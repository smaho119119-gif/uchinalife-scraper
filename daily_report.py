#!/usr/bin/env python3
"""Daily scrape result email — phone-friendly plain text.

Called from integrated_scraper.py after a successful run. Emits one
mail to ALERT_TO via the same XServer SMTP relay used by notify_failure.py.

Layout is plain text with sparing emoji so iOS / Android default mail clients
render it predictably without HTML quirks. Subject line carries the headline
counts so the push notification preview is useful on its own.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Iterable

from notify_failure import send

# Category metadata: emoji + display order
CATEGORY_META = {
    "house":   ("🏠", "戸建"),
    "tochi":   ("🏞️", "土地"),
    "jukyo":   ("🏘️", "住居"),
    "mansion": ("🏢", "マンション"),
    "jigyo":   ("💼", "事業用"),
    "parking": ("🚗", "時間貸"),
    "sonota":  ("🛣️", "その他"),
    "yard":    ("🅿️", "月極"),
}


def _parse_price_yen(price_str: str | None) -> float | None:
    """Convert e-uchina.net price strings ("3,200万円", "1億2,000万円") to yen.

    Returns None if the string can't be parsed — those rows fall to the
    bottom of the sort instead of crashing the report.
    """
    if not price_str or not isinstance(price_str, str):
        return None
    s = price_str.replace(",", "").replace(" ", "")
    total = 0.0
    matched = False

    m = re.search(r"(\d+(?:\.\d+)?)億", s)
    if m:
        total += float(m.group(1)) * 100_000_000
        matched = True

    m = re.search(r"(\d+(?:\.\d+)?)万", s)
    if m:
        total += float(m.group(1)) * 10_000
        matched = True

    if not matched:
        m = re.search(r"(\d+(?:\.\d+)?)", s)
        if m:
            return float(m.group(1))
        return None

    return total


def _format_yen(yen: float | None) -> str:
    if yen is None or yen <= 0:
        return "価格不明"
    if yen >= 100_000_000:
        oku = yen / 100_000_000
        return f"{oku:.2f}".rstrip("0").rstrip(".") + "億円"
    if yen >= 10_000:
        man = yen / 10_000
        return f"{man:,.0f}万円"
    return f"{yen:,.0f}円"


def _truncate(s: str | None, limit: int = 40) -> str:
    if not s:
        return "(タイトル不明)"
    s = s.replace("\n", " ").strip()
    return s if len(s) <= limit else s[: limit - 1] + "…"


def build_subject(date_str: str, total_new: int, total_sold: int,
                  by_category: dict[str, dict[str, int]]) -> str:
    # Highest-traffic category for the day shown in subject for at-a-glance push
    top_cat = None
    if by_category:
        top_cat = max(by_category.items(),
                      key=lambda kv: kv[1].get("new", 0) + kv[1].get("sold", 0))[0]
    top_label = CATEGORY_META.get(top_cat, ("", ""))[1] if top_cat else ""
    suffix = f" ({top_label})" if top_label else ""
    return f"[{date_str}] 🆕{total_new} ❌{total_sold}{suffix}"


def build_body(
    date_str: str,
    total_new: int,
    total_sold: int,
    by_category: dict[str, dict[str, int]],
    sold_top: list[dict],
    elapsed_seconds: int,
    status: str = "成功",
) -> str:
    HR = "━━━━━━━━━━━━━━━━━━━"
    lines: list[str] = []
    lines.append(f"🏝️ うちなーらいふ {date_str}")
    lines.append("")
    lines.append(f"🆕 新着合計: {total_new}")
    lines.append(f"❌ 失効合計: {total_sold}")
    lines.append("")
    lines.append(HR)

    # Per-category counts (descending by activity)
    sorted_cats = sorted(
        by_category.items(),
        key=lambda kv: kv[1].get("new", 0) + kv[1].get("sold", 0),
        reverse=True,
    )
    for cat, counts in sorted_cats:
        emoji, label = CATEGORY_META.get(cat, ("•", cat))
        new_n = counts.get("new", 0)
        sold_n = counts.get("sold", 0)
        # Pad label to align numbers visually on phone
        lines.append(f"{emoji} {label:<6} {new_n:>4} / {sold_n:>4}")
    lines.append(HR)

    h, rem = divmod(max(elapsed_seconds, 0), 3600)
    m, _ = divmod(rem, 60)
    elapsed_label = f"{h}h{m:02d}m" if h else f"{m}m"
    lines.append(f"所要時間: {elapsed_label}")
    lines.append(f"ステータス: ✅ {status}" if status == "成功" else f"ステータス: ⚠️ {status}")

    if sold_top:
        lines.append("")
        lines.append("📈 失効物件 Top 10 (高額順)")
        lines.append("")
        for i, item in enumerate(sold_top, 1):
            emoji, _ = CATEGORY_META.get(item.get("category", ""), ("🔹", ""))
            title = _truncate(item.get("title"), 40)
            price = _format_yen(item.get("price_yen"))
            url = item.get("url", "")
            lines.append(f"{i}. {emoji} {title}")
            lines.append(f"   {price}")
            if url:
                lines.append(f"   {url}")
            lines.append("")

    lines.append(HR)
    lines.append("詳細ログ:")
    lines.append("~/Documents/うちなーらいふスクレイピング/logs/")
    return "\n".join(lines)


def send_daily_report(
    *,
    by_category: dict[str, dict[str, int]],
    sold_properties: Iterable[dict],
    elapsed_seconds: int,
    status: str = "成功",
) -> int:
    """Build & send. Idempotency is intentionally NOT applied here — failure
    mail uses the per-day flag, but successful daily reports should be sent
    every run (one per launchd job)."""
    date_str = datetime.now().strftime("%-m/%-d")
    total_new = sum(c.get("new", 0) for c in by_category.values())
    total_sold = sum(c.get("sold", 0) for c in by_category.values())

    # Score & sort sold properties by parsed price
    enriched: list[dict] = []
    for p in sold_properties:
        if not p:
            continue
        yen = _parse_price_yen(p.get("price"))
        enriched.append({
            "url": p.get("url"),
            "title": p.get("title"),
            "category": p.get("category"),
            "price_raw": p.get("price"),
            "price_yen": yen,
        })
    enriched.sort(key=lambda x: x["price_yen"] or -1, reverse=True)
    top10 = enriched[:10]

    subject = build_subject(date_str, total_new, total_sold, by_category)
    body = build_body(
        date_str=date_str,
        total_new=total_new,
        total_sold=total_sold,
        by_category=by_category,
        sold_top=top10,
        elapsed_seconds=elapsed_seconds,
        status=status,
    )
    # force=True so a successful daily report isn't silenced by an earlier
    # failure-alert flag on the same day
    return send(subject, body, force=True)


if __name__ == "__main__":
    # Manual smoke test
    sample_by_cat = {
        "house":   {"new": 254, "sold": 172},
        "tochi":   {"new": 165, "sold": 148},
        "jukyo":   {"new":  88, "sold": 188},
        "mansion": {"new":  63, "sold":  75},
        "jigyo":   {"new":  55, "sold":  41},
        "parking": {"new":  26, "sold":  22},
        "sonota":  {"new":  38, "sold":  50},
        "yard":    {"new":   5, "sold":  16},
    }
    sample_sold = [
        {"url": "https://example.com/1", "title": "サンプル戸建", "category": "house", "price": "9800万円"},
        {"url": "https://example.com/2", "title": "サンプル土地",   "category": "tochi", "price": "1億2000万円"},
        {"url": "https://example.com/3", "title": "サンプル分譲", "category": "mansion", "price": "5,500万円"},
    ]
    sys_exit = send_daily_report(
        by_category=sample_by_cat,
        sold_properties=sample_sold,
        elapsed_seconds=4500,
    )
    raise SystemExit(sys_exit)
