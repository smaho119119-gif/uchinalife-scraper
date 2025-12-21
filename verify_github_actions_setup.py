#!/usr/bin/env python3
"""
GitHub Actionsの設定が正しくSupabaseに保存するようになっているか確認
"""

import os
import sys

print("=" * 70)
print("GitHub Actions設定確認")
print("=" * 70)

# 1. ワークフローファイルの確認
print("\n1. ワークフローファイル (.github/workflows/property-scraper.yml)")
print("-" * 70)
try:
    with open('.github/workflows/property-scraper.yml', 'r') as f:
        content = f.read()
        if "DATABASE_TYPE: ${{ secrets.DATABASE_TYPE || 'supabase' }}" in content:
            print("   ✅ DATABASE_TYPEのデフォルトが'supabase'に設定されています")
        elif "DATABASE_TYPE: ${{ secrets.DATABASE_TYPE || 'sqlite' }}" in content:
            print("   ❌ DATABASE_TYPEのデフォルトが'sqlite'になっています")
        else:
            print("   ⚠️  DATABASE_TYPEの設定が見つかりません")
        
        if "SUPABASE_URL: ${{ secrets.SUPABASE_URL }}" in content:
            print("   ✅ SUPABASE_URLが設定されています")
        else:
            print("   ❌ SUPABASE_URLが設定されていません")
        
        if "SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}" in content:
            print("   ✅ SUPABASE_ANON_KEYが設定されています")
        else:
            print("   ❌ SUPABASE_ANON_KEYが設定されていません")
except Exception as e:
    print(f"   ❌ ファイル読み込みエラー: {e}")

# 2. database.pyの確認
print("\n2. database.pyの設定")
print("-" * 70)
try:
    with open('database.py', 'r') as f:
        content = f.read()
        if 'DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")' in content:
            print("   ❌ database.pyのデフォルトが'sqlite'になっています")
            print("   ⚠️  これは問題です！環境変数が設定されていない場合、SQLiteが使われます")
        elif 'DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "supabase")' in content:
            print("   ✅ database.pyのデフォルトが'supabase'に設定されています")
        else:
            # database.pyのDATABASE_TYPEの読み込み方法を確認
            if 'os.getenv("DATABASE_TYPE"' in content:
                print("   ⚠️  DATABASE_TYPEの読み込み方法を確認してください")
            else:
                print("   ⚠️  DATABASE_TYPEの設定が見つかりません")
except Exception as e:
    print(f"   ❌ ファイル読み込みエラー: {e}")

# 3. config.pyの確認
print("\n3. config.pyの設定")
print("-" * 70)
try:
    with open('config.py', 'r') as f:
        content = f.read()
        if 'DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")' in content:
            print("   ❌ config.pyのデフォルトが'sqlite'になっています")
        elif 'DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "supabase")' in content:
            print("   ✅ config.pyのデフォルトが'supabase'に設定されています")
        else:
            print("   ⚠️  DATABASE_TYPEの設定が見つかりません")
except Exception as e:
    print(f"   ❌ ファイル読み込みエラー: {e}")

# 4. requirements.txtの確認
print("\n4. requirements.txtの確認")
print("-" * 70)
try:
    with open('requirements.txt', 'r') as f:
        content = f.read()
        if 'supabase' in content.lower():
            print("   ✅ supabaseパッケージが含まれています")
        else:
            print("   ❌ supabaseパッケージが含まれていません")
except Exception as e:
    print(f"   ❌ ファイル読み込みエラー: {e}")

# 5. 実際の動作確認（環境変数が設定されている場合）
print("\n5. 現在の環境変数確認")
print("-" * 70)
db_type = os.getenv("DATABASE_TYPE", "未設定")
supabase_url = os.getenv("SUPABASE_URL", "未設定")
supabase_key = os.getenv("SUPABASE_ANON_KEY", "未設定")

print(f"   DATABASE_TYPE: {db_type}")
print(f"   SUPABASE_URL: {'設定済み' if supabase_url != '未設定' else '未設定'}")
print(f"   SUPABASE_ANON_KEY: {'設定済み' if supabase_key != '未設定' else '未設定'}")

print("\n" + "=" * 70)
print("確認完了")
print("=" * 70)

