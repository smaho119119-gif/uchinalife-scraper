from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
import csv
import time

# Selenium WebDriverの設定
webdriver_path = '/opt/homebrew/bin/chromedriver'
service = Service(webdriver_path)
driver = webdriver.Chrome(service=service)

# スクレイピング対象のURL
url = "https://www.e-uchina.net/fudosan_kaisha"
driver.get(url)
time.sleep(5)

# CSVファイルに保存するためのリスト
data_list = []

# 不動産会社の情報を抽出
fudosan_elements = driver.find_elements(By.CSS_SELECTOR, '.fudosan-list-item')
for element in fudosan_elements:
    name = element.find_element(By.TAG_NAME, 'h3').text.strip()
    url = element.find_element(By.TAG_NAME, 'a').get_attribute('href')
    image_url = element.find_element(By.CSS_SELECTOR, 'img').get_attribute('src')
    info_elements = element.find_elements(By.CSS_SELECTOR, 'tr')
    
    # 抽出した情報を格納する辞書
    fudosan_info = {
        'name': name,
        'url': url,
        'image_url': image_url,
    }
    
    # その他の情報を抽出
    for info_element in info_elements:
        key = info_element.find_element(By.TAG_NAME, 'th').text.strip()
        value = info_element.find_element(By.TAG_NAME, 'td').text.strip()
        fudosan_info[key] = value
    
    data_list.append(fudosan_info)

# ブラウザを閉じる
driver.quit()

# CSVファイルにデータを書き込む
csv_file_path = 'fudosan_data.csv'
with open(csv_file_path, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.DictWriter(file, fieldnames=data_list[0].keys())
    writer.writeheader()
    writer.writerows(data_list)

print(f"データの抽出とCSVへの保存が完了しました。{csv_file_path} を確認してください。")
