#!/usr/bin/env python3
"""物件の位置から「海まで」「ゆいレール駅まで」「小学校まで」の直線距離を出す。

Google の API は使わない。使うのは商用で使える公開データだけ:
  - 海岸線・小学校の位置: 国土地理院ベクトルタイル（experimental_bvmap, z14）
      出典: 国土地理院ウェブサイト（公共データ利用規約 第1.0版）
  - ゆいレールの駅: 国土数値情報 鉄道データ N02-23（CC BY 4.0）
国土数値情報の海岸線 C23・学校 P29 は「非商用」なので使わない。

参照データは geo/okinawa_ref.json.gz（tools/build_geo_ref.py で作る）。
参照データに無い地図（新しい地域の物件）は、その場で地理院タイルを取りに行って足す
（mapbox-vector-tile が入っているときだけ。無ければその物件は距離なしにする）。
距離は直線。徒歩の分数ではない（道のりではないため、画面でも「直線」と書く）。
"""
from __future__ import annotations

import gzip
import json
import math
import os
import time

REF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo", "okinawa_ref.json.gz")
Z = 14
TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf"
CELL = 0.01          # 探索用の升目（約1km）
SEARCH_CELLS = 3     # 升目3つ分（約3km）まで探す
UA = "Mozilla/5.0 (uchinalife-scraper; geo)"


def tile_of(lat: float, lng: float, z: int = Z) -> tuple[int, int]:
    x = int((lng + 180) / 360 * 2 ** z)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * 2 ** z)
    return x, y


def _tile_px_to_lnglat(x: int, y: int, px: float, py: float, extent: int, z: int = Z) -> tuple[float, float]:
    n = 2 ** z
    lng = (x + px / extent) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / extent) / n))))
    return round(lng, 6), round(lat, 6)


def fetch_tile(x: int, y: int, session=None) -> dict:
    """地理院ベクトルタイル1枚から、海岸線（線）と小学校（点）を取り出す。海だけの地図は空。"""
    import mapbox_vector_tile  # 参照データを作るとき・足りない地図を足すときだけ使う
    import requests
    s = session or requests
    for attempt in range(3):
        try:
            r = s.get(TILE_URL.format(z=Z, x=x, y=y), headers={"User-Agent": UA}, timeout=30)
            if r.status_code == 404:
                return {"coast": [], "schools": []}
            r.raise_for_status()
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    d = mapbox_vector_tile.decode(r.content, default_options={"y_coord_down": True})
    out = {"coast": [], "schools": []}
    cl = d.get("coastline")
    if cl:
        ext = cl.get("extent", 4096)
        for f in cl["features"]:
            g = f["geometry"]
            lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"] if g["type"] == "MultiLineString" else []
            for line in lines:
                out["coast"].append([_tile_px_to_lnglat(x, y, px, py, ext) for px, py in line])
    lb = d.get("label")
    if lb:
        ext = lb.get("extent", 4096)
        for f in lb["features"]:
            name = str(f["properties"].get("knj") or "")
            g = f["geometry"]
            if "小学校" in name and g["type"] == "Point":
                lng, lat = _tile_px_to_lnglat(x, y, g["coordinates"][0], g["coordinates"][1], ext)
                out["schools"].append({"name": name, "lat": lat, "lng": lng})
    return out


