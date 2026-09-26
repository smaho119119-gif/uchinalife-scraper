#!/usr/bin/env python3
"""scrape-parallel.yml の過去の実行を、実行記録（uchina_scrape_runs / _categories）に埋め戻す。

    python tools/backfill_runs.py                        # 完了した全実行
    python tools/backfill_runs.py --run 36192412849      # 指定した実行だけ（複数可）
    python tools/backfill_runs.py --dry-run              # 送らずに組み立てた中身を表示
    python tools/backfill_runs.py --force                # artifact 期限切れの実行も上書きする

1回ごとに:
  - GitHub API … 実行の情報（番号・きっかけ・結論・時刻）と各台の時刻・結論
  - artifact result-<cat> … result_<cat>.json と logs/<cat>.log を $TMPDIR 以下へ落として読む（終わったら消す）
  - report ジョブのログ … MODE / SOLD_MODE / SCRAPER_* の値、メール送信の結果
    （"alert sent via relay (hnd1)"・"smtp send failed … 554" など）
  - 結果ファイルに無い再掲載数・取得エラー数は logs/<cat>.log（無ければそのジョブのログ）から拾う
組み立ては run_log.py と同じ関数を使い、source='backfill' で記録する。
同じ実行を何度流しても行は増えない（run_id で上書き）。本番記録（live）がある実行は上書きしない。
artifact が無い実行（mail-test など）も、ジョブとログから分かる範囲で1行残す。
ただし artifact が保存期限（14日）切れの実行は、前に入れた件数を薄い行で上書きしないよう飛ばす（--force で上書き）。

必要なもの: gh（ログイン済み）、.env の SUPABASE_URL / SUPABASE_ANON_KEY、
合言葉（UCHINA_RUN_LOG_TOKEN か ~/.claude/secrets/uchinalife/run_log_token）。
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_DIR)

import run_log  # noqa: E402

REPO = os.getenv("GITHUB_REPOSITORY", "smaho119119-gif/uchinalife-scraper")
WORKFLOW = "scrape-parallel.yml"
ENV_KEYS = ("MODE", "SOLD_MODE", "SCRAPER_SKIP_SOLD", "SCRAPER_SOLD_DRY_RUN", "SCRAPER_ALLOW_MASS_SOLD")
_TS = re.compile(r"^\d{4}-\d\d-\d\dT[\d:.]+Z ?")


def list_runs() -> list[dict]:
    runs: list[dict] = []
    page = 1
    while True:
        data = run_log.gh_api(f"repos/{REPO}/actions/workflows/{WORKFLOW}/runs?per_page=100&page={page}")
        batch = data.get("workflow_runs", [])
        runs.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return [r for r in runs if r.get("status") == "completed"]


def job_log(job_id: int) -> str | None:
    out = subprocess.run(["gh", "api", f"repos/{REPO}/actions/jobs/{job_id}/logs"], capture_output=True, timeout=120)
    if out.returncode != 0:
        return None
    return out.stdout.decode("utf-8", "replace")


def _lines(text: str) -> list[str]:
    return [_TS.sub("", ln) for ln in (text or "").splitlines()]


def env_from_log(text: str) -> dict[str, str]:
    """ステップ見出しの下に並ぶ env（'  MODE: full'）の最初の値。"""
    found: dict[str, str] = {}
    for ln in _lines(text):
        m = re.fullmatch(r"\s+([A-Z_]+):\s?(.*)", ln)
        if m and m.group(1) in ENV_KEYS and m.group(1) not in found:
            found[m.group(1)] = m.group(2).strip()
    return found


def mail_from_log(text: str, kind: str) -> dict | None:
    """report ジョブのメール送信ステップ（'Run mkdir -p logs' で始まる段）から送信結果を読む。"""
    steps: list[list[str]] = []
    cur: list[str] | None = None
    for ln in _lines(text):
        if ln.startswith("##[group]Run "):
            cur = [ln]
            steps.append(cur)
        elif cur is not None:
            cur.append(ln)
    mail_steps = [s for s in steps if any(k in "\n".join(s) for k in
                                          ("mkdir -p logs", "actions_report.py", "notify_failure import send"))]
    if not mail_steps:
        return None
    body = [ln for s in mail_steps for ln in s]
    res: dict = {"kind": kind, "sent": None, "exit_code": None, "via": None, "region": None,
                 "attempts": None, "error": None}
    failures = 0
    for ln in body:
        m = re.search(r"alert sent via relay \(([^)]*)\)", ln)
        if m:
            res.update(sent=True, via="relay", region=m.group(1) or None, exit_code=0)
            continue
        if "alert sent to " in ln:
            res.update(sent=True, via="smtp", exit_code=0)
            continue
        m = re.search(r"(relay|smtp) send failed \(attempt (\d)/3\): (.*)", ln)
        if m:
            failures += 1
            res.update(via=m.group(1), error=m.group(3).strip()[:300])
            continue
        if "missing SMTP env vars" in ln:
            res.update(sent=False, via="smtp", exit_code=2, error=ln.strip()[:300])
            continue
        if "alert already sent today" in ln:
            res.update(sent=False, via="skipped", exit_code=0, error="本日は送信済みのため省略")
            continue
        m = re.search(r"##\[error\]Process completed with exit code (\d+)", ln)
        if m:
            res["exit_code"] = int(m.group(1))
    if res["sent"] is None and res["error"] is None and res["exit_code"] is None:
        return None  # 送信の行が無い（ステップが走っていない）
    if res["sent"] is None:
        res["sent"] = False
    res["attempts"] = failures + 1 if res["sent"] else (failures or None)
    return res


def sold_mode_of(env: dict[str, str]) -> str | None:
    if env.get("SOLD_MODE"):
        return env["SOLD_MODE"]
    if env.get("SCRAPER_SKIP_SOLD") == "1":
        return "skip"
    if env.get("SCRAPER_SOLD_DRY_RUN") == "1":
        return "dry-run"
    return None  # SOLD_MODE を入れる前の実行（判定の方式は記録なし）


def backfill_one(run: dict, dry: bool, force: bool = False) -> tuple[bool, str]:
    run_id = run["id"]
    _, jobs = run_log.fetch_run(REPO, run_id)
    cats, _ = run_log.category_names()
    tmp = tempfile.mkdtemp(prefix=f"uchina-backfill-{run_id}-")
    try:
        results_dir = os.path.join(tmp, "results")
        dl = subprocess.run(["gh", "run", "download", str(run_id), "-R", REPO, "-D", results_dir, "-p", "result-*"],
                            capture_output=True, timeout=300)
        results, notes = run_log.load_results_safe(results_dir)
        if not results and not force:
            # artifact の保存期限（14日）切れで、前に記録した件数をジョブだけの薄い行で上書きしない
            arts = run_log.gh_api(f"repos/{REPO}/actions/runs/{run_id}/artifacts?per_page=100").get("artifacts", [])
            if any(a.get("expired") for a in arts):
                msg = "artifact の保存期限切れのため上書きしません（--force で上書き）"
                print(f"#{run.get('run_number')} {run_id} → {msg}", flush=True)
                return True, msg
        logs = run_log.find_category_logs(results_dir, cats)
        # artifact にログが無いカテゴリは、そのカテゴリのジョブのログから拾う
        grouped = run_log._group_jobs(jobs, cats)
        for cat in results:
            if cat not in logs and grouped.get(cat):
                text = job_log(grouped[cat][-1]["id"])
                if text:
                    logs[cat] = text

        report = next((j for j in jobs if j.get("name") == "report"), None)
        rlog = job_log(report["id"]) if report else None
        env = env_from_log(rlog or "")
        if not env.get("MODE"):  # report のログが無い時は最初の台のログから
            for j in jobs:
                if j.get("name") != "report" and j.get("conclusion") != "skipped":
                    env = env_from_log(job_log(j["id"]) or "")
                    break
        mode = env.get("MODE") or None
        kind = "mail-test" if mode == "mail-test" else ("failure_alert" if not results else "daily_report")
        mail = mail_from_log(rlog or "", kind)

        meta = {
            "run_id": run_id, "run_number": run.get("run_number"), "run_attempt": run.get("run_attempt"),
            "event": run.get("event"), "head_sha": run.get("head_sha"), "run_url": run.get("html_url"),
            "created_at": run.get("created_at"), "run_started_at": run.get("run_started_at"),
        }
        cat_rows = run_log.build_category_rows(results, jobs, logs)
        run_row = run_log.build_run_row(
            meta=meta, results=results, jobs=jobs, cat_rows=cat_rows, mail=mail, mode=mode,
            sold_mode=sold_mode_of(env), source="backfill",
            sold_dry_run=env.get("SCRAPER_SOLD_DRY_RUN") == "1", skip_sold=env.get("SCRAPER_SKIP_SOLD") == "1",
            conclusion=run.get("conclusion"))
        head = (f"#{run.get('run_number')} {run_id} {run_row['snapshot_date']} {run.get('event')} mode={mode} "
                f"sold={run_row['sold_mode']} 台={run_row['jobs_ok']}/{run_row['jobs_total']} "
                f"結果ファイル={len(results)} メール={run_row['mail_sent']}")
        if dl.returncode != 0 and not results:
            head += "（artifact なし）"
        for n in notes:
            head += f"\n    {n}"
        if dry:
            print(head)
            print(json.dumps({"run": run_row, "categories": cat_rows}, ensure_ascii=False, default=str)[:3000])
            return True, "dry-run"
        ok, msg = run_log.send_record(run_row, cat_rows)
        print(head + "\n    → " + msg, flush=True)
        return ok, msg
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    force = "--force" in argv
    wanted = {int(argv[i + 1]) for i, a in enumerate(argv) if a == "--run" and i + 1 < len(argv)}
    runs = list_runs()
    if wanted:
        runs = [r for r in runs if r["id"] in wanted]
    runs.sort(key=lambda r: r["run_number"])
    print(f"対象 {len(runs)} 回（{WORKFLOW}）", flush=True)
    failed = 0
    for r in runs:
        try:
            ok, _ = backfill_one(r, dry, force)
        except Exception as e:
            ok = False
            print(f"#{r.get('run_number')} {r['id']} → 失敗: {e!r}", flush=True)
        failed += 0 if ok else 1
    print(f"完了: {len(runs) - failed} 回成功 / {failed} 回失敗", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
