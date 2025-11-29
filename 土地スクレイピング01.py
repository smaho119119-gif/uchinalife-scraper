import csv
import os
import re
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def extract_price_range(price_text):
    """
    価格テキストから価格の範囲を抽出する関数。
    """
    billion_pattern = r'(\d+(?:,\d+)?)億'
    million_pattern = r'(\d+(?:,\d+)?)万円'
    prices = price_text.split('〜')
    min_price = max_price = None

    for price in prices:
        billion = million = 0
        billion_match = re.search(billion_pattern, price)
        million_match = re.search(million_pattern, price)
        if billion_match:
            billion = int(billion_match.group(1).replace(",", "")) * 10000
        if million_match:
            million = int(million_match.group(1).replace(",", ""))
        total_price = billion + million

        if min_price is None or total_price < min_price:
            min_price = total_price
        if max_price is None or total_price > max_price:
            max_price = total_price

    return min_price, max_price

def extract_numeric_value_with_unit(text):
    """
    数値と単位を含むテキストから数値を抽出する関数。
    """
    match = re.search(r'([\d.]+)', text)
    if match:
        return float(match.group(1))
    return None

def construct_company_link(detail_link):
    """
    詳細リンクから会社情報ページへのリンクを構築する関数。
    """
    match = re.search(r"t-(\d+)-\d+-\d+", detail_link)
    if match:
        company_id = match.group(1)
        return f"https://www.e-uchina.net/fudosan_kaisha/{company_id}"
    return None

def scrape_page(driver, writer):
    """
    特定のページの物件情報をスクレイプしてCSVに書き込む関数。
    """
    properties = WebDriverWait(driver, 10).until(
        EC.presence_of_all_elements_located((By.CLASS_NAME, "search-result-item")))

    for property in properties:
        title = property.find_element(By.CSS_SELECTOR, "h2 a").text
        price_text = property.find_element(By.CSS_SELECTOR, ".bukken-data-price").text
        min_price, max_price = extract_price_range(price_text)
        area_details = property.find_element(By.CSS_SELECTOR, ".bukken-data td:nth-child(3)").text
        area_m2 = extract_numeric_value_with_unit(area_details.split('/')[0])
        area_tsubo = extract_numeric_value_with_unit(area_details.split('/')[1])
        ratios = property.find_element(By.CSS_SELECTOR, ".bukken-data td:nth-child(4)").text.split('/')
        building_ratio = extract_numeric_value_with_unit(ratios[0])
        floor_area_ratio = extract_numeric_value_with_unit(ratios[1])
        favorites = property.find_element(By.CSS_SELECTOR, ".favorite-count").text
        favorites = ''.join(filter(str.isdigit, favorites))
        updated_at = property.find_element(By.CSS_SELECTOR, ".updated_at").text.strip('更新')
        image_url = property.find_element(By.CSS_SELECTOR, ".thumbnail img").get_attribute("src")
        detail_link = property.find_element(By.CSS_SELECTOR, "a.detail-button").get_attribute('href')
        company_link = construct_company_link(detail_link)
        company_name = property.find_element(By.CSS_SELECTOR, ".company-name").text.strip()
        phone_number = property.find_element(By.CSS_SELECTOR, ".company-tell").text.strip()
        scrape_date = datetime.now().strftime("%Y/%m/%d")

        writer.writerow([title, price_text, min_price, max_price, area_m2, area_tsubo, building_ratio, floor_area_ratio,
                        favorites, updated_at, scrape_date, image_url, detail_link, company_name, phone_number, company_link])

def main():
    """
    メイン関数。
    """
    data_folder = 'data'
    if not os.path.exists(data_folder):
        os.makedirs(data_folder)
    filename = f"{data_folder}/{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.csv"
    with open(filename, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(['タイトル', '価格テキスト', '価格低', '価格高', '土地面積（平米）', '土地面積（坪）', '建ぺい率',
                        '容積率', 'お気に入り追加数', '更新日', '取得日', '画像URL', '詳細リンク', '不動産会社名', '不動産会社電話', '会社リンク'])

        options = Options()
        #options.add_argument("--headless")  # ヘッドレスモードを有効にする
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.get("https://www.e-uchina.net/tochi")

        try:
            while True:
                scrape_page(driver, writer)
                next_page_links = driver.find_elements(By.CSS_SELECTOR, "li.pagination-next a")
                if next_page_links:
                    WebDriverWait(driver, 10).until(EC.element_to_be_clickable(next_page_links[0])).click()
                    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CLASS_NAME, "search-result-item")))
                else:
                    break
        finally:
            driver.quit()

if __name__ == "__main__":
    main()