#!/usr/bin/env python3
"""Daily scrape result email — phone-friendly plain text.

Called from integrated_scraper.py after a successful run. Emits one
mail to ALERT_TO via the same XServer SMTP relay used by notify_failure.py.

Layout is plain text with sparing emoji so iOS / Android default mail clients
render it predictably without HTML quirks. Subject line carries the headline
counts so the push notification preview is useful on its own.

Disappearance classification:
    expiry_date > last_seen_date (or today)  → 🤝 成約 (likely sold/let)
    expiry_date <= last_seen_date            → 📅 掲載終了 (auto-expired)
    expiry_date missing/unparseable          → ❓ 不明 (counted with 掲載終了)
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable

from notify_failure import send

# Category metadata: emoji + display order priority (higher = first)
# Order shown in the per-category breakdown is by activity volume; this
# table only supplies the icon + display label.
CATEGORY_META = {
    "house":   ("🏠", "売買 戸建"),
    "tochi":   ("🏞️", "売買 土地"),
    "mansion": ("🏢", "売買 マンション"),
    "sonota":  ("🛣️", "売買 その他"),
    "jukyo":   ("🏘️", "賃貸 住居"),
    "jigyo":   ("💼", "賃貸 事業用"),
    "parking": ("🚗", "時間貸駐車場"),
    "yard":    ("🅿️", "月極駐車場"),
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


def _parse_date_loose(s: str | None) -> date | None:
    """Accept both YYYY/MM/DD (scraped expiry_date) and YYYY-MM-DD (DB date)."""
    if not s or not isinstance(s, str):
        return None
    for fmt in ("%Y/%m/%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _classify(prop: dict, today: date) -> str:
    """Return '成約' if the URL disappeared with expiry still in the future,
    '掲載終了' if the listing ran out its expiry, '不明' otherwise."""
    exp = _parse_date_loose(prop.get("expiry_date"))
    last = _parse_date_loose(prop.get("last_seen_date")) or today
    if exp is None:
        return "不明"
    return "成約" if exp > last else "掲載終了"


def build_subject(date_str: str, total_new: int, total_sold: int,
                  total_contract: int, by_category: dict[str, dict[str, int]]) -> str:
    # Highest-traffic category for the day — shown in subject so the push
    # preview hints at where the action was.
    top_cat = None
    if by_category:
        top_cat = max(by_category.items(),
                      key=lambda kv: kv[1].get("new", 0) + kv[1].get("sold", 0))[0]
    top_label = CATEGORY_META.get(top_cat, ("", ""))[1] if top_cat else ""
    suffix = f" ({top_label})" if top_label else ""
    return f"[{date_str}] 🆕{total_new} 🤝{total_contract}/{total_sold}{suffix}"


def build_body(
    date_str: str,
    total_new: int,
    total_sold: int,
    total_contract: int,
    total_expired: int,
    total_unknown: int,
    by_category: dict[str, dict[str, int]],
    contract_by_category: dict[str, list[dict]],
    elapsed_seconds: int,
    status: str = "成功",
) -> str:
    """Layout philosophy:

    Top half = "answer the obvious questions in 5 seconds":
        - day-level totals (new / 成約 / 掲載終了)
        - per-category counts in a single compact block
        - elapsed time + status

    Bottom half = "drill in if you want":
        - per-category 成約 Top 5 with title / price / URL
    """
    HR = "━━━━━━━━━━━━━━━━━━━"
    lines: list[str] = []

    # ── HEAD ────────────────────────────────────────────────────────
    lines.append(f"🏝️ うちなーらいふ {date_str}")
    lines.append("")
    lines.append("【サマリー】")
    lines.append(f"🆕 新着合計   {total_new}")
    lines.append(f"🤝 成約推定   {total_contract}")
    lines.append(f"📅 掲載終了   {total_expired}")
    if total_unknown:
        lines.append(f"❓ 不明       {total_unknown}")
    lines.append(f"📉 失効合計   {total_sold}")
    lines.append("")

    h, rem = divmod(max(elapsed_seconds, 0), 3600)
    m, _ = divmod(rem, 60)
    elapsed_label = f"{h}h{m:02d}m" if h else f"{m}m"
    lines.append(f"所要時間 {elapsed_label}   ステータス {('✅ 成功' if status == '成功' else '⚠️ ' + status)}")

    lines.append("")
    lines.append(HR)
    lines.append("【カテゴリ別 件数】")
    lines.append("")

    sorted_cats = sorted(
        by_category.items(),
        key=lambda kv: kv[1].get("new", 0) + kv[1].get("sold", 0),
        reverse=True,
    )
    for cat, counts in sorted_cats:
        emoji, label = CATEGORY_META.get(cat, ("•", cat))
        new_n = counts.get("new", 0)
        sold_n = counts.get("sold", 0)
        contract_n = len(contract_by_category.get(cat, []))
        lines.append(f"{emoji} {label}")
        lines.append(f"   新規 {new_n}  成約 {contract_n}  失効 {sold_n}")
    lines.append("")

    # ── BODY: per-category contract listings ────────────────────────
    cats_with_contracts = [
        (cat, items) for cat, items in contract_by_category.items() if items
    ]
    cats_with_contracts.sort(key=lambda kv: len(kv[1]), reverse=True)

    if cats_with_contracts:
        lines.append(HR)
        lines.append("【成約推定 物件リスト】")
        lines.append("各カテゴリ高額順 Top 5")

        for cat, items in cats_with_contracts:
            emoji, label = CATEGORY_META.get(cat, ("•", cat))
            top = sorted(items, key=lambda x: x.get("price_yen") or -1, reverse=True)[:5]
            lines.append("")
            lines.append(f"━━ {emoji} {label}  (成約 {len(items)} 件) ━━")
            for i, item in enumerate(top, 1):
                title = _truncate(item.get("title"), 38)
                price = _format_yen(item.get("price_yen"))
                url = item.get("url", "")
                lines.append("")
                lines.append(f"{i}. {title}")
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
    today = date.today()
    date_str = datetime.now().strftime("%-m/%-d")

    total_new = sum(c.get("new", 0) for c in by_category.values())
    total_sold = sum(c.get("sold", 0) for c in by_category.values())

    # Classify each disappearance & bucket by category for the per-section
    # Top 5 lists. Only "成約" rows go into the highlighted lists; expired/
    # unknown counted in summary only.
    contract_by_category: dict[str, list[dict]] = {}
    total_contract = 0
    total_expired = 0
    total_unknown = 0
    for p in sold_properties:
        if not p:
            continue
        klass = _classify(p, today)
        if klass == "成約":
            total_contract += 1
            cat = p.get("category") or "unknown"
            contract_by_category.setdefault(cat, []).append({
                "url": p.get("url"),
                "title": p.get("title"),
                "category": cat,
                "price_raw": p.get("price"),
                "price_yen": _parse_price_yen(p.get("price")),
            })
        elif klass == "掲載終了":
            total_expired += 1
        else:
            total_unknown += 1

    subject = build_subject(date_str, total_new, total_sold, total_contract, by_category)
    body = build_body(
        date_str=date_str,
        total_new=total_new,
        total_sold=total_sold,
        total_contract=total_contract,
        total_expired=total_expired,
        total_unknown=total_unknown,
        by_category=by_category,
        contract_by_category=contract_by_category,
        elapsed_seconds=elapsed_seconds,
        status=status,
    )
    # force=True so a successful daily report isn't silenced by an earlier
    # failure-alert flag on the same day
    return send(subject, body, force=True)


if __name__ == "__main__":
    # Manual smoke test with realistic 5/1 numbers
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
    # Build sample sold properties — most are 成約 (expiry future), some 期限切れ
    today = date.today().isoformat()
    future = "2026/06/30"
    past = "2026/04/15"
    sample_sold = []
    # House contracts
    for title, price in [
        ("沖縄市知花 5LDK 一戸建て", "9800万円"),
        ("浦添市港川 4LDK 新築", "6500万円"),
        ("豊見城市豊崎 3LDK", "4200万円"),
        ("名護市東江 4LDK", "3800万円"),
        ("宜野湾市真栄原 3LDK", "3200万円"),
        ("糸満市西崎 4LDK (期限切れ)", "2800万円"),
    ]:
        is_expired = "期限切れ" in title
        sample_sold.append({
            "url": f"https://www.e-uchina.net/bukken/house/h-{len(sample_sold)+1}/detail.html",
            "title": title, "price": price, "category": "house",
            "expiry_date": past if is_expired else future,
            "last_seen_date": today,
        })
    # Tochi contracts
    for title, price in [
        ("那覇市首里 270坪 商業地", "1億2000万円"),
        ("うるま市石川 120坪", "2500万円"),
        ("豊見城市豊崎 200坪", "8500万円"),
        ("読谷村大湾 80坪", "1800万円"),
        ("沖縄市美里 100坪", "1500万円"),
    ]:
        sample_sold.append({
            "url": f"https://www.e-uchina.net/bukken/tochi/t-{len(sample_sold)+1}/detail.html",
            "title": title, "price": price, "category": "tochi",
            "expiry_date": future, "last_seen_date": today,
        })
    # Mansion contracts
    for title, price in [
        ("プレミアム国際通り 3LDK 角部屋", "5500万円"),
        ("那覇新都心ザ・タワー 2LDK", "4200万円"),
        ("北谷美浜 3LDK 海側", "3800万円"),
    ]:
        sample_sold.append({
            "url": f"https://www.e-uchina.net/bukken/mansion/m-{len(sample_sold)+1}/detail.html",
            "title": title, "price": price, "category": "mansion",
            "expiry_date": future, "last_seen_date": today,
        })
    # Jukyo (rent)
    for title, price in [
        ("那覇市銘苅 2LDK 賃貸マンション", "12万円"),
        ("浦添市宮城 3LDK アパート", "9.5万円"),
    ]:
        sample_sold.append({
            "url": f"https://www.e-uchina.net/bukken/jukyo/j-{len(sample_sold)+1}/detail.html",
            "title": title, "price": price, "category": "jukyo",
            "expiry_date": future, "last_seen_date": today,
        })

    sys_exit = send_daily_report(
        by_category=sample_by_cat,
        sold_properties=sample_sold,
        elapsed_seconds=4500,
    )
    raise SystemExit(sys_exit)
