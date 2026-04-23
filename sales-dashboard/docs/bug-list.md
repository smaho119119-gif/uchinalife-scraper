# Bug List - sales-dashboard

最終更新: 2026-04-23

凡例: 優先度 [重大|中|軽微] / 状況 [未対応|対応中|修正済|再検証待ち|完了]

---

## 統合バグ一覧（Round 1）

| ID | タイトル | 優先度 | 状況 | 対応方針 |
|----|----------|--------|------|----------|
| **CRIT-01** | NextAuth 認証情報がハードコード (admin/admin) | 重大 | 修正済 | env化 + bcrypt不要だが固定パスの動的化、本番エラーログ抑制 |
| **CRIT-02** | API ルートが未認証でアクセス可（middleware が API を除外） | 重大 | 修正済 | matcher を AI生成系のみ保護に変更 |
| **CRIT-03** | サーバーAPIで Supabase env 欠損時に空文字で createClient → 静かに失敗 | 重大 | 修正済 | shared `getSupabase()` で起動時バリデーション |
| **CRIT-04** | `JSON.parse(prop.property_data)` が try/catch 無しで複数箇所 | 重大 | 修正済 | 共通 `safeParseJson()` ヘルパに集約 |
| **CRIT-05** | クライアントの fetch が catch で console.error のみ → サイレント失敗 | 重大 | 修正済 | エラー state + Toast表示の共通フック化 |
| **CRIT-06** | モバイルでサイドバー非表示 → ナビ不可 | 重大 | 修正済 | ハンバーガーメニュー実装 |
| **CRIT-07** | admin/page.tsx 2255行・責務混在 → 機能追加で副作用爆発 | 重大 | 残課題 | 段階分割（Round 2 で着手）|
| **CRIT-08** | クライアント fetch に AbortController 無し → unmount後 setState | 重大 | 修正済 | カスタムフック `useApi` で signal を統一 |
| MED-01 | parseInt(days) が NaN を返す（`?days=abc`）| 中 | 修正済 | バリデータ追加 |
| MED-02 | プロポーザル/AI生成ボタン連打 → 二重リクエスト | 中 | 修正済 | disabled+abort で防止 |
| MED-03 | エラー文言が英語混在・技術的 | 中 | 修正済 | 日本語統一 |
| MED-04 | 環境変数 `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` 混在 | 中 | 修正済 | サーバ側は `SUPABASE_URL` のみへ統一 |
| MED-05 | Supabase クライアント初期化が8+箇所で重複 | 中 | 修正済 | `lib/supabase-server.ts` に集約 |
| MED-06 | カテゴリマップが複数ファイルで重複 | 中 | 修正済 | `lib/categories.ts` に集約 |
| MED-07 | layout.tsx の metadata が "Create Next App" のまま | 中 | 修正済 | 日本語タイトル/説明に変更 |
| MED-08 | 削除系操作に確認ダイアログ無し | 中 | 残課題 | Round 2（個別UI洗い出し後）|
| MED-09 | property_data null での map/filter null参照 | 中 | 修正済 | safeParseJson + optional chain |
| MED-10 | GitHub API URL がハードコード | 中 | 修正済 | env `NEXT_PUBLIC_GITHUB_REPO` 化 |
| MED-11 | propertyCache (in-memory) が serverless で機能しない | 中 | 残課題 | revalidate に統一済み箇所多数。残りは Round 2 |
| MED-12 | space empty state の説明不足（クリアボタン無し）| 中 | 修正済 | フィルタクリアCTA追加 |
| LOW-01 | disabled ボタンの視覚フィードバック不足 | 軽微 | 修正済 | cursor-not-allowed 追加 |
| LOW-02 | テーブルページ番号ボタン小さい (h-8) | 軽微 | 修正済 | h-10 へ |
| LOW-03 | metadata タイトル | 軽微 | (MED-07に統合) | - |
| LOW-04 | 緯度経度のハードコード散在 | 軽微 | 残課題 | Round 2 |
| LOW-05 | `any` 型の乱用 | 軽微 | 残課題 | 段階対応 |

---

## 根本原因マトリクス

| 根本原因 | 派生バグ |
|----------|----------|
| Supabaseクライアント初期化が分散 | CRIT-03, MED-04, MED-05 |
| エラーハンドリングが各所バラバラ | CRIT-04, CRIT-05, MED-09 |
| 認証/権限の境界が緩い | CRIT-01, CRIT-02 |
| 共有定数の重複 | MED-04〜06, MED-10 |
| クライアントfetchの抽象化欠如 | CRIT-05, CRIT-08, MED-02 |

これらを「層」として整理することで、再発を抑える。
