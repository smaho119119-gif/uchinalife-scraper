import sqlite3
import pandas as pd
import json
import os
from datetime import datetime

# Configuration
DB_PATH = "output/properties.db"
OUTPUT_DIR = "output"
TODAY = datetime.now().strftime("%Y_%m_%d")

# Category Mappings
CATEGORY_NAMES = {
    "jukyo": "賃貸",
    "jigyo": "賃貸",
    "yard": "賃貸",
    "parking": "賃貸",
    "tochi": "売買",
    "mansion": "売買",
    "house": "売買",
    "sonota": "売買"
}

GENRE_NAMES = {
    "jukyo": "住居",
    "jigyo": "事業用",
    "yard": "月極駐車場",
    "parking": "時間貸駐車場",
    "tochi": "土地",
    "mansion": "マンション",
    "house": "戸建",
    "sonota": "その他"
}

def export_to_csv():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Get all active properties
        cursor.execute("SELECT * FROM properties WHERE is_active = 1")
        rows = cursor.fetchall()
        
        # Group by category
        data_by_category = {}
        
        for row in rows:
            item = dict(row)
            category = item["category"]
            
            if category not in data_by_category:
                data_by_category[category] = []
            
            # Parse JSON fields
            try:
                property_data = json.loads(item["property_data"]) if item["property_data"] else {}
                images = json.loads(item["images"]) if item["images"] else []
            except:
                property_data = {}
                images = []
            
            # Flatten data for CSV
            flat_item = {
                "title": item["title"],
                "price": item["price"],
                "url": item["url"],
                "favorites": item["favorites"],
                "update_date": item["update_date"],
                "expiry_date": item["expiry_date"],
                "images": " | ".join(images),
                "company_name": item["company_name"]
            }
            
            # Add dynamic property data
            for key, value in property_data.items():
                flat_item[key] = value
                
            data_by_category[category].append(flat_item)
        
        # Export each category to CSV
        for category, items in data_by_category.items():
            if not items:
                continue
                
            df = pd.DataFrame(items)
            
            # Generate filename: Category_Genre_YYYY_MM_DD.csv
            cat_name_ja = CATEGORY_NAMES.get(category, "不明")
            genre_name_ja = GENRE_NAMES.get(category, "不明")
            filename = f"{cat_name_ja}_{genre_name_ja}_{TODAY}.csv"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            # Save to CSV
            df.to_csv(filepath, index=False, encoding="utf-8-sig")
            print(f"Exported {len(items)} items to {filename}")

    except Exception as e:
        print(f"Error exporting to CSV: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    export_to_csv()
