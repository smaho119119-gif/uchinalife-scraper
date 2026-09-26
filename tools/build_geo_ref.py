#!/usr/bin/env python3
"""geo/okinawa_ref.json.gz（海岸線・小学校・ゆいレール駅の参照データ）を作る。

    python tools/build_geo_ref.py --points points.json --stations N02-23_Station.geojson

points.json は物件の位置の配列 [{"lat":..,"lng":..}, ...]。各物件のまわり3×3枚（z14・約2km四方×9）の
地理院ベクトルタイルを取り、海岸線と小学校を集める。既存の参照データがあれば、足りない地図だけ取りに行く。
駅は国土数値情報 N02-23 の Station.geojson から沖縄都市モノレールだけを取り出す。
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests  # noqa: E402

import geo_near  # noqa: E402

SOURCE = ("海岸線・小学校: 国土地理院ベクトルタイル（出典: 国土地理院ウェブサイト https://maps.gsi.go.jp/development/vt.html・公共データ利用規約 第1.0版）／"
          "駅: 国土数値情報 鉄道データ N02-23（国土交通省・CC BY 4.0）")


def stations_from(path: str) -> list[dict]:
    d = json.load(open(path, encoding="utf-8"))
    out = {}
    for f in d["features"]:
        if f["properties"].get("N02_004") != "沖縄都市モノレール":
            continue
        g = f["geometry"]
        pts = g["coordinates"] if g["type"] == "LineString" else [p for l in g["coordinates"] for p in l]
        name = f["properties"]["N02_005"]
        out[name] = {"name": name, "line": "ゆいレール",
                     "lat": round(sum(p[1] for p in pts) / len(pts), 6), "lng": round(sum(p[0] for p in pts) / len(pts), 6)}
    return list(out.values())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--points", required=True)
    ap.add_argument("--stations", required=True)
    ap.add_argument("--out", default=geo_near.REF_PATH)
    a = ap.parse_args()

    ref = {"coast": [], "schools": [], "tiles": []}
    if os.path.exists(a.out):
        with gzip.open(a.out, "rt", encoding="utf-8") as f:
            ref = json.load(f)
    have = set(ref.get("tiles", []))
    need = set()
    for p in json.load(open(a.points)):
        x0, y0 = geo_near.tile_of(float(p["lat"]), float(p["lng"]))
        need |= {f"{x}/{y}" for x in (x0 - 1, x0, x0 + 1) for y in (y0 - 1, y0, y0 + 1)}
    todo = sorted(need - have)
    print(f"必要 {len(need)} 枚 / 既存 {len(have)} 枚 / 取りに行く {len(todo)} 枚", flush=True)

    s = requests.Session()
    failed = []
    for i, key in enumerate(todo, 1):
        x, y = map(int, key.split("/"))
        try:
            t = geo_near.fetch_tile(x, y, s)
        except Exception as e:
            failed.append(key)
            print(f"  ! {key}: {e}", flush=True)
            continue
        ref["coast"] += t["coast"]
        ref["schools"] += t["schools"]
        ref["tiles"].append(key)
        if i % 100 == 0:
            print(f"  {i}/{len(todo)}", flush=True)
        time.sleep(0.2)

    # 同じ学校が隣の地図の端で2回出ることがあるので、名前と位置でまとめる
    seen, schools = set(), []
    for sc in ref["schools"]:
        k = (sc["name"], round(sc["lat"], 3), round(sc["lng"], 3))
        if k not in seen:
            seen.add(k)
            schools.append(sc)
    ref["schools"] = schools
    ref["stations"] = stations_from(a.stations)
    ref["source"] = SOURCE
    ref["built"] = time.strftime("%Y-%m-%d")
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with gzip.open(a.out, "wt", encoding="utf-8") as f:
        json.dump(ref, f, ensure_ascii=False, separators=(",", ":"))
    pts = sum(len(l) for l in ref["coast"])
    print(f"地図 {len(ref['tiles'])} 枚・海岸線 {len(ref['coast'])} 本 {pts} 点・小学校 {len(schools)}・駅 {len(ref['stations'])}・"
          f"失敗 {len(failed)} → {a.out} ({os.path.getsize(a.out) // 1024}KB)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
