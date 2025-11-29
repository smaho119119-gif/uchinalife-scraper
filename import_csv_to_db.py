"""
CSVファイルをSQLiteデータベースにインポート
既存のスクレイピング済みCSVデータをデータベースに移行
"""

import os
import glob
import pandas as pd
from database import db
from datetime import datetime, date
import re

# カテゴリーマッピング（ファイル名 → カテゴリー）
CATEGORY_MAPPING = {
    "賃貸_住居": "jukyo",
    "賃貸_事業用": "jigyo",
    "賃貸_月極駐車場": "yard",
    "賃貸_時間貸駐車場": "parking",
    "売買_土地": "tochi",
    "売買_マンション": "mansion",
    "売買_戸建": "house",
    "売買_その他": "sonota"
}

CATEGORY_TYPE_MAPPING = {
    "jukyo": "賃貸",
    "jigyo": "賃貸",
    "yard": "賃貸",
    "parking": "賃貸",
    "tochi": "売買",
    "mansion": "売買",
    "house": "売買",
    "sonota": "売買"
}

GENRE_MAPPING = {
    "jukyo": "住居",
    "jigyo": "事業用",
    "yard": "月極駐車場",
    "parking": "時間貸駐車場",
    "tochi": "土地",
    "mansion": "マンション",
    "house": "戸建",
    "sonota": "その他"
}

def get_category_from_filename(filename):
    """ファイル名からカテゴリーを特定"""
    basename = os.path.basename(filename)
    
    for pattern, category in CATEGORY_MAPPING.items():
        if basename.startswith(pattern):
            return category
    
    return None

def transform_csv_to_db_format(row, category):
    """CSV行をデータベース形式に変換"""
    # 固定フィールド
    fixed_fields = {
        "url", "category", "scraped_at", "title", "price", 
        "favorites", "update_date", "expiry_date", "images", "company_name"
    }
    
    # 画像URLをリストに変換
    images_str = row.get("images", "")
    images_list = []
    if images_str and isinstance(images_str, str):
        images_list = [img.strip() for img in images_str.split("|") if img.strip()]
    
    # property_dataに含める全ての追加フィールド
    property_data = {}
    for key, value in row.items():
        if key not in fixed_fields and pd.notna(value):
            property_data[key] = str(value)
    
    # データベースレコード作成
    db_record = {
        "url": row.get("url", ""),
        "category": category,
        "category_type": CATEGORY_TYPE_MAPPING[category],
        "category_name_ja": CATEGORY_TYPE_MAPPING[category],
        "genre_name_ja": GENRE_MAPPING[category],
        "title": row.get("title", ""),
        "price": row.get("price", ""),
        "favorites": int(row.get("favorites", 0)) if pd.notna(row.get("favorites")) else 0,
        "update_date": row.get("update_date"),
        "expiry_date": row.get("expiry_date"),
        "images": images_list,
        "company_name": row.get("company_name"),
        "property_data": property_data
    }
    
    return db_record

def import_csv_to_database(csv_file):
    """CSVファイルをデータベースにインポート"""
    # カテゴリー特定
    category = get_category_from_filename(csv_file)
    if not category:
        print(f"⚠️  カテゴリー不明: {csv_file}")
        return 0, 0
    
    print(f"\n処理中: {os.path.basename(csv_file)}")
    print(f"カテゴリー: {category} ({GENRE_MAPPING[category]})")
    
    # CSV読み込み
    try:
        df = pd.read_csv(csv_file, encoding='utf-8-sig')
        print(f"読み込み: {len(df)} 件")
    except Exception as e:
        print(f"✗ エラー: {e}")
        return 0, 0
    
    # 各行をデータベースに保存
    success_count = 0
    error_count = 0
    
    for idx, row in df.iterrows():
        try:
            # URL必須
            if pd.isna(row.get("url")) or not row.get("url"):
                error_count += 1
                continue
            
            # データベース形式に変換
            db_record = transform_csv_to_db_format(row, category)
            
            # データベースに保存
            if db.upsert_property(db_record):
                success_count += 1
            else:
                error_count += 1
                
        except Exception as e:
            print(f"✗ 行 {idx}: {e}")
            error_count += 1
    
    print(f"✓ 成功: {success_count} 件, エラー: {error_count} 件")
    return success_count, error_count

def main():
    print("="*70)
    print("CSV → SQLite データベース インポート")
    print("="*70)
    
    # CSVファイル検索
    csv_files = glob.glob("output/*.csv")
    csv_files = [f for f in csv_files if not os.path.basename(f).startswith('.')]
    csv_files.sort()
    
    if not csv_files:
        print("\n⚠️  CSVファイルが見つかりませんでした")
        return
    
    print(f"\n見つかったCSVファイル: {len(csv_files)} 個")
    for f in csv_files:
        print(f"  - {os.path.basename(f)}")
    
    print(f"\n{'='*70}")
    response = input("インポートを開始しますか？ (y/N): ")
    if response.lower() != 'y':
        print("キャンセルしました")
        return
    
    print(f"\n{'='*70}")
    print("インポート開始...")
    print(f"{'='*70}")
    
    total_success = 0
    total_error = 0
    
    for csv_file in csv_files:
        success, error = import_csv_to_database(csv_file)
        total_success += success
        total_error += error
    
    print(f"\n{'='*70}")
    print("インポート完了")
    print(f"{'='*70}")
    print(f"総成功: {total_success} 件")
    print(f"総エラー: {total_error} 件")
    print(f"{'='*70}\n")
    
    print("ダッシュボードをリロードして確認してください！")

if __name__ == "__main__":
    main()
