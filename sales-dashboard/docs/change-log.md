# Change Log

## 2026-04-23 — Round 4 (map split + toast wiring + UX polish)

### InteractiveMap 分割 (R4-1 phase 1)
- `src/lib/map-config.ts` — REGIONS / SUMAHO119_STORES / MAP_CATEGORIES / REMOTE_ISLANDS / DEFAULTS を集約
- `src/lib/use-map-markers.ts` — 物件マーカーfetch + module-level cache + 離島フィルタを抽出（AbortController + error state）
- `src/lib/use-map-session.ts` — sessionStorage 永続化を debounced フック化（`readMapSession` で初期復元）
- `src/components/InteractiveMap.tsx`: **738 → 628 行** (15% 削減)
- 旧 `globalCache` シングルトンを `useMapMarkers` 内部の `moduleCache` に隔離
- `useReducer` 化は副作用検証コストが大きいため Round 5 持ち越し（state shape は決定済）
- マップエラー時に `ErrorBanner` + retry を表示

### Toast feedback (R4-5)
- `ProposalBuilder`: 物件削除成功 / 下書きクリア成功で toast.success
- `properties/[...url]/page.tsx`: 3つの alert (コピー / 画像 / 人気分析の生成失敗) を `toast.error` + 詳細メッセージに置換
- `ImageGenerator`: スタッフ写真削除に成功/失敗 toast を追加（res.ok チェック付き）

### WCAG コントラスト (R4-4 limited)
- `app/page.tsx` の dark テキスト `slate-400/500` → `slate-300` 化（ホーム画面の補助テキスト視認性向上）
- 全画面適用は影響範囲が大きいため Round 5 で続行

### モバイルレイアウト (R4-3 limited)
- `app/properties/page.tsx`: テーブルを `overflow-x-auto` + `min-w-[720px]` に変更（スマホで横スクロール、列が潰れない）

### Round 4 で着手しなかったもの → Round 5 へ
- R4-2: ProposalBuilder/MarketPriceCalculator の logic を hooks へ
- R4-6: AI prompts を `src/prompts/` に分離
- WCAG 全面修正、モバイル全面対応、useReducer 化

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功

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
- クライアント fetch を useApi に移行（properties/analytics/area-analysis/AreaAnalytics/TrendAnalytics）
- ConfirmDialog で破壊的操作確認
- a11y polish

---

## 2026-04-23 — Round 1
基盤系（Supabase env / JSON parse / 認証 / mobile sidebar / metadata / abort / parseInt 等）
