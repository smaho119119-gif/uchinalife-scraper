# 16-Round Refactor Journey Summary

最終更新: 2026-04-24 (Round 16 完了時点)

## サイズの変化

| ファイル | 開始 (Round 1) | 現在 (Round 16) | 削減 |
|----------|----------------|------------------|------|
| `src/lib/ai.ts` | 1214 行 | **281 行** | **-77%** |
| `src/app/admin/page.tsx` | 2255 行 | **1427 行** | -37% |
| `src/components/InteractiveMap.tsx` | 738 行 | **487 行** | -34% |
| `src/lib/supabase.ts` (重複) | 251 行 | **削除済** | -100% |
| `src/lib/index.ts` (重複) | 251 行 | **削除済** | -100% |

## 型安全性

| 観点 | 開始時 | 現在 |
|------|--------|------|
| `: any` / `as any` 出現箇所 (src/) | 20+ | **0** |
| `@ts-ignore` (src/) | 6 | **1** (→ `@ts-expect-error` 化、SDK upgrade で自動失効) |

## 共通インフラ（Round 1〜16 で追加）

### `src/lib/`
- `supabase-server.ts` — `getSupabase('anon' | 'service' | 'auto')` で role 切替
- `types.ts` — Property / StaffPhoto / GeneratedImage の単一情報源
- `json.ts` — `safeParseJson` (try/catch 漏れ撲滅)
- `categories.ts` — カテゴリ定数
- `api-utils.ts` — `parseIntParam` / `jsonError` / `logAndSerializeError`
- `auth-helpers.ts` — `enforceRateLimit` / `getActorKey`
- `rate-limit.ts` — in-memory token bucket
- `csp.ts` — `getCspNonce()` (RSC nonce reader)
- `use-api.ts` — クライアント fetch hook (AbortController + error/loading)
- `propertyCache.ts` — SSR-safe TTL キャッシュ
- `map-config.ts`, `map-reducer.ts`, `use-map-markers.ts`, `use-map-session.ts`
- `use-proposal-draft.ts`, `use-property-titles.ts`
- `use-market-price.ts`
- `ai-styles.ts`

### `src/prompts/`
- `sales-copy.ts` — `buildSalesCopyPrompt`
- `property-fields.ts` — `extractPropertyDetails` / `buildPropertyHighlights`
- `property-image.ts` — proposal_* / standard / collage / business / infographic / staff-only / default
- `property-image-modes.ts` — youtube / stories / instagram / sns_banner

### `src/components/admin/`
- `StatsOverviewPanel.tsx`, `ScrapingSettingsPanel.tsx`, `GeneratedImagesGallery.tsx`, `LogViewerPanel.tsx`

### `src/components/ui/`
- `confirm-dialog.tsx`, `error-banner.tsx`

## セキュリティの強化

- NextAuth: 認証情報 env 化、session/jwt maxAge=8h、updateAge=1h
- middleware: API は未認証で 401、ページは /login へ callbackUrl 付きリダイレクト
- 全レスポンスに HTTP セキュリティヘッダ:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()
  - Strict-Transport-Security: max-age=31536000; includeSubDomains
  - Cross-Origin-Opener-Policy: same-origin
  - CSP: nonce + strict-dynamic + object-src none + upgrade-insecure-requests
  - CSP-Report-Only: `'unsafe-inline'` 抜きで並行発行（次段階の準備）
- レートリミット: AI 系 / scraping / staff-photos
- Scraping API: `categories` allowlist でシェル injection 撲滅
- Staff photos: 1.5MB上限 + JPEG/PNG/WebP MIME 検証
- RPC parameters: `isValidCategory` allowlist
- Date 計算: date-fns-tz で JST 統一
- DB RLS: `staff_photos` 新規作成 + `uchina_property_images` RLS 有効化

## DB スキーマ変更（本番適用済）

- `staff_photos` 新規テーブル + index + RLS（anon SELECT, service ALL）
- `uchina_property_images` RLS 有効化 + 同様のポリシー
- ポリシー: anon は読み取りのみ、書き込みは service_role 経由

## UI / UX 改善

- mobile sidebar drawer
- ConfirmDialog (Radix Dialog ベース)
- ErrorBanner + retry ボタン (主要 page 全展開)
- Toast 通知 (sonner) — 成功/失敗フィードバック
- WCAG コントラスト (主要 page)
- properties テーブルの mobile overflow-x-auto
- admin タブ overflow-x-auto
- focus-visible + aria-label (主要 button)
- disabled ボタンの saturation/opacity 強化

## パフォーマンス改善

- Supabase に集約 RPC 7 本 (ダッシュボード初期表示が 7-30秒 → 0.1-0.5秒)
- 8本のインデックス追加
- 全 API route に Cache-Control + revalidate
- propertyCache: SSR-safe + module-level cache
- /api/properties: 必要列のみ select（全件取得時の payload 半減）

## 残課題（実適用は次以降のラウンド or 別タスク）

- スクレイパ Python 側を service_role に移行（→ properties anon write 撤去）
- CSP の `'unsafe-inline'` 完全撤廃 (`<Script nonce={...}>` 配備)
- AreaStatsPanel / ChoroplethMap の hook 抽出 (現在は小さく後回し)
- list virtualization (react-window) — 件数が増えたら
- 全画面 a11y / モバイル網羅監査
