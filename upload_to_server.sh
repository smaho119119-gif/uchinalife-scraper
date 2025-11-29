#!/bin/bash
#
# サーバーへのアップロードスクリプト
# うちなーらいふ不動産スクレイピングシステム
#

set -e  # エラーが発生したら停止

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# サーバー情報
SSH_KEY="/Users/hiroki/ssh/smaho119.key"
SSH_PORT="10022"
SSH_USER="smaho119"
SSH_HOST="sv16131.xserver.jp"
REMOTE_DIR="~/uchinalife-scraper"

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}うちなーらいふ不動産スクレイピングシステム - サーバーアップロード${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""

# ローカルディレクトリの確認
LOCAL_DIR="/Users/hiroki/Documents/うちなーらいふスクレイピング"
if [ ! -d "$LOCAL_DIR" ]; then
    echo -e "${RED}エラー: ローカルディレクトリが見つかりません: $LOCAL_DIR${NC}"
    exit 1
fi

cd "$LOCAL_DIR"
echo -e "${GREEN}✓ ローカルディレクトリ: $LOCAL_DIR${NC}"
echo ""

# アップロードするファイルのリスト
echo -e "${YELLOW}アップロードファイル一覧:${NC}"
echo "  - config.py (新規)"
echo "  - .env.example (新規)"
echo "  - database.py (変更)"
echo "  - integrated_scraper.py (変更)"
echo "  - server.py (変更)"
echo "  - run_tests.py (新規)"
echo "  - README.md (新規)"
echo "  - CHANGELOG.md (新規)"
echo "  - 変更点まとめ.md (新規)"
echo "  - tests/ (新規ディレクトリ)"
echo ""

# 確認
read -p "アップロードを開始しますか？ (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}アップロードをキャンセルしました。${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}ファイルをアップロード中...${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""

# メインファイルのアップロード
echo -e "${YELLOW}1. メインファイルをアップロード中...${NC}"
scp -i "$SSH_KEY" -P "$SSH_PORT" \
    config.py \
    .env.example \
    database.py \
    integrated_scraper.py \
    server.py \
    run_tests.py \
    README.md \
    CHANGELOG.md \
    変更点まとめ.md \
    "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ メインファイルのアップロード完了${NC}"
else
    echo -e "${RED}✗ メインファイルのアップロード失敗${NC}"
    exit 1
fi
echo ""

# testsディレクトリのアップロード
echo -e "${YELLOW}2. テストディレクトリをアップロード中...${NC}"
scp -i "$SSH_KEY" -P "$SSH_PORT" -r \
    tests \
    "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ テストディレクトリのアップロード完了${NC}"
else
    echo -e "${RED}✗ テストディレクトリのアップロード失敗${NC}"
    exit 1
fi
echo ""

# 完了メッセージ
echo -e "${BLUE}=====================================================================${NC}"
echo -e "${GREEN}✓ 全てのファイルのアップロードが完了しました！${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""

# 次のステップを表示
echo -e "${YELLOW}次のステップ:${NC}"
echo ""
echo "1. サーバーにSSH接続:"
echo -e "   ${BLUE}ssh -i $SSH_KEY -p $SSH_PORT ${SSH_USER}@${SSH_HOST}${NC}"
echo ""
echo "2. プロジェクトディレクトリに移動:"
echo -e "   ${BLUE}cd $REMOTE_DIR${NC}"
echo ""
echo "3. 設定を確認:"
echo -e "   ${BLUE}python3 -c \"from config import config; config.display()\"${NC}"
echo ""
echo "4. テストを実行:"
echo -e "   ${BLUE}python3 run_tests.py${NC}"
echo ""
echo "5. .envファイルを作成（必要に応じて）:"
echo -e "   ${BLUE}cp .env.example .env${NC}"
echo -e "   ${BLUE}nano .env${NC}"
echo ""
echo "6. スクレイパーを実行:"
echo -e "   ${BLUE}python3 integrated_scraper.py${NC}"
echo ""

exit 0

