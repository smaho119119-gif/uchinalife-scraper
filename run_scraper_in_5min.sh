#!/bin/bash

# 5分後にスクレイピングを実行するスクリプト

echo "=========================================="
echo "5分後にスクレイピングを実行します"
echo "=========================================="
echo "現在時刻: $(date)"
echo "実行予定時刻: $(date -v+5M 2>/dev/null || date -d '+5 minutes' 2>/dev/null || python3 -c 'from datetime import datetime, timedelta; print((datetime.now() + timedelta(minutes=5)).strftime(\"%Y-%m-%d %H:%M:%S\"))')"
echo ""

# プロジェクトディレクトリに移動
cd "/Users/hiroki/Documents/うちなーらいふスクレイピング"

# 5分待機
echo "5分間待機中..."
sleep 300

echo ""
echo "=========================================="
echo "スクレイピングを開始します"
echo "=========================================="
echo "実行時刻: $(date)"
echo ""

# スクレイピング実行
python3 integrated_scraper.py --skip-refresh

echo ""
echo "=========================================="
echo "スクレイピングが完了しました"
echo "=========================================="
echo "完了時刻: $(date)"

