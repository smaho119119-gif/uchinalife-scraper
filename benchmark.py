#!/usr/bin/env python3
"""Performance benchmark for Playwright scraper"""

import time
import subprocess
from datetime import datetime

print("=" * 70)
print("Starting Performance Benchmark")
print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)
print()
print("This will scrape a sample of properties to measure speed...")
print("Press Ctrl+C to stop early if needed.")
print()

start_time = time.time()

# Run scraper for 2 minutes then stop
try:
    proc = subprocess.Popen(
        ['python', 'integrated_scraper.py', '--skip-refresh'],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    items_processed = 0
    start_scraping_time = None
    
    for line in iter(proc.stdout.readline, ''):
        print(line, end='')
        
        # Detect when scraping starts
        if 'Remaining:' in line and start_scraping_time is None:
            start_scraping_time = time.time()
            print(f"\n[BENCHMARK] Scraping started at {datetime.now().strftime('%H:%M:%S')}\n")
        
        # Count progress
        if 'Progress:' in line:
            try:
                # Extract number like "Progress: 10/3697"
                parts = line.split('Progress:')[1].strip().split('/')
                items_processed = int(parts[0])
                
                if items_processed >= 100:  # Stop after 100 items for quick test
                    elapsed = time.time() - start_scraping_time if start_scraping_time else 0
                    rate = items_processed / (elapsed / 60) if elapsed > 0 else 0
                    
                    print(f"\n{'=' * 70}")
                    print(f"BENCHMARK COMPLETE")
                    print(f"{'=' * 70}")
                    print(f"Items processed: {items_processed}")
                    print(f"Time elapsed: {elapsed:.1f} seconds ({elapsed/60:.2f} minutes)")
                    print(f"Scraping rate: {rate:.1f} items/minute")
                    print(f"{'=' * 70}")
                    
                    proc.terminate()
                    break
            except:
                pass
        
        # Safety timeout: 5 minutes max
        if time.time() - start_time > 300:
            print("\n[BENCHMARK] Timeout reached (5 minutes)")
            proc.terminate()
            break
    
    proc.wait(timeout=5)
    
except KeyboardInterrupt:
    print("\n\n[BENCHMARK] Stopped by user")
    proc.terminate()
    proc.wait(timeout=5)

print("\nBenchmark finished.")
