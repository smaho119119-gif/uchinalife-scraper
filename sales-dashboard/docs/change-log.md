# Change Log

## 2026-04-23 — Round 6 (prompts split, market-price hook, RLS audit, CSP hardening)

### sales-copy prompt 分離 (R6-1 partial)
- `src/prompts/sales-copy.ts` を新設: `buildSalesCopyPrompt(property)` を pure 関数化
- `src/lib/ai.ts`: 旧インライン prompt を呼び出しに置換 (1183 → 1165 行)
- 画像生成 prompt の分離は出力影響評価が必要なため Round 7 へ持ち越し

### MarketPriceCalculator hook (R6-3)
- `src/lib/use-market-price.ts`: `useMarketPriceSearch` フック（AbortController + error state + reset）
- `src/components/sales/MarketPriceCalculator.tsx`: 内部 fetch を hook 呼び出しに置換、ローカル `MarketPriceResult` 型を hook 側へ集約

### Supabase RLS 調査 (R6-2)
- 本番 DB の RLS 状態を pg_tables で全数調査
- 重大発見: `uchina_property_images` は RLS 無効 / `staff_photos` テーブル不在 / `properties` は anon に INSERT/UPDATE 許可
- `docs/rls-plan.md` に現状・リスク・段階的適用 SQL を明文化（実適用は Round 7+）

### CSP 強化 (R6-5)
- dev/prod 分岐: 本番で `'unsafe-eval'` を script-src から削除
- `object-src 'none'`, `upgrade-insecure-requests`, `Cross-Origin-Opener-Policy: same-origin` を追加
- nonce 化への移行は docs/todo.md に記録

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功

---

## 2026-04-23 — Round 5 (map reducer, proposal hooks, AI styles, contrast)

### InteractiveMap useReducer 化 (R5-1)
- `src/lib/map-reducer.ts` を新設: 11個の useState を 1つの reducer + 13 アクションに集約
- `src/components/InteractiveMap.tsx`: 628 → 487 行

### ProposalBuilder の hooks 抽出 (R5-2)
- `src/lib/use-proposal-draft.ts`: localStorage への load/save/clear と form state を集約
- `src/lib/use-property-titles.ts`: 不足分のみ fetch（AbortController）

### AI スタイル定義 (R5-5 partial)
- `src/lib/ai-styles.ts`: 12 スタイルのテーブル化

### WCAG コントラスト改善 (R5-3 / R5-4)
- text-slate-400 → text-slate-300 (32箇所 + map page)

---

## 2026-04-23 — Round 4 (map split + toast wiring + UX polish)

### InteractiveMap 分割
- `src/lib/map-config.ts` / `use-map-markers.ts` / `use-map-session.ts`
- マップエラー時に `ErrorBanner` + retry

### Toast feedback
- ProposalBuilder / properties detail / ImageGenerator

### WCAG (limited) / モバイル (limited)
- 主要ページの dark slate 改善 / properties テーブルの overflow-x-auto

---

## 2026-04-23 — Round 3 (admin split + lib cleanup + toast infra)

### admin/page.tsx 分割
- types.ts + 4 panel コンポーネント (2255 → 1427 行)

### Toast 基盤
- sonner / Toaster

### lib のクリーンアップ
- supabase.ts と index.ts を物理削除

### 型安全化
- `@ts-ignore` → `@ts-expect-error`

---

## 2026-04-23 — Round 2 (architectural debt + security)

### 追加 (Infrastructure)
- types.ts / rate-limit.ts / auth-helpers.ts / confirm-dialog.tsx

### セキュリティ
- NextAuth maxAge / セキュリティヘッダ / レートリミット / scraping allowlist / staff-photos MIME / RPC allowlist / Date timezone / calendar bounds / エラーログ統一

### UI / UX
- useApi / ConfirmDialog / a11y polish

---

## 2026-04-23 — Round 1
基盤系（Supabase env / JSON parse / 認証 / mobile sidebar / metadata / abort / parseInt 等）
