#!/bin/bash
# Check if yesterday's scraping succeeded
# Run this via launchd at 07:00 to verify the 03:00 run worked

LOGS_DIR="/Users/hiroki/Documents/うちなーらいふスクレイピング/logs"
HEALTH_FILE="${LOGS_DIR}/last_run.json"
TODAY=$(date +%Y%m%d)
MARKER_FILE="${LOGS_DIR}/success_${TODAY}.marker"

echo "=== Scraper Health Check $(date) ==="

# Check 1: Did yesterday's marker get created?
if [ -f "$MARKER_FILE" ]; then
    echo "OK: Today ($TODAY) scraping succeeded."
else
    echo "ALERT: Today ($TODAY) scraping did NOT succeed. No marker file found."
fi

# Check 2: What does last_run.json say?
if [ -f "$HEALTH_FILE" ]; then
    echo "Last run status: $(cat "$HEALTH_FILE")"
else
    echo "WARNING: No last_run.json found. Script may not have run at all."
fi

# Check 3: Is launchd agent loaded?
if launchctl list | grep -q "com.uchinalife.scraper"; then
    echo "OK: launchd agent is loaded."
else
    echo "ALERT: launchd agent is NOT loaded! Run: launchctl load ~/Library/LaunchAgents/com.uchinalife.scraper.plist"
fi

# Check 4: Count consecutive failures
FAIL_COUNT=0
for i in $(seq 0 6); do
    CHECK_DATE=$(date -v-${i}d +%Y%m%d)
    if [ ! -f "${LOGS_DIR}/success_${CHECK_DATE}.marker" ]; then
        FAIL_COUNT=$((FAIL_COUNT + 1))
    else
        break
    fi
done

if [ $FAIL_COUNT -ge 3 ]; then
    echo "CRITICAL: $FAIL_COUNT consecutive days without success!"
elif [ $FAIL_COUNT -ge 1 ]; then
    echo "WARNING: $FAIL_COUNT day(s) without success."
else
    echo "OK: No missed days."
fi
