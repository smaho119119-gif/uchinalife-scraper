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

    problems = []
    if failed:
        problems.append("失敗: " + "・".join(names.get(c, c) for c in failed))
    if incomplete:
        problems.append("収集途中で打切り(成約判定なし): " + "・".join(names.get(c, c) for c in incomplete))
    status = "成功" if not problems else " / ".join(problems) + f"\nログ: {RUN_URL}"

    return send_daily_report(
        by_category=by_category,
        sold_properties=sold,
        elapsed_seconds=elapsed,
        status=status,
    )


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "results"))
