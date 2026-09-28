#!/usr/bin/env python3
"""毎晩の取り込みのあと、公開サイト（fudosan.nextcode.ltd のトップ・/sagasu・地図）を作り直す。

    python3 site_refresh.py        # report ジョブの「Refresh public site」で呼ぶ（本番 full の回だけ）

    # 手元で試す（本番サイトの作り置きを実際に消して作り直す。害は無く、見に来た人には新しい版が出るだけ）
    FUDOSAN_REVALIDATE_TOKEN="$(cat ~/.claude/secrets/uchinalife/revalidate_token)" python3 site_refresh.py
    # 環境変数が無ければ上の控えのファイルを読むので、手元では python3 site_refresh.py だけでもよい

サイトはページとデータを1時間作り置きしていて、作り直しは「1時間たったあとに誰かが開いた時」に始まる。
見に来る人が少ないと何日も前の版が出たままになる（2026-09-28 に 9/28 のデータで「9/26 更新」と出ていた）。
そこで:
  1. サイトの /api/revalidate に合言葉つきで合図を送り、相場データの作り置きを全部消す
  2. 返ってきたページと地図APIを全部開いて作っておく（朝一番の人を待たせない）
  3. 合図より後に作られた版が返るまで開き直す。Vercel は消した直後の1回目にまだ古い版を返し、裏で作り直す
     （2026-09-28 実測: 合図直後の1回目 age=51 の古い版 → 2回目 age=0）。確かめること:
       - 応答の age（配信側に置かれてからの秒数）が合図からの経過秒数以下
       - 地図APIは中の at（作った時刻）が合図より後で、点が1件以上
       - テーマのページは「<今日の更新日> 更新」の表示がある。トップは「集計日不明」が出ていない
結果は logs/site_refresh.json に書く。日報（actions_report.py）と実行記録（run_log.py → 管理ページ）が
result_for_mode() で読み、問題があれば problem_of() の1行を問題欄に並べる。
全体の締め切りは DEADLINE 秒。何があっても終了コード 0（メール・記録を巻き込まない）。

環境変数: FUDOSAN_REVALIDATE_TOKEN（GitHub Secrets。Vercel の REVALIDATE_TOKEN と同じ値）
          FUDOSAN_SITE_URL（省略時 https://fudosan.nextcode.ltd）
合言葉の入れ替え方と、失敗したときの対処は README「公開サイトの作り直し」。
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULT_PATH = os.path.join(PROJECT_DIR, "logs", "site_refresh.json")
TOKEN_FILE = os.path.expanduser("~/.claude/secrets/uchinalife/revalidate_token")  # 手元で試す時だけ使う
UA = "uchinalife-scraper/site_refresh (+https://github.com/smaho119119-gif/uchinalife-scraper)"
DEADLINE = 150       # 全体の締め切り（秒）。report ジョブの他の工程は約40秒、ジョブの枠は10分
REQUEST_TIMEOUT = 20  # 1回の通信の上限（秒）。上流の初回は数秒かかる
SEND_TRIES = 3       # 合図を送る回数の上限
WAIT_SECONDS = 10    # 古い版のページを開き直す前に待つ秒数（締め切りまで繰り返す）
HOW_TO_FIX = "対処: GitHub の実行ページで report ジョブを再実行（README「公開サイトの作り直し」）"

# HTTP の番号 → オーナーが読んで分かる言葉
_HTTP_WORDS = {
    401: "合言葉が一致しない（Vercel の REVALIDATE_TOKEN と GitHub Secret FUDOSAN_REVALIDATE_TOKEN を同じ値に。"
         "Vercel 側を変えたら出し直しも。Vercel 側が未設定でも同じ番号になる）",
    404: "サイトに合図の入口が無い（サイトを古い版に戻した可能性）",
    405: "サイトに合図の入口が無い（サイトを古い版に戻した可能性）",
}


def _http_words(code: int) -> str:
    if code in _HTTP_WORDS:
        return _HTTP_WORDS[code]
    return f"サイト側の障害（HTTP {code}）" if code >= 500 else f"HTTP {code}"


def _request(url: str, *, method: str = "GET", token: str | None = None,
             timeout: float = REQUEST_TIMEOUT) -> tuple[int, bytes, int | None]:
    """(HTTPコード, 本文, age ヘッダ)。age は配信側の作り置きの経過秒数（無ければ None）。"""
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=max(1.0, timeout)) as r:
            age = r.headers.get("age")
            return r.status, r.read(), int(age) if age and age.isdigit() else None
    except urllib.error.HTTPError as e:
        return e.code, e.read(), None


def _revalidate(base: str, token: str, deadline: float) -> dict:
    """合図を送る。通信の失敗と 5xx は SEND_TRIES 回まで送る（4xx は合言葉や入口の誤りなので送り直さない）。"""
    last = ""
    for attempt in range(1, SEND_TRIES + 1):
        try:
            code, body, _ = _request(f"{base}/api/revalidate", method="POST", token=token,
                                     timeout=min(REQUEST_TIMEOUT, deadline - time.monotonic()))
            if code == 200:
                return json.loads(body)
            last = _http_words(code)
            if code < 500:
                break
        except Exception as e:  # noqa: BLE001 - 通信の失敗・壊れた返事は送り直しの対象
            last = f"通信の失敗（{repr(e)[:120]}）"
        if attempt < SEND_TRIES and time.monotonic() + 5 * attempt < deadline:
            time.sleep(5 * attempt)
        else:
            break
    raise RuntimeError(f"作り直しの合図が通りませんでした: {last}")


def _date_shown(text: str, want: str) -> bool:
    """「2026/09/28 更新」の表示があるか。React は日付と「更新」の間に <!-- --> を挟む。
    物件の宣伝文に同じ日付が入っていても通らないよう、「更新」と続く形だけを見る。"""
    return re.search(re.escape(want) + r"(?:<!-- -->)?\s*更新", text) is not None


def _check(base: str, path: str, want_date: str, since: float, deadline: float) -> str | None:
    """開いて作っておく。問題があれば短い説明、無ければ None。since = 合図を送った時刻（time.time()）。"""
    try:
        code, body, age = _request(base + path, timeout=min(REQUEST_TIMEOUT, deadline - time.monotonic()))
    except Exception as e:  # noqa: BLE001
        return f"開けない（{repr(e)[:80]}）"
    if code != 200:
        return _http_words(code)
    if age is not None and age > time.time() - since + 2:  # 合図より前に作られた版（2秒は時計の丸め分）
        return f"古い版のまま（{age}秒前に作成）"
    if path.startswith("/api/points/"):
        try:
            d = json.loads(body)
        except ValueError:
            return "地図の点が読めない"
        at = d.get("at")
        if not at or datetime.fromisoformat(at.replace("Z", "+00:00")).timestamp() < since - 2:
            return "古い版のまま"
        return None if d.get("count") else "地図の点が0件"
    text = body.decode("utf-8", "replace")
    if "ただいま読み込めませんでした" in text or "集計日不明" in text:
        return "データを読み込めなかった版が出ている"
    if path.startswith("/sagasu") and not _date_shown(text, want_date):
        return "更新日が古いまま"
    return None


def refresh(base: str, token: str) -> dict:
    started = time.monotonic()
    deadline = started + DEADLINE
    since = time.time()
    info = _revalidate(base, token, deadline)
    if not info.get("asOf"):
        raise RuntimeError("サイトが今日の更新日を返しませんでした（相場APIの障害の可能性）")
    want = info["asOf"].replace("-", "/")  # ページの表示は 2026/09/28 の形
    paths = list(info.get("pages") or []) + list(info.get("points") or [])
    if not paths:
        raise RuntimeError("サイトが開くページの一覧を返しませんでした")
    labels = info.get("labels") or {}
    pending = {p: "未確認" for p in paths}
    rounds = 0
    while pending:
        if rounds:
            if time.monotonic() + WAIT_SECONDS >= deadline:
                break
            time.sleep(WAIT_SECONDS)
        rounds += 1
        still = {}
        for p in pending:
            if time.monotonic() >= deadline:
                still[p] = pending[p] if rounds > 1 else "締め切りまでに開けなかった"
                continue
            if (why := _check(base, p, want, since, deadline)):
                still[p] = why
        pending = still
    return {
        "ok": not pending,
        "asOf": info["asOf"],
        "checked": len(paths),
        "rounds": rounds,  # 何周目で全部そろったか（そろわなければ締め切りまでの周回数）
        "bad": {labels.get(p, p): why for p, why in pending.items()},  # {呼び名: 理由}
        "seconds": round(time.monotonic() - started, 1),
    }


def problem_of(site: dict | None) -> str | None:
    """日報・実行記録の「問題」に並べる1行。問題が無い・対象外の回なら None。"""
    if not site or site.get("ok") is not False:
        return None
    if site.get("error"):
        return f"公開サイトの作り直しで問題（収集とは別）: {site['error']}。{HOW_TO_FIX}"
    bad = site.get("bad") or {}
    shown = "・".join(f"{name}＝{why}" for name, why in list(bad.items())[:3])
    more = f" ほか{len(bad) - 3}か所" if len(bad) > 3 else ""
    return (f"公開サイトの作り直しで問題（収集とは別）: {shown}{more}。"
            f"昨日の版が出ている可能性（見に来た人がいれば1時間で直る）。{HOW_TO_FIX}")


def read_result(path: str = RESULT_PATH) -> dict | None:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"結果ファイル site_refresh.json を読めません（{e}）"}


def result_for_mode(mode: str | None, path: str = RESULT_PATH) -> dict | None:
    """日報と実行記録が同じ判断をするための入口。作り直すのは本番（full）の回だけで、
    その回に結果ファイルが無ければ、工程が動かなかったこと自体を問題にする。"""
    if mode != "full":
        return None
    site = read_result(path)
    if site is None:
        return {"ok": False, "error": "結果の記録なし（作り直しの工程が動いていない）"}
    return site


def _token() -> str:
    token = (os.getenv("FUDOSAN_REVALIDATE_TOKEN") or "").strip()
    if not token and os.path.exists(TOKEN_FILE) and not os.getenv("GITHUB_ACTIONS"):
        with open(TOKEN_FILE, encoding="utf-8") as f:
            token = f.read().strip()
    return token


def main() -> int:
    base = (os.getenv("FUDOSAN_SITE_URL") or "https://fudosan.nextcode.ltd").rstrip("/")
    try:
        token = _token()
        if not token:
            raise RuntimeError("合言葉が未設定（GitHub の Settings → Secrets and variables → Actions に "
                               "FUDOSAN_REVALIDATE_TOKEN を登録）")
        result = refresh(base, token)
    except Exception as e:  # noqa: BLE001 - 何があっても本体を巻き込まない
        result = {"ok": False, "error": str(e)[:400]}
    result["at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        os.makedirs(os.path.dirname(RESULT_PATH), exist_ok=True)
        with open(RESULT_PATH, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)
    except OSError as e:
        print(f"site_refresh.json を書けませんでした: {e}", file=sys.stderr)
    print("公開サイト: " + (problem_of(result) or
          f"作り直し完了（{result['checked']}か所・{result['rounds']}周・更新日 {result['asOf']}・{result['seconds']}秒）"),
          flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
