# Change Log

## 2026-04-23 — Round 1

### 追加 (Infrastructure)
- `src/lib/supabase-server.ts` — server-side Supabaseクライアントを集約。env欠損は throw
- `src/lib/json.ts` — `safeParseJson` ヘルパ
- `src/lib/categories.ts` — カテゴリ定数の単一情報源
- `src/lib/api-utils.ts` — `parseIntParam`, `jsonError`, `logAndSerializeError`
- `src/lib/use-api.ts` — クライアント `useApi` フック (AbortController + error/loading state)
- `src/components/ui/error-banner.tsx` — エラーUI共通化

### 修正 (Critical)
- **CRIT-01** `api/auth/[...nextauth]/route.ts` — 認証情報を env (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) 経由に。`AuthOptions` 型と JWT セッション設定を整備
- **CRIT-02** `src/middleware.ts` — matcher を整理し、未認証 API 呼び出しを 401 で返却。callbackUrl 付き `/login` リダイレクト
- **CRIT-03** 全API routes (`stats`, `admin/stats`, `analytics/diff`, `analytics/areas`, `analytics/trends`, `sales/area-stats`, `sales/featured/by-area`, `sales/featured/new-listings`, `sales/featured/pet-friendly`, `admin/calendar`, etc.) — `getSupabase()` に置換、env欠損時即throw
- **CRIT-04** `safeParseJson` を `pet-friendly`, `new-listings`, `properties/[...url]`, `properties/locations`, `ai/generate`, `ai/generate-image` に適用 (try/catch漏れ撲滅)
- **CRIT-05** `app/page.tsx` — `useApi` + `ErrorBanner` 適用。fetch失敗時に再試行UI表示
- **CRIT-06** `components/sidebar.tsx` + `sidebar-wrapper.tsx` — モバイルドロワー化、ハンバーガーメニュー追加、ルート遷移時自動close
- **CRIT-08** クライアント fetch を `useApi` 経由に置き換え (AbortController標準装備)

### 修正 (Medium)
- **MED-01** `parseIntParam(raw, default, min, max)` で `analytics/diff`, `analytics/trends`, `sales/featured/new-listings`, `properties` を保護
- **MED-03** `properties/[...url]/page.tsx` の英文 alert を日本語に変更
- **MED-04 / MED-05** Supabase env を `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY||SUPABASE_ANON_KEY` に統一、`getSupabase()` で1点管理
- **MED-07** `app/layout.tsx` の metadata を「沖縄不動産 営業ダッシュボード」+ `robots: noindex` に
- **MED-12** `properties/page.tsx` empty stateに「フィルターをクリア」CTA追加

### 修正 (Light/UX)
- **LOW-01** `components/ui/button.tsx` に `disabled:cursor-not-allowed disabled:hover:scale-100`
- **LOW-02** `properties/page.tsx` ページネーションボタン `h-8` → `h-10`、min-w 拡大
- `app/login/page.tsx` — Suspense + LoginForm 分離、callbackUrl 対応、loading state、エラー表示の inline 化、autoComplete 追加
- `app/layout.tsx` — `lang="en"` → `lang="ja"`

### ビルド対応
- すべての `request.url` 使用 API route に `export const dynamic = 'force-dynamic'` 追加 (Next.js 16 静的生成エラー回避)
- `app/login/page.tsx` を `<Suspense>` 境界で wrap (`useSearchParams` 静的化エラー解消)

### 副作用チェック結果
- `npx tsc --noEmit` → エラーゼロ
- `npx next build` → 全ルート生成成功
- 既存レスポンス互換性: `/api/stats` の `total/newToday/soldToday/byType/byCategory/categories` 維持。`/api/analytics/trends` の `summary/trends` 維持
- middleware 仕様変更により未認証 API は 401 を返す → 公開ページ (`/sales/featured/*`) と auth (`/api/auth/*`) のみアクセス可

### 残課題
`docs/issues.md` 参照
