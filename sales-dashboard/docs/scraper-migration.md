# Scraper Migration Plan: anon → service_role

最終更新: 2026-04-23 (Round 8)

## 背景
`properties` テーブルは現在、anon に SELECT / INSERT / UPDATE を許可している。
Python スクレイパが書き込みに anon key を使っているためだが、
これは Web ダッシュボード側からの書き込み攻撃面を残す。

## 目標
スクレイパが service_role key を使って書き込むよう移行し、
DB 側で anon の書き込みポリシーを撤去する。

## 移行手順

### Phase 1 — スクレイパに service_role key 追加（書き込み変更なし）
1. GitHub Actions Secrets に `SUPABASE_SERVICE_ROLE_KEY` 追加
2. ローカル `.env` にも同 key 追加
3. `integrated_scraper.py` などで env から両方読めるように:
   ```python
   key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['SUPABASE_ANON_KEY']
   client = create_client(url, key)
   ```
4. Phase 1 ではまだ anon を fallback にしておく（既存挙動維持）
5. 本番 GitHub Actions が新キーで成功することを確認

### Phase 2 — anon fallback 削除
1. スクレイパから anon fallback を削除し service_role 必須に
2. ローカル / GitHub Actions の両方で動作確認

### Phase 3 — DB ポリシー撤去
```sql
DROP POLICY IF EXISTS "Allow anon insert on properties" ON properties;
DROP POLICY IF EXISTS "Allow anon update on properties" ON properties;
-- 残るのは "Allow public read on properties" のみ
```

### Phase 4 — 動作確認
- Web 公開 read API (anon)→ 200 を維持
- Web admin / AI write API (service)→ 動作確認
- Python スクレイパ → 書き込み成功を確認
- 試しに anon key で `INSERT INTO properties` を打って 403 が返ることを確認

## ロールバック
```sql
CREATE POLICY "Allow anon insert on properties" ON properties FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on properties" ON properties FOR UPDATE USING (true);
```

## 着手判断
- **誰が**: スクレイパ運用担当
- **依存**: GitHub Actions / .env 変更
- **本ダッシュボード側の変更は不要**（Round 7 で role 切替済み）
