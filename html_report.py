#!/usr/bin/env python3
"""HTML daily report — the mail itself is the dashboard.

Everything is drawn with tables + inline CSS (no images, no JS) so it renders
the same in iPhone Mail, Gmail and Outlook. History comes from the database:
  - listing counts per day : daily_link_snapshots.url_count
  - new per day            : properties.first_seen_date
  - sold per day           : properties.last_seen_date where is_active = false
Any database failure only drops the history sections; the mail still goes out.
"""
from __future__ import annotations

import html
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from daily_report import CATEGORY_META

JST = timezone(timedelta(hours=9))
ORDER = ["jukyo", "jigyo", "yard", "parking", "tochi", "mansion", "house", "sonota"]
# Before this date jukyo was cut off at ~2,100–2,300 and missed listings were
# marked sold, so older numbers are shown as reference only.
RELIABLE_FROM = date(2026, 9, 24)

TEAL, TEAL_BG = "#0f766e", "#ccfbf1"
ORANGE = "#c2410c"
PINK, PINK_BG = "#be185d", "#fce7f3"
INK, MUTED, LINE, PAPER = "#1f2937", "#6b7280", "#e5e7eb", "#ffffff"
FONT = "-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',Meiryo,sans-serif"


def _e(s) -> str:
    return html.escape(str(s))


def _label(cat: str) -> str:
    emoji, label = CATEGORY_META.get(cat, ("•", cat))
    return f"{emoji} {label}"


def _fetch_history(days: int = 35) -> dict:
    """Read-only history queries. Returns {} on any error."""
    try:
        from database import db
        sb = db.supabase
        since = (date.today() - timedelta(days=days)).isoformat()

        counts: dict[str, dict[str, int]] = defaultdict(dict)
        snaps = sb.table("daily_link_snapshots").select("snapshot_date,category,url_count") \
            .gte("snapshot_date", since).order("snapshot_date").execute().data or []
        for r in snaps:
            counts[r["snapshot_date"]][r["category"]] = r["url_count"]

        def per_day(column: str, active: bool | None) -> dict[str, dict[str, int]]:
            out: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
            start = 0
            while True:
                q = sb.table("properties").select(f"{column},category").gte(column, since)
                if active is not None:
                    q = q.eq("is_active", active)
                rows = q.range(start, start + 999).execute().data or []
                for r in rows:
                    if r.get(column):
                        out[r[column][:10]][r.get("category") or "?"] += 1
                if len(rows) < 1000:
                    return out
                start += 1000

        return {
            "counts": counts,
            "new": per_day("first_seen_date", None),
            "sold": per_day("last_seen_date", False),
        }
    except Exception as e:  # history is optional
        print(f"history unavailable: {e}")
        return {}


def _bar(value: int, max_value: int, color: str, width_px: int = 140) -> str:
    w = 0 if max_value <= 0 else max(2, round(width_px * value / max_value)) if value else 0
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>'
            f'<td style="width:{w}px;height:14px;background:{color};border-radius:3px;font-size:0;line-height:0">&nbsp;</td>'
            f'<td style="padding-left:6px;font-size:14px;color:{INK};font-weight:700;white-space:nowrap">{value:,}</td>'
            f'</tr></table>')


