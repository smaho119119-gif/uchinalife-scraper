# TODO

## ✅ Round 1〜8 完了（過去ラウンド詳細は change-log.md）

## ✅ Round 9 完了
- 画像 prompt: standard モードを `src/prompts/property-image-modes.ts` のテーブル化（4 modes）
- legacy `generatePropertyImage` を削除（callers ゼロを確認）
- CSP Report-Only を `'unsafe-inline'` 抜き script-src で並行発行 → 違反収集の準備
- ai.ts: **921 → 690 行** （1ラウンドで 25% 削減、Round 1 開始時 1214 から累計 -43%）

## 🔜 Round 10 候補（優先度順）
1. **画像 prompt の collage / magazine / overlay / business / infographic / その他テンプレート分離**
   - まだ inline で残っている branches を builder 化
2. **`<Script nonce>` 配備で本番 CSP を Enforcing に切替**
   - Report-Only で違反ゼロを確認後、`'unsafe-inline'` を script-src から削除
3. **`properties` の anon write 削除**（スクレイパ側 service_role 移行後）
4. **react-window でリスト仮想化** （properties / map）
5. **a11y: 残ダイアログの focus trap 一貫化**
6. **`Property.property_data` の値型厳密化**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- DB スキーマ変更は本番運用 (スクレイパ含む) と協調
- 大規模リファクタは1コミット1機能まで
