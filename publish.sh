#!/bin/bash
# Đưa bản mới lên GitHub Pages: ./publish.sh "mô tả thay đổi"
# Đóng dấu phiên bản (?v=…) lên css/app.js trong index.html ⇒ trình duyệt không trộn file cũ/mới khi cache.
set -e
cd "$(dirname "$0")"
python3 build.py --check                                  # dựng lại js/app.js từ src/app/ — lỗi cú pháp thì dừng, không đẩy
STAMP=$(date +%Y%m%d%H%M%S)
sed -E -i '' "s/(app\.(css|js))\?v=[0-9A-Za-z]+/\1?v=$STAMP/g" index.html
git add -A
if git diff --cached --quiet; then echo "Không có thay đổi."; exit 0; fi
git commit -q -m "${1:-Cập nhật trang}"
git push -q
echo "Đã đẩy lên (v=$STAMP). Trang cập nhật sau ~1 phút: https://michaeltran75.github.io/airport-gate/"
