#!/usr/bin/env python3
"""Push today's listings to PROPERTY AI (Tokyo) for the AI market estimate.

Rows are built from the e-uchina search API records collected by api_collect.
They go through two SECURITY DEFINER functions in the PROPERTY AI database
that accept a sync token and can only touch the market tables:
  property_ai_market_ingest(token, day, rows)   upsert listings + daily price
  property_ai_market_finalize(token, day, cat)  mark unseen listings ended
finalize is called only when the category was collected completely, so a
partial collection can never end listings that are still on the market.

Env: PROPERTY_AI_URL, PROPERTY_AI_KEY (publishable key), PROPERTY_AI_SYNC_TOKEN
"""
from __future__ import annotations

import os
import re
import time
from datetime import date, datetime, timedelta, timezone

import requests

JST = timezone(timedelta(hours=9))
BATCH = 500


def _num(v) -> float | None:
    try:
        f = float(str(v).replace(",", ""))
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def _ts_jst(v) -> str | None:
    """API gives '2026-10-08 11:54:15' (JST, no zone) or ISO with Z."""
    if not v:
        return None
    s = str(v)
    if "T" in s:
        return s
    return s.replace(" ", "T") + "+09:00"


SEA_TEXT = re.compile(r"オーシャンビュー|海が見え|海を望|海一望|海を一望")
GARAGE_TEXT = re.compile(r"ガレージ|車庫(?!証明)")   # 「ビルトイン」は食洗器にも当たるので使わない
PARKING2_TEXT = re.compile(r"駐車\S{0,6}[2-9２-９]台|[2-9２-９]台(?:駐車|分|以上|可|まで)")
SHOP_HOME_TEXT = re.compile(r"店舗付き?住宅|店舗併用住宅|店舗兼住宅|住居付き?店舗|住宅付き?店舗")
SHOP_TEXT = re.compile(r"店舗付|店舗併用|店舗兼")


def themes_of(category: str, r: dict) -> list[str]:
    """テーマ別ページ（海・ペット・車・店舗付き）の印。判定はここだけに置く。"""
    text = " ".join(str(r.get(k) or "") for k in ("catch_phrase_web", "bukken_biko", "option_biko_web", "parking_biko", "parking_disp"))
    opts = str(r.get("options") or "")
    out = []
    if "option_sea" in opts or "option_coastland" in opts or SEA_TEXT.search(text):
        out.append("sea")
    if r.get("pet_type") in (1, 2):
        out.append("pet")
    if GARAGE_TEXT.search(text):
        out.append("garage")
    if PARKING2_TEXT.search(text):
        out.append("parking2")
    if SHOP_HOME_TEXT.search(text) or (category in ("house", "mansion", "jukyo") and SHOP_TEXT.search(text)):
        out.append("shop")
    return out


def to_row(category: str, r: dict) -> dict | None:
    bid = r.get("bukken_hid")
    if not bid:
        return None
    price_man = _num(r.get("price_sort"))
    price = round(price_man * 10000) if price_man else None
    land = _num(r.get("tochi_space_metr"))
    building = _num(r.get("house_space_metr")) if category == "house" else None
    unit = _num(r.get("man_senyu_metr")) if category in ("mansion", "jukyo") else None
    area = {"tochi": land, "house": building, "mansion": unit, "jukyo": unit}.get(category)

    title = r.get("disp_name") or r.get("bukken_name") or ""
    price_note = str(r.get("price_disp") or "")
    outlier = False
    if price is None or area is None or area < 10:
        outlier = True
    elif category == "tochi" and price / area < 1000:
        outlier = True                    # 打ち間違い（2.398万円 など）。北部・離島は1万円/㎡未満も実在する
    elif price > 1_000_000_000:
        outlier = True
    if re.search(r"墓|霊園", title) or "〜" in price_note or "～" in price_note:
        outlier = True                    # 墓地・価格に幅がある掲載

    dup_key = None
    if area:
        dup_key = f"{category}|{r.get('adr_city')}|{r.get('adr_area')}|{round(area, 1)}"

    return {
        "bukken_id": bid,
        "category": category,
        "city_code": r.get("adr_city"),
        "municipality": r.get("city_name"),
        "area_code": r.get("adr_area"),
        "area_name": r.get("area_name"),
        "address_disp": r.get("address_disp"),
        "title": title,
        "company_name": r.get("cust_name"),
        "source_url": r.get("permalink"),
        "price_yen": price,
        "land_sqm": land,
        "building_sqm": building,
        "unit_sqm": unit,
        "built_ym": r.get("kenchiku_date"),
        "madori": r.get("madori_space_all_disp"),
        "zoning": r.get("yoto_chiki_disp") if r.get("yoto_chiki_disp") not in (None, 0, "0", "-") else None,
        "kenpei_yoseki": r.get("kenpei_yoseki_disp"),
        "lat": _num(r.get("map_ido")),
        "lng": _num(r.get("map_keido")),
        "listed_at": _ts_jst(r.get("created_at")),
        "source_updated_at": _ts_jst(r.get("updated_at")),
        "expires_at": _ts_jst(r.get("expired_at")),
        "dup_key": dup_key,
        "is_outlier": outlier,
        "favorite_count": int(r.get("favorite_count") or 0),
        "pet_type": r.get("pet_type"),
        "pet_note": (str(r.get("pet_disp") or "").strip() or None) if r.get("pet_type") is not None else None,
        "options": [o for o in str(r.get("options") or "").split(",") if o],
        "themes": themes_of(category, r),
        "parking_disp": (str(r.get("parking_disp") or "").strip() or None),
        "catch_phrase": (str(r.get("catch_phrase_web") or "").strip()[:300] or None),
        "kind_disp": r.get("bukken_type_disp"),
        "image_count": int(r.get("image_count") or 0),
        "has_video": bool(r.get("video_youtube_id")),
    }


def _rpc(name: str, payload: dict) -> requests.Response:
    url = os.environ["PROPERTY_AI_URL"].rstrip("/") + f"/rest/v1/rpc/{name}"
    key = os.environ["PROPERTY_AI_KEY"]
    last = None
    for attempt in range(1, 4):
        try:
            resp = requests.post(url, json=payload, timeout=120,
                                 headers={"apikey": key, "Content-Type": "application/json"})
            if resp.status_code == 200:
                return resp
            last = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            last = str(e)
        time.sleep(5 * attempt)
    raise RuntimeError(f"{name} failed: {last}")


def enabled() -> bool:
    return all(os.getenv(k) for k in ("PROPERTY_AI_URL", "PROPERTY_AI_KEY", "PROPERTY_AI_SYNC_TOKEN"))


def sync(category: str, records: list[dict], complete: bool) -> dict:
    day = datetime.now(JST).date().isoformat()
    token = os.environ["PROPERTY_AI_SYNC_TOKEN"]
    rows = [x for x in (to_row(category, r) for r in records) if x]
    written = 0
    for i in range(0, len(rows), BATCH):
        resp = _rpc("property_ai_market_ingest", {"p_token": token, "p_day": day, "p_rows": rows[i:i + BATCH]})
        written += int(resp.json())
    ended = None
    if complete and rows:
        ended = int(_rpc("property_ai_market_finalize", {"p_token": token, "p_day": day, "p_category": category}).json())
    return {"rows": len(rows), "written": written, "outliers": sum(r["is_outlier"] for r in rows),
            "ended": ended, "finalized": bool(complete and rows)}