def _shade(value: int, max_value: int) -> str:
    """Calendar cell colour: white → teal by value."""
    if not value or max_value <= 0:
        return "#f9fafb"
    steps = ["#ecfdf5", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6"]
    return steps[min(len(steps) - 1, int(len(steps) * value / (max_value + 1)))]


POPULAR_API = ("https://rtrorhmmsjvbmlulcxra.supabase.co/functions/v1/property-ai-api"
               "?forceFunctionRegion=ap-northeast-1&action=market-popular&limit=10")
SAGASU_URL = "https://fudosan.nextcode.ltd/sagasu"
KIND = {"jukyo": "賃貸", "house": "一戸建て", "mansion": "マンション", "tochi": "土地", "jigyo": "店舗・事務所"}


def _popular_html() -> str:
    """お気に入り数の多い物件の上位（PROPERTY AI の公開API）。取れなければ空文字＝節ごと出さない。"""
    try:
        import requests
        items = requests.get(POPULAR_API, timeout=20).json().get("listings") or []
    except Exception:
        return ""
    if not items:
        return ""
    rows = ""
    for i, x in enumerate(items, 1):
        man = (x.get("price_yen") or 0) / 10000
        price = "" if not man else (f"月{man:.1f}万円" if x.get("category") == "jukyo" else f"{round(man):,}万円")
        where = " ".join(v for v in (x.get("municipality"), x.get("area_name")) if v)
        madori = x.get("madori") if x.get("madori") not in (None, "", "-", "－") else None
        rows += (f'<tr><td style="padding:6px 8px 6px 0;font-size:13px;font-weight:900;color:{MUTED};vertical-align:top;width:1%">{i}</td>'
                 f'<td style="padding:6px 8px 6px 0;font-size:14px;font-weight:900;color:{PINK};white-space:nowrap;vertical-align:top;width:1%">♥ {x.get("favorite_count") or 0:,}</td>'
                 f'<td style="padding:6px 0;font-size:14px;line-height:1.5;border-bottom:1px solid {LINE}">'
                 f'<a href="{_e(x.get("source_url") or "")}" style="color:{INK};font-weight:800;text-decoration:none">{_e((x.get("title") or "")[:40])}</a><br>'
                 f'<span style="font-size:13px;color:{MUTED};font-weight:700">{_e(KIND.get(x.get("category"), x.get("kind_disp") or ""))}・{_e(where)}'
                 f'{("・" + _e(madori)) if madori else ""}{("・" + price) if price else ""}</span></td></tr>')
    return ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + rows + '</table>'
            f'<div style="padding-top:10px;font-size:13px;color:{MUTED}">♥＝うちなーらいふでお気に入りに入れた人の数（掲載からの合計）。'
            f'<a href="{SAGASU_URL}" style="color:{TEAL};font-weight:800">テーマ別ページ（海・ペット・車・店舗付き）</a></div>')


def _section(title: str, color: str, inner: str) -> str:
    return (f'<tr><td style="padding:22px 20px 6px">'
            f'<div style="font-size:18px;font-weight:900;color:{color};border-left:6px solid {color};padding-left:10px">{_e(title)}</div>'
            f'</td></tr><tr><td style="padding:6px 20px 4px">{inner}</td></tr>')


