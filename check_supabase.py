#!/usr/bin/env python3
"""
Supabaseデータベースの内容を確認するスクリプト
"""

import os
from dotenv import load_dotenv
from datetime import date, timedelta
from database import db

load_dotenv()

def check_supabase_data():
    """Supabaseデータベースの内容を確認"""
    print("=" * 70)
    print("Supabaseデータベース確認")
    print("=" * 70)
    print(f"データベースタイプ: {db.db_type.upper()}\n")
    
    if db.db_type != "supabase":
        print("⚠️  現在のデータベースタイプはSupabaseではありません")
        print(f"   現在のタイプ: {db.db_type}")
        return
    
    try:
        # 1. アクティブな物件の総数
        print("1. アクティブな物件の総数")
        print("-" * 70)
        active_properties = db.get_all_active_properties()
        print(f"   アクティブな物件数: {len(active_properties)}件\n")
        
        # 2. カテゴリ別の物件数
        print("2. カテゴリ別の物件数")
        print("-" * 70)
        category_counts = {}
        for prop in active_properties:
            category = prop.get('category', 'unknown')
            category_counts[category] = category_counts.get(category, 0) + 1
        
        for category, count in sorted(category_counts.items()):
            print(f"   {category}: {count}件")
        print()
        
        # 3. 今日の新規物件
        print("3. 今日の新規物件")
        print("-" * 70)
        today = date.today()
        today_properties = [
            p for p in active_properties 
            if p.get('first_seen_date') == today.isoformat()
        ]
        print(f"   今日の新規物件数: {len(today_properties)}件\n")
        
        # 4. 最近のスナップショット
        print("4. 最近のリンクスナップショット")
        print("-" * 70)
        try:
            # 各カテゴリの最新スナップショットを取得
            categories = ['jukyo', 'jigyo', 'yard', 'parking', 'tochi', 'mansion', 'house', 'sonota']
            for cat in categories:
                snapshot = db.get_previous_links(cat, days_back=0)
                if snapshot:
                    print(f"   {cat}: {len(snapshot)}件 (今日)")
                else:
                    # 昨日のスナップショットを確認
                    snapshot = db.get_previous_links(cat, days_back=1)
                    if snapshot:
                        print(f"   {cat}: {len(snapshot)}件 (昨日)")
                    else:
                        print(f"   {cat}: データなし")
        except Exception as e:
            print(f"   エラー: {e}")
        print()
        
        # 5. 最新の物件（サンプル）
        print("5. 最新の物件（サンプル5件）")
        print("-" * 70)
        sorted_properties = sorted(
            active_properties,
            key=lambda x: x.get('created_at', ''),
            reverse=True
        )[:5]
        
        for i, prop in enumerate(sorted_properties, 1):
            print(f"   {i}. {prop.get('title', 'N/A')[:50]}")
            print(f"      カテゴリ: {prop.get('category')}, URL: {prop.get('url', '')[:60]}...")
            print(f"      価格: {prop.get('price', 'N/A')}, 作成日: {prop.get('created_at', 'N/A')}")
        print()
        
        # 6. 成約物件数（非アクティブ）
        print("6. 成約物件数（非アクティブ）")
        print("-" * 70)
        try:
            # Supabaseから非アクティブな物件を取得
            result = db.supabase.table("properties")\
                .select("id", count="exact")\
                .eq("is_active", False)\
                .execute()
            inactive_count = result.count if hasattr(result, 'count') else len(result.data) if result.data else 0
            print(f"   成約物件数: {inactive_count}件\n")
        except Exception as e:
            print(f"   エラー: {e}\n")
        
        print("=" * 70)
        print("確認完了")
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_supabase_data()

