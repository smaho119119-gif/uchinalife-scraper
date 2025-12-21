# Supabaseに保存されていなかった原因

## 🔍 問題の原因

### 1. GitHub Actionsのワークフローファイルの設定

**修正前:**
```yaml
env:
  DATABASE_TYPE: ${{ secrets.DATABASE_TYPE || 'sqlite' }}
```

**問題点:**
- GitHub Secretsに`DATABASE_TYPE`が設定されていない場合、デフォルトで`sqlite`が使われていた
- そのため、SupabaseではなくSQLite（ローカルファイル）に保存されていた

### 2. database.pyの設定

**修正前:**
```python
DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")
```

**問題点:**
- 環境変数`DATABASE_TYPE`が設定されていない場合、デフォルトで`sqlite`が使われていた
- GitHub Actionsで環境変数が正しく設定されていても、念のためのフォールバックが`sqlite`だった

### 3. config.pyの設定

**修正前:**
```python
DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")
```

**問題点:**
- 同様に、デフォルトが`sqlite`になっていた

## 📊 実際の動作フロー（修正前）

1. GitHub Actionsが実行される
2. 環境変数`DATABASE_TYPE`が設定される
   - Secretsに`DATABASE_TYPE`が設定されていない場合 → `sqlite`（デフォルト）
3. `integrated_scraper.py`が実行される
4. `database.py`が読み込まれる
5. `DATABASE_TYPE`が`sqlite`のため、SQLiteデータベースに接続
6. データが`output/properties.db`（ローカルファイル）に保存される
7. **Supabaseには保存されない** ❌

## ✅ 修正後の動作フロー

1. GitHub Actionsが実行される
2. 環境変数`DATABASE_TYPE`が設定される
   - Secretsに`DATABASE_TYPE`が設定されていない場合 → `supabase`（デフォルト）✅
3. `integrated_scraper.py`が実行される
4. `database.py`が読み込まれる
5. `DATABASE_TYPE`が`supabase`のため、Supabaseに接続
6. データがSupabaseに保存される ✅

## 🔧 修正内容

### 修正したファイル

1. **`.github/workflows/property-scraper.yml`**
   ```yaml
   DATABASE_TYPE: ${{ secrets.DATABASE_TYPE || 'supabase' }}
   ```

2. **`database.py`**
   ```python
   DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "supabase")
   ```

3. **`config.py`**
   ```python
   DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "supabase")
   ```

## 📝 まとめ

**原因:**
- デフォルト値が`sqlite`になっていたため、GitHub Secretsに`DATABASE_TYPE`が設定されていない場合、自動的にSQLiteが使われていた
- SQLiteはローカルファイルに保存されるため、Supabaseには保存されなかった

**解決策:**
- デフォルト値を`supabase`に変更した
- これにより、GitHub Secretsに`DATABASE_TYPE`が設定されていない場合でも、自動的にSupabaseが使われるようになった

**確認事項:**
- GitHub Secretsに`SUPABASE_URL`と`SUPABASE_ANON_KEY`が正しく設定されている必要があります
- これらが設定されていれば、次回のGitHub Actions実行からSupabaseにデータが保存されます

