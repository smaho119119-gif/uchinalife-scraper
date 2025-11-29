from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
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

                fudosan_info = {
                    'name': name,
                    '所在地': address,
                    'TEL': tel,
                    'url': url,
                    '営業時間': business_hours,
                    '定休日': holidays,
                    'image_url': image_url,
                    '免許': license,
                }
                data_list.append(fudosan_info)
                print(f"会社名: {name}, 所在地: {address}, TEL: {tel}, URL: {url}, 営業時間: {business_hours}, 定休日: {holidays}, image_url: {image_url}, 免許: {license} の情報を取得しました。")

            # "次へ"リンクを探してクリック
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

# pandasを使用してデータフレームを作成し、CSVとExcelファイルに保存
df = pd.DataFrame(all_data)
df.to_csv('fudosan_data.csv', index=False)

# データフレーム内の不正な文字を除去する
def clean_string(text):
    if isinstance(text, str):
        # ASCII制御文字を除去する（例えば、改行、タブ、その他の制御文字）
        return ''.join(char for char in text if ord(char) > 31 or ord(char) == 9)
    return text

# データフレームの作成例
df = pd.DataFrame({
    'Column1': ['This is a text', 'Another text', 'Text with\nnewline'],
    'Column2': ['Sample text', 'Text containing \t tab', 'Clean text']
})

# 列全体に関数を適用する
df = df.apply(lambda x: x.apply(clean_string))

# エクセルファイルに保存
df.to_excel('fudosan_data.xlsx', index=False, engine='openpyxl')


print(f"データの抽出とファイルへの保存が完了しました。取得したデータの総数: {len(all_data)}件")
