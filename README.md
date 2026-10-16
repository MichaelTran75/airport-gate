# Gate A1 · Sân bay 3D (747-8)

Diorama cổng sân bay với Boeing 747-8, chạy bằng three.js WebGPU. Trang: https://michaeltran75.github.io/airport-gate/ (nhúng Wix bằng iframe).

| Tệp | Nội dung |
|---|---|
| `index.html` | khung trang + giao diện |
| `css/app.css` | kiểu giao diện |
| `src/app/*.js` + `manifest.txt` | **nơi sửa mã dựng cảnh** — các mảnh của một hàm `build()` chung phạm vi, ghép theo thứ tự trong manifest |
| `src/app/flight/` | **chuyến bay** (14/10): `21-runway.js` cảnh đường băng 09 + đường lăn A/RET · `22-sky.js` bầu trời (biển mây, mây tích, vệt ngưng tụ) · `23-flight.js` điều phối lăn ra → cất cánh → bay bằng → hạ cánh → về cổng |
| `build.py` | ghép `src/app/` → `js/app.js` (`--check` kiểm cú pháp, `--same` chỉ so) |
| `js/app.js` | bản đã ghép (đừng sửa tay — sẽ bị build.py ghi đè) |
| `js/wind-worker.js` | bộ giải Navier–Stokes đối xứng trục + hạt khói, chạy trong Web Worker |
| `assets/cfm56.bin` | lưới ruột động cơ (zlib) |

- Sửa mã: đổi trong `src/app/`, rồi `python3 build.py` (publish.sh tự chạy bước này).
- Xem trên máy: `./preview.sh` (cần máy chủ cục bộ; mở `index.html` trực tiếp bằng file:// sẽ thiếu luồng gió và lưới động cơ).
- Đưa lên mạng: `./publish.sh "mô tả"`.

Lưới ruột động cơ: "Engine CFM56-7B" — Michael Zhang (Sketchfab), CC BY 4.0, đã chỉnh sửa (quạt, nacelle, thêm cấp nén và turbine, đổi tỉ lệ GEnx-2B).

Nút **Khởi hành** chạy cả chuỗi: chuẩn bị ở cổng → đẩy lùi → lăn ra → đường băng → cất cánh → bầu trời (giữ bay bằng tới khi bấm **Hạ cánh**) → hạ cánh → về cổng. **Về cổng** huỷ giữa chừng. Gỡ lỗi từ console: `__fltJump('rtaxi' | 'roll' | 'sky' | 'appr' | 'arr')` nhảy thẳng tới một pha.
