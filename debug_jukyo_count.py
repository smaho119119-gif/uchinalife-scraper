#!/usr/bin/env python3
"""
jukyoページの総件数を確認
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
        ]
    )
    
    page = browser.new_context(
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        viewport={'width': 1920, 'height': 1080},
    ).new_page()
    
    url = "https://www.e-uchina.net/jukyo?perPage=50&page=1"
    print(f"Accessing: {url}\n")
    page.goto(url, wait_until='domcontentloaded', timeout=30000)
    
    # XPathで取得
    xpath = '//*[@id="search-page"]/div[2]/div[2]/div[2]/div/span[1]'
    try:
        element = page.locator(f'xpath={xpath}').first
        text = element.inner_text(timeout=5000)
        print(f"XPath結果: '{text}'")
        
        import re
        match = re.search(r'(\d+)', text)
        if match:
            total = int(match.group(1))
            pages = (total + 50 - 1) // 50
            print(f"✓ 総件数: {total}")
            print(f"✓ ページ数: {pages}")
    except Exception as e:
        print(f"✗ XPath失敗: {e}")
    
    # body textから取得
    print("\n--- body textから検索 ---")
    body = page.inner_text("body")
    
    # 最初の大きな数字を探す
    import re
    matches = re.findall(r'(\d{3,})', body)
    print(f"見つかった3桁以上の数字: {matches[:10]}")
    
    # 「件」を含むパターン
    matches = re.findall(r'(\d+)\s*件', body)
    print(f"「件」を含むパターン: {matches[:5]}")
    
    browser.close()
