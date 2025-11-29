from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import NoSuchElementException
import pandas as pd
import time

webdriver_path = '/opt/homebrew/bin/chromedriver'
service = Service(webdriver_path)
driver = webdriver.Chrome(service=service)

def scrape_fudosan_info(driver):
    data_list = []
    page_number = 1
    while True:
        print(f"ページ {page_number} のデータ取得を開始します...")
        fudosan_elements = driver.find_elements(By.CSS_SELECTOR, '.fudosan-list-item')
        if not fudosan_elements:
            print("不動産会社の情報が見つかりませんでした。")
        
        for element in fudosan_elements:
            try:
                name = element.find_element(By.TAG_NAME, 'h3').text.strip()
                url = element.find_element(By.TAG_NAME, 'a').get_attribute('href')
                image_url = element.find_element(By.CSS_SELECTOR, 'img').get_attribute('src')
                address = element.find_element(By.XPATH, ".//tr[1]/td").text.strip()
                business_hours = element.find_element(By.XPATH, ".//tr[2]/td").text.strip()
                holidays = element.find_element(By.XPATH, ".//tr[3]/td").text.strip()
                license = element.find_element(By.XPATH, ".//tr[4]/td").text.strip()
                tel = element.find_element(By.XPATH, ".//tr[5]/td[1]").text.strip()
                fudosan_info = {
                    'name': name,
                    'url': url,
                    'image_url': image_url,
                    '所在地': address,
                    '営業時間': business_hours,
                    '定休日': holidays,
                    '免許': license,
                    'TEL': tel,
                }
                data_list.append(fudosan_info)
                print(f"会社名: {name}, URL: {url} の情報を取得しました。")
            except Exception as e:
                print(f"情報の取得中にエラーが発生しました: {e}")
        
        try:
            next_page = driver.find_element(By.CSS_SELECTOR, 'a[rel="next"]')
            next_page.click()
            print("次のページに移動します...")
            page_number += 1
            time.sleep(5)
        except NoSuchElementException:
            print("次のページが存在しません。データ取得を終了します。")
            break
    
    return data_list

url = "https://www.e-uchina.net/fudosan_kaisha"
print(f"{url} にアクセスします...")
driver.get(url)
time.sleep(5)

all_data = scrape_fudosan_info(driver)
driver.quit()

df = pd.DataFrame(all_data)
csv_file_path = 'fudosan_data.csv'
excel_file_path = 'fudosan_data.xlsx'

df.to_csv(csv_file_path, index=False, encoding='utf-8')
df.to_excel(excel_file_path, index=False, engine='openpyxl')

print(f"データの抽出とCSV、Excelへの保存が完了しました。{csv_file_path} と {excel_file_path} を確認してください。")
