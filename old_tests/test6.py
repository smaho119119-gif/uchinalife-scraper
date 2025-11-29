from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
import pandas as pd
import time

def setup_driver(webdriver_path):
    service = Service(webdriver_path)
    options = webdriver.ChromeOptions()
    #options.add_argument('--headless')  # デバッグ時はこの行をコメントアウト
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def scrape_fudosan_info(driver, url):
    driver.get(url)
    wait = WebDriverWait(driver, 10)
    data_list = []
    
    total_count_text = wait.until(EC.presence_of_element_located(
        (By.CSS_SELECTOR, '.fudosan-paginator p span'))).text
    print(f"該当する不動産情報の総数: {total_count_text}件")

    page_number = 1
    while True:
        print(f"ページ {page_number} のデータを取得しています...")
        fudosan_elements = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.fudosan-list-item')))
        
        for element in fudosan_elements:
            name = element.find_element(By.TAG_NAME, 'h3').text.strip()
            url = element.find_element(By.TAG_NAME, 'a').get_attribute('href')
            data = {'name': name, 'url': url}
            data_list.append(data)
            print(f"取得したデータ: {data}")

        # 次のページへ移動
        try:
            next_page_link = driver.find_element(By.CSS_SELECTOR, '.pagination-next a')
            next_page_link.click()
            print("次のページに移動します...")
            page_number += 1
            time.sleep(2)
        except NoSuchElementException:
            print("ページネーションの終端に到達しました。")
            break

    print(f"取得したデータの総数: {len(data_list)}件")
    return data_list

webdriver_path = '/opt/homebrew/bin/chromedriver'
driver = setup_driver(webdriver_path)

url = "https://www.e-uchina.net/fudosan_kaisha"
all_data = scrape_fudosan_info(driver, url)
driver.quit()

# pandasを使用してデータフレームを作成し、CSVとExcelファイルに保存
df = pd.DataFrame(all_data)
df.to_csv('fudosan_data.csv', index=False)
df.to_excel('fudosan_data.xlsx', index=False, engine='openpyxl')

print("データの抽出とファイルへの保存が完了しました。ファイルを確認してください。")
