# Change Log

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
