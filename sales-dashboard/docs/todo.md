# TODO

## ✅ Round 1 完了
基盤系（Supabase env / JSON parse / 認証 / mobile sidebar / metadata / abort / parseInt 等）

## ✅ Round 2 完了
- 型集約 (lib/types.ts)
- propertyCache SSR-safe化
- 残クライアント fetch を useApi 化
- ErrorBanner 主要 page 展開
- NextAuth maxAge / セキュリティヘッダ
- AI / scraping / staff-photos のレートリミット
- Date JST/UTC 修正、calendar bounds、RPC param allowlist
- ConfirmDialog で破壊的操作確認
- a11y 第一弾

## ✅ Round 3 完了
- admin/page.tsx を types + 4 panel コンポーネントに分割（2255 → 1427行）
- sonner 導入 + Toaster 配置
- lib/supabase.ts と lib/index.ts を物理削除（呼び出し移行込み）
- @ts-ignore → @ts-expect-error

## 🔜 Round 4 候補（優先度順）
1. **InteractiveMap.tsx 738行 を useReducer + 抽出 hooks に**
2. **ProposalBuilder / MarketPriceCalculator の logic を hooks へ**（unit testable に）
3. **モバイルレイアウト: properties / sales/area-analysis / map**
4. **WCAG コントラスト全面修正**（slate-400 → slate-300 等）
5. **Toast を実際に使う**: 提案書保存、画像生成成功、エラー時のフィードバック
6. **AI prompts を `src/prompts/` に分離**
7. **Supabase RLS 設計と移行**（DBスキーマ要協調）
8. **テーブル virtualization (react-window)** ※ データ量増えたら
9. **Property.property_data の値型厳密化**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- docs/change-log.md に変更内容と理由を残す
- 大規模リファクタは1コミット1機能まで
