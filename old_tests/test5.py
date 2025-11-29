from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
import pandas as pd
import os
import time

webdriver_path = '/opt/homebrew/bin/chromedriver'
service = Service(webdriver_path)
driver = webdriver.Chrome(service=service)

def scrape_fudosan_info(driver, url):
    data_list = []
    driver.get(url)
    time.sleep(5)
    
    wait = WebDriverWait(driver, 10)
    
    # 総数の取得とログ出力
    total_count = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.fudosan-paginator p span'))).text
    print(f"該当する不動産情報の総数: {total_count}件")
    
    page_number = 1
    while True:
        print(f"ページ {page_number} のデータ取得を開始します...")
        fudosan_elements = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.fudosan-list-item')))
        
        # 以下、不動産情報の取得処理（省略）
        
        # "次へ"リンクを探してクリックする処理
        try:
            next_page = driver.find_element(By.CSS_SELECTOR, '.pagination-next a')
            next_page.click()
            print("次のページに移動します...")
            page_number += 1
            time.sleep(5)
        except NoSuchElementException:
            print("次のページが存在しません。データ取得を終了します。")
            break
    
    return data_list

url = "https://www.e-uchina.net/fudosan_kaisha"
all_data = scrape_fudosan_info(driver, url)
driver.quit()

# pandasを使用してデータフレームを作成
df = pd.DataFrame(all_data)

# CSVとExcelファイルの保存
csv_file_path = os.path.join(os.getcwd(), 'fudosan_data.csv')
excel_file_path = os.path.join(os.getcwd(), 'fudosan_data.xlsx')

df.to_csv(csv_file_path, index=False, encoding='utf-8')
df.to_excel(excel_file_path, index=False, engine='openpyxl')

print(f"データの抽出とCSV、Excelへの保存が完了しました。ファイルは {csv_file_path} と {excel_file_path} にあります。")
