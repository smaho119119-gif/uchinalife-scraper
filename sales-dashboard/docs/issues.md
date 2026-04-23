# Open Issues

## 2026-04-23

### 残課題（Round 2 以降で対応予定）

- **CRIT-07**: `admin/page.tsx` 2255行を分割 → コンポーネント+カスタムフック化
- **MED-08**: 削除系UIに確認ダイアログ統一適用
- **MED-11**: `lib/propertyCache.ts` の serverless 非互換 → 既に多くは revalidate 化済。残箇所を洗い出す
- **LOW-04**: 緯度経度のハードコード集約 (`lib/coordinates.ts`)
- **LOW-05**: `any` 型を段階的に厳格化（重大ではないため最後）

### 後回し理由
- Round 1 では「セキュリティ + クラッシュ + ナビゲーション断 + 共通基盤」を優先
- 大規模リファクタは1度に行うと副作用検証コスト爆発するため複数ラウンドに分割

### 追加調査項目
- Supabase RLS ポリシー（properties テーブル）が anon でフルアクセスかを確認
- middleware で除外している `/api/properties` が public で良いか営業側確認
- Vercel Functions の cold start 時間と revalidate 戦略の整合性
