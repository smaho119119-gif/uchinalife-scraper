import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd
import os

# Google Sheets API認証情報
def auth_gspread():
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    creds = ServiceAccountCredentials.from_json_keyfile_name('your_credentials_file.json', scope)
    return gspread.authorize(creds)

# 最新のCSVファイル名を取得
def get_latest_csv(directory='data'):
    csv_files = [file for file in os.listdir(directory) if file.endswith('.csv')]
    full_paths = [os.path.join(directory, file) for file in csv_files]
    latest_file = max(full_paths, key=os.path.getmtime)
    return latest_file

# CSVデータをスプレッドシートに書き込む
def csv_to_sheet(csv_file, sheet):
    # CSVファイルをDataFrameとして読み込む
    data = pd.read_csv(csv_file)
    
    # スプレッドシートをクリア
    sheet.clear()
    
    # DataFrameからスプレッドシートへ書き込む（1行目にヘッダーを含む）
    (row_count, col_count) = data.shape
    cells_range = f'A1:{chr(64 + col_count)}{row_count + 1}'
    cell_list = sheet.range(cells_range)
    
    for cell, value in zip(cell_list, pd.concat([data.columns.to_frame().T, data], ignore_index=True).values.flatten()):
        cell.value = value
    
    sheet.update_cells(cell_list)

def main():
    client = auth_gspread()
    sheet = client.open_by_url('https://docs.google.com/spreadsheets/d/1YK1D-d-HlP4C1piP-ib2aRVplsnEPDXEmc0nTQvJQTM/edit#gid=276754068').worksheet('land2')
    latest_csv = get_latest_csv()
    csv_to_sheet(latest_csv, sheet)

if __name__ == "__main__":
    main()
