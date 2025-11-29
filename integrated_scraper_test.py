import os
import time
import pandas as pd
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

BASE_URL = "https://www.e-uchina.net"
CATEGORIES = {"tochi": f"{BASE_URL}/tochi", "mansion": f"{BASE_URL}/mansion"}
OUTPUT_DIR = "output"
MAX_TEST_ITEMS = 3

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def setup_driver():
    options = Options()
    options.add_argument('--headless=new')  # 新しいヘッドレスモード
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')  # メモリ問題を回避
    options.add_argument('--remote-debugging-port=9222')  # デバッグポート
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        print(f"ChromeDriver起動エラー: {e}")
        print("ヘッドレスモードを無効にして再試行...")
        options2 = Options()
        options2.add_argument('--disable-gpu')
        options2.add_argument('--no-sandbox')
        options2.add_argument('--disable-dev-shm-usage')
        options2.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options2)


def collect_links(category_name, base_url):
    print(f"[{category_name}] リンク収集中...")
    driver = setup_driver()
    links = []
    try:
        driver.get(f"{base_url}?perPage=50&page=1")
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.CSS_SELECTOR, "a.button.detail-button")))
        for elem in driver.find_elements(By.CSS_SELECTOR, "a.button.detail-button")[:MAX_TEST_ITEMS]:
            if link := elem.get_attribute("href"):
                links.append(link)
        print(f"[{category_name}] {len(links)}件取得")
    except Exception as e:
        print(f"エラー: {e}")
    finally:
        driver.quit()
    return links

def scrape_detail(url, category):
    driver = setup_driver()
    data = {"url": url, "category": category}
    try:
        print(f"  スクレイピング: {url[-30:]}")
        driver.get(url)
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        
        try:
            data["title"] = driver.find_element(By.TAG_NAME, "h1").text.strip()
        except:
            data["title"] = ""
        
        img_urls = []
        for link in driver.find_elements(By.CSS_SELECTOR, ".bx-viewport a[data-exthumbimag]"):
            if (href := link.get_attribute("href")) and "cdn.e-uchina.net/media/pic/large/" in href and href not in img_urls:
                img_urls.append(href)
        
        print(f"    → {len(img_urls)}枚のlarge画像")
        data["images"] = " | ".join(img_urls)
        print(f"    ✓ 完了")
    except Exception as e:
        print(f"    ✗ エラー: {e}")
        data["error"] = str(e)
    finally:
        driver.quit()
    return data

def main():
    print("="*60)
    print(f"テスト: 各カテゴリ{MAX_TEST_ITEMS}件ずつ (large画像のみ)")
    print("="*60)
    
    for cat_name, cat_url in CATEGORIES.items():
        print(f"\n[{cat_name}] 開始")
        results = []
        for idx, url in enumerate(collect_links(cat_name, cat_url), 1):
            print(f"  {idx}/{MAX_TEST_ITEMS}")
            results.append(scrape_detail(url, cat_name))
            time.sleep(2)
        
        if results:
            df = pd.DataFrame(results)
            csv_path = os.path.join(OUTPUT_DIR, f"{cat_name}_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
            df.to_csv(csv_path, index=False, encoding="utf-8-sig")
            print(f"\n  ✓ 保存: {csv_path}")
            for _, row in df.iterrows():
                img_count = len(row['images'].split(' | ')) if row['images'] else 0
                print(f"    {row.get('title', '')[:40]}... → {img_count}枚")
    
    print("\n" + "="*60)
    print("完了!")
    print("="*60)

if __name__ == "__main__":
    main()