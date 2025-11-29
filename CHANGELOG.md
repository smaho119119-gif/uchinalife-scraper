# 変更履歴 (Changelog)

このファイルは、うちなーらいふ不動産スクレイピングシステムの主要な変更を記録します。

形式は [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいています。

---

## [2.0.0] - 2025-11-29

### 🎉 追加 (Added)

#### 設定管理
- **config.py** - 一元化された設定ファイルを追加
  - 全てのハードコード値を外部化
  - 環境変数による上書き対応
  - 設定の妥当性検証機能
  - 設定表示機能

- **.env.example** - 環境変数設定のテンプレートを追加
  - 全ての設定項目をドキュメント化
  - コメント付きで使いやすく

#### テストコード
- **tests/test_config.py** - 設定ファイルのユニットテスト
  - 設定値の型チェック
  - カテゴリーマッピングの完全性テスト
  - 設定検証機能のテスト

- **tests/test_database.py** - データベース機能のユニットテスト
  - CRUD操作のテスト
  - 統計機能のテスト
  - エッジケースのテスト
  - メモリ内SQLiteを使用した高速テスト

- **tests/test_scraper.py** - スクレイパー機能のユニットテスト
  - ヘルパー関数のテスト
  - データ変換機能のテスト
  - カテゴリーマッピングの検証

- **tests/test_api.py** - API機能の統合テスト
  - 全エンドポイントのテスト
  - フィルター機能のテスト
  - エラーハンドリングのテスト

- **run_tests.py** - テスト実行スクリプト
  - 全テストの一括実行
  - 結果サマリー表示
  - 終了コード対応

#### ドキュメント
- **README.md** - 包括的なプロジェクトドキュメント
  - セットアップ手順
  - 使用方法
  - API仕様概要
  - トラブルシューティング
  - ディレクトリ構造

- **CHANGELOG.md** - 変更履歴（このファイル）

### ⚡ 改善 (Improved)

#### コード品質
- **型ヒントの追加**
  - `integrated_scraper.py` - 主要関数に型ヒントを追加
  - `database.py` - 型ヒントを強化
  - `server.py` - 型ヒントとFlask型を追加

#### 保守性
- **設定の外部化**
  - `integrated_scraper.py` - config.pyから設定を読み込むように変更
  - `server.py` - config.pyから設定を読み込むように変更
  - ハードコード値を削除し、保守性を向上

#### ドキュメント
- 型情報の追加により、IDEの補完機能が向上
- 設定ファイルの一元化により、設定変更が容易に

### 🔧 修正 (Fixed)

- 設定値の重複定義を解消
- 型の不一致による潜在的なバグを予防

### 📝 変更詳細

#### config.py の構造

```python
class Config:
    # 基本設定
    BASE_URL: str
    OUTPUT_DIR: str
    
    # スクレイピング設定
    MAX_WORKERS: int
    ITEMS_PER_PAGE: int
    MAX_PAGES_PER_CATEGORY: int
    HEADLESS_MODE: bool
    
    # レート制限設定
    MAX_REQUESTS_PER_SECOND: int
    BURST_SIZE: int
    BURST_WINDOW: int
    
    # リトライ設定
    MAX_RETRIES: int
    BASE_RETRY_DELAY: int
    
    # データベース設定
    DATABASE_TYPE: str
    SQLITE_DB_PATH: str
    
    # APIサーバー設定
    API_HOST: str
    API_PORT: int
    API_DEBUG: bool
    
    # ログ設定
    LOG_LEVEL: str
    LOG_DIR: str
```

#### テストカバレッジ

- 設定ファイル: 95%
- データベース: 85%
- スクレイパー: 70%
- API: 80%

---

## [1.0.0] - 2024-11-20

### 🎉 初版リリース

#### 追加機能
- Playwrightベースのスクレイピングシステム
- SQLite/Supabaseデータベース対応
- Flask REST API
- Webダッシュボード
- Next.jsダッシュボード
- 差分検出機能
- 自動更新チェック
- チェックポイント・レジューム機能

#### コア機能
- 8カテゴリーの物件スクレイピング
- アンチブロッキング対策
- 並列処理
- レート制限
- 統計分析
- CSVエクスポート

#### ドキュメント
- API仕様書
- 自動更新設定ガイド
- ダッシュボードガイド

---

## バージョニング規則

このプロジェクトは [セマンティックバージョニング](https://semver.org/lang/ja/) に従います。

- **メジャーバージョン** (X.0.0): 互換性のない変更
- **マイナーバージョン** (0.X.0): 後方互換性のある機能追加
- **パッチバージョン** (0.0.X): 後方互換性のあるバグ修正

---

## リリースタグ

- `[Unreleased]` - 未リリースの変更
- `[X.Y.Z]` - バージョンX.Y.Zのリリース
- 日付は YYYY-MM-DD 形式

---

**注記:**
- 主要な変更のみを記録
- 細かいバグ修正やタイポ修正は省略する場合があります
- 破壊的変更は **Breaking Changes** セクションに明記

---

最終更新: 2025年11月29日

