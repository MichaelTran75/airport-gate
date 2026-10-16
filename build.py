#!/usr/bin/env python3
"""Dựng js/app.js từ mã nguồn src/app/ (nơi sửa mã).

  src/app/manifest.txt   thứ tự ghép các mảnh src/app/*.js (+ thư mục con, vd. flight/ — cảnh đường băng, bầu trời, bay) — toàn bộ là MỘT hàm build() chung phạm vi, nên mảnh sau
                         dùng được hằng/hàm khai báo ở mảnh trước (đổi thứ tự = đổi thứ tự chạy)
  js/wind-worker.js · js/engine-audio.js · css/app.css · index.html   sửa thẳng (không qua build)

  python3 build.py           dựng js/app.js
  python3 build.py --check   dựng + kiểm tra cú pháp bằng node (publish.sh chạy cái này trước khi đẩy)
  python3 build.py --same    chỉ so: bản ghép có trùng từng byte với js/app.js hiện tại không (không ghi)
"""
import pathlib, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
APP = HERE / 'src' / 'app'
OUT = HERE / 'js' / 'app.js'
args = set(sys.argv[1:])

def die(msg):
    sys.exit('build.py: ' + msg)

parts = []
for line in (APP / 'manifest.txt').read_text(encoding='utf-8').splitlines():
    rel = line.split('#', 1)[0].strip()
    if rel: parts.append(rel)
if len(parts) != len(set(parts)): die('manifest có tệp trùng')
stray = sorted(str(p.relative_to(APP)) for p in APP.rglob('*.js') if str(p.relative_to(APP)) not in parts)   # kể cả thư mục con (flight/)
if stray: die('có tệp chưa ghi trong src/app/manifest.txt: ' + ', '.join(stray))

def read(rel):
    p = APP / rel
    if not p.exists(): die('thiếu tệp src/app/' + rel)
    t = p.read_text(encoding='utf-8')
    return t[:-1] if t.endswith('\n') else t      # mỗi mảnh kết thúc bằng đúng 1 dấu xuống dòng

app = '\n'.join(read(r) for r in parts) + '\n'

if '--same' in args:
    cur = OUT.read_text(encoding='utf-8') if OUT.exists() else ''
    print('TRÙNG từng byte với js/app.js' if cur == app else 'KHÁC js/app.js (%d ↔ %d ký tự)' % (len(cur), len(app)))
    sys.exit(0 if cur == app else 1)

OUT.write_text(app, encoding='utf-8')
print('js/app.js ← %d mảnh · %d dòng · %.0f KB' % (len(parts), app.count('\n'), len(app.encode('utf-8')) / 1024))

if '--check' in args:
    r = subprocess.run(['node', '--check', str(OUT)], capture_output=True, text=True)
    if r.returncode != 0: die('lỗi cú pháp:\n' + r.stderr)
    print('cú pháp OK (node --check)')
