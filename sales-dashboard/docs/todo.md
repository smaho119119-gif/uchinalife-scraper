# TODO

## ✅ Round 1 完了 — 基盤系
## ✅ Round 2 完了 — 型集約 / セキュリティハードニング / UX
## ✅ Round 3 完了 — admin/page 分割 / lib整理 / Toast基盤
## ✅ Round 4 完了 — InteractiveMap 抽出 / Toast配線 / 一部コントラスト・モバイル
## ✅ Round 5 完了
- InteractiveMap useReducer 化（11 useState → 1 reducer / 487行）
- ProposalBuilder の logic を hooks へ（useProposalDraft / usePropertyTitles）
- AI スタイルテーブル抽出（lib/ai-styles.ts）
- WCAG コントラスト改善（sales/properties/map ページ）

## 🔜 Round 6 候補（優先度順）
1. **AI prompts を `src/prompts/` に分離**（300+行のテンプレ; 出力影響評価が必要）
2. **Supabase RLS 設計と移行**（DBスキーマ要協調）
3. **MarketPriceCalculator の logic を hooks へ**（unit testable に）
4. **モバイル全面対応の続き**（admin / sales/proposal の細部、bottom navigation 検討）
5. **コントラスト全体監査**（残りページ、disabled 状態のテキスト）
6. **Property.property_data の値型厳密化**（実データ調査）
7. **CSP の nonce 化**（`'unsafe-inline'` 撤廃）
8. **react-window で大量物件のリスト仮想化**（500件超で顕在化したら）

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- docs/change-log.md に変更内容と理由を残す
- 大規模リファクタは1コミット1機能まで
