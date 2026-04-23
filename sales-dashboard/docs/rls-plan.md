# Supabase RLS / Schema Plan

最終更新: 2026-04-23 (Round 6 調査)

## 現状 (本番 DB の実態調査)

| テーブル | RLS | 既存ポリシー | 備考 |
|----------|-----|--------------|------|
| `properties` | ✅ ON | anon に SELECT / INSERT / UPDATE 全許可 | スクレイパが anon key を使うため広い権限 |
| `uchina_property_images` | ❌ OFF | (なし) | `/api/ai/*` 系で扱う AI 生成画像。RLS 無効 = 誰でも書換可 |
| `generated_images` | ✅ ON | (要調査) | プロジェクト共用テーブル。本アプリでは未使用想定 |
| `daily_link_snapshots` | ✅ ON | (要調査) | スクレイパ用 |
| `staff_photos` | ❌ **存在しない** | — | `/api/staff-photos` のコードはあるが対応テーブルが無く、init / save / delete はサイレント失敗していた |

## リスク

1. **`uchina_property_images` が RLS なし** → anon key で誰でも UPDATE/DELETE できる。Vercel 側は `getSupabase()` がサーバ起動時に有効な key を選ぶが、もし NEXT_PUBLIC_ANON で叩かれれば書換可能
2. **`properties` の anon write 許可** → スクレイパ用の運用設計だが、フロント側が誤って書き込みできてしまう
3. **`staff_photos` テーブル不在** → Round 2 で追加した MIME / サイズ検証や rate limit は **実態として動作していない**（route は 5xx か no-op）。誤誘導のリスクあり

## 提案 (Round 7+ で実適用)

### A. テーブル新設: `staff_photos`
```sql
CREATE TABLE IF NOT EXISTS staff_photos (
    id text PRIMARY KEY,
    name text NOT NULL,
    data_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_photos ENABLE ROW LEVEL SECURITY;

-- 本アプリは社内ツールで NextAuth で認証する。
-- service_role でのみ書き込み、anon は読み取り不可。
-- (フロントは `/api/staff-photos` 経由でアクセスし、
--  middleware で /api/staff-photos の POST/DELETE は認証必須にしてある)
CREATE POLICY "service_role full access" ON staff_photos
    FOR ALL USING (auth.role() = 'service_role');
```

### B. `uchina_property_images` に RLS 有効化
```sql
ALTER TABLE uchina_property_images ENABLE ROW LEVEL SECURITY;

-- 公開 read OK, write は service_role のみ
CREATE POLICY "Allow public read on images" ON uchina_property_images
    FOR SELECT USING (true);
CREATE POLICY "service_role write" ON uchina_property_images
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

### C. `properties` の anon write を絞る
スクレイパが service_role に切り替えできるなら anon の INSERT / UPDATE ポリシーを削除。スクレイパ運用変更が必要なため、**まずスクレイパ側の env 整理 → DB ポリシー差し替え** の順で進める。

```sql
-- スクレイパが service_role に切り替わった後に実行
DROP POLICY IF EXISTS "Allow anon insert on properties" ON properties;
DROP POLICY IF EXISTS "Allow anon update on properties" ON properties;
-- 公開 read は維持
```

### D. `getSupabase()` のキー戦略
- 公開 read API: `SUPABASE_ANON_KEY`
- 書き込み / admin API: `SUPABASE_SERVICE_ROLE_KEY`
- 現在は両者を同じ `getSupabase()` で受けている。今後は `getSupabase('anon' | 'service')` のように使い分け可能にする。

## 実適用前の確認事項
- [ ] スクレイパ (Python) が service_role key を持てるか（GitHub Actions secrets）
- [ ] 既存 RLS ポリシー (anon insert / update) が他で参照されていないか
- [ ] `uchina_property_images` の RLS 有効化で AI 画像生成が壊れないかの動作確認

## 参考 SQL：すべての public.* RLS 状態を一括確認
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public'
ORDER BY tablename;
```
