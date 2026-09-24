#!/usr/bin/env python3
"""Confirm "sold" candidates by opening each listing's detail page.

A listing missing from today's complete list is only a CANDIDATE. It is
confirmed sold only when its detail URL answers 404 twice. Anything else
is not sold:
  - 200 with the listing id in the page  → still listed (list-side miss)
  - 403/429/5xx, timeout, redirect, 200 without the id → held (unknown)

Two controls run first; if either is wrong the whole confirmation is
refused, so a site change or a block can never turn into mass "sold":
  - a URL from today's list must answer 200 with its id
  - a URL that cannot exist must answer 404
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

import requests

UA = {"User-Agent": "Mozilla/5.0 (uchinalife-scraper)"}
WORKERS = 3          # parallel requests per job
PAUSE = 0.35         # seconds each worker waits between requests (~8 req/s per job)


def _bid(url: str) -> str:
    parts = url.rstrip("/").split("/")
    return parts[-2] if len(parts) >= 2 else url


def probe(session: requests.Session, url: str) -> str:
    """'gone' | 'live' | 'unknown'"""
    try:
        r = session.get(url, headers=UA, timeout=25, allow_redirects=False)
    except Exception:
        return "unknown"
    if r.status_code == 404:
        return "gone"
    if r.status_code == 200 and _bid(url) in r.text:
        return "live"
    return "unknown"


def dead_control_url(category: str) -> str:
    prefix = {"jukyo": "r", "jigyo": "c", "yard": "y", "parking": "p",
              "tochi": "t", "mansion": "m", "house": "h", "sonota": "o"}.get(category, "x")
    return f"https://www.e-uchina.net/bukken/{category}/{prefix}-0000-0000000-0000/detail.html"


def confirm(category: str, candidates: list[str], live_control: str | None) -> dict:
    session = requests.Session()
    live_ok = probe(session, live_control) == "live" if live_control else False
    dead_ok = probe(session, dead_control_url(category)) == "gone"
    result = {"controls_ok": live_ok and dead_ok, "live_control_ok": live_ok, "dead_control_ok": dead_ok,
              "confirmed": [], "still_listed": [], "held": [], "checked": 0}
    if not result["controls_ok"]:
        result["held"] = list(candidates)
        return result

    def check(url: str) -> tuple[str, str]:
        time.sleep(PAUSE)
        first = probe(session, url)
        if first != "gone":
            return url, first
        time.sleep(2)  # second look, so one bad response cannot mark a listing sold
        return url, "gone" if probe(session, url) == "gone" else "unknown"

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for url, state in pool.map(check, candidates):
            result["checked"] += 1
            {"gone": result["confirmed"], "live": result["still_listed"]}.get(state, result["held"]).append(url)
    return result
