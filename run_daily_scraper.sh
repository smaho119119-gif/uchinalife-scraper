#!/bin/bash

# Move to the project directory
cd /Users/hiroki/Documents/うちなーらいふスクレイピング

# Get today's date
TODAY=$(date +%Y%m%d)
MARKER_FILE="logs/success_${TODAY}.marker"

# Check if already ran successfully today
if [ -f "$MARKER_FILE" ]; then
    echo "[$(date)] Already ran for today ($TODAY). Exiting."
    exit 0
fi

echo "[$(date)] Starting daily scraping..."

# Run the scraper with timeout (2 hours max)
timeout 7200 /Users/hiroki/miniconda3/bin/python3 integrated_scraper.py

# Check exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    # Create a marker file to prevent re-running today
    touch "$MARKER_FILE"
    echo "[$(date)] Scraping completed successfully for $TODAY."
elif [ $EXIT_CODE -eq 124 ]; then
    echo "[$(date)] ⚠️  Scraping timed out after 2 hours. This may indicate an infinite loop."
    exit 1
else
    echo "[$(date)] Scraping failed with exit code $EXIT_CODE."
    exit 1
fi
