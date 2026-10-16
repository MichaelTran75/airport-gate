    /* ═══ flight/22-sky — CẢNH BẦU TRỜI (G 14/10): máy bay đứng giữa khung, mây trôi ngược chiều bay ═══
       Mây học theo 3D garden (nature/clouds-rain.js): "bông" = HỢP MỀM của nhiều quả cầu (chuẩn p = 6) + nhiễu fBm (mặt súp-lơ,
       mép xơ) → pháp tuyến → chiếu nắng theo hướng mặt trời thật; các bông che nắng lẫn nhau; đáy mây tích phẳng (mực ngưng tụ),
       chân xám-lam. Garden vẽ bằng shader GLSL (WebGL) — trang này chạy WebGPU nên cùng thuật toán được NƯỚNG SẴN trong Web Worker:
         · BIỂN MÂY bên dưới: 1 ô lặp liền mép 1024² (cạnh 160 world) dựng từ ~70 ô mây × vài chục bông cầu mềm (đỉnh mây tích nhìn từ trên cao), chiếu nắng + bóng tự đổ
           (dò tia trên trường độ cao), khe hở lộ mặt đất xa mờ sương — cuộn theo tốc độ bay;
         · MÂY TÍCH nổi lên khỏi biển mây: impostor (ảnh đã chiếu sáng, nhìn từ hướng camera mặc định) dựng từ bố cục bông kiểu garden
           (đế + 2–5 tháp đối lưu + vòm súp-lơ), mỗi bông che nắng bông khác — Sprite quay mặt về camera.
       Camera ortho ⇒ mọi thứ gắn đất trôi CÙNG một tốc độ trên màn hình; tốc độ hiển thị nén ~1/4 tốc độ thật.
       Vệt ngưng tụ: 4 dải sau 4 động cơ — hình thành cách miệng xả ~30 m (hơi nước trong khí xả đông đặc ở −40 °C), loang rồi tan. */
    // tile: cạnh 1 ô biển mây (world) — nhỏ ⇒ ô mây nhỏ (đọc như ở rất xa bên dưới) & texture 1024² đủ mịn khi phóng gần
    const SKY = { set: null, deck: null, puffs: [], trails: null, speed: 30, baked: null, tile: 160 };
    // góc nhìn mặc định trên trời (G 16/10, ảnh mẫu thứ 2): từ phía SAU-PHẢI-TRÊN máy bay — lệch 38.6° về phía đuôi so với nhìn ngang,
    // cao hơn máy bay 21.7° ⇒ thân + vệt ngưng tụ chếch 18.7° lên phải, mũi hướng góc trên-phải. Khớp bình phương nhỏ nhất từ ảnh G:
    // góc vệt ngưng tụ (18.7°, có tính góc chúc 2.5° lúc bay bằng), khoảng cách 4 vệt (động cơ sải 5.94 / 10.5 world, máy ngoài cao
    // hơn 0.57) và chiều dài thân 38 world
    const SKY_SUN = [90, 140, 55], SKY_CAM = { theta: -0.6737, phi: 1.1921 };   // −38.6° · 68.3° (vẽ lại đối chiếu: vệt 18.7°)
    // ── bộ nướng mây: hàm THUẦN (không dùng THREE) để chạy được trong Web Worker; trả các mảng RGBA + kích thước
    function skyBake(opt) {
      let seed = opt.seed | 0;
      const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let q = Math.imul(seed ^ (seed >>> 15), 1 | seed); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; };
      const hash = (x, y, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const vn = (x, y, s, P) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), m = (a) => P ? ((a % P) + P) % P : a;
        const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
      const fbm = (x, y, s, P) => { let sum = 0, amp = 0.5, f = 1; for (let o = 0; o < 4; o++) { sum += amp * vn(x * f, y * f, s + o * 17, P ? P * f : 0); f *= 2; amp *= 0.5; } return sum / 0.9375; };
      const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
      const L = nrm(opt.sun), toSRGB = (c) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, c)), 1 / 2.2));
      const out = {};
      if (opt.deckN) // ═══ 1 · BIỂN MÂY (nhìn từ trên cao) — ~70 Ô MÂY TÍCH, mỗi ô vài chục BÔNG cầu mềm (giữa ô cao, rìa thấp); vẽ chồng theo độ cao
      //     (bông thấp trước, bông cao đè lên), mép xơ fBm, chiếu nắng pháp tuyến bán cầu trên + bóng đổ dò trên trường độ cao;
      //     khe giữa các ô lộ mặt đất xa nhuốm sương lam. Ô lặp liền mép (toạ độ 0..1: u → +x thế giới, v → −z thế giới). ═══
      {
        const N = opt.deckN, C = new Float32Array(N * N * 3), A = new Float32Array(N * N), TOP = new Float32Array(N * N);
        const LT = [L[0], L[1], -L[2]];                                            // nắng trong hệ (u, cao, v)
        const puffs = [];
        for (let c = 0; c < opt.deckCells; c++) {
          const cx = rnd(), cy = rnd(), Rc = 0.022 + Math.pow(rnd(), 1.6) * 0.07, n = Math.round(14 + Rc * 1300), dome = Rc * (0.5 + rnd() * 0.5);
          for (let k = 0; k < n; k++) {
            const a = rnd() * 6.283, d = Math.sqrt(rnd()) * Rc, f = 1 - d / Rc, r = Rc * (0.11 + 0.17 * rnd()) * (0.55 + 0.45 * f);
            puffs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r, dome * f * f + r * 0.5]);   // [u, v, bán kính, cao độ đỉnh]
          }
        }
        puffs.sort((p, q) => p[3] - q[3]);
        for (const p of puffs) {
          const R = Math.ceil(p[2] * 1.15 * N), ix = Math.round(p[0] * N), iy = Math.round(p[1] * N), r = p[2];
          for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
            const du = i / N, dv = j / N, d = Math.hypot(du, dv) / r; if (d >= 1.15) continue;
            const X = ((ix + i) % N + N) % N, Y = ((iy + j) % N + N) % N, k = Y * N + X;
            const ero = d * (1 + (fbm(X / N * 40, Y / N * 40, 21, 40) - 0.5) * 1.1);
            const a = sm(1.08, 0.45, ero); if (a <= 0.003) continue;
            const q = Math.max(0, 1 - Math.min(1, d) ** 2), up = Math.sqrt(q), bump = (fbm(X / N * 64, Y / N * 64, 31, 64) - 0.5) * 0.5;
            const nn = nrm([du / r * 0.55 + bump, up + 0.55, dv / r * 0.55 - bump]);   // pháp tuyến dẹt: mép bông không sẫm thành vòng
            const ndl = nn[0] * LT[0] + nn[1] * LT[1] + nn[2] * LT[2], hgt = p[3] - r * 0.5 + r * up;
            const direct = Math.max(0, 0.35 + 0.65 * ndl), amb = 0.55 + 0.45 * nn[1], low = Math.min(1, hgt / 0.05);
            const col = [0.42 * amb * (0.7 + 0.3 * low) + 0.6 * direct, 0.46 * amb * (0.7 + 0.3 * low) + 0.57 * direct, 0.55 * amb * (0.7 + 0.3 * low) + 0.52 * direct];
            for (let c = 0; c < 3; c++) C[k * 3 + c] = col[c] * a + C[k * 3 + c] * (1 - a);
            A[k] = a + A[k] * (1 - a); if (a > 0.4) TOP[k] = Math.max(TOP[k], hgt);
          }
        }
        const Lh = Math.hypot(LT[0], LT[2]), su = LT[0] / Lh, sv = LT[2] / Lh, tanE = LT[1] / Lh, g = (i, j) => TOP[((j % N + N) % N) * N + ((i % N + N) % N)];
        const img = new Uint8ClampedArray(N * N * 4);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const k = j * N + i, o = k * 4, h = TOP[k];
          let sh = 0;                                                               // bóng của ô mây cao đổ lên ô thấp / mặt đất
          for (let st = 1; st <= 12; st++) { const d = st * 3, hh = g(Math.round(i - su * d), Math.round(j - sv * d)) - (h + d / N * tanE); if (hh > 0) sh = Math.max(sh, Math.min(1, hh * 60)); }
          const gr = [0.27 + 0.05 * fbm(i / N * 5, j / N * 5, 9, 5), 0.33 + 0.06 * fbm(i / N * 5, j / N * 5, 13, 5), 0.39];   // mặt đất xa qua khe mây (sương lam)
          for (let c = 0; c < 3; c++) {
            const v = (C[k * 3 + c] * opt.deckAlpha + gr[c] * (1 - A[k] * opt.deckAlpha)) * (1 - 0.55 * sh * opt.deckAlpha);   // mây đục deckAlpha (G: 50 %) trên nền đất xa
            img[o + c] = toSRGB(v);
          }
          img[o + 3] = 255;
        }
        // 2 lượt làm mờ hộp 3×3 (liền mép) — hoà các bông vào nhau thành khối mây, hết viền tròn kiểu bong bóng
        for (let pass = 0; pass < 2; pass++) {
          const src = img.slice();
          for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) {
            let acc = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) acc += src[((((j + dj) % N + N) % N) * N + (((i + di) % N + N) % N)) * 4 + c];
            img[(j * N + i) * 4 + c] = acc / 9;
          }
        }
        out.deck = { N, data: img };
      }
      // ═══ 2 · MÂY TÍCH — impostor nhìn từ hướng camera: bông (bố cục garden cloudShape) vẽ chồng TỪ XA TỚI GẦN như billboard
      //     của garden — mỗi bông: pháp tuyến cầu + gợn fBm, mép xơ, nắng lọt (bông khác che), chân phẳng xám-lam ═══
      {
        const th = opt.cam.theta, ph = opt.cam.phi, zc = [Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)];
        const xc = nrm([zc[2], 0, -zc[0]]), yc = [zc[1] * xc[2] - zc[2] * xc[1], zc[2] * xc[0] - zc[0] * xc[2], zc[0] * xc[1] - zc[1] * xc[0]];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        out.clouds = [];
        for (let ci = 0; ci < opt.clouds.length; ci++) {
          const size = opt.clouds[ci], R = rnd, Lc = size * (2.0 + R()), Wd = size * (0.95 + R() * 0.4), Hm = size * (0.75 + R() * 0.55), P = [];
          const add = (x, y, z, r) => { if (P.length < 70) P.push([x, y, z, r]); };
          const nb = 8 + (R() * 5 | 0);
          for (let i = 0; i < nb; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * 0.9, r = size * (0.46 + R() * 0.16) * (1 - 0.3 * rr); add(Math.cos(a) * rr * Lc * 0.5, r * 0.5, Math.sin(a) * rr * Wd * 0.5, r); }
          const nt = 2 + (R() * 4 | 0);
          for (let t = 0; t < nt; t++) {
            const tx = (R() - 0.5) * Lc * 0.65, tz = (R() - 0.5) * Wd * 0.45, top = Hm * (0.5 + R() * 0.5) * (1 - 0.6 * Math.abs(tx) / Lc);
            let y = size * 0.45, r = size * (0.52 + R() * 0.12);
            while (y < top) { add(tx + (R() - 0.5) * r * 0.5, y, tz + (R() - 0.5) * r * 0.5, r); y += r * 0.55; r *= 0.87; }
            const nc = 3 + (R() * 3 | 0);
            for (let c = 0; c < nc; c++) { const a = R() * 6.283; add(tx + Math.cos(a) * r * 0.75, y - r * 0.25 + R() * r * 0.35, tz + Math.sin(a) * r * 0.6, r * (0.55 + R() * 0.25)); }
          }
          const sun = P.map((p, i) => { let tau = 0; for (let k = 1; k <= 6; k++) { const s = k * p[3] * 0.7, x = p[0] + L[0] * s, y = p[1] + L[1] * s, z = p[2] + L[2] * s; for (let j = 0; j < P.length; j++) { if (j === i) continue; const q = P[j], f = 1 - ((x - q[0]) ** 2 + (y - q[1]) ** 2 + (z - q[2]) ** 2) / (q[3] * q[3]); if (f > 0) tau += f * f; } } return Math.max(0.22, Math.exp(-tau * 0.35)); });
          const S = P.map((p, i) => [dot(p, xc), dot(p, yc), dot(p, zc), p[3], i]).sort((a, b) => a[2] - b[2]);   // xa → gần
          let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
          for (const s of S) { u0 = Math.min(u0, s[0] - s[3] * 1.2); u1 = Math.max(u1, s[0] + s[3] * 1.2); v0 = Math.min(v0, s[1] - s[3] * 1.2); v1 = Math.max(v1, s[1] + s[3] * 1.2); }
          const W = opt.cloudPx, Hh = Math.max(32, Math.round(W * (v1 - v0) / (u1 - u0))), ppu = W / (u1 - u0);
          const Cb = new Float32Array(W * Hh * 3), Ab = new Float32Array(W * Hh), base = P.reduce((m, p) => Math.min(m, p[1] - p[3] * 0.25), 1e9) + size * 0.22;
          const lit = [0.70, 0.68, 0.62], shade = [0.46, 0.51, 0.60], bas = [0.27, 0.31, 0.39];
          for (const s of S) {
            const p = P[s[4]], r = s[3], cx = (s[0] - u0) * ppu, cy = (v1 - s[1]) * ppu, rp = r * ppu * 1.15, sk = sun[s[4]];
            const hk = Math.min(1, Math.max(0, (p[1] - base) / (Hm + 1e-6)));   // bông càng cao càng sáng trời
            for (let j = Math.max(0, Math.floor(cy - rp)); j <= Math.min(Hh - 1, Math.ceil(cy + rp)); j++) for (let i = Math.max(0, Math.floor(cx - rp)); i <= Math.min(W - 1, Math.ceil(cx + rp)); i++) {
              const du = (i - cx) / ppu / r, dv = (cy - j) / ppu / r, d = Math.hypot(du, dv); if (d >= 1.15) continue;
              const e = fbm(i / W * 11 + ci * 7.3, j / Hh * 11 * Hh / W + s[4] * 0.37, 5);
              const a0 = sm(1.08, 0.66, d * (1 + (e - 0.5) * 0.55)); if (a0 <= 0.003) continue;
              const q = Math.max(0, 1 - Math.min(1, d) ** 2), hz = Math.sqrt(q);
              const b1 = (fbm(i / W * 23 + ci, j / Hh * 23 * Hh / W, 17) - 0.5) * 0.9, b2 = (fbm(i / W * 23 + ci + 9.1, j / Hh * 23 * Hh / W, 23) - 0.5) * 0.9;
              const ncam = nrm([du * 0.9 + b1, dv * 0.9 + b2, hz + 0.25]);
              const n = [ncam[0] * xc[0] + ncam[1] * yc[0] + ncam[2] * zc[0], ncam[0] * xc[1] + ncam[1] * yc[1] + ncam[2] * zc[1], ncam[0] * xc[2] + ncam[1] * yc[2] + ncam[2] * zc[2]];
              const yW = p[1] + du * r * xc[1] + dv * r * yc[1] + hz * r * zc[1];     // cao độ thật của điểm mặt bông ⇒ cắt đáy phẳng
              const a = a0 * sm(base - size * 0.06, base + size * 0.16, yW); if (a <= 0.003) continue;
              const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
              const direct = sk * Math.min(1, Math.max(0, 0.42 + 0.58 * ndl)), ambK = Math.min(1, Math.max(0, 0.18 + 0.5 * hk + 0.32 * n[1]));
              const k = j * W + i;
              for (let c = 0; c < 3; c++) { const col = bas[c] + (shade[c] - bas[c]) * ambK + lit[c] * direct * 0.95; Cb[k * 3 + c] = col * a + Cb[k * 3 + c] * (1 - a); }
              Ab[k] = a + Ab[k] * (1 - a);
            }
          }
          const img = new Uint8ClampedArray(W * Hh * 4);
          for (let k = 0; k < W * Hh; k++) { const a = Ab[k]; if (a < 0.004) continue; for (let c = 0; c < 3; c++) img[k * 4 + c] = toSRGB(Cb[k * 3 + c] / a); img[k * 4 + 3] = Math.round(255 * a); }
          out.clouds.push({ W, H: Hh, data: img, w: u1 - u0, h: v1 - v0, cu: (u0 + u1) / 2, cv: (v0 + v1) / 2, base });
        }
      }
      return out;
    }
    // nướng ở LUỒNG PHỤ (Worker từ Blob — như garden), không chặn khung hình; trình duyệt chặn Worker ⇒ nướng trên luồng chính
    function skyBakeStart() {
      if (SKY.baking) return; SKY.baking = true;
      const opt = { seed: 20261014, sun: SKY_SUN, cam: SKY_CAM, deckN: 0, clouds: [26, 22, 30, 18, 24, 20, 16, 28, 12, 14], cloudPx: 300 };   // mặt đất thật ⇒ bỏ biển mây
      const done = (r) => { SKY.baked = r; if (SKY.set) skyApplyBake(); };
      try {
        const url = URL.createObjectURL(new Blob(['onmessage = (e) => { const r = (' + skyBake.toString() + ')(e.data); const t = [...(r.deck ? [r.deck.data.buffer] : []), ...r.clouds.map(c => c.data.buffer)]; postMessage(r, t); };'], { type: 'text/javascript' }));
        const w = new Worker(url);
        w.onmessage = (e) => { w.terminate(); URL.revokeObjectURL(url); done(e.data); };
        w.onerror = (e) => { e.preventDefault?.(); w.terminate(); URL.revokeObjectURL(url); done(skyBake(opt)); };
        w.postMessage(opt);
      } catch (e) { done(skyBake(opt)); }
    }
    setTimeout(skyBakeStart, 2500);                                             // nướng sẵn sau khi trang hiện (~0.4 s ở luồng phụ)
    // ═══ MẶT ĐẤT THẬT (G 15/10 "khi máy bay bay trên bầu trời, make it real earth") ═══
    // Ảnh vệ tinh USGS The National Map (USGSImageryOnly — ảnh trực giao, phạm vi công cộng, máy chủ cho phép tải chéo nguồn) lát
    // theo ô Web Mercator ngay dưới ĐƯỜNG BAY THẬT: bay bằng FL350 hướng 280° từ Desert View dọc lòng Grand Canyon (Arizona), qua phía bắc Grand Canyon Village — như các chuyến xuyên lục
    // địa vào Los Angeles. Tỉ lệ: camera "bay kèm" cách máy bay ~90 m (như ảnh chụp không đối không) ⇒ mặt đất 10.7 km bên dưới hiện
    // ở 1 world = 260 m (khung ~25 × 40 km); đất trôi đúng tốc độ bay GS 490 kt = 252 m/s (× nhịp phát của cảnh). Ô ảnh tải dần theo
    // vùng camera nhìn thấy (chọn mức zoom theo độ rộng khung, ≤ ~150 ô), ô ra khỏi vùng thì giải phóng; chưa có ảnh ⇒ nền đất sa mạc.
    // Sương khí quyển: fog của cảnh (dày dần theo chiều sâu nhìn). Hệ local của lớp đất: x = đông, z = −bắc (quay β − 90° ⇒ hướng bay = +x).
    const EARTH = { lat0: 36.04, lon0: -111.82, brg: 280, mpw: 260, gs: 252, y: -160, d: 0, z: 13, tiles: new Map(), loading: 0, group: null,
      clouds: [], box: [220, 300], url: (z, y, x) => 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/' + z + '/' + y + '/' + x };
    const MERC_R = 6378137, MERC_MAX = Math.PI * MERC_R;
    const mercOf = (lat, lon) => [MERC_R * lon * Math.PI / 180, MERC_R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
    const EO = mercOf(EARTH.lat0, EARTH.lon0), EK = Math.cos(EARTH.lat0 * Math.PI / 180) / EARTH.mpw;   // gốc Mercator · world / m Mercator
    function earthLatLon() {                                                            // vị trí hiện tại (độ) — cho bảng số
      const b = EARTH.brg * Math.PI / 180, X = EO[0] + EARTH.d * Math.sin(b) / Math.cos(EARTH.lat0 * Math.PI / 180), Y = EO[1] + EARTH.d * Math.cos(b) / Math.cos(EARTH.lat0 * Math.PI / 180);
      return [(2 * Math.atan(Math.exp(Y / MERC_R)) - Math.PI / 2) * 180 / Math.PI, X / MERC_R * 180 / Math.PI];
    }
    const _ev = new THREE.Vector3(), _ed = new THREE.Vector3(), _texL = new THREE.TextureLoader(); _texL.setCrossOrigin('anonymous');
    function earthBuild(G) {
      const E = new THREE.Group(); E.rotation.y = EARTH.brg * Math.PI / 180 - Math.PI / 2; E.position.y = EARTH.y; G.add(E); EARTH.group = E;
      // camera nhìn xiên xuống ⇒ tia qua tâm khung chạm mặt đất cách gốc cảnh ~300 world (≈ 78 km theo tỉ lệ đất): dời lớp đất để
      // ĐÚNG vị trí hiện tại trên đường bay nằm giữa khung ở góc nhìn mặc định (xoay góc nhìn thì thấy đất quanh đó, như camera bay kèm)
      { const t = -EARTH.y / Math.cos(SKY_CAM.phi), h = t * Math.sin(SKY_CAM.phi); EARTH.off = [-h * Math.sin(SKY_CAM.theta), -h * Math.cos(SKY_CAM.theta)]; }
      const base = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb59c80, fog: true, toneMapped: false }));
      base.scale.set(2400, 1, 2400); base.position.y = -0.05; E.add(base); EARTH.base = base;   // nền sa mạc Colorado Plateau khi ô ảnh chưa tải
      EARTH.tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const cr = document.createElement('div'); cr.id = 'earthCredit'; cr.hidden = true;
      cr.innerHTML = 'Ảnh vệ tinh: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noopener">USGS The National Map</a> · Grand Canyon, Arizona';
      wrapEl.appendChild(cr); EARTH.credit = cr;
    }
    // vùng mặt đất camera đang thấy: tia qua 4 góc khung ∩ mặt phẳng đất → toạ độ local của lớp đất
    function earthFootprint() {
      const E = EARTH.group; E.updateMatrixWorld(); camera.updateMatrixWorld(); camera.getWorldDirection(_ed);
      const pts = [];
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        _ev.set(x, y, -1).unproject(camera); const t = (EARTH.y - _ev.y) / (_ed.y || -1e-6);
        _ev.addScaledVector(_ed, Math.max(0, t)); E.worldToLocal(_ev); pts.push([_ev.x, _ev.z]);
      }
      return pts;
    }
    const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    function earthTiles() {
      const P = earthFootprint(), cx = P.reduce((a, p) => a + p[0], 0) / 4, cz = P.reduce((a, p) => a + p[1], 0) / 4;
      EARTH.fc = [cx, cz]; EARTH.base.position.x = cx; EARTH.base.position.z = cz;
      const xs = P.map(p => EO[0] + p[0] / EK), ys = P.map(p => EO[1] - p[1] / EK);
      // mức zoom: lớn nhất mà số ô phủ vùng nhìn ≤ ~150 (13 ở khung mặc định: ô 4.9 km ≈ 15 world, ~15 m / điểm ảnh)
      let z = 15, T, tx0, tx1, ty0, ty1;
      for (; z >= 8; z--) {
        T = 2 * MERC_MAX / 2 ** z;
        tx0 = Math.floor((Math.min(...xs) + MERC_MAX) / T) - 1; tx1 = Math.floor((Math.max(...xs) + MERC_MAX) / T) + 1;
        ty0 = Math.floor((MERC_MAX - Math.max(...ys)) / T) - 1; ty1 = Math.floor((MERC_MAX - Math.min(...ys)) / T) + 1;
        if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= 300) break;
      }
      const sz = T * EK, half = sz * 0.75, need = [];
      const Pg = P.map(([x, zz]) => { const dx = x - cx, dz = zz - cz, l = Math.hypot(dx, dz) || 1; return [x + dx / l * half * 1.5, zz + dz / l * half * 1.5]; });   // nới vùng 1 ô
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const lx = (-MERC_MAX + (tx + 0.5) * T - EO[0]) * EK, lz = -((MERC_MAX - (ty + 0.5) * T) - EO[1]) * EK;
        if (inPoly(Pg, lx, lz)) need.push([tx, ty, lx, lz, (lx - cx) ** 2 + (lz - cz) ** 2]);
      }
      need.sort((a, b) => a[4] - b[4]);
      const now = performance.now(), keep = new Set();
      for (const [tx, ty, lx, lz] of need) {
        const key = z + '/' + ty + '/' + tx; keep.add(key);
        let Tl = EARTH.tiles.get(key);
        if (!Tl) {
          const m = new THREE.Mesh(EARTH.tileGeo, new THREE.MeshBasicMaterial({ fog: true, toneMapped: false }));
          m.scale.set(sz * 1.002, 1, sz * 1.002); m.position.set(lx, 0, lz); m.visible = false; EARTH.group.add(m);
          Tl = { m, z, key, st: 0, seen: now }; EARTH.tiles.set(key, Tl);
        }
        Tl.seen = now;
        if (Tl.st === 0 && EARTH.loading < 6) {
          Tl.st = 1; EARTH.loading++;
          _texL.load(EARTH.url(z, ty, tx), (tex) => {
            EARTH.loading--; if (Tl.dead) { tex.dispose(); return; }
            tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; Tl.m.material.map = tex; Tl.m.material.needsUpdate = true; Tl.m.visible = true; Tl.st = 2;
          }, undefined, () => { EARTH.loading--; Tl.st = 3; });
        }
      }
      // ô mức zoom khác nằm thấp hơn (ô mới đè lên khi tải xong) · ô không còn cần quá 2 s ⇒ giải phóng
      for (const [key, Tl] of EARTH.tiles) {
        Tl.m.position.y = Tl.z === z ? 0 : -0.02;
        if (!keep.has(key) && now - Tl.seen > (Tl.z === z ? 400 : 2000)) {
          Tl.dead = true; EARTH.group.remove(Tl.m); if (Tl.m.material.map) Tl.m.material.map.dispose(); Tl.m.material.dispose(); EARTH.tiles.delete(key);
        }
      }
    }
    // mây + bóng: quấn trong hộp quanh tâm vùng nhìn (hệ local) ⇒ đi theo đất, luôn phủ khung
    function earthPlaceClouds() {
      const [cx, cz] = EARTH.fc || [0, 0], [W, H] = EARTH.box;
      for (const C of EARTH.clouds) {
        while (C.x - cx > W / 2) C.x -= W; while (C.x - cx < -W / 2) C.x += W;
        while (C.z - cz > H / 2) C.z -= H; while (C.z - cz < -H / 2) C.z += H;
        C.sp.position.set(C.x, C.h, C.z); C.sh.position.set(C.x + C.off[0], 0.05, C.z + C.off[1]);
      }
    }
    function earthStep(dt) {
      EARTH.d += EARTH.gs * dt;                                                          // m (theo thời gian cảnh)
      EARTH.group.position.set(EARTH.off[0] - EARTH.d / EARTH.mpw, EARTH.y, EARTH.off[1]);   // vị trí hiện tại ⇒ giữa khung, hướng bay = +x
      earthTiles(); earthPlaceClouds();
    }

    // gắn kết quả nướng vào cảnh: Sprite mây tích ĐÚNG TỈ LỆ mặt đất (rộng 1.3–3 km = 5–12 world, chân 1.5 km) rải quanh vùng nhìn,
    // mỗi đám 1 bóng mềm trên mặt đất lệch theo hướng nắng (mây ở độ cao h ⇒ bóng lệch h·cot(góc nắng) về phía ngược mặt trời)
    function skyApplyBake() {
      const B = SKY.baked; if (!B || SKY.applied || !EARTH.group) return; SKY.applied = true;
      const texs = B.clouds.map((c) => {
        const src = new Uint8Array(c.data.buffer), px = new Uint8Array(src.length), row = c.W * 4;   // ảnh nướng: hàng 0 ở TRÊN ⇒ lật cho DataTexture
        for (let j = 0; j < c.H; j++) px.set(src.subarray(j * row, (j + 1) * row), (c.H - 1 - j) * row);
        const t = new THREE.DataTexture(px, c.W, c.H, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace;
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
      });
      const sc = document.createElement('canvas'); sc.width = sc.height = 64; const g = sc.getContext('2d'), rg = g.createRadialGradient(32, 32, 4, 32, 32, 31);
      rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.6, 'rgba(0,0,0,0.75)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      const stex = new THREE.CanvasTexture(sc), sgeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      // lệch bóng: nắng SKY_SUN (hướng TỚI mặt trời) ⇒ bóng ở −(ngang)·h/(đứng); đổi sang hệ local của lớp đất (quay β − 90°)
      const th = EARTH.group.rotation.y, sx = -SKY_SUN[0] / SKY_SUN[1], sz = -SKY_SUN[2] / SKY_SUN[1];
      const offL = [sx * Math.cos(th) - sz * Math.sin(th), sx * Math.sin(th) + sz * Math.cos(th)];
      let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 40; i++) {
        // mây tích thời tiết đẹp nhìn từ 10 km: dẹt, mép mỏng (đục ~0.85), rộng 0.9–2.7 km, chân 1.5–1.9 km — bóng rõ hơn mây
        const c = B.clouds[i % B.clouds.length], w = 3.5 + Math.pow(rnd(), 1.6) * 7, k = w / c.w, h = 6 + rnd() * 1.5;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs[(i * 7) % texs.length], transparent: true, opacity: 0.86, depthWrite: false, fog: true }));
        sp.scale.set(c.w * k, c.h * k * 0.72, 1); sp.renderOrder = 2;
        const sh = new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ map: stex, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, fog: true }));
        sh.scale.set(w * 0.95, 1, w * 0.62); sh.renderOrder = 1;
        const C = { sp, sh, x: (rnd() - 0.5) * EARTH.box[0], z: (rnd() - 0.5) * EARTH.box[1], h: h + c.h * k * 0.42, off: [offL[0] * h, offL[1] * h] };
        EARTH.group.add(sp, sh); EARTH.clouds.push(C);
      }
      earthPlaceClouds(true);
    }
    function buildSky() {
      if (SKY.set) return SKY.set;
      const G = new THREE.Group(); G.visible = false;
      earthBuild(G);
      // vệt ngưng tụ: dải phẳng gắn máy bay (toạ độ máy bay), alpha theo texture: hiện dần từ ~30 m, loang + tan cuối dải
      const tc = document.createElement('canvas'); tc.width = 256; tc.height = 32; const tg = tc.getContext('2d');
      const lg = tg.createLinearGradient(0, 0, 256, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.05, 'rgba(255,255,255,0.85)'); lg.addColorStop(0.45, 'rgba(255,255,255,0.6)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      tg.fillStyle = lg; tg.fillRect(0, 0, 256, 32);
      const vg = tg.createLinearGradient(0, 0, 0, 32); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
      tg.globalCompositeOperation = 'destination-out'; tg.fillStyle = vg; tg.fillRect(0, 0, 256, 32);
      const ttex = new THREE.CanvasTexture(tc); ttex.colorSpace = THREE.SRGBColorSpace;
      const trailMat = new THREE.MeshBasicMaterial({ map: ttex, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
      const trails = new THREE.Group(); trails.visible = false;
      for (const s of ENG_SPANS) for (const sg of [-1, 1]) {
        const x0 = engX(s) - 6, L = 260, w0 = 0.5, w1 = 7;                                  // đơn vị máy bay (×1.1 ra world)
        const geo = new THREE.BufferGeometry(), y = engY(s) - 0.2, z = sg * s;
        geo.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z - w0, x0, y, z + w0, x0 - L, y, z - w1, x0 - L, y, z + w1], 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 1], 2)); geo.setIndex([0, 2, 1, 1, 2, 3]);
        const m = new THREE.Mesh(geo, trailMat); m.renderOrder = 4; m.userData.noFade = true; trails.add(m);
      }
      plane.add(trails); SKY.trails = trails; SKY.trailMat = trailMat;
      scene.add(G); SKY.set = G;
      if (SKY.baked) skyApplyBake(); else skyBakeStart();
      return G;
    }
    // máy bay bay tiếp dt giây (thời gian cảnh) dọc đường bay thật — gọi từ pha sky / desc
    function skyScroll(dt) { if (SKY.set) earthStep(dt); }
