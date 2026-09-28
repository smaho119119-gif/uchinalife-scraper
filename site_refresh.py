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
  3. 合図より後に作られた版が返るまで開き直す。消した直後はまだ古い版が返ることがあり、裏で作り直される
     （2026-09-28 実測: /sagasu/hiraya が age=57→62→3。通しの実行では1〜3周でそろった。原因は未確認）。確かめること:
       - 応答の age（配信側に置かれてからの秒数）が合図からの経過秒数以下
       - 地図APIは中の at（作った時刻）が合図より後、asOf（データの日付）が今日の更新日で、点が1件以上
       - テーマ一覧とテーマのページは「<今日の更新日> 更新」、トップは「<今日の更新日>時点」の表示がある
     更新日（asOf）が合図の返事に無いときも全部開いて作っておき、日付の確認だけ「できなかった」と問題に出す
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
# report ジョブの再実行は日報がもう1通届き記録も上書きされるので、作り直しだけを手元で流す
HOW_TO_FIX = "対処: 手元で python3 site_refresh.py（Claude に「公開サイトを作り直して」でよい。README「公開サイトの作り直し」）"
# 合言葉の食い違いは手元で流しても次の夜にまた落ちるので、入れ替え手順を案内する
HOW_TO_FIX_TOKEN = "対処: README「合言葉の入れ替え」の手順で Vercel と GitHub Secret を同じ値にする"
# 未設定なら、控えの値（Vercel と同じ）を GitHub Secret に登録するだけでよい
HOW_TO_FIX_UNSET = ("対処: 控え ~/.claude/secrets/uchinalife/revalidate_token の値（Vercel の REVALIDATE_TOKEN と同じ）を "
                    "GitHub の Settings → Secrets and variables → Actions に FUDOSAN_REVALIDATE_TOKEN として登録")

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
                info = json.loads(body)
                # 返事の形が崩れていたら送り直さず止める（辞書でない・一覧が文字列だと1文字ずつ開いてしまう）
                if not isinstance(info, dict) or not all(isinstance(info.get(k) or [], list) for k in ("pages", "points")):
                    raise RuntimeError("作り直しの合図の返事の形が想定と違う（サイト側の /api/revalidate を確認）")
                return info
            last = _http_words(code)
            if code < 500:
                break
        except RuntimeError:
            raise
        except Exception as e:  # noqa: BLE001 - 通信の失敗・読めない返事は送り直しの対象
            last = f"通信の失敗（{repr(e)[:120]}）"
        if attempt < SEND_TRIES and time.monotonic() + 5 * attempt < deadline:
            time.sleep(5 * attempt)
        else:
            break
    raise RuntimeError(f"作り直しの合図が通りませんでした: {last}")


def _date_shown(text: str, as_of: str, top: bool = False) -> bool:
    """今日の更新日の表示があるか（as_of は 2026-09-28 の形）。React は日付と後ろの語の間に <!-- --> を挟む。
    物件の宣伝文に同じ日付が入っていても通らないよう、後ろに「更新」（トップは「時点」）と続く形だけを見る。
    テーマのページは 2026/09/28、トップは 2026/9/28（0を詰めない）の形で出る。"""
    y, m, d = as_of.split("-")
    date = f"{y}/{int(m)}/{int(d)}" if top else f"{y}/{m}/{d}"
    word = "時点" if top else "更新"
    return re.search(re.escape(date) + r"(?:<!-- -->)?\s*" + word, text) is not None


def _check(base: str, path: str, as_of: str | None, since: float, deadline: float) -> str | None:
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
            if not isinstance(d, dict):
                return "地図の中身の形が想定と違う"
            at = datetime.fromisoformat(str(d.get("at")).replace("Z", "+00:00")).timestamp()
        except ValueError:
            return "地図の中身（作った時刻）が読めない"
        if at < since - 2:
            return "古い版のまま"
        if as_of and d.get("asOf") != as_of:
            return f"地図のデータが古いまま（{d.get('asOf')}）"
        return None if d.get("count") else "地図の点が0件"
    text = body.decode("utf-8", "replace")
    if "集計日不明" in text:
        return "データを読み込めなかった版が出ている"
    try:
        if as_of and not _date_shown(text, as_of, top=path == "/"):
            return "更新日が古いまま"
    except ValueError:
        return f"更新日の形が想定と違う（{as_of}）"
    return None


def refresh(base: str, token: str) -> dict:
    started = time.monotonic()
    deadline = started + DEADLINE
    since = time.time()
    info = _revalidate(base, token, deadline)
    as_of = info.get("asOf")  # 取れなくても作り置きは消えているので、開いて作るのは続ける
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
            if (why := _check(base, p, as_of, since, deadline)):
                still[p] = why
        pending = still
    if not as_of:
        pending["更新日"] = "サイトが今日の更新日を返さず、日付を確かめられなかった（相場APIの一時的な障害の可能性）"
    return {
        "ok": not pending,
        "asOf": as_of,
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
        err = site["error"]
        fix = ("対処: サイトの web/app/api/revalidate/route.ts の返事（pages・points が一覧）を直して出し直し、"
               "そのあと手元で python3 site_refresh.py" if "返事の形" in err
               else HOW_TO_FIX_UNSET if "合言葉が未設定" in err
               else "対処: 控えのファイルを Vercel の REVALIDATE_TOKEN と同じ値で作り直す" if "合言葉が見つからない" in err
               else HOW_TO_FIX_TOKEN if "合言葉" in err else HOW_TO_FIX)
        return f"公開サイトの作り直しで問題（収集とは別）: {err}。{fix}"
    bad = site.get("bad") or {}
    shown = "・".join(f"{name}＝{why}" for name, why in list(bad.items())[:3])
    more = f" ほか{len(bad) - 3}か所" if len(bad) > 3 else ""
    return (f"公開サイトの作り直しで問題（収集とは別）: {shown}{more}。"
            f"前の日の版が出ている可能性（次に誰かが開いたとき作り直されるが、相場APIの障害中は直らない）。{HOW_TO_FIX}")


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


def _write(result: dict) -> None:
    result["at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        os.makedirs(os.path.dirname(RESULT_PATH), exist_ok=True)
        with open(RESULT_PATH, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)
    except OSError as e:
        print(f"site_refresh.json を書けませんでした: {e}", file=sys.stderr)


def main() -> int:
    base = (os.getenv("FUDOSAN_SITE_URL") or "https://fudosan.nextcode.ltd").rstrip("/")
    # 先に「途中で打ち切られた」を書いておく（工程の4分の打ち切りで止まっても、日報に正しい理由が出る）
    _write({"ok": False, "error": "作り直しが途中で打ち切られた（4分を超えた）"})
    try:
        token = _token()
        if not token:
            if os.getenv("GITHUB_ACTIONS"):
                raise RuntimeError("合言葉が未設定（GitHub Secret FUDOSAN_REVALIDATE_TOKEN が無い）")
            raise RuntimeError(f"合言葉が見つからない（手元: 環境変数 FUDOSAN_REVALIDATE_TOKEN も控え {TOKEN_FILE} も無い）")
        result = refresh(base, token)
    except Exception as e:  # noqa: BLE001 - 何があっても本体を巻き込まない
        result = {"ok": False, "error": str(e)[:400]}
    _write(result)
    print("公開サイト: " + (problem_of(result) or
          f"作り直し完了（{result['checked']}か所・{result['rounds']}周・更新日 {result['asOf']}・{result['seconds']}秒）"),
          flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
