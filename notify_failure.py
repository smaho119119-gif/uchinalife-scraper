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
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(PROJECT_DIR, "logs")


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


def send(subject: str, body: str, *, force: bool = False) -> int:
    _load_env()
    os.makedirs(LOGS_DIR, exist_ok=True)

    flag = _today_flag()
    if not force and os.path.exists(flag):
        print(f"alert already sent today ({flag}); skipping", flush=True)
        return 0

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
        return 2

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((sender_name, sender)) if sender_name else sender
    msg["To"] = to
    msg["Date"] = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    msg.set_content(body)

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
    except Exception as e:
        print(f"smtp send failed: {e}", file=sys.stderr)
        return 3

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
