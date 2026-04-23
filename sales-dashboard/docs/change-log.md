# Change Log

## 2026-04-23 — Round 7 (image prompt helpers, role-aware Supabase, staff_photos RLS, CSP nonce)

### 画像プロンプト helper 抽出 (R7-1 partial)
- `src/prompts/property-fields.ts` を新設: `extractPropertyDetails` / `buildPropertyHighlights`
- `src/lib/ai.ts`: `generatePropertyImageWithPhotos` 内のフィールド抽出と highlights を helper に置換 (1165 → 1139 行)
- 巨大な `proposal_*` テンプレ群は AI 出力比較が必要なため Round 8 へ持ち越し（todo に明記）

### Supabase role selector (R7-4)
- `src/lib/supabase-server.ts`: `getSupabase('anon' | 'service' | 'auto')` に拡張、role ごとにクライアントをキャッシュ
- 公開 read 系 API 10 本を `'anon'` に切り替え
- admin API 2 本 (`admin/stats`, `admin/calendar`) を `'service'` に明示
- 既存 `getSupabase()` は `'auto'` (旧挙動) を維持

### Supabase RLS 適用 (R7-2 / R7-3)
- 新規: `staff_photos` テーブル + index + RLS + `anon SELECT only / service ALL` ポリシー（テーブルが存在せずサイレント失敗していた問題の解消）
- `uchina_property_images`: RLS 有効化 + `anon SELECT only / service ALL` ポリシー（誰でも書換可だった脆弱性を是正）
- `properties` の anon write 削除はスクレイパ側の env 整理が必要なため Round 8 以降

### CSP nonce + strict-dynamic (R7-5)
- middleware で per-request nonce を生成し `x-nonce` リクエストヘッダで RSC に伝搬
- `script-src` に `'nonce-...' 'strict-dynamic' https:` を追加（modern browsers では `'unsafe-inline'` を無視、レガシーは fallback）
- `'unsafe-inline'` はレガシーブラウザ用 fallback として残置、将来 `<Script nonce>` 実装後に削除

### モバイル微調整 (R7-6)
- admin タブを `overflow-x-auto` 化（スマホで横スクロール、md+ で wrap）

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- DB 変更:
  - `staff_photos` 新規作成 ✅
  - `uchina_property_images` RLS 有効化 ✅（service_role はバイパス、anon は read のみで現行挙動維持）

---

## 2026-04-23 — Round 6 (prompts split, market-price hook, RLS audit, CSP hardening)
（既存の通り維持）

## 2026-04-23 — Round 5 — Round 4 — Round 3 — Round 2 — Round 1
（前ラウンドの記述を保持）
