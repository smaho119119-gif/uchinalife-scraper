# Open Issues

## 2026-04-25 (Round 22 / multi-agent bug hunt)

### 軽微 / 後回し
- **R22-i01**: `AreaStatsPanel` から `/sales/market-price?area=...` に遷移してもページ側が `searchParams.area` を読まないため、エリア事前選択が効かない。修正は MarketPriceCalculator にエリア初期値プロパティを追加する小修正。優先度: 軽微。
- **R22-i02**: `analytics_areas`, `dashboard_stats` 等の RPC が SECURITY DEFINER でないものは将来の row 増加で同じ timeout を踏む。Supabase 側で `SECURITY DEFINER` 化するのが正解。今は service role 側でバイパスしているが、長期的には DB 側で対応。
- **R22-i03**: `MarketPriceCalculator` 内の `CATEGORIES` 定数が `lib/categories.ts` と二重定義。同様に `header.tsx`, `properties/page.tsx` にも独立した CATEGORIES 定数があり 3 重重複。Round 23 で id を `CategoryId` 型に固定して再発防止は完了。完全な単一化は将来課題。
- **R22-i04**: `src/app/sales/proposal/page.tsx` の `calculateMarketData` が `/api/properties?limit=50000` を一括取得している。area-stats API などに置き換えるとペイロードが桁単位で減る。
- **R24-i01**: 真の DB 側パフォーマンス対策。Supabase ダッシュボードで以下:
  1. `properties` に `(category, area)` 複合 index (where is_active = true)
  2. `analytics_diff` / `analytics_trends` を `SECURITY DEFINER` 化して anon でも安全に呼べる単一 RPC に統合
  3. `properties.is_active = true` 用部分 index `idx_properties_active`
- **R24-i02**: `properties/locations` payload 219KB の圧縮。サーバ側で geo bin 化、もしくはページ側で lazy-load。
- **R24-i03**: Supabase クライアントのコールドスタート短縮。今は module-scope cache 済 (lib/supabase-server.ts) だが、Vercel cron で 5 分おきに warmup ping を打つと cold 0.5–2s が消える。

### 追加調査項目
- 他の RPC ( `analytics_properties`, `analytics_areas`, `get_diff_summary`, `analytics_trends`, `dashboard_stats`, `admin_stats`) が SECURITY DEFINER かどうか Supabase ダッシュボードで確認 (本リポジトリには SQL が無い)
- properties テーブルの `is_active` カラムを scraper 側で確実にセットしているか確認 (R20 の調査で "false/null 行が 44k ある" 状況)

---

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
