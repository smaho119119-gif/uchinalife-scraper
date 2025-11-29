#!/usr/bin/env python3
"""
HTMLを保存して確認
"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    url = "https://www.e-uchina.net/house?perPage=50&page=1"
    print(f"Accessing: {url}")
    page.goto(url, wait_until='domcontentloaded')
    
    # HTMLを保存
    html = page.content()
    with open("debug_house_page1.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Saved to debug_house_page1.html")
    
    # body textを保存
    body_text = page.inner_text("body")
    with open("debug_house_page1_text.txt", "w", encoding="utf-8") as f:
        f.write(body_text)
    print("Saved to debug_house_page1_text.txt")
    
    # 件数を探す
    import re
    match = re.search(r'(\d{3,})', body_text)
    if match:
        print(f"\nFirst large number found: {match.group(1)}")
    
    browser.close()
