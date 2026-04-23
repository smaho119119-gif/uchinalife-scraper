# TODO (Bug Hunt Rounds)

## ✅ Round 1 完了
基盤系（Supabase env / JSON parse / 認証 / mobile sidebar / metadata / abort / parseInt 等）

## ✅ Round 2 完了
- 型集約 (lib/types.ts)
- propertyCache SSR-safe化
- 残クライアント fetch を useApi 化（properties / analytics / area-analysis / AreaAnalytics / TrendAnalytics）
- ErrorBanner 主要 page 展開
- NextAuth maxAge / セキュリティヘッダ (CSP, HSTS, X-Frame-Options, etc.)
- AI / scraping / staff-photos のレートリミット
- Date JST/UTC 修正、calendar bounds、RPC param allowlist
- ConfirmDialog で破壊的操作確認
- a11y polish 第一弾

## 🔜 Round 3 候補（優先度順）
1. **admin/page.tsx 2255行 の分割**（最大の負債）
2. **InteractiveMap.tsx 738行 の useReducer + hooks化**
3. **Supabase RLS ポリシー設計と移行**
4. **モバイルレイアウト全面対応**（特に properties / sales/area-analysis / map）
5. **WCAG コントラスト全面修正**（テキスト色）
6. **Toast 通知システム導入**（成功/失敗フィードバック）
7. **AI prompts の templates 化**
8. **sales/* の hooks 抽出 + 単体テスト**
9. **lib/ai.ts の `@ts-ignore` 解消**
10. **lib/supabase.ts / lib/index.ts の物理削除**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- docs/change-log.md に変更内容と理由を残す
- 大規模リファクタは1コミット1機能まで
