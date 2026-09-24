#!/usr/bin/env python3
"""GitHub Actions: merge per-category results and ALWAYS send one mail.

Each matrix job (one category) writes result_<category>.json via
`integrated_scraper.py --report-json`. This script runs in the final job
(`if: always()`), so it runs even when some or all category jobs failed.

    python actions_report.py <results_dir>

- every category succeeded        → daily report (status 成功)
- some failed / collected partly  → daily report with the problem in status
- nothing succeeded               → failure alert
Exit code is non-zero when the mail could not be sent, so the workflow run
turns red instead of failing silently.
"""
from __future__ import annotations

import glob
import json
import os
import sys

from config import config
from daily_report import send_daily_report
from notify_failure import send

RUN_URL = (
    f"{os.getenv('GITHUB_SERVER_URL', 'https://github.com')}/"
    f"{os.getenv('GITHUB_REPOSITORY', '')}/actions/runs/{os.getenv('GITHUB_RUN_ID', '')}"
)


def _jobs() -> list[dict]:
    """This run's jobs (name, result, start/end) from the GitHub API. [] on any error."""
    import urllib.request
    repo, run_id, token = os.getenv("GITHUB_REPOSITORY"), os.getenv("GITHUB_RUN_ID"), os.getenv("GH_TOKEN")
    if not (repo and run_id and token):
        return []
    try:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/jobs?per_page=50",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                     "User-Agent": "uchinalife-scraper"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8")).get("jobs", [])
    except Exception as e:
        print(f"could not fetch jobs: {e}", file=sys.stderr)
        return []


