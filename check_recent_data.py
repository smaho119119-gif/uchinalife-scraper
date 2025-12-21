#!/usr/bin/env python3
"""
GitHub Actionsからの最新データがSupabaseに保存されているか確認
"""

import os
from dotenv import load_dotenv
from datetime import date, timedelta
from database import db

load_dotenv()

def check_recent_data():
    """最新のデータがSupabaseに保存されているか確認"""
    print("=" * 70)
    print("GitHub Actionsからの最新データ確認")
    print("=" * 70)
    print(f"データベースタイプ: {db.db_type.upper()}\n")
    
    if db.db_type != "supabase":
        print("⚠️  現在のデータベースタイプはSupabaseではありません")
        return
    
    try:
        # 最新の物件を取得（created_atでソート）
        print("1. 最新の物件（作成日時順、最新10件）")
        print("-" * 70)
        
        result = db.supabase.table("properties")\
            .select("*")\
            .order("created_at", desc=True)\
            .limit(10)\
            .execute()
        
        if result.data:
            for i, prop in enumerate(result.data, 1):
                created_at = prop.get('created_at', 'N/A')
                title = prop.get('title', 'N/A')[:50] if prop.get('title') else 'N/A'
                category = prop.get('category', 'N/A')
                is_active = prop.get('is_active', False)
                print(f"   {i}. {title}")
                print(f"      カテゴリ: {category}, アクティブ: {is_active}")
                print(f"      作成日時: {created_at}")
                print()
        else:
            print("   データが見つかりません\n")
        
        # 今日と昨日のデータを確認
        print("2. 最近のデータ統計（過去7日間）")
        print("-" * 70)
        
        today = date.today()
        for days_ago in range(7):
            check_date = today - timedelta(days=days_ago)
            
            result = db.supabase.table("properties")\
                .select("id", count="exact")\
                .gte("created_at", check_date.isoformat() + "T00:00:00")\
                .lt("created_at", (check_date + timedelta(days=1)).isoformat() + "T00:00:00")\
                .execute()
            
            count = result.count if hasattr(result, 'count') else len(result.data) if result.data else 0
            date_label = "今日" if days_ago == 0 else f"{days_ago}日前"
            print(f"   {check_date.isoformat()} ({date_label}): {count}件")
        
        print()
        
        # 最新のスナップショットを確認
        print("3. 最新のリンクスナップショット")
        print("-" * 70)
        
        result = db.supabase.table("daily_link_snapshots")\
            .select("*")\
            .order("snapshot_date", desc=True)\
            .limit(8)\
            .execute()
        
        if result.data:
            for snapshot in result.data:
                snapshot_date = snapshot.get('snapshot_date', 'N/A')
                category = snapshot.get('category', 'N/A')
                url_count = snapshot.get('url_count', 0)
                scraped_at = snapshot.get('scraped_at', 'N/A')
                print(f"   {snapshot_date} - {category}: {url_count}件 (スクレイピング時刻: {scraped_at})")
        else:
            print("   スナップショットが見つかりません")
        
        print()
        print("=" * 70)
        print("確認完了")
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_recent_data()

