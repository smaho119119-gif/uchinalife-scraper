#!/bin/bash

# Absolute paths (launchd does not inherit user PATH)
PYTHON="/Users/hiroki/miniconda3/bin/python3"
GTIMEOUT="/opt/homebrew/bin/gtimeout"
PROJECT_DIR="/Users/hiroki/Documents/うちなーらいふスクレイピング"
LOGS_DIR="${PROJECT_DIR}/logs"
HEALTH_FILE="${LOGS_DIR}/last_run.json"
PID_FILE="${LOGS_DIR}/run_daily_scraper.pid"
SCRAPER_LOG="${LOGS_DIR}/scraper.log"
LOG_MAX_BYTES=$((10 * 1024 * 1024))  # 10 MB

cd "$PROJECT_DIR" || exit 1
mkdir -p "$LOGS_DIR"

# --- Log rotation (B-007) ----------------------------------------------------
# launchd opens StandardOutPath at load time and keeps writing through that FD,
# so we cannot rotate the launchd-owned log by mv. We rotate scraper.log only
# when this script writes additional output to it; for the launchd-owned file,
# size-based rotation is performed by the user via launchctl re-load. Here we
# at least cap the *content* this script writes by truncating-on-overflow.
if [ -f "$SCRAPER_LOG" ]; then
    LOG_SIZE=$(/usr/bin/stat -f%z "$SCRAPER_LOG" 2>/dev/null || echo 0)
    if [ "$LOG_SIZE" -gt "$LOG_MAX_BYTES" ]; then
        ARCHIVE="${SCRAPER_LOG}.$(date +%Y%m%d_%H%M%S)"
        cp "$SCRAPER_LOG" "$ARCHIVE" 2>/dev/null && : > "$SCRAPER_LOG"
        echo "[$(date)] Rotated scraper.log -> $(basename "$ARCHIVE")"
    fi
fi

# --- PID lock (B-006) --------------------------------------------------------
# Prevent duplicate runs even when a previous job is hung (no marker yet).
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "[$(date)] Another scraper run is in progress (PID $OLD_PID). Exiting."
        exit 0
    fi
    echo "[$(date)] Stale PID file found (PID $OLD_PID not running). Cleaning up."
    rm -f "$PID_FILE"
fi
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT INT TERM

TODAY=$(date +%Y%m%d)
MARKER_FILE="${LOGS_DIR}/success_${TODAY}.marker"

# Kill any leftover Chromium from previous runs BEFORE starting
pkill -9 -f "chromium.*--headless" 2>/dev/null

# Check if already ran successfully today
if [ -f "$MARKER_FILE" ]; then
    echo "[$(date)] Already ran for today ($TODAY). Exiting."
    exit 0
fi

# Pre-flight checks
ERRORS=""
if [ ! -x "$PYTHON" ]; then
    ERRORS="${ERRORS}Python not found at $PYTHON. "
fi
if [ ! -x "$GTIMEOUT" ]; then
    ERRORS="${ERRORS}gtimeout not found at $GTIMEOUT. "
fi
if [ ! -f "${PROJECT_DIR}/integrated_scraper.py" ]; then
    ERRORS="${ERRORS}integrated_scraper.py not found. "
fi

if [ -n "$ERRORS" ]; then
    echo "[$(date)] Pre-flight check FAILED: $ERRORS"
    cat > "$HEALTH_FILE" <<EOJSON
{"date":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","status":"preflight_error","error":"$ERRORS"}
EOJSON
    exit 1
fi

echo "[$(date)] Starting daily scraping..."

# Run the scraper with unbuffered output and timeout (2 hours max).
# --kill-after=300 forces SIGKILL 5 minutes after SIGTERM if scraper ignores it
# (B-002, B-003).
"$GTIMEOUT" --kill-after=300 7200 "$PYTHON" -u integrated_scraper.py
EXIT_CODE=$?

# Always cleanup Chromium and any leftover python after run (even on success)
pkill -9 -f "chromium.*--headless" 2>/dev/null
pkill -9 -f "integrated_scraper.py" 2>/dev/null

if [ $EXIT_CODE -eq 0 ]; then
    touch "$MARKER_FILE"
    echo "[$(date)] Scraping completed successfully for $TODAY."
    cat > "$HEALTH_FILE" <<EOJSON
{"date":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","status":"success","exit_code":0}
EOJSON
elif [ $EXIT_CODE -eq 124 ] || [ $EXIT_CODE -eq 137 ]; then
    # 124 = SIGTERM by timeout, 137 = SIGKILL after --kill-after window
    echo "[$(date)] Scraping timed out (exit $EXIT_CODE)."
    cat > "$HEALTH_FILE" <<EOJSON
{"date":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","status":"timeout","exit_code":$EXIT_CODE}
EOJSON
    exit 1
else
    echo "[$(date)] Scraping failed with exit code $EXIT_CODE."
    cat > "$HEALTH_FILE" <<EOJSON
{"date":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","status":"failed","exit_code":$EXIT_CODE}
EOJSON
    exit 1
fi