def build_html(*, results: dict[str, dict], jobs: list[dict], status: str, run_url: str,
               total_minutes: int | None, history: dict | None = None) -> str:
    today = datetime.now(JST).date()
    hist = _fetch_history() if history is None else history
    counts = hist.get("counts", {})
    new_hist = hist.get("new", {})
    sold_hist = hist.get("sold", {})

    # ---- today's numbers -------------------------------------------------
    rows = []
    for cat in ORDER:
        d = results.get(cat) or {}
        col = (d.get("collection") or {}).get(cat) or {}
        bc = (d.get("by_category") or {}).get(cat) or {}
        rows.append({
            "cat": cat, "ok": bool(d), "complete": bool(col.get("complete")),
            "listed": col.get("collected") or 0, "site": col.get("expected"),
            "new": bc.get("new", 0), "sold": bc.get("sold", 0),
            "paused": bc.get("sold_candidates_paused",
                             bc.get("sold_confirmed") if bc.get("sold_dry_run") else bc.get("sold_held_mass")),
            "retries": col.get("retries") or 0,
        })
    # previous listing count = latest snapshot before today
    prev_date = max((d for d in counts if d < today.isoformat()), default=None)
    prev = counts.get(prev_date, {}) if prev_date else {}
    total_listed = sum(r["listed"] for r in rows)
    total_prev = sum(prev.get(r["cat"], 0) for r in rows) if prev else None
    total_new = sum(r["new"] for r in rows)
    paused_any = any(r["paused"] is not None for r in rows)
    total_sold = sum((r["paused"] or 0) if paused_any else r["sold"] for r in rows)
    ok = status == "成功"

    def delta(now: int, before: int | None) -> str:
        if before is None:
            return f'<span style="color:{MUTED}">―</span>'
        diff = now - before
        color = TEAL if diff > 0 else PINK if diff < 0 else MUTED
        return f'<span style="color:{color};font-weight:800">{diff:+,}</span>'

    # ---- KPI cards --------------------------------------------------------
    def card(label: str, value: str, sub: str, color: str) -> str:
        return (f'<td width="33%" style="padding:6px" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                f'style="border:2px solid {color};border-radius:12px;background:{PAPER}"><tr><td style="padding:12px 10px;text-align:center">'
                f'<div style="font-size:13px;color:{MUTED};font-weight:700">{label}</div>'
                f'<div style="font-size:28px;font-weight:900;color:{color};line-height:1.2">{value}</div>'
                f'<div style="font-size:12px;color:{MUTED};font-weight:700">{sub}</div></td></tr></table></td>')

    sold_label = "売れた候補" if paused_any else "売れた"
    sold_sub = "判定は停止中" if paused_any else "本日"
    cards = ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
             + card("掲載合計", f"{total_listed:,}", f"前日比 {total_listed - total_prev:+,}" if total_prev else "前日比 ―", TEAL)
             + card("新着", f"{total_new:,}", "本日", ORANGE)
             + card(sold_label, f"{total_sold:,}", sold_sub, PINK)
             + "</tr></table>")

    # ---- category table ---------------------------------------------------
    th = f'style="padding:8px 3px;font-size:12px;color:{MUTED};font-weight:800;text-align:right;border-bottom:2px solid {INK}"'
    table = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">'
             f'<tr><th {th.replace("right", "left")}>カテゴリ</th><th {th}>掲載</th><th {th}>前日比</th>'
             f'<th {th}>新着</th><th {th}>{"候補" if paused_any else "売れた"}</th><th {th}>取得</th></tr>')
    for r in rows:
        mark = "✅" if r["complete"] else ("⚠️" if r["ok"] else "❌")
        sold_v = r["paused"] if r["paused"] is not None else r["sold"]
        table += (f'<tr><td style="padding:8px 3px;border-bottom:1px solid {LINE};font-weight:800;color:{INK}">{_e(_label(r["cat"]))}</td>'
                  f'<td style="padding:8px 3px;border-bottom:1px solid {LINE};text-align:right;font-weight:800">{r["listed"]:,}</td>'
                  f'<td style="padding:8px 3px;border-bottom:1px solid {LINE};text-align:right">{delta(r["listed"], prev.get(r["cat"]) if prev else None)}</td>'
                  f'<td style="padding:8px 3px;border-bottom:1px solid {LINE};text-align:right;color:{ORANGE};font-weight:800">{r["new"]:,}</td>'
                  f'<td style="padding:8px 3px;border-bottom:1px solid {LINE};text-align:right;color:{PINK};font-weight:800">{(sold_v or 0):,}</td>'
                  f'<td style="padding:8px 3px;border-bottom:1px solid {LINE};text-align:center">{mark}</td></tr>')
    table += "</table>"
    if prev_date:
        table += f'<div style="font-size:12px;color:{MUTED};padding-top:6px">前日比は {prev_date[5:].replace("-", "/")} の記録との差</div>'

    # ---- new-by-category bars --------------------------------------------
    max_new = max((r["new"] for r in rows), default=0)
    bars = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    for r in sorted(rows, key=lambda r: -r["new"]):
        bars += (f'<tr><td style="padding:4px 8px 4px 0;font-size:14px;font-weight:800;color:{INK};width:118px">{_e(_label(r["cat"]))}</td>'
                 f'<td style="padding:4px 0">{_bar(r["new"], max_new, ORANGE)}</td></tr>')
    bars += "</table>"

    # ---- calendar (last 5 weeks, Monday start) ----------------------------
    start = today - timedelta(days=today.weekday() + 28)
    new_by_day = {d: sum(v.values()) for d, v in new_hist.items()}
    sold_by_day = {d: sum(v.values()) for d, v in sold_hist.items()}
    new_by_day[today.isoformat()] = max(new_by_day.get(today.isoformat(), 0), total_new)
    cal_max = max((v for d, v in new_by_day.items() if d >= start.isoformat()), default=0)
    cal = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="3" style="table-layout:fixed">'
           + "<tr>" + "".join(f'<td style="text-align:center;font-size:12px;font-weight:800;color:{PINK if i == 6 else MUTED}">{w}</td>'
                               for i, w in enumerate("月火水木金土日")) + "</tr>")
    for week in range(5):
        cal += "<tr>"
        for dow in range(7):
            d = start + timedelta(days=week * 7 + dow)
            key = d.isoformat()
            if d > today:
                cal += '<td style="height:58px"></td>'
                continue
            n = new_by_day.get(key, 0)
            s = sold_by_day.get(key, 0)
            border = f"2px solid {INK}" if d == today else f"1px solid {LINE}"
            sold_color = PINK if d >= RELIABLE_FROM else "#9ca3af"
            cal += (f'<td valign="top" style="height:58px;background:{_shade(n, cal_max)};border:{border};border-radius:8px;padding:4px">'
                    f'<div style="font-size:11px;color:{MUTED};font-weight:700">{d.month}/{d.day}</div>'
                    f'<div style="font-size:13px;font-weight:900;color:{TEAL}">{("+" + format(n, ",")) if n else "·"}</div>'
                    f'<div style="font-size:11px;font-weight:800;color:{sold_color}">{("−" + format(s, ",")) if s else ""}</div></td>')
        cal += "</tr>"
    cal += "</table>"
    cal += (f'<div style="font-size:12px;color:{MUTED};padding-top:6px;line-height:1.6">'
            f'<b style="color:{TEAL}">+ 新着</b>（濃いほど多い）　<b style="color:{PINK}">− 売れた</b>'
            f'<br>※ {RELIABLE_FROM.month}/{RELIABLE_FROM.day} より前の「売れた」は取りこぼしの誤判定を含むため灰色（参考値）'
            + ("<br>※ 売れた判定は現在停止中のため、停止中の日は空欄" if paused_any else "") + "</div>")

    # ---- listing trend (last 7 recorded days + today) ---------------------
    days = sorted(d for d in counts if d < today.isoformat())[-4:]
    tcols = days + [today.isoformat()]
    trend = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
             f'<tr><th style="padding:6px 3px;text-align:left;color:{MUTED};border-bottom:2px solid {INK}">カテゴリ</th>'
             + "".join(f'<th style="padding:6px 4px;text-align:right;color:{INK if d == today.isoformat() else MUTED};border-bottom:2px solid {INK}">'
                       f'{int(d[5:7])}/{int(d[8:10])}</th>' for d in tcols) + "</tr>")
    today_counts = {r["cat"]: r["listed"] for r in rows}
    for cat in ORDER:
        trend += f'<tr><td style="padding:6px 3px;font-weight:800;border-bottom:1px solid {LINE}">{_e(CATEGORY_META.get(cat, ("", cat))[1])}</td>'
        for d in tcols:
            v = today_counts.get(cat) if d == today.isoformat() else counts.get(d, {}).get(cat)
            ref = cat == "jukyo" and d < RELIABLE_FROM.isoformat()
            color = "#9ca3af" if ref else (INK if d == today.isoformat() else "#374151")
            weight = 900 if d == today.isoformat() else 600
            trend += (f'<td style="padding:6px 3px;text-align:right;border-bottom:1px solid {LINE};color:{color};font-weight:{weight}">'
                      f'{"―" if v is None else format(v, ",")}</td>')
        trend += "</tr>"
    trend += (f'</table><div style="font-size:12px;color:{MUTED};padding-top:6px">'
              f'※ 住居の {RELIABLE_FROM.month}/{RELIABLE_FROM.day} より前は途中で打ち切られていた値（灰色・参考値）</div>')

    # ---- run details --------------------------------------------------------
    def jmin(j):
        try:
            s = datetime.fromisoformat(j["started_at"].replace("Z", "+00:00"))
            e = datetime.fromisoformat(j["completed_at"].replace("Z", "+00:00"))
            return (e - s).total_seconds() / 60
        except Exception:
            return 0.0
    def jlabel(name: str) -> str:
        """GitHub job name → short Japanese label that fits one line on a phone."""
        import re
        short = {c: CATEGORY_META.get(c, ("", c))[1] for c in ORDER}
        m = re.match(r"scrape \((\w+)\)", name)
        if m:
            return short.get(m.group(1), m.group(1))
        m = re.match(r"jukyo-collect \((\d+)-(\d*)\)", name)
        if m:
            return f"{short['jukyo']} {m.group(1)}〜{m.group(2) or '最後'}ページ"
        if name == "jukyo":
            return f"{short['jukyo']} まとめ"
        return name

    run_jobs = [j for j in jobs if j.get("name") != "report"]
    max_min = max((jmin(j) for j in run_jobs), default=0)
    runs = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    for j in sorted(run_jobs, key=lambda j: -jmin(j)):
        good = j.get("conclusion") == "success"
        pct = 0 if max_min <= 0 else max(2, round(78 * jmin(j) / max_min))  # 画面幅に合わせて伸びる
        runs += (f'<tr><td style="padding:3px 10px 3px 0;font-size:13px;font-weight:700;color:{INK if good else PINK};white-space:nowrap;width:1%">'
                 f'{"✅" if good else "❌"} {_e(jlabel(j.get("name", "")))}</td>'
                 f'<td style="padding:3px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
                 f'<td width="{pct}%" style="height:12px;background:{TEAL if good else PINK};border-radius:3px;font-size:0">&nbsp;</td>'
                 f'<td style="padding-left:6px;font-size:13px;font-weight:800;white-space:nowrap">{jmin(j):.1f}分</td></tr></table></td></tr>')
    runs += "</table>"
    retries = sum(r["retries"] for r in rows)
    run_head = (f'<div style="font-size:14px;font-weight:800;color:{INK};padding-bottom:8px">'
                + (f"全体 {total_minutes}分　" if total_minutes is not None else "")
                + f'成功 {sum(1 for j in run_jobs if j.get("conclusion") == "success")}/{len(run_jobs)}台　取り直し {retries}回</div>')

    # ---- assemble ---------------------------------------------------------
    badge_color = TEAL if ok else ORANGE
    badge_text = "✅ すべて正常" if ok else "⚠️ " + _e(status.split("\n")[0])
    head = (f'<tr><td style="background:{TEAL};padding:20px;border-radius:14px 14px 0 0">'
            f'<div style="font-size:14px;color:{TEAL_BG};font-weight:800">うちなーらいふ 日次レポート</div>'
            f'<div style="font-size:26px;color:#ffffff;font-weight:900">🏝️ {today.month}/{today.day}（{"月火水木金土日"[today.weekday()]}）</div>'
            f'</td></tr>'
            f'<tr><td style="padding:14px 20px 0"><div style="display:inline-block;background:{PAPER};border:2px solid {badge_color};'
            f'color:{badge_color};font-weight:900;font-size:15px;padding:8px 12px;border-radius:10px;line-height:1.5">{badge_text}</div></td></tr>'
            f'<tr><td style="padding:10px 14px 0">{cards}</td></tr>')

    popular = _popular_html()
    body = (head
            + _section("カテゴリ別（今日）", TEAL, table)
            + _section("新着の内訳", ORANGE, bars)
            + (_section("人気の物件（お気に入りが多い順）", PINK, popular) if popular else "")
            + (_section("カレンダー（直近5週）", TEAL, cal) if hist else "")
            + (_section("掲載数の推移", "#1d4ed8", trend) if counts else "")
            + _section("実行の詳細（GitHub）", "#6d28d9", run_head + runs)
            + f'<tr><td style="padding:18px 20px 24px;font-size:13px;color:{MUTED}">'
              f'<a href="{_e(run_url)}" style="color:{TEAL};font-weight:800">実行ログを開く（GitHub）</a></td></tr>')

    return ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">'
            f'<title>うちなーらいふ {today.month}/{today.day}</title></head>'
            f'<body style="margin:0;padding:0;background:#f3f4f6;font-family:{FONT};color:{INK}">'
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:12px 6px">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:{PAPER};border-radius:14px">'
            + body + "</table></td></tr></table></body></html>")
