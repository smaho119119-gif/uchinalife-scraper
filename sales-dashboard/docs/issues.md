# Open Issues

## 2026-04-23 (Round 2 完了時点)

### Round 3 で対応予定

#### 大規模リファクタ
- **R3-01**: `admin/page.tsx` 2255行を分割
  - 想定分割: AdminStats / WorkflowMonitor / ScrapingControl / CalendarPanel / GeneratedImageGallery / LogsViewer
  - 各々をカスタムフック (`useAdminStats`, `useScrapingProgress` 等) と presentational コンポーネントに分解
- **R3-02**: `InteractiveMap.tsx` 738行を `useReducer` + `useMapData` / `useMapFilters` / `useMapCache` に分解
- **R3-03**: `lib/ai.ts` の prompts を `src/prompts/` に分離（300行のテンプレート）
- **R3-04**: `components/sales/*` の logic を hooks (`useProposalForm`, `useMarketPrice`, `usePropertySearch`) に抽出

#### UI 全面対応
- **R3-05**: モバイルレイアウト全面対応（テーブルの card 化など）
- **R3-06**: WCAG コントラスト全面修正（slate-400 → slate-300 等）
- **R3-07**: Toast 通知システム（Radix Toast / sonner 検討）

#### セキュリティ強化（要バックエンド調整）
- **R3-09**: Supabase RLS ポリシーの本格設計
  - properties テーブル: anon に readonly、書き込みは service_role のみ
  - 公開 read API は anon key、admin/AI 系は service_role
- **CSP**: `'unsafe-inline'` を nonce 化（Round 3 中）

#### 後始末
- **R3-08**: `lib/ai.ts` の `responseModalities` `@ts-ignore` 解消（Gemini SDK 型定義確認後）
- **R3-10**: 大量データのテーブル virtualization（react-window）
- **R3-11**: `lib/supabase.ts` / `lib/index.ts` の物理削除（呼び出し移行完了後）
- **R3-12**: `Property.property_data` の値型を厳密化（実データ調査）

### 後回し理由（明示）
- Round 1 で「セキュリティ + クラッシュ + ナビ + 共通基盤」を優先
- Round 2 で「アーキテクチャ債 + 残りセキュリティ + UX 死角」を優先
- Round 3 は「大規模リファクタ + 全面 UI 改善」に集中するため、各機能を独立コミット可能な単位に分けて進める

### 追加調査項目（実施タイミング未定）
- Supabase RLS が現状どうなっているか（Service Role 使用は緊急対応）
- middleware の CSP がプロダクション環境の Leaflet, Recharts 等で動作するか実機確認
- レートリミットが Vercel cold start でユーザーに違和感を与えないか
- ConfirmDialog の Esc キャンセルがすべての画面で機能しているか（Radix デフォルトを信頼）

### 非対応（明示的に対応しない）
- E2E テスト導入（人手スモークテストで代替）
- Storybook（コンポーネント数とライフサイクルから費用対効果が低いと判断）
