# うちなーらいふ不動産スクレイピングツール

沖縄県の不動産情報を自動収集するスクレイピングツール

## 🚀 機能

- **自動スクレイピング**: GitHub Actionsで毎日自動実行
- **差分検出**: 新規物件と売却済み物件を自動検出
- **データベース対応**: SQLite / Supabase
- **ダッシュボード**: Next.jsベースの分析ダッシュボード

## 📋 セットアップ（GitHub Actions）

### 1. Supabaseプロジェクト作成（オプション）

1. [Supabase](https://supabase.com)にアクセス
2. 新規プロジェクトを作成
3. SQL Editorで以下を実行:

```sql
-- テーブル作成
CREATE TABLE properties (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    category_type TEXT,
    category_name_ja TEXT,
    genre_name_ja TEXT,
    title TEXT,
    price TEXT,
    favorites INTEGER DEFAULT 0,
    update_date TEXT,
    expiry_date TEXT,
    images JSONB,
    company_name TEXT,
    property_data JSONB,
    is_active BOOLEAN DEFAULT true,
    first_seen_date DATE,
    last_seen_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE daily_link_snapshots (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    category TEXT NOT NULL,
    urls JSONB NOT NULL,
    url_count INTEGER DEFAULT 0,
    scraped_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(snapshot_date, category)
);

-- インデックス作成
CREATE INDEX idx_properties_url ON properties(url);
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_is_active ON properties(is_active);
CREATE INDEX idx_properties_first_seen ON properties(first_seen_date);
CREATE INDEX idx_properties_last_seen ON properties(last_seen_date);
CREATE INDEX idx_snapshots_date_category ON daily_link_snapshots(snapshot_date, category);
```

4. Project Settings → API から以下を取得:
   - `Project URL` (SUPABASE_URL)
   - `anon public` key (SUPABASE_ANON_KEY)

### 2. GitHubリポジトリ設定

1. このリポジトリをGitHubにプッシュ
2. Settings → Secrets and variables → Actions
3. 以下のSecretsを追加:

**Supabase使用時**:
- `DATABASE_TYPE`: `supabase`
- `SUPABASE_URL`: `https://your-project.supabase.co`
- `SUPABASE_ANON_KEY`: `your-anon-key`

**SQLiteのみ使用時**:
- Secretsは不要（デフォルトでSQLite）

### 3. 実行確認

1. Actions タブを開く
2. "Daily Property Scraper" を選択
3. "Run workflow" で手動実行してテスト

## 🏃 ローカル実行

```bash
# 依存関係インストール
pip install -r requirements.txt
playwright install chromium

# 環境変数設定（.env）
DATABASE_TYPE=sqlite  # または supabase
# SUPABASE_URL=your-url
# SUPABASE_ANON_KEY=your-key

# スクレイピング実行
python integrated_scraper.py

# 強制リンク更新
python integrated_scraper.py --force-refresh
```

## 📊 ダッシュボード

```bash
cd sales-dashboard
npm install
npm run dev
```

http://localhost:3000 でアクセス

## ⚙️ 設定

### 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `DATABASE_TYPE` | `sqlite` | `sqlite` または `supabase` |
| `SCRAPER_MAX_WORKERS` | `4` | 並列ワーカー数 |
| `SCRAPER_MAX_PAGES` | `150` | カテゴリごとの最大ページ数 |
| `SCRAPER_ITEMS_PER_PAGE` | `50` | 1ページあたりの件数 |

### スケジュール変更

`.github/workflows/daily-scraper.yml` の `cron` を編集:

```yaml
schedule:
  - cron: '0 15 * * *'  # 毎日0時JST
  # - cron: '0 */6 * * *'  # 6時間ごと
  # - cron: '0 9,21 * * *'  # 1日2回（18時、6時JST）
```

## 📁 出力ファイル

- `output/properties.db`: SQLiteデータベース
- `output/*.csv`: カテゴリ別CSV
- `logs/scraper.log`: 実行ログ

## 🔧 トラブルシューティング

### GitHub Actionsでタイムアウト

- `SCRAPER_MAX_WORKERS` を減らす（2に設定）
- `timeout-minutes` を増やす

### 403 Forbidden エラー

- すでに対策済み（ステルス機能実装済み）
- 頻度を下げる（1日1回推奨）

## 📝 ライセンス

MIT

## 🤝 貢献

Issue・PRを歓迎します
