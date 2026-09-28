"""公開サイトの作り直し（site_refresh.py）と、その結果を読む日報・実行記録・埋め戻しの検査。通信はしない。

    python3 -m unittest tests/test_site_refresh.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest
from datetime import datetime, timezone
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import site_refresh as sr  # noqa: E402
from tools import backfill_runs  # noqa: E402

BASE = "https://example.test"
THEME_HTML = '<span>3,429</span><span>2026/09/28<!-- --> 更新・毎晩入れ替わります</span>'
AD_HTML = '<p>2026/08/14価格変更しました</p><span>2026/09/28<!-- --> 更新</span>'
TOP_HTML = '沖縄の売り物件 16,759件 を毎日更新（2026/9/28<!-- -->時点・当社集計）'


def points_body(as_of: str, at: float, count: int = 5) -> bytes:
    iso = datetime.fromtimestamp(at, timezone.utc).isoformat().replace("+00:00", "Z")
    return json.dumps({"theme": "sea", "count": count, "asOf": as_of, "at": iso, "points": []}).encode()


class DateShown(unittest.TestCase):
    def test_theme_page_date(self):
        self.assertTrue(sr._date_shown(THEME_HTML, "2026-09-28"))
        self.assertFalse(sr._date_shown(THEME_HTML, "2026-09-27"))

    def test_same_date_in_ad_text_does_not_pass(self):
        # 宣伝文の「2026/08/14価格変更」で通っていた（旧判定は単なる含む検査）
        self.assertIn("2026/08/14", AD_HTML)
        self.assertFalse(sr._date_shown(AD_HTML, "2026-08-14"))

    def test_top_page_uses_unpadded_date_and_jiten(self):
        self.assertTrue(sr._date_shown(TOP_HTML, "2026-09-28", top=True))
        self.assertFalse(sr._date_shown(TOP_HTML, "2026-09-27", top=True))
        self.assertFalse(sr._date_shown(TOP_HTML, "2026-09-28"))  # トップに「更新」の形は無い


class Check(unittest.TestCase):
    def run_check(self, path, body, age, as_of="2026-09-28", since=None, code=200):
        since = time.time() - 10 if since is None else since
        with mock.patch.object(sr, "_request", return_value=(code, body, age)):
            return sr._check(BASE, path, as_of, since, time.monotonic() + 30)

    def test_fresh_page_passes(self):
        self.assertIsNone(self.run_check("/sagasu/umi", THEME_HTML.encode(), 3))
        self.assertIsNone(self.run_check("/", TOP_HTML.encode(), 3))

    def test_page_built_before_signal_fails(self):
        self.assertIn("古い版", self.run_check("/sagasu/umi", THEME_HTML.encode(), 57))

    def test_old_date_fails(self):
        self.assertEqual(self.run_check("/sagasu/umi", THEME_HTML.encode(), 3, as_of="2026-09-29"), "更新日が古いまま")
        self.assertEqual(self.run_check("/", TOP_HTML.encode(), 3, as_of="2026-09-29"), "更新日が古いまま")

    def test_top_with_empty_body_fails(self):
        # 本文が "x" だけのトップが合格になっていた
        self.assertEqual(self.run_check("/", b"x", 3), "更新日が古いまま")

    def test_failed_data_version_fails(self):
        self.assertIn("読み込めなかった", self.run_check("/", "（集計日不明時点）".encode(), 3))

    def test_points(self):
        since = time.time() - 10
        self.assertIsNone(self.run_check("/api/points/sea", points_body("2026-09-28", since + 1), 0, since=since))
        self.assertEqual(self.run_check("/api/points/sea", points_body("2026-09-28", since - 60), 0, since=since), "古い版のまま")
        self.assertIn("地図のデータが古い", self.run_check("/api/points/sea", points_body("2026-09-27", since + 1), 0, since=since))
        self.assertEqual(self.run_check("/api/points/sea", points_body("2026-09-28", since + 1, 0), 0, since=since), "地図の点が0件")

    def test_broken_values_are_words_not_crashes(self):
        since = time.time() - 10
        bad_at = json.dumps({"count": 1, "asOf": "2026-09-28", "at": "きのう"}).encode()
        self.assertIn("読めない", self.run_check("/api/points/sea", bad_at, 0, since=since))
        self.assertIn("形が想定と違う", self.run_check("/sagasu/umi", THEME_HTML.encode(), 3, as_of="2026/09/28"))
        for body in (b"[]", b'"x"', b"null"):  # 返事が辞書でなくても全体を止めない
            self.assertIn("形が想定と違う", self.run_check("/api/points/sea", body, 0, since=since))

    def test_http_words(self):
        self.assertIn("合言葉が一致しない", self.run_check("/", b"", None, code=401))
        self.assertIn("サイト側の障害", self.run_check("/", b"", None, code=503))


class Revalidate(unittest.TestCase):
    """合図を送る所: 5xx と通信の失敗は送り直す、4xx は1回で止める、200 の返事を読む。"""

    def send(self, answers):
        calls = []

        def fake(url, method="GET", token=None, timeout=0):
            calls.append(method)
            a = answers[len(calls) - 1]
            if isinstance(a, Exception):
                raise a
            return a

        with mock.patch.object(sr, "_request", fake), mock.patch.object(sr.time, "sleep", lambda s: None):
            try:
                return sr._revalidate(BASE, "t", time.monotonic() + 60), calls
            except RuntimeError as e:
                return str(e), calls

    def test_401_stops_at_once(self):
        r, calls = self.send([(401, b"", None)] * 3)
        self.assertEqual(len(calls), 1)
        self.assertIn("合言葉が一致しない", r)

    def test_5xx_then_ok(self):
        r, calls = self.send([(503, b"", None), (200, json.dumps({"asOf": "2026-09-28"}).encode(), None)])
        self.assertEqual(len(calls), 2)
        self.assertEqual(r["asOf"], "2026-09-28")

    def test_gives_up_after_three(self):
        r, calls = self.send([OSError("timed out")] * 3)
        self.assertEqual(len(calls), 3)
        self.assertIn("通信の失敗", r)

    def test_broken_reply_stops_without_retry(self):
        for body in (b"[]", json.dumps({"asOf": "2026-09-28", "pages": "/abc"}).encode()):
            r, calls = self.send([(200, body, None)] * 3)
            self.assertEqual(len(calls), 1)
            self.assertIn("返事の形が想定と違う", r)

    def test_uses_post(self):
        _, calls = self.send([(200, b"{}", None)])
        self.assertEqual(calls, ["POST"])


class Refresh(unittest.TestCase):
    INFO = {"asOf": "2026-09-28", "pages": ["/", "/sagasu/umi"], "points": ["/api/points/sea"],
            "labels": {"/": "トップ", "/sagasu/umi": "テーマ「海のそば」", "/api/points/sea": "地図「海のそば」"}}

    def setUp(self):
        self.p = [mock.patch.object(sr, "WAIT_SECONDS", 0.01), mock.patch.object(sr.time, "sleep", lambda s: None)]
        for p in self.p:
            p.start()

    def tearDown(self):
        for p in self.p:
            p.stop()

    def test_waits_until_every_path_is_fresh(self):
        calls = {}

        def check(base, path, as_of, since, deadline):
            calls[path] = calls.get(path, 0) + 1
            return "古い版のまま（57秒前に作成）" if calls[path] <= 2 else None

        with mock.patch.object(sr, "_revalidate", return_value=self.INFO), mock.patch.object(sr, "_check", check):
            r = sr.refresh(BASE, "t")
        self.assertTrue(r["ok"])
        self.assertEqual(r["rounds"], 3)

    def test_stops_at_deadline_and_reports_by_label(self):
        with mock.patch.object(sr, "DEADLINE", 0.2), mock.patch.object(sr, "_revalidate", return_value=self.INFO), \
                mock.patch.object(sr, "_check", lambda *a: "古い版のまま"):
            start = time.monotonic()
            r = sr.refresh(BASE, "t")
        self.assertFalse(r["ok"])
        self.assertLess(time.monotonic() - start, 5)
        self.assertEqual(set(r["bad"]), {"トップ", "テーマ「海のそば」", "地図「海のそば」"})

    def test_missing_as_of_still_warms_and_reports(self):
        seen = []
        info = dict(self.INFO, asOf=None)
        with mock.patch.object(sr, "_revalidate", return_value=info), \
                mock.patch.object(sr, "_check", lambda b, p, a, s, d: seen.append((p, a))):
            r = sr.refresh(BASE, "t")
        self.assertEqual([p for p, _ in seen], ["/", "/sagasu/umi", "/api/points/sea"])  # 全部開いた
        self.assertFalse(r["ok"])
        self.assertIn("更新日", r["bad"])


class Reporting(unittest.TestCase):
    def test_result_for_mode(self):
        missing = os.path.join(tempfile.mkdtemp(), "none.json")
        self.assertIn("記録なし", sr.result_for_mode("full", missing)["error"])
        for mode in ("collect-only", "mail-test", None):
            self.assertIsNone(sr.result_for_mode(mode, missing))

    def test_problem_of(self):
        self.assertIsNone(sr.problem_of(None))
        self.assertIsNone(sr.problem_of({"ok": True}))
        line = sr.problem_of({"ok": False, "bad": {"a": "1", "b": "2", "c": "3", "d": "4"}})
        self.assertIn("収集とは別", line)
        self.assertIn("ほか1か所", line)
        self.assertIn("python3 site_refresh.py", line)
        self.assertNotIn("再実行", line)  # 日報が二重に届く対処は案内しない
        token_line = sr.problem_of({"ok": False, "error": "作り直しの合図が通りませんでした: 合言葉が一致しない（…）"})
        self.assertIn("合言葉の入れ替え", token_line)  # 手元で流しても次の夜にまた落ちる
        unset = sr.problem_of({"ok": False, "error": "合言葉が未設定（GitHub Secret FUDOSAN_REVALIDATE_TOKEN が無い）"})
        self.assertIn("として登録", unset)
        self.assertNotIn("入れ替え", unset)  # 案内は1つだけ

    def test_local_missing_token_is_not_called_github_secret(self):
        path = os.path.join(tempfile.mkdtemp(), "site_refresh.json")
        env = {k: v for k, v in os.environ.items() if k not in ("FUDOSAN_REVALIDATE_TOKEN", "GITHUB_ACTIONS")}
        with mock.patch.object(sr, "RESULT_PATH", path), mock.patch.object(sr, "TOKEN_FILE", "/nonexistent"), \
                mock.patch.dict(os.environ, env, clear=True):
            sr.main()
        err = json.load(open(path, encoding="utf-8"))["error"]
        self.assertIn("合言葉が見つからない", err)
        self.assertNotIn("Secret", sr.problem_of({"ok": False, "error": err}).split("対処:")[1])

    def test_main_writes_interrupted_first(self):
        # 工程の4分の打ち切りで止まっても「途中で打ち切られた」が残る
        path = os.path.join(tempfile.mkdtemp(), "site_refresh.json")
        seen = {}

        def refresh(base, token):
            seen.update(json.load(open(path, encoding="utf-8")))
            return {"ok": True, "asOf": "2026-09-28", "checked": 1, "rounds": 1, "bad": {}, "seconds": 0.1}

        with mock.patch.object(sr, "RESULT_PATH", path), mock.patch.object(sr, "refresh", refresh), \
                mock.patch.dict(os.environ, {"FUDOSAN_REVALIDATE_TOKEN": "t"}):
            sr.main()
        self.assertIn("打ち切られた", seen["error"])
        self.assertTrue(json.load(open(path, encoding="utf-8"))["ok"])


class Backfill(unittest.TestCase):
    LOG = "\n".join([
        "2026-09-29T06:40:00.0Z ##[group]Run mkdir -p logs",
        "2026-09-29T06:40:00.0Z python3 site_refresh.py",
        "2026-09-29T06:40:40.0Z 公開サイト: 公開サイトの作り直しで問題（収集とは別）: テーマ「ペット」＝更新日が古いまま。"
        "前の日の版が出ている可能性（…）。対処: 手元で python3 site_refresh.py",
        "2026-09-29T06:40:41.0Z ##[error]Process completed with exit code 3",
        "2026-09-29T06:40:42.0Z ##[group]Run mkdir -p logs",
        "2026-09-29T06:40:42.0Z python actions_report.py results",
        "2026-09-29T06:40:50.0Z alert sent via relay (hnd1)",
    ])

    def test_site_from_log(self):
        self.assertEqual(backfill_runs.site_from_log(self.LOG)["ok"], False)
        self.assertIn("テーマ「ペット」", backfill_runs.site_from_log(self.LOG)["error"])
        self.assertTrue(backfill_runs.site_from_log("公開サイト: 作り直し完了（20か所）")["ok"])
        self.assertIsNone(backfill_runs.site_from_log("古い実行のログ"))
        cut = "##[group]Run mkdir -p logs\npython3 site_refresh.py\n##[error]The action has timed out."
        self.assertIn("打ち切られた", backfill_runs.site_from_log(cut)["error"])  # 本番の記録と同じ判断

    def test_mail_step_is_not_confused_with_refresh_step(self):
        mail = backfill_runs.mail_from_log(self.LOG, "daily_report")
        self.assertTrue(mail["sent"])
        self.assertEqual(mail["exit_code"], 0)  # 作り直しの段の exit code 3 を拾わない

    def test_refresh_step_alone_is_not_a_mail_result(self):
        # メールの段が走らなかった回に、作り直しの段の exit code をメールの結果と取り違えない
        only_refresh = "\n".join(self.LOG.splitlines()[:4])
        self.assertIsNone(backfill_runs.mail_from_log(only_refresh, "daily_report"))


if __name__ == "__main__":
    unittest.main()
