# エラー通知の追加方法

## オプション1: GitHub標準のメール通知

1. https://github.com/settings/notifications
2. "Actions" → "Send notifications for failed workflows only" を有効化

## オプション2: Slackに通知（無料）

ワークフローに以下を追加：

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "❌ スクレイピングが失敗しました",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*スクレイピングエラー*\n実行: ${{ github.run_number }}\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|ログを確認>"
            }
          }
        ]
      }
```

## オプション3: メールで詳細通知

SendGridやGmailを使用してカスタムメールを送信できます。

## 推奨設定

**GitHub標準のメール通知**が最もシンプルで推奨です：
- 設定が簡単
- 無料
- エラー時のみ通知
- ログへのリンク付き

## エラーの確認方法

1. **GitHub Actions**: https://github.com/smaho119119-gif/uchinalife-scraper/actions
2. **失敗した実行をクリック**
3. **ログを確認**
4. **Artifactsをダウンロード**（詳細ログ）

## 定期的な確認

週に1回程度、以下を確認することをお勧めします：
- https://github.com/smaho119119-gif/uchinalife-scraper/actions
- 緑のチェックマーク ✅ = 成功
- 赤いバツマーク ❌ = 失敗
