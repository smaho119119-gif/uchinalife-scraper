# GitHub Secrets 設定ガイド

## 1. GitHub リポジトリにアクセス
https://github.com/smaho119119-gif/uchinalife-scraper/settings/secrets/actions

## 2. 以下のSecretsを追加

### DATABASE_TYPE
- Name: `DATABASE_TYPE`
- Value: `supabase`

### SUPABASE_URL
- Name: `SUPABASE_URL`
- Value: `https://xxxxx.supabase.co` (あなたのProject URL)

### SUPABASE_ANON_KEY
- Name: `SUPABASE_ANON_KEY`
- Value: `eyJhbGc...` (あなたのanon public key)

## 3. 設定完了後の確認

Secrets画面で以下が表示されればOK:
- DATABASE_TYPE
- SUPABASE_URL
- SUPABASE_ANON_KEY

## 4. テスト実行

1. https://github.com/smaho119119-gif/uchinalife-scraper/actions
2. "Daily Property Scraper" を選択
3. "Run workflow" → "Run workflow" をクリック

## 5. 実行結果の確認

- ✅ 緑色のチェックマーク = 成功
- ❌ 赤色のバツマーク = 失敗（ログを確認）

## トラブルシューティング

### エラー: "DATABASE_TYPE not found"
→ Secretsが正しく設定されているか確認

### エラー: "Connection refused"
→ SUPABASE_URLが正しいか確認

### エラー: "Authentication failed"
→ SUPABASE_ANON_KEYが正しいか確認