class GeoRef:
    def __init__(self, ref: dict):
        self.ref = ref
        self.tiles = set(ref.get("tiles", []))
        self.stations = ref.get("stations", [])
        self._coast_grid: dict[tuple[int, int], list] = {}
        self._school_grid: dict[tuple[int, int], list] = {}
        for line in ref.get("coast", []):
            self._add_line(line)
        for s in ref.get("schools", []):
            self._school_grid.setdefault(self._cell(s["lat"], s["lng"]), []).append(s)
        self.fetched = 0
        self.fetch_failed = 0

    @staticmethod
    def _cell(lat: float, lng: float) -> tuple[int, int]:
        return int(lat // CELL), int(lng // CELL)

    def _add_line(self, line: list) -> None:
        for a, b in zip(line, line[1:]):
            seg = (a[0], a[1], b[0], b[1])
            cells = {self._cell(a[1], a[0]), self._cell(b[1], b[0]), self._cell((a[1] + b[1]) / 2, (a[0] + b[0]) / 2)}
            for c in cells:
                self._coast_grid.setdefault(c, []).append(seg)

    def add_tile(self, x: int, y: int, data: dict) -> None:
        self.tiles.add(f"{x}/{y}")
        for line in data["coast"]:
            self._add_line(line)
        for s in data["schools"]:
            self._school_grid.setdefault(self._cell(s["lat"], s["lng"]), []).append(s)

    def ensure(self, lat: float, lng: float, session=None) -> bool:
        """物件のまわり3×3枚の地図が参照データにあるか。無ければ取りに行く。"""
        x0, y0 = tile_of(lat, lng)
        missing = [(x, y) for x in (x0 - 1, x0, x0 + 1) for y in (y0 - 1, y0, y0 + 1) if f"{x}/{y}" not in self.tiles]
        for x, y in missing:
            try:
                self.add_tile(x, y, fetch_tile(x, y, session))
                self.fetched += 1
                time.sleep(0.2)
            except Exception:
                self.fetch_failed += 1
                return False
        return True

    def near(self, lat, lng, session=None) -> dict:
        """海・駅・小学校までの直線距離（m）。分からないものは None。"""
        out = {"sea_m": None, "station_name": None, "station_m": None, "school_name": None, "school_m": None}
        try:
            lat, lng = float(lat), float(lng)
        except (TypeError, ValueError):
            return out
        if not (24 <= lat <= 28 and 122 <= lng <= 132):
            return out
        kx = 111320 * math.cos(math.radians(lat))
        ky = 110540

        def xy(plng, plat):
            return (plng - lng) * kx, (plat - lat) * ky

        best = None
        for st in self.stations:
            sx, sy = xy(st["lng"], st["lat"])
            d = math.hypot(sx, sy)
            if best is None or d < best[0]:
                best = (d, st["name"])
        if best:
            out["station_m"], out["station_name"] = round(best[0]), best[1]

        if not self.ensure(lat, lng, session):
            return out  # 地図が取れなかった地域は、海と学校を空にする（0や遠いと誤魔化さない）
        cy, cx = self._cell(lat, lng)
        sea = None
        school = None
        for dy in range(-SEARCH_CELLS, SEARCH_CELLS + 1):
            for dx in range(-SEARCH_CELLS, SEARCH_CELLS + 1):
                for (ax, ay, bx, by) in self._coast_grid.get((cy + dy, cx + dx), ()):
                    x1, y1 = xy(ax, ay)
                    x2, y2 = xy(bx, by)
                    vx, vy = x2 - x1, y2 - y1
                    L = vx * vx + vy * vy
                    t = 0.0 if L == 0 else max(0.0, min(1.0, -(x1 * vx + y1 * vy) / L))
                    d = math.hypot(x1 + t * vx, y1 + t * vy)
                    if sea is None or d < sea:
                        sea = d
                for s in self._school_grid.get((cy + dy, cx + dx), ()):
                    sx, sy = xy(s["lng"], s["lat"])
                    d = math.hypot(sx, sy)
                    if school is None or d < school[0]:
                        school = (d, s["name"])
        # 探したのは約3km四方まで。見つからなければ「遠い」ではなく「分からない」とする
        if sea is not None and sea <= 2500:
            out["sea_m"] = round(sea)
        if school is not None and school[0] <= 2500:
            out["school_m"], out["school_name"] = round(school[0]), school[1]
        return out


_REF: GeoRef | None = None


def load() -> GeoRef:
    global _REF
    if _REF is None:
        ref = {}
        if os.path.exists(REF_PATH):
            with gzip.open(REF_PATH, "rt", encoding="utf-8") as f:
                ref = json.load(f)
        _REF = GeoRef(ref)
    return _REF


def near(lat, lng) -> dict:
    try:
        return load().near(lat, lng)
    except Exception:
        return {"sea_m": None, "station_name": None, "station_m": None, "school_name": None, "school_m": None}
