"""
サンプル物件データを追加するスクリプト
ダッシュボードのデモ用
"""

from database import db
from datetime import date

print("サンプル物件データを追加中...")

# サンプル物件データ
sample_properties = [
    {
        "url": "https://www.e-uchina.net/bukken/jukyo/sample-001/detail.html",
        "category": "jukyo",
        "category_type": "賃貸",
        "category_name_ja": "賃貸",
        "genre_name_ja": "住居",
        "title": "賃貸アパート オーシャンビュー 201号",
        "price": "6.5万円",
        "favorites": 3,
        "update_date": "2025-11-22",
        "expiry_date": "2025-12-22",
        "images": ["https://picsum.photos/400/300?random=1"],
        "company_name": "うちなーらいふ不動産",
        "property_data": {
            "家賃": "6.5万円",
            "敷金／礼金": "1ヶ月/1ヶ月",
            "間取り": "2LDK",
            "所在地": "那覇市おもろまち"
        }
    },
    {
        "url": "https://www.e-uchina.net/bukken/jukyo/sample-002/detail.html",
        "category": "jukyo",
        "category_type": "賃貸",
        "category_name_ja": "賃貸",
        "genre_name_ja": "住居",
        "title": "賃貸マンション サンライズ那覇 303号",
        "price": "8.2万円",
        "favorites": 5,
        "update_date": "2025-11-23",
        "expiry_date": "2025-12-23",
        "images": ["https://picsum.photos/400/300?random=2"],
        "company_name": "沖縄ハウジング",
        "property_data": {
            "家賃": "8.2万円",
            "敷金／礼金": "2ヶ月/1ヶ月",
            "間取り": "3LDK",
            "所在地": "那覇市首里"
        }
    },
    {
        "url": "https://www.e-uchina.net/bukken/tochi/sample-003/detail.html",
        "category": "tochi",
        "category_type": "売買",
        "category_name_ja": "売買",
        "genre_name_ja": "土地",
        "title": "売地 宜野湾市真栄原",
        "price": "2,500万円",
        "favorites": 8,
        "update_date": "2025-11-22",
        "expiry_date": "2026-01-22",
        "images": ["https://picsum.photos/400/300?random=3"],
        "company_name": "沖縄土地開発",
        "property_data": {
            "価格": "2,500万円",
            "面積": "150坪",
            "所在地": "宜野湾市真栄原"
        }
    },
    {
        "url": "https://www.e-uchina.net/bukken/mansion/sample-004/detail.html",
        "category": "mansion",
        "category_type": "売買",
        "category_name_ja": "売買",
        "genre_name_ja": "マンション",
        "title": "中古マンション パークビュー那覇 1205号",
        "price": "3,800万円",
        "favorites": 12,
        "update_date": "2025-11-23",
        "expiry_date": "2026-02-23",
        "images": ["https://picsum.photos/400/300?random=4"],
        "company_name": "うちなーらいふ不動産",
        "property_data": {
            "価格": "3,800万円",
            "間取り": "4LDK",
            "専有面積": "85㎡",
            "所在地": "那覇市おもろまち"
        }
    },
    {
        "url": "https://www.e-uchina.net/bukken/house/sample-005/detail.html",
        "category": "house",
        "category_type": "売買",
        "category_name_ja": "売買",
        "genre_name_ja": "戸建",
        "title": "新築戸建 浦添市内間",
        "price": "4,200万円",
        "favorites": 15,
        "update_date": "2025-11-23",
        "expiry_date": "2026-03-23",
        "images": ["https://picsum.photos/400/300?random=5"],
        "company_name": "沖縄ハウジング",
        "property_data": {
            "価格": "4,200万円",
            "間取り": "4LDK",
            "土地面積": "200㎡",
            "建物面積": "120㎡",
            "所在地": "浦添市内間"
        }
    },
    {
        "url": "https://www.e-uchina.net/bukken/jigyo/sample-006/detail.html",
        "category": "jigyo",
        "category_type": "賃貸",
        "category_name_ja": "賃貸",
        "genre_name_ja": "事業用",
        "title": "賃貸事務所 国際通り沿い 2階",
        "price": "25万円",
        "favorites": 6,
        "update_date": "2025-11-22",
        "expiry_date": "2025-12-22",
        "images": ["https://picsum.photos/400/300?random=6"],
        "company_name": "沖縄商業不動産",
        "property_data": {
            "賃料": "25万円",
            "面積": "60㎡",
            "所在地": "那覇市牧志"
        }
    }
]

# データ追加
success_count = 0
for prop in sample_properties:
    if db.upsert_property(prop):
        success_count += 1
        print(f"✓ 追加: {prop['title']}")

print(f"\n完了！ {success_count}/{len(sample_properties)} 件の物件を追加しました。")
print("\nダッシュボードをリロードして確認してください！")
