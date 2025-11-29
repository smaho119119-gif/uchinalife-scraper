import json
import os
from datetime import datetime

checkpoint_file = "output/checkpoint.json"

if os.path.exists(checkpoint_file):
    with open(checkpoint_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    print(f"Checkpoint file found: {checkpoint_file}")
    for category, info in data.items():
        count = info.get("count", 0)
        last_updated = info.get("last_updated", "N/A")
        processed = len(info.get("processed_urls", []))
        print(f"Category: {category}")
        print(f"  Processed URLs: {processed}")
        print(f"  Last Updated: {last_updated}")
else:
    print("Checkpoint file not found.")
