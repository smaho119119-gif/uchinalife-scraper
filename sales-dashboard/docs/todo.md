# TODO

## ✅ 過去ラウンド完了
- R1-16: `docs/journey-summary.md` に集約（ai.ts -43%, RLS, CSP nonce, role-aware Supabase 等）
- R17: console.log 0件化
- R18: `any` / `as any` 排除
- R19: `alert()` 全廃 → `sonner` toast
- R20: CSP `'unsafe-inline'` 完全撤廃（script-src は nonce + strict-dynamic のみ）

## 🔜 Round 21 候補（優先度順）
1. **スクレイパ Python 側 service_role 移行**（`docs/scraper-migration.md` Phase 1-3）
   - 完了後に `properties` の anon write ポリシー DROP
2. **AreaStatsPanel / ChoroplethMap の hook 抽出**
3. **react-window でリスト仮想化**（properties / map）
4. **全画面 a11y / モバイル網羅監査**（focus trap, tap target, contrast）
5. **`lib/ai.ts` error handling 統一**（try/catch + エラーメッセージ正規化）
6. **`Property.property_data` の値型厳密化**

## 持続的観点
- Round ごとに必ずビルド + typecheck + 副作用検証
- DB スキーマ変更は本番運用 (スクレイパ含む) と協調
- 大規模リファクタは1コミット1機能まで
