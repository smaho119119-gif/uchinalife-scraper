#!/usr/bin/env python3
"""Send a failure-alert email via XServer SMTP.

Invoked from check_scraper_health.sh when consecutive failures are detected.
Idempotent for the day via logs/alert_sent_YYYYMMDD.flag — at most one mail
per UTC date so we don't blast the inbox if launchd retries the health check.

Usage:
    notify_failure.py <subject> <body_file_or_-_for_stdin>
"""
from __future__ import annotations

import os
import smtplib
import ssl
import time
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(PROJECT_DIR, "logs")

# 直前の send() の結果（経路・中継の地域・最後のエラー文）。戻り値（終了コード）だけでは
# 「どこから送れたか／なぜ落ちたか」が分からないので、実行記録（run_log.py）用に残す。
LAST_RESULT: dict = {}


def _set_last(**kw) -> None:
    # エラー文にはSMTPの宛先・ユーザー名が入ることがある（例: 554 の拒否）。記録には伏せ字で残す
    err = kw.get("error")
    if err:
        for k in ("ALERT_TO", "SMTP_USER", "SMTP_FROM", "SMTP_PASS", "MAIL_RELAY_TOKEN"):
            v = os.environ.get(k)
            if v and len(v) >= 4:
                err = err.replace(v, "***")
        kw["error"] = err
    LAST_RESULT.clear()
    LAST_RESULT.update(kw)


def _load_env() -> None:
    """Lightweight .env loader — avoids the python-dotenv runtime dependency."""
    env_path = os.path.join(PROJECT_DIR, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)


def _today_flag() -> str:
    return os.path.join(LOGS_DIR, f"alert_sent_{datetime.now().strftime('%Y%m%d')}.flag")


def _read_body(spec: str) -> str:
    if spec == "-":
        return sys.stdin.read()
    if os.path.isfile(spec):
        with open(spec, "r", encoding="utf-8") as f:
            return f.read()
    return spec  # treat as inline body


def _send_via_relay(url: str, subject: str, body: str, flag: str, html: str | None = None) -> int:
    """Send through the Tokyo relay (mail-relay/, Vercel hnd1).

    XServer SMTP rejects GitHub Actions' overseas IPs with 554 5.7.1, so the
    cloud run posts here instead. The relay fixes the recipient to ALERT_TO.
    """
    import json
    import urllib.request

    token = os.environ.get("MAIL_RELAY_TOKEN", "")
    payload = {"subject": subject, "body": body}
    if html:
        payload["html"] = html
    data = json.dumps(payload).encode("utf-8")
    last_error = ""
    for attempt in range(1, 4):
        req = urllib.request.Request(url, data=data, method="POST", headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "uchinalife-scraper/1.0",
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            if result.get("ok"):
                try:
                    with open(flag, "w", encoding="utf-8") as f:
                        f.write(f"sent at {datetime.now().isoformat()} via relay\nsubject: {subject}\n")
                except OSError:
                    pass
                print(f"alert sent via relay ({result.get('region')})", flush=True)
                _set_last(sent=True, exit_code=0, via="relay", region=result.get("region"),
                          attempts=attempt, error=last_error or None)
                return 0
            last_error = str(result)[:300]
            print(f"relay send failed (attempt {attempt}/3): {result}", file=sys.stderr)
        except Exception as e:
            detail = e.read().decode("utf-8", "replace")[:200] if hasattr(e, "read") else ""
            last_error = f"{e} {detail}".strip()[:300]
            print(f"relay send failed (attempt {attempt}/3): {e} {detail}", file=sys.stderr)
        if attempt < 3:
            time.sleep(30 * attempt)
    _set_last(sent=False, exit_code=3, via="relay", region=None, attempts=3, error=last_error)
    return 3


def send(subject: str, body: str, *, force: bool = False, html: str | None = None) -> int:
    _load_env()
    os.makedirs(LOGS_DIR, exist_ok=True)
    LAST_RESULT.clear()

    flag = _today_flag()
    if not force and os.path.exists(flag):
        print(f"alert already sent today ({flag}); skipping", flush=True)
        _set_last(sent=False, exit_code=0, via="skipped", region=None, attempts=0,
                  error="本日は送信済みのため省略")
        return 0

    relay_url = os.environ.get("MAIL_RELAY_URL")
    if relay_url:
        return _send_via_relay(relay_url, subject, body, flag, html)

    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")
    sender = os.environ.get("SMTP_FROM", user or "")
    sender_name = os.environ.get("SMTP_FROM_NAME", "")
    to = os.environ.get("ALERT_TO")

    missing = [k for k, v in [
        ("SMTP_HOST", host), ("SMTP_USER", user),
        ("SMTP_PASS", password), ("ALERT_TO", to),
    ] if not v]
    if missing:
        print(f"missing SMTP env vars: {missing}", file=sys.stderr)
        _set_last(sent=False, exit_code=2, via="smtp", region=None, attempts=0,
                  error=f"missing SMTP env vars: {missing}")
        return 2

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((sender_name, sender)) if sender_name else sender
    msg["To"] = to
    msg["Date"] = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    context = ssl.create_default_context()
    # 一時的なSMTP障害で知らせが消えないよう、間を空けて3回まで試す
    last_error = ""
    for attempt in range(1, 4):
        try:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
            break
        except Exception as e:
            last_error = str(e)[:300]
            print(f"smtp send failed (attempt {attempt}/3): {e}", file=sys.stderr)
            if attempt == 3:
                _set_last(sent=False, exit_code=3, via="smtp", region=None, attempts=3, error=last_error)
                return 3
            time.sleep(30 * attempt)
    _set_last(sent=True, exit_code=0, via="smtp", region=None, attempts=attempt, error=last_error or None)

    # Only mark as sent on success
    try:
        with open(flag, "w", encoding="utf-8") as f:
            f.write(f"sent at {datetime.now().isoformat()}\nsubject: {subject}\n")
    except OSError as e:
        print(f"warning: could not write flag {flag}: {e}", file=sys.stderr)

    print(f"alert sent to {to}", flush=True)
    return 0


def main(argv: list[str]) -> int:
    force = False
    args = argv[1:]
    if "--force" in args:
        force = True
        args = [a for a in args if a != "--force"]
    if len(args) < 2:
        print(__doc__, file=sys.stderr)
        return 64
    subject, body_spec = args[0], args[1]
    body = _read_body(body_spec)
    return send(subject, body, force=force)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
