#!/usr/bin/env python3
"""Parallel performance test"""

import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from integrated_scraper import scrape_detail, retry_with_backoff, MAX_WORKERS
import json

# Load some test URLs
with open('output/links.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    test_urls = data['data'].get('jukyo', [])[:100]  # Test with 100 URLs

print("=" * 70)
print(f"Parallel Performance Test - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)
print(f"URLs to test: {len(test_urls)}")
print(f"Max workers: {MAX_WORKERS}")
print()

start_time = time.time()
results = []
errors = 0

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    def scrape_with_retry(url):
        return retry_with_backoff(lambda: scrape_detail(url, "jukyo"))
    
    future_to_url = {executor.submit(scrape_with_retry, url): url for url in test_urls}
    
    completed_count = 0
    for future in as_completed(future_to_url):
        url = future_to_url[future]
        try:
            data = future.result()
            if data:
                results.append(data)
        except Exception as exc:
            errors += 1
            print(f"Error: {exc}")
        
        completed_count += 1
        if completed_count % 10 == 0:
            elapsed = time.time() - start_time
            rate = completed_count / (elapsed / 60)
            print(f"Progress: {completed_count}/{len(test_urls)} ({rate:.1f} items/min)")

elapsed = time.time() - start_time
rate = len(results) / (elapsed / 60)

print()
print("=" * 70)
print("RESULTS")
print("=" * 70)
print(f"Total URLs: {len(test_urls)}")
print(f"Successful: {len(results)}")
print(f"Errors: {errors}")
print(f"Time: {elapsed:.1f} seconds ({elapsed/60:.2f} minutes)")
print(f"Average: {elapsed/len(test_urls):.2f} seconds per URL")
print(f"Rate: {rate:.1f} items/minute")
print("=" * 70)
print()

# Performance comparison
print("Performance Comparison:")
print(f"  Current (Playwright):  {rate:.1f} items/min")
print(f"  Previous (Selenium):  ~53 items/min")
print(f"  Improvement:  {(rate / 53 - 1) * 100:+.1f}%")
print(f"  Target:  150-200 items/min")
if rate >= 150:
    print(f"  Status: ✓ Target achieved!")
elif rate >= 100:
    print(f"  Status: ⚠ Close to target")
else:
    print(f"  Status: ✗ Below target, needs optimization")
