# TODO

## ✅ Round 1 完了 — 基盤系
## ✅ Round 2 完了 — 型集約 / セキュリティハードニング / UX
## ✅ Round 3 完了 — admin/page 分割 / lib整理 / Toast基盤
## ✅ Round 4 完了 — InteractiveMap 抽出 / Toast配線 / 一部コントラスト・モバイル
## ✅ Round 5 完了 — Map useReducer / Proposal hooks / AI styles / コントラスト
## ✅ Round 6 完了
- sales-copy prompt を `src/prompts/sales-copy.ts` に抽出（builder 関数化）
- MarketPriceCalculator の検索ロジックを `lib/use-market-price.ts` に hook 化（abort 安全）
- Supabase RLS の現状調査と plan を `docs/rls-plan.md` に明文化
- CSP: dev/prod 分岐し、本番で `'unsafe-eval'` を削除 / COOP / `object-src 'none'` / `upgrade-insecure-requests` 追加

## 🔜 Round 7 候補（優先度順）
1. **画像生成 prompt の builder 関数化**（`src/prompts/property-image.ts`、~850行）
   - mode/style バリアントで分岐するため、AI 出力結果を比較検証しながら段階的に
2. **`staff_photos` テーブル新規作成 + RLS** （docs/rls-plan.md A）
3. **`uchina_property_images` の RLS 有効化** （docs/rls-plan.md B）
4. **`getSupabase('anon' | 'service')` キー使い分け**
5. **CSP nonce 化**（Next.js 16 `headers()` で nonce 配布）
6. **AreaStatsPanel / ChoroplethMap 等の sales/* 残コンポーネントの hook 抽出**
7. **モバイル全面対応の続き**（admin / sales/proposal 細部）
8. **disabled 状態テキストのコントラスト監査**
9. **react-window でのリスト仮想化**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- docs/change-log.md に変更内容と理由を残す
- 大規模リファクタは1コミット1機能まで
- DB スキーマ変更は本番運用 (スクレイパ含む) と協調
