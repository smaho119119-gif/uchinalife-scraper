# Change Log

## 2026-04-23 — Round 5 (map reducer, proposal hooks, AI styles, contrast)

### InteractiveMap useReducer 化 (R5-1)
- `src/lib/map-reducer.ts` を新設: 11個の useState を 1つの reducer + 13 アクションに集約
- `SELECT_REGION` / `TOGGLE_STORE` などのコーディネートが必要な更新を1アクションで完結（race condition の余地を撲滅）
- 純関数化により `mapReducer` 単体テスト可能
- `src/components/InteractiveMap.tsx`: **628 → 487 行**（-22%、当初 738 比 -34%）
- 機能挙動は維持: region 選択、店舗トグル、fit-bounds、session 復元、property 復元

### ProposalBuilder の hooks 抽出 (R5-2)
- `src/lib/use-proposal-draft.ts`: localStorage への load/save/clear と form state を集約
- `src/lib/use-property-titles.ts`: 選択 URL の不足分のみフェッチ（AbortController + 失敗無視）
- `src/components/sales/ProposalBuilder.tsx`: 重複ロジック削減、責務はUIのみに

### AI スタイル定義の集約 (R5-5 partial)
- `src/lib/ai-styles.ts`: 12 スタイルのテーブル化 + `getStyleDescription` を1箇所に
- `src/lib/ai.ts`: 旧 switch/case を削除（1214 → 1183 行）
- 完全な prompt 分離は別 round で（300+行のテンプレ抜き出し時に AI 出力影響評価が必要）

### WCAG コントラスト改善 (R5-3 / R5-4)
- `text-slate-400` → `text-slate-300`:
  - `app/sales/featured/page.tsx` (3箇所)
  - `app/sales/area-analysis/page.tsx` (4箇所)
  - `app/properties/page.tsx` (25箇所)
- `app/map/page.tsx` の loading テキスト: `dark:text-slate-400` → `dark:text-slate-300`

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- 公開API レスポンスシェイプ維持

---

## 2026-04-23 — Round 4 (map split + toast wiring + UX polish)

### InteractiveMap 分割 (R4-1 phase 1)
- `src/lib/map-config.ts` — REGIONS / SUMAHO119_STORES / MAP_CATEGORIES / REMOTE_ISLANDS / DEFAULTS を集約
- `src/lib/use-map-markers.ts` — 物件マーカーfetch + module-level cache + 離島フィルタを抽出（AbortController + error state）
- `src/lib/use-map-session.ts` — sessionStorage 永続化を debounced フック化
- `src/components/InteractiveMap.tsx`: 738 → 628 行
- マップエラー時に `ErrorBanner` + retry を表示

### Toast feedback (R4-5)
- `ProposalBuilder`: 物件削除成功 / 下書きクリア成功で toast.success
- `properties/[...url]/page.tsx`: 3つの alert を `toast.error` + 詳細メッセージに置換
- `ImageGenerator`: スタッフ写真削除に成功/失敗 toast

### WCAG コントラスト (R4-4 limited) / モバイル (R4-3 limited)
- `app/page.tsx` の dark テキスト slate-400/500 → slate-300
- `app/properties/page.tsx`: テーブルを overflow-x-auto + min-w-[720px]

---

## 2026-04-23 — Round 3 (admin split + lib cleanup + toast infra)

### admin/page.tsx 分割 (R3-01 Phase 1)
- `src/app/admin/types.ts` を新設し、9つの interface を集約
- `src/components/admin/StatsOverviewPanel.tsx` / `ScrapingSettingsPanel.tsx` / `GeneratedImagesGallery.tsx` / `LogViewerPanel.tsx`
- `src/app/admin/page.tsx`: 2255行 → 1427行

### Toast 基盤 (R3-07)
- `sonner` を導入、`src/app/layout.tsx` に `Toaster` を配置

### lib のクリーンアップ (R3-11)
- `src/lib/supabase.ts` と `src/lib/index.ts` を物理削除
- 6 ファイルを `@/lib/db` / `@/lib/types` への import に切り替え

### 型安全化 (R3-08)
- `src/lib/ai.ts`: `@ts-ignore` → `@ts-expect-error`

---

## 2026-04-23 — Round 2 (architectural debt + security)

### 追加 (Infrastructure)
- `src/lib/types.ts` — Property/StaffPhoto/GeneratedImage 型を集約
- `src/lib/rate-limit.ts` — in-memory token-bucket
- `src/lib/auth-helpers.ts` — `getActorKey` / `enforceRateLimit`
- `src/components/ui/confirm-dialog.tsx` — 破壊的操作向け共通モーダル

### セキュリティ
- NextAuth `session.maxAge=8h`, `updateAge=1h`, `jwt.maxAge=8h`
- middleware で全レスポンスにセキュリティヘッダ
- AI/scraping/staff-photos のレートリミット
- Scraping API: categories allowlist
- Staff photos: 1.5MB上限、JPEG/PNG/WebP MIME 検証
- RPC allowlist
- Date timezone (JST化)
- Calendar bounds
- エラーログ統一

### UI / UX
- クライアント fetch を useApi に移行
- ConfirmDialog で破壊的操作確認
- a11y polish

---

## 2026-04-23 — Round 1
基盤系（Supabase env / JSON parse / 認証 / mobile sidebar / metadata / abort / parseInt 等）
