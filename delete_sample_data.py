"""
サンプルデータを削除
"""

from database import db
import sqlite3

print("サンプルデータを削除中...")

# サンプルデータのURL（add_sample_data.pyで追加したもの）
sample_urls = [
    "https://www.e-uchina.net/bukken/jukyo/sample-001/detail.html",
    "https://www.e-uchina.net/bukken/jukyo/sample-002/detail.html",
    "https://www.e-uchina.net/bukken/tochi/sample-003/detail.html",
    "https://www.e-uchina.net/bukken/mansion/sample-004/detail.html",
    "https://www.e-uchina.net/bukken/house/sample-005/detail.html",
    "https://www.e-uchina.net/bukken/jigyo/sample-006/detail.html"
]

if db.db_type == "sqlite":
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    
    deleted_count = 0
    for url in sample_urls:
        cursor.execute("DELETE FROM properties WHERE url = ?", (url,))
        deleted_count += cursor.rowcount
    
    conn.commit()
    conn.close()
    
    print(f"✓ {deleted_count}件のサンプルデータを削除しました")
else:
    # Supabase
    for url in sample_urls:
        db.supabase.table("properties").delete().eq("url", url).execute()
    print(f"✓ サンプルデータを削除しました")

print("\n完了！ダッシュボードをリロードしてください。")
