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

def setup_driver(webdriver_path, headless=False):
    service = Service(webdriver_path)
    options = webdriver.ChromeOptions()
    if headless:
        options.add_argument('--headless')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36')
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def clean_illegal_characters(text):
    if isinstance(text, str):
        return ''.join(char for char in text if ord(char) > 31 or ord(char) == 9)
    return text

def get_store_original_hp(driver, detail_page_url):
    driver.execute_script("window.open('');")
    driver.switch_to.window(driver.window_handles[1])
    driver.get(detail_page_url)
    
    try:
        original_hp_element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, '//*[@id="main"]/div/div[2]/div/div/div[2]/div[2]/table/tbody/tr[3]/td[2]/a'))
        )
        original_hp = original_hp_element.get_attribute('href')
    except TimeoutException:
        original_hp = ""
    
    driver.close()
    driver.switch_to.window(driver.window_handles[0])
    return original_hp

def scrape_fudosan_info(driver, url):
    driver.get(url)
    wait = WebDriverWait(driver, 10)
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
                name = element.find_element(By.TAG_NAME, 'h3').text.strip()  # 名前を取得
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

# 以下の部分は以前のコードと変わらないため省略します...


webdriver_path = '/opt/homebrew/bin/chromedriver'
headless_mode = True
driver = setup_driver(webdriver_path, headless=headless_mode)

url = "https://www.e-uchina.net/fudosan_kaisha"
all_data = scrape_fudosan_info(driver, url)
driver.quit()

df = pd.DataFrame(all_data)
df = df.applymap(clean_illegal_characters)

output_folder = "output"
if not os.path.exists(output_folder):
    os.makedirs(output_folder)

unique_datetime = datetime.now().strftime("%Y%m%d%H%M%S")

csv_filename = f"{output_folder}/不動産会社_{unique_datetime}.csv"
excel_filename = f"{output_folder}/不動産会社_{unique_datetime}.xlsx"

df.to_csv(csv_filename, index=False)
df.to_excel(excel_filename, index=False, engine='openpyxl')

print(f"CSVファイルが保存されました: {csv_filename}")
print(f"Excelファイルが保存されました: {excel_filename}")
