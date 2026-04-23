# Change Log

## 2026-04-23 — Round 3 (admin split + lib cleanup + toast infra)

### admin/page.tsx 分割 (R3-01 Phase 1)
- `src/app/admin/types.ts` を新設し、9つの interface を集約（page から ~170行削減）
- `src/components/admin/StatsOverviewPanel.tsx` — KPI / charts / GitHub workflow history / quick links
- `src/components/admin/ScrapingSettingsPanel.tsx` — 設定値表示 + env リファレンス
- `src/components/admin/GeneratedImagesGallery.tsx` — DB / ローカル両画像のギャラリーとプレビューモーダル（Esc / role=dialog 対応）
- `src/components/admin/LogViewerPanel.tsx` — ログ選択 + 再読込 + ファイル一覧（aria-pressed の選択状態）
- `src/app/admin/page.tsx`: 2255行 → **1427行** (≒ 36% 削減、各 panel が独立検証可能に)

### Toast 基盤 (R3-07)
- `sonner` を導入、`src/app/layout.tsx` に `Toaster` を配置
- 今後の R4 で各画面の成功/失敗 feedback に活用

### lib のクリーンアップ (R3-11)
- `src/lib/supabase.ts` と `src/lib/index.ts` を **物理削除**
- 使用元 6 ファイルを `@/lib/db`（実装）と `@/lib/types`（型のみ）に切り替え

### 型安全化 (R3-08)
- `src/lib/ai.ts`: `@ts-ignore` → `@ts-expect-error` （SDK が responseModalities をサポートしたら検出される）

### Round 3 で着手しなかったもの（明示）→ Round 4 へ
- R3-02: InteractiveMap.tsx の useReducer 化（738行）
- R3-04: sales/* component の hooks 抽出
- R3-05: モバイルレイアウト全面対応
- R3-06: WCAG コントラスト全面修正
- 理由: 1コミットの規模が大きく独立検証が必要。Round 4 で1機能ずつ着手

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- レスポンス互換性: 維持（admin タブの内部構造分割のみ、外部APIは不変）

---

## 2026-04-23 — Round 2 (architectural debt + security)

### 追加 (Infrastructure)
- `src/lib/types.ts` — Property/StaffPhoto/GeneratedImage 型を集約（lib/db, supabase, indexで重複していたものを単一情報源化）
- `src/lib/rate-limit.ts` — in-memory token-bucket（serverless 友好的、コメントで分散環境の制約を明記）
- `src/lib/auth-helpers.ts` — `getActorKey` / `enforceRateLimit`（ユーザID or IPで識別、429返却）
- `src/components/ui/confirm-dialog.tsx` — 破壊的操作向け共通モーダル（Esc/overlay close、disabled while busy）

### 整理 (Refactor)
- `src/lib/db.ts` — 型は types.ts から re-export、`supabase` クライアントは `getSupabase()` の Proxy 経由（env 検証統一）
- `src/lib/supabase.ts` / `src/lib/index.ts` — db.ts への薄い再エクスポートに置換（後続Round で完全削除）
- `src/lib/propertyCache.ts` — SSR セーフ化（`window` チェック、TTL明示）+ コメントで分散環境の制約を文書化

### セキュリティ
- **NextAuth**: `session.maxAge=8h`, `updateAge=1h`, `jwt.maxAge=8h` を設定 (R2-05)
- **HTTP セキュリティヘッダ**: middleware で全レスポンスに `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `HSTS`, `CSP` を付与 (R2-06)
- **AI レートリミット**: `/api/ai/generate` 20/分、`/api/ai/generate-image` 10/分、`/api/ai/analyze-popularity` 20/分、`/api/ai/sync-images` 5/分、`/api/staff-photos` 30/分、`/api/admin/scraping` 5/分 (R2-07/14)
- **Scraping API**: `categories` を `isValidCategory` で allowlist 検証（シェル injection 攻撃面を撲滅）、レートリミット適用 (R2-14)
- **Staff photos**: 1.5MB上限、JPEG/PNG/WebP の MIME 検証、name 100文字上限、エラー文言日本語化 (R2-15)
- **RPC allowlist**: `/api/sales/featured/{by-area,new-listings,pet-friendly}`, `/api/sales/area-stats`, `/api/analytics/properties` で `category`/`type` を `isValidCategory` で検証 (R2-13)
- **Date timezone**: `/api/analytics/properties` の `today` 計算を `date-fns-tz` で JST 化（UTC ズレで「本日」が9時間ずれる問題を解決） (R2-11)
- **Calendar bounds**: `year` を 2020〜2099、`month` を 1〜12 に clamp。`date` は `YYYY-MM-DD` 厳密検証 (R2-12)
- **エラーログ統一**: 残ったルート (`analytics/areas`, `properties/locations`, `sales/area-stats`, `sales/featured/by-area`, `sales/featured/new-listings`, `sales/featured/pet-friendly`) を `jsonError` + `logAndSerializeError` に統一 (R2-16)

### UI / UX
- **クライアント fetch を useApi に移行** (R2-03/04):
  - `app/properties/page.tsx` — AbortController + ErrorBanner + retry
  - `app/analytics/page.tsx` — propertyCache 依存を撤廃、useApi に集約、ErrorBanner で復帰
  - `app/sales/area-analysis/page.tsx` — 同上、cancelled flag を useApi の AbortController に統合
  - `components/AreaAnalytics.tsx`, `components/TrendAnalytics.tsx` — 同上
- **削除確認ダイアログ** (R2-09):
  - `ProposalBuilder.tsx`: 物件削除 / 下書きクリアに `ConfirmDialog`
  - `ImageGenerator.tsx`: 既存 inline 確認UIを文言追加・aria-label・Esc対応・focus-visible 強化
- **アクセシビリティ** (R2-10):
  - `app/admin/page.tsx`: ギャラリー画像 alt を「生成画像のプレビュー」に
  - スタッフ削除ボタンに aria-label、`role="alertdialog"`、`aria-modal`、autoFocus

### 副作用チェック結果
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- 既存レスポンス互換性: stats/analytics/featured 全て維持
