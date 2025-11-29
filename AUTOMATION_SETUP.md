# 自動更新セットアップガイド

## 概要

このドキュメントでは、うちなーらいふ不動産スクレイピングツールの自動更新機能について説明します。

## 基本的な使用方法

### 通常実行 (自動更新チェック付き)

```bash
cd "/Users/hiroki/Documents/うちなーらいふスクレイピング"
python integrated_scraper.py
```

このコマンドを実行すると:
- リンクが24時間以上古い場合、自動的に再収集されます
- リンクが最新の場合、既存のリンクを使用します

### 強制更新

リンクの年齢に関わらず、常に最新のリンクを収集したい場合:

```bash
python integrated_scraper.py --force-refresh
```

### 更新スキップ

更新チェックをスキップして、常に既存のリンクを使用したい場合:

```bash
python integrated_scraper.py --skip-refresh
```

## リンクファイルの構造

`output/links.json`は以下の構造になっています:

```json
{
    "metadata": {
        "last_updated": "2025-11-21T01:42:48+09:00",
        "total_links": 400
    },
    "data": {
        "jukyo": [...],
        "tochi": [...],
        ...
    }
}
```

## macOS自動実行設定 (launchd)

毎日決まった時間に自動的にスクリプトを実行したい場合、以下の手順でlaunchdを設定できます。

### 1. launchd設定ファイルの作成

以下の内容で`~/Library/LaunchAgents/com.uchinalife.scraper.plist`を作成します:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.uchinalife.scraper</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/hiroki/Documents/うちなーらいふスクレイピング/integrated_scraper.py</string>
    </array>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/hiroki/Documents/うちなーらいふスクレイピング/logs/scraper.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/hiroki/Documents/うちなーらいふスクレイピング/logs/scraper_error.log</string>
    
    <key>WorkingDirectory</key>
    <string>/Users/hiroki/Documents/うちなーらいふスクレイピング</string>
</dict>
</plist>
```

**設定内容:**
- 毎日午前2時に実行
- 標準出力とエラーを`logs/`ディレクトリに保存

### 2. ログディレクトリの作成

```bash
mkdir -p "/Users/hiroki/Documents/うちなーらいふスクレイピング/logs"
```

### 3. launchdに登録

```bash
launchctl load ~/Library/LaunchAgents/com.uchinalife.scraper.plist
```

### 4. 動作確認

即座にテスト実行:

```bash
launchctl start com.uchinalife.scraper
```

ログを確認:

```bash
tail -f "/Users/hiroki/Documents/うちなーらいふスクレイピング/logs/scraper.log"
```

### 5. 停止・削除

launchdから削除する場合:

```bash
launchctl unload ~/Library/LaunchAgents/com.uchinalife.scraper.plist
rm ~/Library/LaunchAgents/com.uchinalife.scraper.plist
```

## トラブルシューティング

### リンクが更新されない

1. `output/links.json`を確認して、`metadata.last_updated`をチェック
2. `--force-refresh`オプションを使用して強制更新

### launchdが動作しない

1. ログファイルを確認: `logs/scraper_error.log`
2. Pythonパスを確認: `which python3`
3. 権限を確認: スクリプトが実行可能か確認

### ChromeDriverエラー

Chromeブラウザとドライバーのバージョンが一致していることを確認してください。

## 推奨される運用方法

1. **開発時**: `--skip-refresh`を使用して既存リンクでテスト
2. **手動実行時**: 通常実行で自動判定に任せる
3. **本番環境**: launchdで毎日自動実行を設定

## 注意事項

- スクレイピングは対象サイトに負荷をかける可能性があるため、適切な間隔(24時間)を守ってください
- サイトの構造が変更された場合、スクリプトの修正が必要になる場合があります
