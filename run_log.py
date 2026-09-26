#!/usr/bin/env python3
"""GitHub Actions の1回の実行の成績を Supabase に残す（1回=1行＋カテゴリごとの行）。

    python run_log.py results             # report ジョブの最後「Record run (always)」で呼ぶ
    python run_log.py results --dry-run   # 送らずに、組み立てた行を表示するだけ
    python run_log.py results --mail-result=PATH   # 手元で試す時にメール結果のファイルを差し替える

読むもの:
  - results/**/result_<cat>.json と results/**/logs/<cat>.log（download-artifact の置き場所）
  - この実行のジョブ一覧（GitHub API。GH_TOKEN が無ければ gh コマンド）
  - logs/mail_result.json（actions_report.py が書く。無ければ mail_sent = null）
書く先:
  うちなーらいふDB の uchina_scrape_runs / uchina_scrape_run_categories
  （関数 uchina_log_scrape_run 経由・合言葉 UCHINA_RUN_LOG_TOKEN つき。同じ run_id は上書き）

記録に失敗しても例外で落とさず、失敗の内容を標準出力に出して終了コード 0 で終わる
（メール送信や本体の結果を巻き込まない）。埋め戻し（tools/backfill_runs.py）も
ここの組み立て関数をそのまま使う。
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
MAIL_RESULT_PATH = os.path.join(PROJECT_DIR, "logs", "mail_result.json")
TOKEN_FILE = os.path.expanduser("~/.claude/secrets/uchinalife/run_log_token")  # 手元で試す時だけ使う
JST = timezone(timedelta(hours=9))

# result_<cat>.json の鍵 → 表の列（ここに無い鍵は extra に入る）
COLLECTION_COLS = {
    "expected": "expected", "collected": "collected", "complete": "complete", "method": "method",
    "seconds": "seconds", "retries": "retries", "chunks": "chunks", "requests": "requests",
    "api_problems": "api_problems",
}
BY_CATEGORY_COLS = {
    "new": "new_count", "sold": "sold_count", "sold_candidates": "sold_candidates",
    "sold_confirmed": "sold_confirmed", "sold_still_listed": "sold_still_listed", "sold_held": "sold_held",
    "sold_controls_ok": "sold_controls_ok", "reactivated": "reactivated", "scrape_errors": "scrape_errors",
}
SYNC_COLS = {
    "rows": "sync_rows", "written": "sync_written", "outliers": "sync_outliers", "ended": "sync_ended",
    "finalized": "sync_finalized", "error": "sync_error",
}
# 列の型（jsonb_populate_record に渡す前に揃える。int 列に 5.0 を渡すと落ちる）
INT_COLS = {"expected", "collected", "retries", "chunks", "requests", "new_count", "sold_count",
            "sold_candidates", "sold_confirmed", "sold_still_listed", "sold_held", "reactivated",
            "scrape_errors", "sync_rows", "sync_written", "sync_outliers", "sync_ended"}
BOOL_COLS = {"complete", "sold_controls_ok", "sync_finalized"}
NUM_COLS = {"seconds", "elapsed_seconds", "job_minutes"}
# 個別の物件（題名・価格・URL）や数千件のリンクは記録に持ち込まない（件数だけ extra に残す）
BULKY_KEYS = {"sold_properties", "links"}


# ───────────────────────── 共通の小道具 ─────────────────────────

def _load_env() -> None:
    """手元で動かす時だけ .env を読む（既にある環境変数は上書きしない）。"""
    try:
        from notify_failure import _load_env as load
        load()
    except Exception:
        pass


def parse_ts(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def iso(dt: datetime | None) -> str | None:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds") if dt else None


def minutes(start: datetime | None, end: datetime | None) -> float | None:
    if not (start and end):
        return None
    return round((end - start).total_seconds() / 60, 1)


def _cast(col: str, v: Any) -> Any:
    if v is None:
        return None
    try:
        if col in INT_COLS:
            return int(v)
        if col in BOOL_COLS:
            return bool(v)
        if col in NUM_COLS:
            return float(v)
        if col == "api_problems":
            return [str(x)[:300] for x in v] if isinstance(v, list) else [str(v)[:300]]
        if col == "sync_error":
            return str(v)[:300]
    except (TypeError, ValueError):
        return None
    return v


def category_names() -> tuple[list[str], dict[str, str]]:
    from config import config
    return list(config.CATEGORIES), dict(config.GENRE_NAMES)


def job_category(name: str, cats: list[str]) -> str | None:
    """ジョブ名 → カテゴリ。'scrape (house)'・旧方式の 'jukyo-collect (1-27)' / 'jukyo' に対応。"""
    name = (name or "").strip()
    m = re.fullmatch(r"scrape \((\w+)\)", name) or re.fullmatch(r"(\w+)-collect \(.*\)", name) \
        or re.fullmatch(r"(\w+)", name)
    if m and m.group(1) in cats:
        return m.group(1)
    return None


_TS_PREFIX = re.compile(r"^\d{4}-\d\d-\d\dT[\d:.]+Z ", re.M)


def parse_category_log(text: str) -> dict[str, int | None]:
    """スクレイパーのログから、画面に出すだけだった数を拾う（古い実行の埋め戻し用）。

    reactivated   … '♻️  Reactivated N listed properties' の N。行が無くスナップショットを
                    保存していれば 0（戻す物件が無かった）。保存していなければ None。
    scrape_errors … '✓ Category X complete:' の直後の 'Errors: N'。取得する物件が無ければ 0。
    """
    text = _TS_PREFIX.sub("", text or "")
    out: dict[str, int | None] = {"reactivated": None, "scrape_errors": None}
    m = re.search(r"Reactivated (\d+) listed properties", text)
    if m:
        out["reactivated"] = int(m.group(1))
    elif "Saved link snapshot to database" in text:
        out["reactivated"] = 0
    m = re.search(r"✓ Category \w+ complete:\s*\n\s*Scraped: (\d+)\s*\n\s*Errors: (\d+)", text)
    if m:
        out["scrape_errors"] = int(m.group(2))
    elif "No new properties to scrape" in text:
        out["scrape_errors"] = 0
    return out


def find_category_logs(results_dir: str, cats: list[str]) -> dict[str, str]:
    """results/**/logs/<cat>.log を読む（無いカテゴリは入らない）。"""
    out: dict[str, str] = {}
    for root, _, files in os.walk(results_dir or ""):
        for fn in files:
            cat = fn[:-4] if fn.endswith(".log") else None
            if cat in cats and os.path.basename(root) == "logs":
                try:
                    with open(os.path.join(root, fn), encoding="utf-8", errors="replace") as f:
                        out[cat] = f.read()
                except OSError:
                    pass
    return out


def load_results_safe(results_dir: str) -> tuple[dict[str, dict], list[str]]:
    """actions_report.load_results と同じ集め方。壊れたファイルは飛ばして理由を返す。"""
    import glob
    results: dict[str, dict] = {}
    notes: list[str] = []
    for path in glob.glob(os.path.join(results_dir or "", "**", "result_*.json"), recursive=True):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            notes.append(f"{os.path.basename(path)} を読めません: {e}")
            continue
        for cat in data.get("categories", []):
            results[cat] = data
    return results, notes


# ───────────────────────── 行の組み立て ─────────────────────────

def _group_jobs(jobs: list[dict], cats: list[str]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for j in jobs:
        if j.get("conclusion") == "skipped":
            continue
        c = job_category(j.get("name", ""), cats)
        if c:
            grouped.setdefault(c, []).append(j)
    return grouped


def _worst(conclusions: list[str | None]) -> str | None:
    if not conclusions:
        return None
    for bad in ("failure", "timed_out", "startup_failure", "cancelled", "action_required", "neutral", None):
        if bad in conclusions:
            return bad or "in_progress"
    return "success" if all(c == "success" for c in conclusions) else conclusions[0]


def build_category_rows(results: dict[str, dict], jobs: list[dict],
                        logs_by_cat: dict[str, str] | None = None) -> list[dict]:
    """カテゴリごとの行。結果ファイルが無い（台が落ちた）カテゴリも、ジョブがあれば1行作る。"""
    cats, _ = category_names()
    logs_by_cat = logs_by_cat or {}
    grouped = _group_jobs(jobs, cats)
    rows: list[dict] = []
    for cat in cats:
        d = results.get(cat)
        cjobs = grouped.get(cat, [])
        if d is None and not cjobs:
            continue
        row: dict[str, Any] = {"category": cat}
        extra: dict[str, Any] = {}

        starts = [parse_ts(j.get("started_at")) for j in cjobs]
        ends = [parse_ts(j.get("completed_at")) for j in cjobs]
        starts, ends = [s for s in starts if s], [e for e in ends if e]
        row["job_conclusion"] = _worst([j.get("conclusion") for j in cjobs])
        row["job_started_at"] = iso(min(starts)) if starts else None
        row["job_finished_at"] = iso(max(ends)) if ends else None
        row["job_minutes"] = minutes(min(starts), max(ends)) if starts and ends else None
        if len(cjobs) > 1:  # 旧方式（住居を3台で分担＋まとめ役）
            extra["jobs"] = [{"name": j.get("name"), "conclusion": j.get("conclusion")} for j in cjobs]

        if d is not None:
            col = (d.get("collection") or {}).get(cat) or {}
            for k, v in col.items():
                if k == "market_sync":
                    for sk, sv in (v or {}).items():
                        if sk in SYNC_COLS:
                            row[SYNC_COLS[sk]] = sv
                        else:
                            extra[f"sync_{sk}"] = sv
                elif k in COLLECTION_COLS:
                    row[COLLECTION_COLS[k]] = v
                else:
                    extra[k] = v
            bc = (d.get("by_category") or {}).get(cat)
            for k, v in (bc or {}).items():
                if k in BY_CATEGORY_COLS:
                    row[BY_CATEGORY_COLS[k]] = v
                else:
                    extra[k] = v
            for k, v in d.items():
                if k in ("categories", "collection", "by_category"):
                    continue
                if k == "elapsed_seconds":
                    row["elapsed_seconds"] = v
                elif k in BULKY_KEYS:
                    extra[f"{k}_count"] = len(v) if isinstance(v, (list, dict)) else None
                else:
                    extra[k] = v
            # 再掲載数・取得エラー数が結果ファイルに無い（古い実行）ときはログから拾う
            if bc is not None and cat in logs_by_cat:
                parsed = parse_category_log(logs_by_cat[cat])
                for k in ("reactivated", "scrape_errors"):
                    if k not in bc and parsed[k] is not None:
                        row[k] = parsed[k]
                        extra.setdefault("from_log", []).append(k)
        row["extra"] = extra or None
        rows.append({k: _cast(k, v) if k != "extra" else v for k, v in row.items()})
    return rows


def _sum(rows: list[dict], key: str) -> int | None:
    vals = [r[key] for r in rows if r.get(key) is not None]
    return sum(vals) if vals else None


def mail_fields(mail: dict | None, mode: str | None) -> tuple[bool | None, str]:
    """(mail_sent, mail_detail)。mail が None = 送信の記録が無い。"""
    if mail is None:
        if mode in ("full", "mail-test"):
            return None, "送信結果の記録なし（送る前に止まった可能性）"
        return None, f"メール送信の工程なし（{mode or '不明'}）"
    kind = {"daily_report": "日報", "failure_alert": "全カテゴリ失敗の知らせ",
            "mail-test": "試験メール", "error": "送信前に停止"}.get(mail.get("kind"), mail.get("kind") or "メール")
    if mail.get("via") == "skipped":
        return False, f"{kind}: 省略（本日は送信済み）"
    via = {"relay": "東京の中継", "smtp": "SMTP直送"}.get(mail.get("via"), mail.get("via"))
    if mail.get("sent"):
        where = f"{via}・{mail['region']}" if mail.get("region") else (via or "経路不明")
        tries = f"・{mail['attempts']}回目で成功" if (mail.get("attempts") or 1) > 1 else ""
        return True, f"{kind}: 送信済み（{where}{tries}）"
    err = (mail.get("error") or "").strip()
    return False, f"{kind}: 送信失敗（終了コード {mail.get('exit_code')}{'・' + via if via else ''}）" + (f": {err}" if err else "")


def build_run_row(*, meta: dict, results: dict[str, dict], jobs: list[dict], cat_rows: list[dict],
                  mail: dict | None, mode: str | None, sold_mode: str | None, source: str,
                  sold_dry_run: bool, skip_sold: bool, conclusion: str | None,
                  now: datetime | None = None) -> dict:
    """実行1回分の行。meta = run_id / run_number / run_attempt / event / head_sha / run_url / created_at / run_started_at。"""
    from actions_report import build_problems, build_status
    cats, names = category_names()
    now = now or datetime.now(timezone.utc)

    machines = [j for j in jobs if j.get("name") != "report" and j.get("conclusion") != "skipped"]
    report = next((j for j in jobs if j.get("name") == "report"), None)
    starts = [s for s in (parse_ts(j.get("started_at")) for j in machines) if s]
    ends = [e for e in (parse_ts(j.get("completed_at")) for j in machines) if e]
    if not starts and report:  # mail-test など収集の台が無い実行は report ジョブの時間
        starts = [s for s in [parse_ts(report.get("started_at"))] if s]
        ends = [e for e in [parse_ts(report.get("completed_at")) or now] if e]
    started, finished = (min(starts) if starts else None), (max(ends) if ends else None)

    run_started = parse_ts(meta.get("run_started_at")) or parse_ts(meta.get("created_at")) or started or now
    if mode == "mail-test":
        problems: list[str] = []
        status = "メール試験のみ（収集なし）"
    else:
        problems = build_problems(results, sold_dry_run=sold_dry_run, skip_sold=skip_sold, names=names)
        status = build_status(problems, meta.get("run_url") or "")
    mail_sent, mail_detail = mail_fields(mail, mode)

    return {
        "run_id": int(meta["run_id"]),
        "run_number": int(meta["run_number"]) if meta.get("run_number") else None,
        "run_attempt": int(meta["run_attempt"]) if meta.get("run_attempt") else None,
        "event": meta.get("event"),
        "mode": mode,
        "sold_mode": sold_mode,
        "head_sha": meta.get("head_sha"),
        "run_url": meta.get("run_url"),
        "snapshot_date": run_started.astimezone(JST).date().isoformat(),
        "created_at": iso(parse_ts(meta.get("created_at"))),
        "started_at": iso(started),
        "finished_at": iso(finished),
        "total_minutes": minutes(started, finished),
        "conclusion": conclusion,
        "jobs_ok": sum(1 for j in machines if j.get("conclusion") == "success"),
        "jobs_total": len(machines),
        "status_text": status,
        "problems": problems,
        "expected_total": _sum(cat_rows, "expected"),
        "collected_total": _sum(cat_rows, "collected"),
        "new_total": _sum(cat_rows, "new_count"),
        "sold_total": _sum(cat_rows, "sold_count"),
        "reactivated_total": _sum(cat_rows, "reactivated"),
        "mail_sent": mail_sent,
        "mail_detail": mail_detail,
        "source": source,
    }


# ───────────────────────── 外とのやりとり ─────────────────────────

def gh_api(path: str) -> Any:
    """GitHub API（GET）。GH_TOKEN があれば直接、無ければ gh コマンドで。"""
    token = os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN")
    if token:
        import urllib.request
        req = urllib.request.Request(
            f"https://api.github.com/{path.lstrip('/')}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                     "User-Agent": "uchinalife-scraper"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    out = subprocess.run(["gh", "api", path], capture_output=True, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(f"gh api {path}: {out.stderr.decode('utf-8', 'replace')[:200]}")
    return json.loads(out.stdout)


def fetch_run(repo: str, run_id: str | int) -> tuple[dict, list[dict]]:
    run = gh_api(f"repos/{repo}/actions/runs/{run_id}")
    jobs = gh_api(f"repos/{repo}/actions/runs/{run_id}/jobs?per_page=100").get("jobs", [])
    return run, jobs


def send_record(run_row: dict, cat_rows: list[dict]) -> tuple[bool, str]:
    """uchina_log_scrape_run を呼ぶ。(成功したか, 説明)。例外は投げない。"""
    import urllib.error
    import urllib.request
    _load_env()
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY")
    token = (os.getenv("UCHINA_RUN_LOG_TOKEN") or "").strip()
    if not token and os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, encoding="utf-8") as f:
            token = f.read().strip()
    missing = [k for k, v in (("SUPABASE_URL", url), ("SUPABASE_ANON_KEY", key), ("UCHINA_RUN_LOG_TOKEN", token)) if not v]
    if missing:
        return False, f"環境変数がありません: {', '.join(missing)}"
    body = json.dumps({"p_token": token, "p_run": run_row, "p_categories": cat_rows},
                      ensure_ascii=False, default=str).encode("utf-8")
    last = ""
    for attempt in range(1, 4):
        req = urllib.request.Request(
            f"{url.rstrip('/')}/rest/v1/rpc/uchina_log_scrape_run", data=body, method="POST",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                     "User-Agent": "uchinalife-scraper/run-log"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                n = json.loads(r.read().decode("utf-8"))
            if n == -1:
                return True, f"run_id={run_row['run_id']} は本番記録（live）があるため埋め戻しで上書きしませんでした"
            return True, f"run_id={run_row['run_id']} を記録（カテゴリ {n} 行・{run_row['source']}）"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}"
            if e.code < 500:
                break  # 合言葉違い・形の誤りは何度送っても同じ
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
        if attempt < 3:
            time.sleep(5 * attempt)
    return False, last


def read_mail_result(path: str = MAIL_RESULT_PATH) -> dict | None:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as e:
        return {"kind": "error", "sent": None, "error": f"mail_result.json を読めません: {e}"}


def derive_conclusion(jobs: list[dict], job_status: str | None) -> str | None:
    """実行中（report ジョブの最後）なので、実行全体の結論は各台＋report の途中経過から出す。"""
    concl = [j.get("conclusion") for j in jobs if j.get("name") != "report" and j.get("conclusion") != "skipped"]
    if job_status:
        concl.append(job_status.lower())
    if any(c in ("failure", "timed_out", "startup_failure") for c in concl):
        return "failure"
    if "cancelled" in concl:
        return "cancelled"
    if concl and all(c == "success" for c in concl):
        return "success"
    return None


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in argv
    # --mail-result=PATH … 手元で試す時に、logs/mail_result.json の代わりに読むファイル
    mail_path = next((a.split("=", 1)[1] for a in argv if a.startswith("--mail-result=")), MAIL_RESULT_PATH)
    results_dir = args[0] if args else "results"
    try:
        _load_env()
        cats, _ = category_names()
        repo = os.getenv("GITHUB_REPOSITORY", "smaho119119-gif/uchinalife-scraper")
        run_id = os.getenv("GITHUB_RUN_ID")
        if not run_id:
            print("実行記録: GITHUB_RUN_ID がありません（Actions の外では tools/backfill_runs.py を使う）")
            return 0
        run: dict = {}
        jobs: list[dict] = []
        try:
            run, jobs = fetch_run(repo, run_id)
        except Exception as e:
            print(f"実行記録: ジョブ一覧を取れませんでした（時刻・台の結果は空で記録）: {e}")
        results, notes = load_results_safe(results_dir)
        for n in notes:
            print(f"実行記録: {n}")
        server = os.getenv("GITHUB_SERVER_URL", "https://github.com")
        meta = {
            "run_id": run_id,
            "run_number": os.getenv("GITHUB_RUN_NUMBER") or run.get("run_number"),
            "run_attempt": os.getenv("GITHUB_RUN_ATTEMPT") or run.get("run_attempt"),
            "event": os.getenv("GITHUB_EVENT_NAME") or run.get("event"),
            "head_sha": os.getenv("GITHUB_SHA") or run.get("head_sha"),
            "run_url": f"{server}/{repo}/actions/runs/{run_id}",
            "created_at": run.get("created_at"),
            "run_started_at": run.get("run_started_at"),
        }
        cat_rows = build_category_rows(results, jobs, find_category_logs(results_dir, cats))
        mode = os.getenv("MODE") or None
        run_row = build_run_row(
            meta=meta, results=results, jobs=jobs, cat_rows=cat_rows,
            mail=read_mail_result(mail_path), mode=mode, sold_mode=os.getenv("SOLD_MODE") or None, source="live",
            sold_dry_run=os.getenv("SCRAPER_SOLD_DRY_RUN") == "1", skip_sold=os.getenv("SCRAPER_SKIP_SOLD") == "1",
            conclusion=derive_conclusion(jobs, os.getenv("JOB_STATUS")))
        if dry:
            print(json.dumps({"run": run_row, "categories": cat_rows}, ensure_ascii=False, indent=1, default=str))
            return 0
        ok, msg = send_record(run_row, cat_rows)
        print(("実行記録: " if ok else "⚠️ 実行記録に失敗: ") + msg, flush=True)
    except Exception as e:
        print(f"⚠️ 実行記録に失敗（組み立て中）: {e!r}", flush=True)
        traceback.print_exc(file=sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
