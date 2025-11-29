# Supabase セットアップガイド

## 1. データベース作成手順

### ステップ1: Supabaseプロジェクトにアクセス
1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. プロジェクトを選択

### ステップ2: SQL Editorでマイグレーション実行
1. 左メニューから **SQL Editor** をクリック
2. **New query** ボタンをクリック
3. `supabase_migration.sql` の内容を全てコピー&ペースト
4. **Run** ボタンをクリックしてSQLを実行

### ステップ3: テーブル作成の確認
1. 左メニューから **Table Editor** をクリック
2. 以下の3つのテーブルが作成されていることを確認：
   - ✅ `properties` (物件データ)
   - ✅ `daily_link_snapshots` (日次URLスナップショット)
   - ✅ `property_snapshots` (履歴スナップショット)

---

## 2. 環境変数の設定

### ステップ1: Supabase認証情報の取得
1. Supabase Dashboardで **Settings** → **API** をクリック
2. 以下の情報をコピー：
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (管理用)

### ステップ2: .envファイルの作成
```bash
# .env.exampleをコピー
cp .env.example .env

# .envを編集して実際の値を設定
nano .env
```

`.env` ファイルの内容例：
```
SUPABASE_URL=https://abcdefgh12345.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Pythonパッケージのインストール

```bash
pip install supabase python-dotenv
```

または、requirements.txtに追加：
```bash
echo "supabase>=2.0.0" >> requirements.txt
echo "python-dotenv>=1.0.0" >> requirements.txt
pip install -r requirements.txt
```

---

## 4. 接続テスト

簡単な接続テストを実行：

```python
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY")
)

# テスト: propertiesテーブルにアクセス
result = supabase.table("properties").select("*").limit(1).execute()
print("接続成功！", result.data)
```

---

## 5. データベーススキーマ説明

### `properties` テーブル
現在アクティブな物件情報を保存

**主要カラム：**
- `url`: 物件URL（ユニーク）
- `category`: カテゴリー（jukyo, tochi, etc.）
- `category_type`: 賃貸 or 売買
- `title`, `price`: 物件タイトルと価格
- `property_data`: JSONB形式で柔軟なデータ保存
- `is_active`: アクティブフラグ（false = 成約済み）
- `first_seen_date`: 初回発見日
- `last_seen_date`: 最終確認日

**特徴：**
- 全8カテゴリーを1つのテーブルで管理
- JSONBカラムで可変フィールドに対応
- インデックス最適化済み

### `daily_link_snapshots` テーブル
毎日のURL一覧を保存（差分検出用）

**用途：**
- 昨日と今日を比較して新規・成約物件を検出
- カテゴリーごとに1日1レコード

### `property_snapshots` テーブル（オプション）
物件の価格変動など履歴を追跡

---

## 6. ヘルパー関数の使用方法

SQLで便利な関数が定義されています：

### 今日の新規物件を取得
```sql
SELECT * FROM get_new_properties_today();
```

### 最近成約した物件を取得（7日以内）
```sql
SELECT * FROM get_recently_sold_properties(7);
```

### 今日の差分サマリを取得
```sql
SELECT * FROM get_daily_diff(CURRENT_DATE);
```

---

## 7. トラブルシューティング

### エラー: "relation does not exist"
→ SQLマイグレーションが正しく実行されていません。ステップ2を再実行してください。

### エラー: "Invalid API key"
→ `.env`ファイルのキーが正しいか確認してください。

### エラー: "permission denied"
→ `service_role` キーを使用するか、RLSポリシーを設定してください。

---

## 8. 次のステップ

✅ データベース作成完了
✅ 環境変数設定完了
✅ 接続テスト成功

次は：
1. スクレイパーをSupabase対応に修正
2. APIエンドポイントを実装
3. フロントエンドを更新

詳細は `implementation_plan.md` を参照してください。
