# Bug List - sales-dashboard

最終更新: 2026-04-23 (Round 2 完了)

凡例: 優先度 [重大|中|軽微] / 状況 [未対応|対応中|修正済|再検証待ち|完了]

---

## Round 1 完了 (commit 427cedc, 978ed25)
すべて完了。詳細は git log + change-log.md

## Round 2 完了 (今回)

| ID | タイトル | 優先度 | 状況 |
|----|----------|--------|------|
| R2-01 | 型定義の重複（db.ts/supabase.ts/index.ts） | 重大 | 完了（types.ts集約 + re-export） |
| R2-02 | propertyCache (serverless非互換) | 重大 | 完了（SSR-safe + 制約をコードコメントで明示） |
| R2-03 | 残存する直接 fetch (useApi未適用) | 重大 | 完了（properties/analytics/area-analysis/AreaAnalytics/TrendAnalytics）|
| R2-04 | 主要 page にエラーUI 不足 | 重大 | 完了（ErrorBanner展開）|
| R2-05 | NextAuth secret弱、maxAge未設定 | 重大 | 完了（maxAge=8h, updateAge=1h）|
| R2-06 | HTTPセキュリティヘッダ完全欠落 | 重大 | 完了（CSP/X-Frame-Options/HSTS等付与）|
| R2-07 | AI エンドポイント レートリミット欠落 | 重大 | 完了（rate-limit.ts + auth-helpers.ts）|
| R2-08 | 公開APIの個人情報流出 | 重大 | 完了（既存SELECT検証 OK + 文書化）|
| R2-09 | 削除/破壊操作に確認なし | 中 | 完了（ConfirmDialog + ProposalBuilder + ImageGenerator）|
| R2-10 | a11y: alt欠如、aria-label、focus-visible | 中 | 完了（主要箇所）|
| R2-11 | Date JST/UTC 混在 | 中 | 完了（date-fns-tz化）|
| R2-12 | calendar route year/month boundsなし | 中 | 完了（clamp + 厳密検証）|
| R2-13 | RPC パラメータの allowlist 不足 | 中 | 完了（全featured routes + area-stats + properties）|
| R2-14 | scraping API の濫用余地 | 重大 | 完了（categories allowlist + rate limit）|
| R2-15 | スタッフ写真 MIME/size 制限なし | 中 | 完了（1.5MB上限 + JPEG/PNG/WebP）|
| R2-16 | エラーログのサニタイズ不統一 | 中 | 完了（jsonError/logAndSerializeError統一）|

---

## Round 3+ に持ち越し（明示）

| ID | タイトル | 規模 | 理由 |
|----|----------|------|------|
| R3-01 | admin/page.tsx 2255行 の分割 | 大 | 単一コミットの適正規模超過、機能ごとに分けて検証 |
| R3-02 | InteractiveMap.tsx (738行) の useReducer 化 | 大 | 同上 + sessionStorage同期検証必要 |
| R3-03 | AI prompts を templates 化 | 中 | 機能拡張と一緒にやる方が安全 |
| R3-04 | sales/* コンポーネントの hooks 抽出 | 中 | 同上 |
| R3-05 | モバイルレイアウト全面対応 | 中 | 各画面個別検証 |
| R3-06 | WCAG コントラスト全面修正 | 中 | デザインシステム見直し含む |
| R3-07 | Toast 通知システム導入 | 小 | ライブラリ追加検討含む |
| R3-08 | lib/ai.ts の `responseModalities` @ts-ignore 解消 | 小 | Gemini SDK 仕様確認後 |
| R3-09 | Supabase RLS 強化 | 大 | DBスキーマ移行が必要、運用と協調 |
| R3-10 | テーブル virtualization (react-window) | 中 | 500件超のときのみ顕在化 |
| R3-11 | lib/supabase.ts と lib/index.ts の物理削除 | 小 | 完全置換完了後 |
| R3-12 | Property型 `property_data: Record<string, string>` の値型を厳密化 | 小 | 実データ調査後 |
