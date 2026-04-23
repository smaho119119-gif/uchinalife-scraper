# TODO

## ✅ Round 1〜7 完了（過去ラウンド詳細は change-log.md）

## ✅ Round 8 完了
- 画像 prompt: `proposal_*` 4バリアントを `src/prompts/property-image.ts` の builder 関数化（ai.ts 1139 → 921 行 / -19%）
- `lib/csp.ts` の `getCspNonce()` ヘルパ追加（将来の `<Script nonce>` 配備に備え）
- sales/proposal モバイル padding 縮小
- button disabled 状態の saturate/opacity 強化
- スクレイパ migration plan を `docs/scraper-migration.md` に明文化
- AreaStatsPanel / ChoroplethMap は現状サイズ (213 / 254 行) で hook 化の利益が小さく見送り

## 🔜 Round 9 候補（優先度順）
1. **`<Script nonce>` 配備による `'unsafe-inline'` 撤廃**
   - `next/script` の third-party scripts に `getCspNonce()` を流用
   - その後 CSP から `'unsafe-inline'` を script-src から削除
2. **画像生成 prompt の standard / mode別 (youtube/sns_banner/etc) 分離**（残ってる ~570行 → builders）
3. **`properties` の anon write ポリシー削除**（スクレイパ側 service_role 移行後）
4. **ai.ts の `generatePropertyImage` (legacy / 互換用) の整理**
5. **react-window でリスト仮想化**
6. **Property.property_data 値型厳密化**
7. **a11y: 全 dialog の focus trap / Esc 一貫化（Radix デフォルトで概ね OK だが、custom overlay 部分を再点検）**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- DB スキーマ変更は本番運用 (スクレイパ含む) と協調
- 大規模リファクタは1コミット1機能まで
