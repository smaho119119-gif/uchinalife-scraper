# Change Log

## 2026-04-26 — Round 22b (生 fetch のクラッシュ耐性強化)

### 修正内容
- `src/app/properties/[...url]/page.tsx`: 物件詳細初期 fetch を `then(res => res.json())` から `res.ok` 判定 + try/catch + `finally(setLoading(false))` に書き換え (R22-06)。500 時にローディング永続 / 壊れた state でクラッシュする経路を遮断。
- `src/app/sales/proposal/page.tsx`: `calculateMarketData` の `/api/properties?limit=50000` レスポンスを `res.ok && Array.isArray(payload)` で防御 (R22-07)。エラー応答が `Property[]` として後段の filter に流れていた。

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- 物件詳細・proposal 共に既存の `!property` / `[]` フォールバック画面が機能するため UX 退行なし

### 残課題 (issues.md)
- proposal の 50000 件一括取得は本来 area-stats API などへ移行すべき (R22-i04 として追加)

---

## 2026-04-25 — Round 22 (multi-agent bug hunt: trends 500 + jigyo/jigyou 不整合)

### 修正内容
- `/api/analytics/trends`: anon → service role に切替 (R22-01 / Supabase 8s statement timeout)
- カテゴリ ID `jigyou` → `jigyo` 統一 (R22-02 / 4 ファイル: properties/page.tsx, header.tsx, featured/[slug]/page.tsx, MarketPriceCalculator.tsx)
- `/api/sales/market-price` のエラーハンドリングを `logAndSerializeError` に統一 (R22-03)
- `/api/sales/market-price` から未使用 `createClient` import 削除 (R22-04)

### 原因
- trends: dashboard_stats / admin_stats / analytics_diff と同根。anon ロールで RPC を叩くと RLS で重くなり 8s timeout に到達。R20-fix と同パターン。
- jigyou: 過去のコピペで誤記が UI 側 4 ファイルに伝播、API が categories.ts に揃った後も UI 側が取り残されていた。

### 影響範囲
- trends 修正 → 営業ダッシュボード「差分分析」配下のトレンドカード復活
- jigyo 統一 → 物件一覧 / featured 詳細 / ヘッダーフィルタ / 相場ツールで「賃貸事業用」が機能するように

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- `grep -rn 'jigyou' src` → 0 件
- 全 anon ロール API を smoke (areas/properties/area-stats/by-area/new-listings/pet-friendly/market-price) → 200 確認、trends は service 切替後に再 smoke 予定

---

## 2026-04-24 — Round 20 (CSP `'unsafe-inline'` 完全撤廃)

### 背景
- R7 で nonce + `'strict-dynamic'` を配布、R8 で Report-Only で「unsafe-inline 無し」版を並行発行
- 本番で数週間観察し、ユーザーコードに `<script>` / `<Script>` / `dangerouslySetInnerHTML` が一切存在しないことを確認（`grep -rn` でゼロ件）
- Next.js の bootstrap script は middleware が `x-nonce` をセットすると自動でnonceが付与されるため、追加の `<Script nonce>` 配備は不要

### 変更
- `src/middleware.ts`
  - `buildCsp()` から `'unsafe-inline'` を削除（dev / prod 双方）
  - `buildCspReportOnly()` 関数と `Content-Security-Policy-Report-Only` ヘッダー送出を削除
  - JSDoc をシンプルな現状説明に更新
- `src/lib/csp.ts` は維持（将来のサードパーティ script 導入時に `<Script nonce={await getCspNonce()} />` で使う）

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- script-src は `'self' 'nonce-...' 'strict-dynamic' https:`（prod） / + `'unsafe-eval'`（dev HMR のみ）

---

## 2026-04-23 — Round 8 (proposal templates split, csp helper, mobile/contrast polish, scraper plan)

### proposal_* 画像 prompt builders (R8-1)
- `src/prompts/property-image.ts` を新設
  - `buildProposalImagePrompt({ template, propertyDetails, propertyImageCount, hasStaffPhoto, aspectRatio })`
  - 4 つの layout helper (card / compare / flow / grid) と staff / multi-image 指示を分離
  - `parseProposalTemplate(template)` で型安全な分岐
- `src/lib/ai.ts`: 235 行のインラインテンプレを 13 行の builder 呼び出しに圧縮 (1139 → **921 行** / -19%)
- 出力文字列はバイト一致で維持 → AI 生成結果は不変

### CSP nonce helper (R8-3)
- `src/lib/csp.ts`: `getCspNonce()` で middleware が設定した `x-nonce` を RSC から取得
- 将来 `<Script nonce={await getCspNonce()} />` 配備 → 完全な `'unsafe-inline'` 撤廃の準備

### モバイル / コントラスト
- `app/sales/proposal/page.tsx`: スマホで `p-8` → `p-4 sm:p-8`、`-m-8` → `-m-4 sm:-m-8`
- `components/ui/button.tsx`: disabled 状態に `saturate-50` + opacity 60 で「死んで見える」明確化

### スクレイパ移行計画 (R8-2)
- `docs/scraper-migration.md` を新設
  - Phase 1: GitHub Actions に service_role key 追加（fallback 維持）
  - Phase 2: anon fallback 削除
  - Phase 3: `properties` の anon write ポリシー DROP
  - Phase 4: 動作確認 + ロールバック手順
- ダッシュボード側の変更は不要（Round 7 で role 切替済み）

### 副作用チェック
- `npx tsc --noEmit` → 0 errors
- `npx next build` → 全ルート生成成功
- 公開 API レスポンスシェイプ維持

---

## 2026-04-23 — Round 7 (role-aware Supabase, RLS hardening, CSP nonce, prompt helpers)

### 画像プロンプト helper 抽出 (R7-1 partial)
- `src/prompts/property-fields.ts` を新設: `extractPropertyDetails` / `buildPropertyHighlights`
- `src/lib/ai.ts`: 1165 → 1139 行

### Supabase role selector (R7-4)
- `getSupabase('anon' | 'service' | 'auto')` に拡張
- 公開 read 系 API 10 本を `'anon'` に / admin 2 本を `'service'` に明示

### Supabase RLS 適用 (R7-2 / R7-3)
- 新規: `staff_photos` テーブル + RLS
- `uchina_property_images`: RLS 有効化 + 同様のポリシー

### CSP nonce + strict-dynamic (R7-5)
- middleware で per-request nonce 生成 + `x-nonce` 伝搬
- `script-src` に nonce + `'strict-dynamic'` 追加

### モバイル微調整 (R7-6)
- admin タブ overflow-x-auto

---

## 2026-04-23 — Round 6 / 5 / 4 / 3 / 2 / 1
（前ラウンドの記述を保持。詳細は git log 参照）