def _total_minutes(jobs: list[dict]) -> int | None:
    from datetime import datetime
    spans = [(j.get("started_at"), j.get("completed_at")) for j in jobs if j.get("name") != "report"]
    spans = [(s, e) for s, e in spans if s and e]
    if not spans:
        return None
    p = lambda x: datetime.fromisoformat(x.replace("Z", "+00:00"))
    return int((max(p(e) for _, e in spans) - min(p(s) for s, _ in spans)).total_seconds() // 60)


def _html(results: dict[str, dict], jobs: list[dict], status: str, total_minutes: int | None) -> str | None:
    """HTML dashboard; None (text-only mail) if building it fails for any reason."""
    try:
        from html_report import build_html
        return build_html(results=results, jobs=jobs, status=status, run_url=RUN_URL, total_minutes=total_minutes)
    except Exception as e:
        print(f"html report failed, sending text only: {e}", file=sys.stderr)
        return None


def build_details(results: dict[str, dict], names: dict[str, str], jobs: list[dict] | None = None) -> str:
    """Per-machine timings and per-category collection numbers for the mail."""
    from datetime import datetime, timedelta, timezone
    JST = timezone(timedelta(hours=9))

    def t(s):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(JST) if s else None

    lines = ["━━━━━━━━━━━━━━━━━━━", "【実行の詳細（GitHub）】", ""]
    jobs = [j for j in (jobs if jobs is not None else _jobs()) if j.get("name") != "report"]
    if jobs:
        starts = [t(j["started_at"]) for j in jobs if j.get("started_at")]
        ends = [t(j["completed_at"]) for j in jobs if j.get("completed_at")]
        if starts and ends:
            lines.append(f"全体 {min(starts):%H:%M}〜{max(ends):%H:%M}（{int((max(ends) - min(starts)).total_seconds() // 60)}分）")
        ok = sum(1 for j in jobs if j.get("conclusion") == "success")
        lines.append(f"成功 {ok}/{len(jobs)}台")
        lines.append("")
        lines.append("■ 各台の所要時間")
        for j in sorted(jobs, key=lambda j: j.get("name", "")):
            s, e = t(j.get("started_at")), t(j.get("completed_at"))
            mins = f"{(e - s).total_seconds() / 60:.1f}分" if s and e else "-"
            mark = "✅" if j.get("conclusion") == "success" else f"❌{j.get('conclusion')}"
            lines.append(f"{mark} {j.get('name')}  {mins}")
        lines.append("")
    else:
        lines.append("（各台の時間は取得できませんでした）")
        lines.append("")

    lines.append("■ カテゴリ別（サイト件数 / 取得件数）")
    for cat in config.CATEGORIES:
        d = results.get(cat)
        if not d:
            lines.append(f"❌ {names.get(cat, cat)}: 結果なし（失敗）")
            continue
        col = (d.get("collection") or {}).get(cat) or {}
        bc = (d.get("by_category") or {}).get(cat) or {}
        mark = "✅" if col.get("complete") else "⚠️不完全"
        extra = []
        if col.get("shards"):
            extra.append(f"分担{col['shards']}台")
        if col.get("retries"):
            extra.append(f"取り直し{col['retries']}回")
        if col.get("method") == "browser-fallback":
            extra.append("窓口異常→ブラウザ方式")
        lines.append(f"{mark} {names.get(cat, cat)}  {col.get('expected')} / {col.get('collected')}"
                     + (f"（{'・'.join(extra)}）" if extra else ""))
        paused = bc.get("sold_candidates_paused")
        lines.append(f"    新着 {bc.get('new', 0)}  売れた {bc.get('sold', 0)}"
                     + (f"  売れた候補（判定停止中） {paused}" if paused is not None else ""))
    lines.append("")
    lines.append(f"ログ: {RUN_URL}")
    return "\n".join(lines)


def main(results_dir: str) -> int:
    results: dict[str, dict] = {}
    for path in glob.glob(os.path.join(results_dir, "**", "result_*.json"), recursive=True):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        for cat in data.get("categories", []):
            results[cat] = data

    names = config.GENRE_NAMES
    failed = [c for c in config.CATEGORIES if c not in results]
    incomplete = [
        c for c, d in results.items()
        if not (d.get("collection", {}).get(c) or {}).get("complete", True)
    ]

    if not results:
        body = (
            "🚨 うちなーらいふスクレイパー（GitHub Actions）\n"
            "全カテゴリが失敗しました。\n\n"
            f"失敗: {', '.join(names.get(c, c) for c in failed)}\n\n"
            f"ログ: {RUN_URL}\n"
        )
        return send("🚨 うちなーらいふ 全カテゴリ失敗", body, force=True)

    by_category: dict[str, dict[str, int]] = {}
    sold: list[dict] = []
    for cat, d in results.items():
        if cat in d.get("by_category", {}):
            by_category[cat] = d["by_category"][cat]
        sold.extend(d.get("sold_properties", []))  # one category per result file
    elapsed = max(d.get("elapsed_seconds", 0) for d in results.values())
    jobs = _jobs()
    total_minutes = _total_minutes(jobs)
    if total_minutes is not None:
        elapsed = total_minutes * 60  # 全体の時間（最初の台の開始〜最後の台の終了）

    problems = []
    if failed:
        problems.append("失敗: " + "・".join(names.get(c, c) for c in failed))
    fallback = [c for c, d in results.items()
                if ((d.get("collection") or {}).get(c) or {}).get("method") == "browser-fallback"]
    if fallback:
        problems.append("検索窓口の異常でブラウザ方式に切替: " + "・".join(names.get(c, c) for c in fallback))
    if incomplete:
        problems.append("収集途中で打切り(成約判定なし): " + "・".join(names.get(c, c) for c in incomplete))
    def cats_with(key):
        return [(c, (d.get("by_category") or {}).get(c, {}).get(key)) for c, d in results.items()
                if (d.get("by_category") or {}).get(c, {}).get(key)]
    held = cats_with("sold_held_mass")
    if held:
        problems.append("売れた候補が多すぎるため保留: " + "・".join(f"{names.get(c, c)}{n}件" for c, n in held))
    bad_controls = [c for c, d in results.items() if (d.get("by_category") or {}).get(c, {}).get("sold_controls_ok") is False]
    if bad_controls:
        problems.append("判定の物差しが合わず売れた判定を保留: " + "・".join(names.get(c, c) for c in bad_controls))
    if os.getenv("SCRAPER_SOLD_DRY_RUN") == "1":
        would = sum(n for _, n in cats_with("sold_confirmed"))
        problems.append(f"売れた判定は試運転（確認のみ・書き込みなし）: 確定相当 {would}件")
    if os.getenv("SCRAPER_SKIP_SOLD") == "1":
        problems.append("売れた判定は一時停止中（新しい判定を準備中。新着の取り込みは通常どおり）")
    status = "成功" if not problems else " / ".join(problems) + f"\nログ: {RUN_URL}"

    return send_daily_report(
        by_category=by_category,
        sold_properties=sold,
        elapsed_seconds=elapsed,
        status=status,
        appendix=build_details(results, names, jobs),
        html=_html(results, jobs, status, total_minutes),
    )


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "results"))
