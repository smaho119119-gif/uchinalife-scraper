from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import NoSuchElementException
import pandas as pd
import time

def get_info_by_label(elements, label):
    """指定されたラベルを持つ情報をelementsから探して返します。"""
    for element in elements:
        try:
            th = element.find_element(By.TAG_NAME, 'th').text.strip()
            td = element.find_element(By.TAG_NAME, 'td').text.strip()
            if th == label:
                return td
        except NoSuchElementException:
            continue
    return ""

# Selenium WebDriverの設定
webdriver_path = '/opt/homebrew/bin/chromedriver'
service = Service(webdriver_path)
driver = webdriver.Chrome(service=service)

url = "https://www.e-uchina.net/fudosan_kaisha"
driver.get(url)
time.sleep(5)

data_list = []

fudosan_elements = driver.find_elements(By.CSS_SELECTOR, '.fudosan-list-item')
for element in fudosan_elements:
    name = element.find_element(By.TAG_NAME, 'h3').text.strip()
    url = element.find_element(By.TAG_NAME, 'a').get_attribute('href')
    image_url = element.find_element(By.CSS_SELECTOR, 'img').get_attribute('src')
    tr_elements = element.find_elements(By.TAG_NAME, 'tr')
    
    fudosan_info = {
        'name': name,
        'url': url,
        'image_url': image_url,
        '所在地': get_info_by_label(tr_elements, "所在地"),
        '営業時間': get_info_by_label(tr_elements, "営業時間"),
        '定休日': get_info_by_label(tr_elements, "定休日"),
        '免許': get_info_by_label(tr_elements, "免許"),
        'TEL': get_info_by_label(tr_elements, "TEL"),
        '駐車場': get_info_by_label(tr_elements, "駐車場"),
    }
    
    data_list.append(fudosan_info)

driver.quit()

# pandasを使用してデータフレームを作成
df = pd.DataFrame(data_list)

# CSVファイルにデータを書き込む
csv_file_path = 'fudosan_data.csv'
df.to_csv(csv_file_path, index=False, encoding='utf-8')

# Excelファイルにデータを書き込む
excel_file_path = 'fudosan_data.xlsx'
df.to_excel(excel_file_path, index=False, engine='openpyxl')

print(f"データの抽出とCSV、Excelへの保存が完了しました。{csv_file_path} と {excel_file_path} を確認してください。")
