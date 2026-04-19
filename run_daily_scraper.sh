#!/bin/bash

# Absolute paths (launchd does not inherit user PATH)
PYTHON="/Users/hiroki/miniconda3/bin/python3"
GTIMEOUT="/opt/homebrew/bin/gtimeout"
PROJECT_DIR="/Users/hiroki/Documents/うちなーらいふスクレイピング"
LOGS_DIR="${PROJECT_DIR}/logs"
HEALTH_FILE="${LOGS_DIR}/last_run.json"

cd "$PROJECT_DIR"
mkdir -p "$LOGS_DIR"

TODAY=$(date +%Y%m%d)
MARKER_FILE="${LOGS_DIR}/success_${TODAY}.marker"

# Kill any leftover Chromium from previous runs BEFORE starting
pkill -f "chromium.*--headless" 2>/dev/null

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

# Run the scraper with unbuffered output and timeout (2 hours max)
"$GTIMEOUT" 7200 "$PYTHON" -u integrated_scraper.py
EXIT_CODE=$?

# Always cleanup Chromium after run (even on success)
pkill -f "chromium.*--headless" 2>/dev/null

if [ $EXIT_CODE -eq 0 ]; then
    touch "$MARKER_FILE"
    echo "[$(date)] Scraping completed successfully for $TODAY."
    cat > "$HEALTH_FILE" <<EOJSON
{"date":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","status":"success","exit_code":0}
EOJSON
elif [ $EXIT_CODE -eq 124 ]; then
    echo "[$(date)] Scraping timed out after 2 hours."
    cat > "$HEALTH_FILE" <<EOJSON
{"date":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","status":"timeout","exit_code":124}
EOJSON
    exit 1
else
    echo "[$(date)] Scraping failed with exit code $EXIT_CODE."
    cat > "$HEALTH_FILE" <<EOJSON
{"date":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","status":"failed","exit_code":$EXIT_CODE}
EOJSON
    exit 1
fi
