#!/usr/bin/env python3
"""
管理ページがどこからデータを取得しているか確認
"""

import os
from dotenv import load_dotenv
from datetime import date, timedelta
from database import db

load_dotenv()

def check_data_source():
    """データソースを確認"""
    print("=" * 70)
    print("データソース確認")
    print("=" * 70)
    
    print(f"\n1. データベースタイプ: {db.db_type.upper()}")
    print(f"   Supabase URL: {os.getenv('SUPABASE_URL', '未設定')}")
    
    if db.db_type == "supabase":
        print("\n2. Supabaseからデータを取得中...")
        
        # 管理ページと同じクエリを実行
        try:
            # 総物件数
            result = db.supabase.table("properties")\
                .select("*", count="exact", head=True)\
                .execute()
            total = result.count if hasattr(result, 'count') else 0
            
            # アクティブな物件数
            result = db.supabase.table("properties")\
                .select("*", count="exact", head=True)\
                .eq("is_active", True)\
                .execute()
            active = result.count if hasattr(result, 'count') else 0
            
            # カテゴリ別
            result = db.supabase.table("properties")\
                .select("category")\
                .execute()
            
            categories = {}
            if result.data:
                for item in result.data:
                    cat = item.get('category', '不明')
                    categories[cat] = categories.get(cat, 0) + 1
            
            # 最終更新日時
            result = db.supabase.table("properties")\
                .select("updated_at")\
                .order("updated_at", desc=True)\
                .limit(1)\
                .execute()
            
            lastUpdated = result.data[0]['updated_at'] if result.data else None
            
            print(f"\n   管理ページが表示するデータ:")
            print(f"   - 総物件数: {total}件")
            print(f"   - アクティブな物件数: {active}件")
            print(f"   - カテゴリ別:")
            for cat, count in sorted(categories.items()):
                print(f"     {cat}: {count}件")
            print(f"   - 最終更新日時: {lastUpdated}")
            
            # 作成日時で最新のデータを確認
            print(f"\n3. 最新のデータ（作成日時順、最新5件）:")
            result = db.supabase.table("properties")\
                .select("created_at, title, category, is_active")\
                .order("created_at", desc=True)\
                .limit(5)\
                .execute()
            
            if result.data:
                for i, prop in enumerate(result.data, 1):
                    print(f"   {i}. {prop.get('title', 'N/A')[:50]}")
                    print(f"      カテゴリ: {prop.get('category')}, 作成日時: {prop.get('created_at')}")
                    print(f"      アクティブ: {prop.get('is_active')}")
            
            # GitHub Actionsからのデータかどうかを確認（UTC 15:00 = JST 00:00）
            print(f"\n4. GitHub Actionsからのデータ確認:")
            print(f"   GitHub Actionsは毎日UTC 15:00（JST 00:00）に実行されます")
            
            # 今日のUTC 15:00以降のデータを確認
            today = date.today()
            utc_15_00 = f"{today.isoformat()}T15:00:00+00:00"
            
            result = db.supabase.table("properties")\
                .select("created_at", count="exact")\
                .gte("created_at", utc_15_00)\
                .execute()
            
            github_count = result.count if hasattr(result, 'count') else len(result.data) if result.data else 0
            print(f"   今日のUTC 15:00以降のデータ: {github_count}件")
            
            # ローカルからのデータ（JST時間帯）を確認
            jst_00_00 = f"{today.isoformat()}T00:00:00+09:00"
            jst_23_59 = f"{today.isoformat()}T23:59:59+09:00"
            
            result = db.supabase.table("properties")\
                .select("created_at", count="exact")\
                .gte("created_at", jst_00_00)\
                .lt("created_at", jst_23_59)\
                .execute()
            
            local_count = result.count if hasattr(result, 'count') else len(result.data) if result.data else 0
            print(f"   今日のJST時間帯のデータ: {local_count}件")
            
        except Exception as e:
            print(f"   エラー: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("確認完了")
    print("=" * 70)

if __name__ == "__main__":
    check_data_source()

