# TODO

## ✅ Round 1〜6 完了（過去ラウンド詳細は change-log.md）

## ✅ Round 7 完了
- 画像 prompt: フィールド抽出 helper / highlights helper を `src/prompts/property-fields.ts` に
- `getSupabase('anon' | 'service' | 'auto')` 切替
- 公開 read API 10 本を anon に / admin API 2 本を service に明示
- `staff_photos` テーブル新設 + RLS（anon SELECT, service ALL）
- `uchina_property_images` RLS 有効化（同上）
- CSP に nonce + `'strict-dynamic'` 追加（middleware で nonce 生成・伝搬）
- admin タブのモバイル横スクロール

## 🔜 Round 8 候補（優先度順）
1. **画像生成 prompt の builder 関数化（残り）**: 4 つの `proposal_*` テンプレ + その他 mode/style バリアント
   - AI 出力の golden test 的な比較スイートを先に整える
2. **`properties` の anon write ポリシー削除** （スクレイパ側 service_role 移行が前提）
3. **`<Script nonce={nonce}>` の段階配備** + 完全な `'unsafe-inline'` 撤廃
4. **mobile 残り**: sales/proposal の builder + preview を縦並びで最適化
5. **disabled 状態テキストのコントラスト監査**
6. **AreaStatsPanel / ChoroplethMap のロジック分離**
7. **react-window でリスト仮想化**（500件超で顕在化したら）
8. **Property.property_data の値型厳密化**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- DB スキーマ変更は本番運用 (スクレイパ含む) と協調
- 大規模リファクタは1コミット1機能まで
