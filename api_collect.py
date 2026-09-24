#!/usr/bin/env python3
"""List every current listing URL of a category via the site's JSON search API.

Instead of paging through rendered list pages (which silently lost pages that
came back empty or timed out), the category is split into small chunks
— city, then area (地区) — whose sizes the site itself reports. Each chunk is
fetched and checked: the number of listings received must equal the chunk's
`total`, otherwise it is re-fetched. A chunk that never matches makes the
whole category "incomplete", so sold detection is skipped for it.

    python api_collect.py jukyo [--out links_jukyo.json]

Read-only against the site; no browser needed.
"""
from __future__ import annotations

import argparse
import json
import sys
import time

import requests

BASE = "https://www.e-uchina.net"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (uchinalife-scraper)",
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
}
PER_PAGE = 50          # the API caps perPage at 50
RETRIES = 3
PAUSE = 0.4            # seconds between requests (be polite)


class Collector:
    def __init__(self, category: str):
        self.category = category
        self.session = requests.Session()
        self.requests = 0
        self.retries = 0
        self.problems: list[str] = []

    def _get(self, url: str, params: dict | None = None, *, as_json: bool = True):
        last = None
        for attempt in range(1, RETRIES + 1):
            time.sleep(PAUSE)
            self.requests += 1
            try:
                r = self.session.get(url, params=params, headers=HEADERS if as_json else {"User-Agent": HEADERS["User-Agent"]}, timeout=40)
                r.raise_for_status()
                return r.json() if as_json else r.text
            except Exception as e:  # network / 5xx / bad json
                last = e
                self.retries += 1
                time.sleep(2 * attempt)
        raise RuntimeError(f"GET {url} {params} failed after {RETRIES} tries: {last}")

    # ---- counts ------------------------------------------------------------
    def category_total(self) -> int:
        j = self._get(f"{BASE}/api/search", {"searchType": self.category, "perPage": PER_PAGE, "page": 1})
        return int(j["data"]["bukkens"]["total"])

    def cities(self) -> list[dict]:
        html = self._get(f"{BASE}/{self.category}", as_json=False)
        key = '"cities_prefetch":'
        i = html.find(key)
        if i < 0:
            raise RuntimeError("cities_prefetch not found in list page")
        arr, _ = json.JSONDecoder().raw_decode(html[i + len(key):])
        return [{"code": c["city_code"], "name": c["city_name"], "count": int(c["count"])} for c in arr if int(c["count"]) > 0]

    def areas(self, city_code: str) -> list[dict]:
        j = self._get(f"{BASE}/api/area/get_searchable_areas", {"city_code": city_code, "filter": self.category})
        return [{"code": a["area_code"], "name": a["area_name"], "count": int(a["count"])}
                for a in j.get("data", []) if int(a["count"]) > 0]

    # ---- fetching a chunk --------------------------------------------------
    def fetch(self, params: dict, expected: int, label: str) -> list[str] | None:
        """All permalinks for one filter. None if it never matched `expected`."""
        for attempt in range(1, RETRIES + 1):
            urls: list[str] = []
            page, last_page, total = 1, 1, None
            while page <= last_page:
                j = self._get(f"{BASE}/api/search", {"searchType": self.category, "perPage": PER_PAGE, "page": page, **params})
                b = j["data"]["bukkens"]
                total = int(b["total"])
                last_page = int(b["last_page"])
                urls += [d["permalink"] for d in b["data"] if d.get("permalink")]
                page += 1
            unique = list(dict.fromkeys(urls))
            if total == len(unique):
                if total != expected:
                    # listing added/removed since counts were read — the chunk itself is consistent
                    print(f"  ~ {label}: count moved {expected}→{total} (consistent)")
                return unique
            self.retries += 1
            print(f"  ! {label}: got {len(unique)} of {total} (try {attempt}/{RETRIES})")
        self.problems.append(f"{label}: mismatch after {RETRIES} tries")
        return None

    def collect(self) -> dict:
        t0 = time.time()
        site_total = self.category_total()
        cities = self.cities()
        city_sum = sum(c["count"] for c in cities)
        links: list[str] = []
        chunks = 0
        for c in cities:
            if c["count"] <= PER_PAGE:
                got = self.fetch({"city": c["code"]}, c["count"], c["name"])
                chunks += 1
                if got is not None:
                    links += got
                continue
            areas = self.areas(c["code"])
            area_sum = sum(a["count"] for a in areas)
            if area_sum != c["count"]:
                # areas do not add up (listings without an area?) — fetch the city as a whole
                print(f"  ~ {c['name']}: areas sum {area_sum} ≠ city {c['count']}, fetching whole city")
                got = self.fetch({"city": c["code"]}, c["count"], c["name"])
                chunks += 1
                if got is not None:
                    links += got
                continue
            for a in areas:
                got = self.fetch({"city": c["code"], "areas": a["code"]}, a["count"], f"{c['name']}/{a['name']}")
                chunks += 1
                if got is not None:
                    links += got
        unique = list(dict.fromkeys(links))
        # 窓口がエラーを出さずに壊れた値を返す場合の保険（0件・件数の辻褄が合わない）
        if site_total <= 0 or not unique:
            self.problems.append(f"API returned no listings (site_total={site_total}, collected={len(unique)})")
        if abs(city_sum - site_total) > max(5, site_total * 0.005):
            self.problems.append(f"city counts {city_sum} do not add up to site total {site_total}")
        complete = not self.problems and len(unique) >= site_total * 0.995
        return {
            "category": self.category,
            "site_total": site_total,
            "city_sum": city_sum,
            "collected": len(unique),
            "duplicates": len(links) - len(unique),
            "complete": complete,
            "chunks": chunks,
            "requests": self.requests,
            "retries": self.retries,
            "problems": self.problems,
            "seconds": round(time.time() - t0, 1),
            "links": unique,
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("category")
    ap.add_argument("--out", default="")
    a = ap.parse_args()
    res = Collector(a.category).collect()
    summary = {k: v for k, v in res.items() if k != "links"}
    print(json.dumps(summary, ensure_ascii=False))
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False)
    return 0 if res["complete"] else 1


if __name__ == "__main__":
    sys.exit(main())
