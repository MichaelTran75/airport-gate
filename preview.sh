#!/bin/bash
# Xem trên máy: chạy máy chủ cục bộ (Web Worker & tải lưới động cơ không chạy được khi mở file:// trực tiếp)
cd "$(dirname "$0")"
python3 build.py --check || exit 1                       # ghép src/app/ → js/app.js
sed -E -i '' "s/(app\.(css|js))\?v=[0-9A-Za-z]+/\1?v=dev$(date +%s)/g" index.html   # tránh trình duyệt dùng app.js cũ trong cache
( sleep 1; open "http://localhost:8000/" ) &
exec python3 -m http.server 8000
