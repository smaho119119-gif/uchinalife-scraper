# TODO

## ✅ Round 1 完了
基盤系

## ✅ Round 2 完了
型集約 / propertyCache / useApi 全面 / ErrorBanner / NextAuth maxAge / セキュリティヘッダ / レートリミット / Date / bounds / ConfirmDialog / a11y 第一弾

## ✅ Round 3 完了
- admin/page.tsx を types + 4 panel コンポーネントに分割（2255 → 1427行）
- sonner 導入 + Toaster 配置
- lib/supabase.ts と lib/index.ts を物理削除
- @ts-ignore → @ts-expect-error

## ✅ Round 4 完了
- InteractiveMap 分割: lib/map-config.ts / use-map-markers / use-map-session（738 → 628行）
- マップエラー時 ErrorBanner + retry
- Toast を実用箇所に配線（Proposal/property detail/ImageGenerator）
- ホーム画面のコントラスト改善（slate-400/500 → slate-300）
- properties テーブルのモバイル横スクロール対応

## 🔜 Round 5 候補（優先度順）
1. **InteractiveMap useReducer 化（残り）** — state の集約と race condition 解消
2. **ProposalBuilder / MarketPriceCalculator の logic を hooks へ**（unit testable に）
3. **WCAG コントラスト全面修正**（残ページ）
4. **モバイル全面対応**（sales/area-analysis / map / admin など）
5. **AI prompts を `src/prompts/` に分離**
6. **Supabase RLS 設計と移行**
7. **react-window で properties / map のリスト仮想化**（500件超で顕在化したら）
8. **Property.property_data の値型厳密化**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- docs/change-log.md に変更内容と理由を残す
- 大規模リファクタは1コミット1機能まで
