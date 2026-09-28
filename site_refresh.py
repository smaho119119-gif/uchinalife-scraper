#!/usr/bin/env python3
"""毎晩の取り込みのあと、公開サイト（fudosan.nextcode.ltd の /sagasu・地図・トップ）を作り直す。

    python3 site_refresh.py            # report ジョブの「Refresh public site」で呼ぶ

サイトはページとデータを1時間作り置きしていて、作り直しは「1時間たったあとに誰かが開いた時」に始まる。
見に来る人が少ないと何日も前の版が出たままになる（2026-09-28 に 9/28 のデータで「9/26 更新」と出ていた）。
そこで:
  1. サイトの /api/revalidate に合言葉つきで合図を送り、相場データの作り置きを全部消す
  2. 返ってきたページと地図APIを全部開いて作っておく（朝一番の人を待たせない）
  3. 合図より後に作られた版が返るまで開き直す。Vercel は消した直後の1回目にまだ古い版を返し、裏で作り直す
     （2026-09-28 実測: 合図直後の1回目 age=51 の古い版 → 2回目 age=0）。判定は応答の age（作ってからの秒数）が
     合図からの経過秒数以下か。テーマのページは今日の更新日（asOf）が出ているかも見る
結果は logs/site_refresh.json に書く。日報（actions_report.py）と実行記録（run_log.py）が読み、
失敗なら「問題」に並べる。標準ライブラリだけで動き、何があっても終了コード 0（本体を巻き込まない）。

環境変数: FUDOSAN_REVALIDATE_TOKEN（必須・GitHub Secrets）/ FUDOSAN_SITE_URL（省略時 https://fudosan.nextcode.ltd）
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULT_PATH = os.path.join(PROJECT_DIR, "logs", "site_refresh.json")
UA = "uchinalife-scraper/site_refresh (+https://github.com/smaho119119-gif/uchinalife-scraper)"
ROUNDS = 4          # 古い日付のページを開き直す回数の上限
WAIT_SECONDS = 10   # 開き直す前に待つ秒数


def _request(url: str, *, method: str = "GET", token: str | None = None,
             timeout: int = 60) -> tuple[int, bytes, int | None]:
    """(HTTPコード, 本文, age ヘッダ)。age は配信側の作り置きの経過秒数（無ければ None）。"""
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            age = r.headers.get("age")
            return r.status, r.read(), int(age) if age and age.isdigit() else None
    except urllib.error.HTTPError as e:
        return e.code, e.read(), None


def _revalidate(base: str, token: str) -> dict:
    """合図を送る。通信の失敗と 5xx は3回まで送り直す（401 は合言葉の誤りなので送り直さない）。"""
    last = ""
    for attempt in range(1, 4):
        try:
            code, body, _ = _request(f"{base}/api/revalidate", method="POST", token=token)
            if code == 200:
                return json.loads(body)
            last = f"HTTP {code}"
            if code < 500:
                break
        except Exception as e:  # noqa: BLE001 - 通信の失敗は全部送り直しの対象
            last = repr(e)[:200]
        time.sleep(5 * attempt)
    raise RuntimeError(f"作り直しの合図が通りませんでした（{last}）")


def _check(base: str, path: str, want_date: str | None, since: float) -> str | None:
    """開いて作っておく。問題があれば短い説明、無ければ None。since = 合図を送った時刻（time.time()）。"""
    try:
        code, body, age = _request(base + path)
    except Exception as e:  # noqa: BLE001
        return f"開けない（{repr(e)[:80]}）"
    if code != 200:
        return f"HTTP {code}"
    if age is not None and age > time.time() - since + 2:  # 合図より前に作られた版（2秒は時計の丸め分）
        return f"古い版のまま（{age}秒前に作成）"
    if path.startswith("/api/points/"):
        try:
            n = json.loads(body).get("count")
        except ValueError:
            return "地図の点が読めない"
        return None if n else "地図の点が0件"
    if path.startswith("/sagasu") and want_date:
        text = body.decode("utf-8", "replace")
        if "ただいま読み込めませんでした" in text:
            return "データを読み込めなかった版が出ている"
        if want_date not in text:
            return "更新日が古いまま"
    return None


def refresh(base: str, token: str) -> dict:
    started = time.monotonic()
    since = time.time()
    info = _revalidate(base, token)
    want = (info.get("asOf") or "").replace("-", "/") or None  # ページの表示は 2026/09/28 の形
    paths = list(info.get("pages") or []) + list(info.get("points") or [])
    pending = {p: "未確認" for p in paths}
    for rnd in range(ROUNDS):
        if rnd:
            time.sleep(WAIT_SECONDS)
        pending = {p: why for p in pending if (why := _check(base, p, want, since))}
        if not pending:
            break
    return {
        "ok": not pending,
        "asOf": info.get("asOf"),
        "checked": len(paths),
        "bad": pending,  # {パス: 理由}
        "seconds": round(time.monotonic() - started, 1),
    }


def problem_of(site: dict | None) -> str | None:
    """日報・実行記録の「問題」に並べる1行。問題が無い・記録が無い（古い実行）なら None。"""
    if not site or site.get("ok") is not False:
        return None
    if site.get("error"):
        return f"公開サイトの作り直しに失敗: {site['error']}"
    bad = site.get("bad") or {}
    shown = "・".join(f"{p}（{why}）" for p, why in list(bad.items())[:3])
    more = f" ほか{len(bad) - 3}件" if len(bad) > 3 else ""
    return f"公開サイトの一部が古いまま: {shown}{more}"


def read_result(path: str = RESULT_PATH) -> dict | None:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"site_refresh.json を読めません: {e}"}


def main() -> int:
    base = (os.getenv("FUDOSAN_SITE_URL") or "https://fudosan.nextcode.ltd").rstrip("/")
    token = (os.getenv("FUDOSAN_REVALIDATE_TOKEN") or "").strip()
    try:
        if not token:
            raise RuntimeError("合言葉 FUDOSAN_REVALIDATE_TOKEN が設定されていません")
        result = refresh(base, token)
    except Exception as e:  # noqa: BLE001 - 何があっても本体を巻き込まない
        result = {"ok": False, "error": str(e)[:300]}
    result["at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        os.makedirs(os.path.dirname(RESULT_PATH), exist_ok=True)
        with open(RESULT_PATH, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)
    except OSError as e:
        print(f"site_refresh.json を書けませんでした: {e}", file=sys.stderr)
    print("公開サイト: " + (problem_of(result) or
          f"作り直し完了（{result['checked']}か所・更新日 {result['asOf']}・{result['seconds']}秒）"), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
