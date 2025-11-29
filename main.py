from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import pandas as pd
import time
import os
from datetime import datetime

def setup_driver(webdriver_path):
    service = Service(webdriver_path)
    options = webdriver.ChromeOptions()
    # ヘッドレスモードを有効にする場合は次の行のコメントを解除
    # options.add_argument('--headless')
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def clean_illegal_characters(text):
    if isinstance(text, str):
        # Excelで問題を引き起こす可能性のある不正な文字を除去
        return ''.join(char for char in text if ord(char) > 31 or ord(char) == 9)
    return text

def get_store_original_hp(driver, detail_page_url):
    # 新しいウィンドウで詳細ページを開く
    driver.execute_script("window.open('');")
    driver.switch_to.window(driver.window_handles[1])
    driver.get(detail_page_url)
    
    try:
        # 詳細ページからオリジナルHPのリンクを取得
        original_hp_element = WebDriverWait(driver, 1).until(
            EC.presence_of_element_located((By.XPATH, '//*[@id="main"]/div/div[2]/div/div/div[2]/div[2]/table/tbody/tr[3]/td[2]/a'))
        )
        original_hp = original_hp_element.get_attribute('href')
    except TimeoutException:
        print(f"オリジナルHPのリンクを取得できませんでした: {detail_page_url}")
        original_hp = ""
    
    # 現在のタブを閉じて、最初のタブに戻る
    driver.close()
    driver.switch_to.window(driver.window_handles[0])
    
    return original_hp


def scrape_fudosan_info(driver, url):
    driver.get(url)
    wait = WebDriverWait(driver, 1)
    data_list = []
    
    try:
        total_count_text = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, '.fudosan-paginator p span'))).text
        print(f"該当する不動産情報の総数: {total_count_text}件")
    except TimeoutException:
        print("総数を表示する要素が見つかりませんでした。")

    page_number = 1
    while True:
        try:
            fudosan_elements = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.fudosan-list-item')))
            print(f"ページ {page_number} のデータを取得しています...")

            for element in fudosan_elements:
                name = element.find_element(By.TAG_NAME, 'h3').text.strip()
                address = element.find_element(By.XPATH, ".//tr[1]/td").text.strip()
                tel = element.find_element(By.XPATH, ".//tr[5]/td[1]").text.strip()
                url = element.find_element(By.TAG_NAME, 'a').get_attribute('href')
                business_hours = element.find_element(By.XPATH, ".//tr[2]/td").text.strip()
                holidays = element.find_element(By.XPATH, ".//tr[3]/td").text.strip()
                image_url = element.find_element(By.CSS_SELECTOR, 'img').get_attribute('src')
                license = element.find_element(By.XPATH, ".//tr[4]/td").text.strip()

                # 詳細ページからオリジナルのHPアドレスを取得
                original_hp_url = get_store_original_hp(driver, url)

                fudosan_info = {
                    'name': name,
                    '所在地': address,
                    'TEL': tel,
                    'url': url,
                    '営業時間': business_hours,
                    '定休日': holidays,
                    'image_url': image_url,
                    '免許': license,
                    'オリジナルHP': original_hp_url,
                }
                data_list.append(fudosan_info)

            next_page_link = driver.find_elements(By.CSS_SELECTOR, '.pagination-next a')
            if next_page_link:
                next_page_link[0].click()
                print("次のページに移動します...")
                page_number += 1
                time.sleep(2)
            else:
                print("ページネーションの終端に到達しました。")
                break
        except TimeoutException:
            print("ページが期待通りにロードされませんでした。")
            break

    return data_list

webdriver_path = '/opt/homebrew/bin/chromedriver'
driver = setup_driver(webdriver_path)

url = "https://www.e-uchina.net/fudosan_kaisha"
all_data = scrape_fudosan_info(driver, url)
driver.quit()

# pandasを使用してデータフレームを作成し、データクリーニングを適用
df = pd.DataFrame(all_data)
df = df.applymap(clean_illegal_characters)

# outputフォルダを作成
output_folder = "output"
if not os.path.exists(output_folder):
    os.makedirs(output_folder)

# ファイル名の一部として使用するユニークな日時の文字列を生成
unique_datetime = datetime.now().strftime("%Y%m%d%H%M%S")

# ファイル名を設定
csv_filename = f"{output_folder}/不動産会社_{unique_datetime}.csv"
excel_filename = f"{output_folder}/不動産会社_{unique_datetime}.xlsx"

# CSVとExcelファイルに保存
df.to_csv(csv_filename, index=False)
df.to_excel(excel_filename, index=False, engine='openpyxl')

print(f"CSVファイルが保存されました: {csv_filename}")
print(f"Excelファイルが保存されました: {excel_filename}")
