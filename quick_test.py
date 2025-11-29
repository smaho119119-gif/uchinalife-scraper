#!/usr/bin/env python3
"""Quick test of Playwright scraper"""

import time
from datetime import datetime
from integrated_scraper import scrape_detail, get_thread_browser, cleanup_thread_browser

print("=" * 60)
print(f"Quick Test - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 60)

# Test URLs
test_urls = [
    "https://www.e-uchina.net/bukken/jukyo/r-5997-2250917-0392/detail.html",
    "https://www.e-uchina.net/bukken/jukyo/r-6468-2251104-0387/detail.html",
    "https://www.e-uchina.net/bukken/jukyo/r-5890-2251118-0380/detail.html",
]

start_time = time.time()
results = []

print(f"\nTesting {len(test_urls)} URLs...")
print()

for i, url in enumerate(test_urls, 1):
    print(f"[{i}/{len(test_urls)}] Scraping: {url[:60]}...")
    try:
        data = scrape_detail(url, "jukyo")
        results.append(data)
        print(f"  ✓ Success: {data.get('title', 'N/A')[:50]}")
    except Exception as e:
        print(f"  ✗ Error: {e}")

elapsed = time.time() - start_time
print()
print("=" * 60)
print(f"Completed: {len(results)}/{len(test_urls)} URLs")
print(f"Time: {elapsed:.1f} seconds ({elapsed/len(test_urls):.1f}s per URL)")
print(f"Rate: {len(test_urls)/(elapsed/60):.1f} items/minute")
print("=" * 60)

# Cleanup
cleanup_thread_browser()
print("\nTest completed successfully!")
