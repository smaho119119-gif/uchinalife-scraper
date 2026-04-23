# Design Decisions

## 2026-04-23 — Round 1

### D-1: Supabase クライアントを `lib/supabase-server.ts` に一本化
- **採用**: サーバー専用ヘルパ `getSupabase()` を1箇所定義し、env欠損時は throw する
- **理由**: 8箇所以上で重複 + 環境変数の選択ロジックがバラバラ → 起動時に検出できないバグの温床
- **不採用**: 各ファイルで `process.env.X!` を続ける案 → 静かに空文字で createClient され検知不能

### D-2: クライアント fetch を `useApi` フックに統一
- **採用**: `AbortController`、`loading/error/data` 状態、`signal` 自動付与
- **理由**: 各 page で同じパターンを誤って実装、abort 漏れ・loading解除漏れ多数
- **不採用**: SWR 導入 → ライブラリ追加コスト・既存コード書換量大。最小依存で同等価値を提供

### D-3: 認証 middleware の matcher を「保護対象のみ」に変更
- **採用**: `/admin`, `/api/admin/*`, `/api/ai/*` のみ middleware 経由
- **理由**: 元の matcher は API 全体を除外しており API 認証ゼロ。一方で全パスを通すと公開ページが回らない
- **副作用**: 公開ページ (`/`, `/properties`, `/sales/featured`) は無認証で閲覧可。仕様として明示

### D-4: 共通定数を `lib/categories.ts` に集約
- **採用**: `CATEGORIES`, `CATEGORY_TO_TYPE`, `RENTAL_CATEGORIES`, `SALE_CATEGORIES`
- **理由**: 6+箇所に重複、新カテゴリ追加で破綻リスク

### D-5: JSON parsing は `lib/json.ts` の `safeParseJson` に集約
- **採用**: undefined/string/object すべて受け取り `{}` フォールバック
- **理由**: 5+箇所で `JSON.parse(x)` を try なしで呼んでおり、1件でも壊れたデータがあると 500

### D-6: エラー UI は `components/ui/error-banner.tsx` で統一
- **採用**: シンプルな赤バナー + 再試行ボタン
- **理由**: 各 page ごとにバラバラ、ほとんど何も出ていない箇所多数

### D-7: 環境変数は **サーバ側 = `SUPABASE_URL`、クライアント側 = `NEXT_PUBLIC_SUPABASE_URL`** で完全分離
- **採用**: フォールバックチェーンを廃止
- **理由**: フォールバック多重で実環境のキーがどれか不明、本番でズレるリスク
