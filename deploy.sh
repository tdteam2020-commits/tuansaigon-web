#!/bin/zsh
# Dựng lại website từ kho GAS + đăng lên tuansaigon.surge.sh
# Chạy tay: ./deploy.sh · Tự động: launchd com.tuansaigon.web (7h15 sáng hằng ngày)
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")"
git pull --rebase -q 2>/dev/null || true   # lấy archive mới nhất do GitHub Actions commit mỗi sáng
source ~/.config/claude-bds/surge.env
source ~/.config/claude-bds/web.env
export SURGE_LOGIN SURGE_TOKEN WEB_KEY
node build.mjs
npx --yes surge ./dist tuansaigon.surge.sh --token "$SURGE_TOKEN"
echo "[$(date '+%Y-%m-%d %H:%M')] deploy OK"
