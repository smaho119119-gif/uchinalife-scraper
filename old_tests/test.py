from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
import time

# ChromeDriverのパスを指定（Firefoxなど他のブラウザを使用する場合は適宜変更してください）
webdriver_path = '/opt/homebrew/bin/chromedriver'

# Selenium WebDriverの設定
service = Service(webdriver_path)
driver = webdriver.Chrome(service=service)

# スクレイピング対象のURL
url = "https://www.e-uchina.net/fudosan_kaisha"

# ページにアクセス
driver.get(url)

# ページが完全にロードされるまで待つ（必要に応じて時間を調整）
time.sleep(5)

# 不動産会社の情報を抽出
fudosan_elements = driver.find_elements(By.CSS_SELECTOR, '.fudosan-list-item')

for element in fudosan_elements:
    # 会社名とURLを取得
    name = element.find_element(By.TAG_NAME, 'h3').text.strip()
    link = element.find_element(By.TAG_NAME, 'a').get_attribute('href')
    print(f"会社名: {name}, URL: {link}")

# ブラウザを閉じる
driver.quit()
