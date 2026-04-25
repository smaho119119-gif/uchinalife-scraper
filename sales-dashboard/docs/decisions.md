# Design Decisions

## 2026-04-25 — Round 22 (multi-agent bug hunt)

### D-22-1: 重い集計 RPC は service role で叩く
- 文脈: properties が 60k 行を超え、anon ロールで RPC を叩くと RLS フィルタが先に走り Supabase の 8s statement timeout を踏むようになった。`/api/stats`, `/api/admin/stats`, `/api/analytics/diff`, `/api/analytics/trends` で同症状。
- 判断: 一律 `getSupabase('service')` に切り替える。RPC を SECURITY DEFINER で再定義するのが理想だが、本リポジトリから DB スキーマを操作できないため、アプリ側で対処。
- レスポンスは入力依存ではなく集約数値だけなので、service role の使用が情報漏洩リスクを増やすことはない。
- 長期: Supabase 側で RPC を SECURITY DEFINER 化したら anon に戻す。issues.md R22-i02 で追跡。

### D-22-2: カテゴリ ID は `lib/categories.ts` を唯一の真実とする
- 文脈: UI 4 ファイルに `jigyou` と誤記が残り、API (`jigyo`) と齟齬が出てフィルタゼロ件 / 400 を起こしていた。
- 判断: 各 UI 定数は `lib/categories.ts` から派生させる方針へ移行。今ラウンドはまず誤記を直すだけに留め、二重定義の解消は R23 で対応 (issues.md R22-i03)。

---

## 2026-04-23 — Round 1
（前回分はそのまま保持）

### D-1: Supabase クライアントを `lib/supabase-server.ts` に一本化
- env欠損で throw、サイレント失敗を撲滅

### D-2: クライアント fetch を `useApi` に統一
- AbortController + loading/error state、SWR は導入しない（依存最小化）

### D-3: middleware の matcher を保護対象のみに変更
- `/admin`, `/api/admin/*`, `/api/ai/*` のみ middleware 経由

### D-4: 共通定数を `lib/categories.ts` に集約

### D-5: JSON parsing は `lib/json.ts` の `safeParseJson` に集約

### D-6: エラー UI は `components/ui/error-banner.tsx` で統一

### D-7: 環境変数は サーバ側=`SUPABASE_URL`、クライアント側=`NEXT_PUBLIC_SUPABASE_URL` で完全分離

---

## 2026-04-23 — Round 2

### D-8: 型は `lib/types.ts` に集約、レガシー modules は thin re-export
- **採用**: `db.ts` も実装＋ `types.ts` から re-export。`supabase.ts` / `index.ts` は `export * from '@/lib/db'` のみ
- **理由**: 251行が3ファイル完全コピー。差分が出始めるとデバッグ不可能になる
- **段階的削除**: Round 3 で `supabase.ts` / `index.ts` の物理削除（呼び出し移行完了後）
- **非採用**: 一気に全削除 → import エラーが大量に発生し、副作用検証コスト爆発

### D-9: `propertyCache` は SSR-safe で残す（撤廃しない）
- **採用**: `window` チェック追加、TTL明示、コメントで分散環境の制約を文書化
- **理由**: 同一タブ内のクリックレスポンス短縮には十分有効。完全撤廃すると体験が悪化する箇所がある
- **非採用**: Redis 導入 → 別Roundで判断（コスト + 運用）

### D-10: NextAuth セッション TTL = 8時間
- **採用**: `maxAge: 60*60*8`
- **理由**: 社内ツールで「1営業日」を想定。セキュリティと再ログインの煩わしさのバランス

### D-11: HTTP セキュリティヘッダは middleware で全レスポンス付与
- **採用**: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **CSP**: `'unsafe-inline'` + `'unsafe-eval'` を許可（Tailwind, Next runtime 必要）。Round 3 で nonce 化検討
- **理由**: 全API/ページで一律。ヘッダ漏れが起きにくい

### D-12: レートリミットは in-memory token bucket
- **採用**: `lib/rate-limit.ts` + `lib/auth-helpers.ts`
- **理由**: 「誤クリック・暴走 fetch」レベルなら充分。コスト爆発の予防が主目的
- **制約**: serverless では各 instance 独立。ドキュメントで明示
- **将来**: 厳密制限が必要になったら Upstash Redis (`@upstash/ratelimit`) に置換

### D-13: 破壊的操作は `ConfirmDialog` で統一
- **採用**: Radix Dialog ベースの汎用ラッパー
- **理由**: alert() / window.confirm() は禁止（UI仕様）。`busy` ロックで二重実行防止

### D-14: scraping route の `categories` allowlist 検証
- **採用**: `isValidCategory` で文字列フィルタ
- **理由**: シェル経由で渡るため最も攻撃面が大きい
- **非採用**: `execFile` 化 → ファイルリダイレクト含むためシェル必要。allowlist で十分小さくできる

### D-15: Date 計算は `date-fns-tz` で JST 統一
- **採用**: `toZonedTime` + `fromZonedTime` で JST 0:00 → UTC ISO へ変換
- **理由**: `Date.setHours(0)` はローカルタイム依存、サーバの TZ 設定に依存して 9 時間ズレが起きる

### D-16: Round 2 のスコープを明確に分離
- **採用**: 大規模リファクタ (admin/page.tsx 2255行分割等) は Round 3 へ持ち越し
- **理由**: 1コミットに混ぜると副作用検証コスト爆発。各々を独立コミットに
