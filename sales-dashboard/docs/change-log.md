# Change Log

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
- middleware 仕様変更（headers のみ追加、auth ロジック不変）
- lib/db.ts は Proxy 経由で getSupabase に。既存 `import { supabase } from '@/lib/db'` は呼び出し時に env 検証するよう変更（テスト環境を持たない呼び出しでは初回アクセス時に throw する）

### 残課題 → Round 3 へ持ち越し (`docs/issues.md`)
- admin/page.tsx (2255行) の分割
- InteractiveMap.tsx (738行) の useReducer 化
- AI prompts の templates 化
- sales/* コンポーネント の hooks 抽出
- モバイルレイアウト全面対応
- WCAG コントラスト全面修正
- Toast 通知システム
- Supabase RLS 強化（バックエンドDBスキーマ移行が必要）
