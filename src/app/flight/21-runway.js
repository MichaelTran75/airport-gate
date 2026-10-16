    /* ═══ flight/21-runway — CẢNH ĐƯỜNG BĂNG (G 14/10, bước 2): slab diorama riêng, dựng LƯỜI lần đầu cần (lúc màn mờ che) ═══
       Cùng ngôn ngữ với sân đỗ: slab kem nổi trên nền, mặt đường có viền nét. Đơn vị world (1 m = 0.498).
       Đường băng 09 hướng +x, rộng 60 m (code F) · đường lăn song song cách tim 190 m · đường nối A1 ở đầu 09, vạch chờ
       107.5 m (ICAO Annex 14, đường băng tiếp cận chính xác) · đường lăn thoát nhanh (RET) rẽ 30° ở ~1.8 km.
       Sơn: đường băng TRẮNG (vạch ngưỡng 16 sọc, số hiệu, tim đứt 30/20 m, vạch vùng chạm 150 m/lần, vạch ngắm 400 m),
       đường lăn VÀNG (= PAINT, như vạch dẫn sân đỗ). Đèn: lề trắng 60 m · ngưỡng xanh · cuối đỏ · đèn tiếp cận · PAPI 4 ô
       (2 trắng 2 đỏ = đúng dốc 3°) · ống gió · ăng-ten ILS (đài hướng + đài dốc). */
    const RWY = {
      x0: -122, x1: 1250, th: -101, hw: 15,                   // mặt đường băng (kể dải chống luồng xả trước ngưỡng) · vạch ngưỡng · nửa rộng
      twz: 95, tww: 12.5, cx: -113, hold: 54,                 // đường lăn song song · đường nối A1 (tim x) · vạch chờ (z)
      td: -101 + 200,                                         // điểm ngắm 400 m sau ngưỡng
      set: null,
    };
    // lộ trình (tim đường, world): lăn từ đường song song → A1 → đầu đường băng; thoát nhanh RET → đường song song
    RWY.taxiRoute = [[-172, RWY.twz], [RWY.cx, RWY.twz], [RWY.cx, 0], [RWY.cx + 60, 0]];
    RWY.taxiR = [18, 18];                                    // bán kính rẽ 36 m
    RWY.retRoute = [[600, 0], [840, 0], [840 + 95 / Math.tan(Math.PI / 6), RWY.twz], [1250, RWY.twz]];
    RWY.retR = [137, 50];                                    // RET rẽ 30° bán kính 275 m

    // ── đường gấp khúc bo góc: góc i có bán kính R[i−1] → điểm dày ~0.8 world + độ dài cộng dồn (dùng chung cho sơn & lăn)
    function fPath(pts, R, step = 0.3) {
      const out = [], V = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [dx / l, dz / l, l]; };
      let cur = pts[0];
      const line = (a, b) => { const [ux, uz, l] = V(a, b), n = Math.max(1, Math.ceil(l / step)); for (let i = (out.length ? 1 : 0); i <= n; i++) out.push([a[0] + ux * l * i / n, a[1] + uz * l * i / n]); };
      for (let i = 1; i < pts.length - 1; i++) {
        const [ax, az] = V(pts[i - 1], pts[i]), [bx, bz] = V(pts[i], pts[i + 1]);
        const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz), r = R[i - 1], tl = r * Math.tan(Math.abs(turn) / 2);
        const p0 = [pts[i][0] - ax * tl, pts[i][1] - az * tl];
        line(cur, p0);
        const sg = Math.sign(turn), cx = p0[0] - az * r * sg, cz = p0[1] + ax * r * sg;   // tâm cung về phía rẽ
        const a0 = Math.atan2(p0[1] - cz, p0[0] - cx), n = Math.max(2, Math.ceil(r * Math.abs(turn) / step));
        for (let k = 1; k <= n; k++) { const a = a0 + turn * k / n; out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
        cur = out[out.length - 1];
      }
      line(cur, pts[pts.length - 1]);
      return fPathOf(out);
    }
    // điểm dày → đường: độ dài cộng dồn + tiếp tuyến tại TỪNG ĐỈNH (sai phân trung tâm), góc LIỀN (không nhảy qua ±π) ⇒ fSample nội suy
    // hướng mượt giữa 2 đỉnh. (G 14/10 "turn bị giật": bản trước lấy hướng theo đoạn thẳng ⇒ hướng mũi nhảy bậc 2.5–4° mỗi 0.8 world)
    function fPathOf(out) {
      const cum = [0]; for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
      const ang = [];
      for (let i = 0; i < out.length; i++) {
        const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
        let g = Math.atan2(b[1] - a[1], b[0] - a[0]); if (i) g -= Math.round((g - ang[i - 1]) / (2 * Math.PI)) * 2 * Math.PI;
        ang.push(g);
      }
      return { pts: out, cum, ang, len: cum[cum.length - 1] };
    }
    // đoạn [s0, s1] của P lệch ngang d(s) (world, + = bên trái hướng đi: +z khi đi +x)
    function offPath(P, s0, s1, d) {
      const pts = [], o = {}, n = Math.max(2, Math.ceil((s1 - s0) / 0.3));
      for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n, e = d(s); fSample(P, s, o); pts.push([o.x - o.tz * e, o.z + o.tx * e]); }
      return fPathOf(pts);
    }
    const sNear = (P, x, z) => { let b = 0, bd = 1e9; P.pts.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; b = i; } }); return P.cum[b]; };
    // điểm + hướng tiếp tuyến tại độ dài s (kẹp trong [0, len]) · o = {x, z, tx, tz, k (độ cong 1/world)}
    function fSample(P, s, o = {}) {
      s = Math.max(0, Math.min(P.len, s));
      let lo = 0, hi = P.cum.length - 1;
      while (lo < hi - 1) { const m = (lo + hi) >> 1; if (P.cum[m] <= s) lo = m; else hi = m; }
      const a = P.pts[lo], b = P.pts[hi], L = (P.cum[hi] - P.cum[lo]) || 1, u = (s - P.cum[lo]) / L;
      o.x = a[0] + (b[0] - a[0]) * u; o.z = a[1] + (b[1] - a[1]) * u;
      const g = P.ang[lo] + (P.ang[hi] - P.ang[lo]) * u; o.tx = Math.cos(g); o.tz = Math.sin(g);   // hướng nội suy liên tục
      const i0 = Math.max(0, lo - 4), i1 = Math.min(P.pts.length - 1, hi + 4);
      o.k = Math.abs(P.ang[i1] - P.ang[i0]) / ((P.cum[i1] - P.cum[i0]) || 1);                  // độ cong ≈ dθ/ds trên cửa sổ ±4 đỉnh
      return o;
    }
    // dải phẳng dọc đường (mặt đường cong / vạch sơn cong): tam giác không chỉ số, pháp tuyến lên
    function ribbonGeo(P, w, y, s0 = 0, s1 = P.len) {
      const v = [], h = w / 2, o = {}, n = Math.max(2, Math.ceil((s1 - s0) / 0.8));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        fSample(P, s0 + (s1 - s0) * i / n, o);
        const L = [o.x - o.tz * h, o.z + o.tx * h], Rr = [o.x + o.tz * h, o.z - o.tx * h];
        if (prev) {
          const [pl, pr] = prev;
          v.push(pl[0], y, pl[1], L[0], y, L[1], Rr[0], y, Rr[1], pl[0], y, pl[1], Rr[0], y, Rr[1], pr[0], y, pr[1]);   // ngược chiều kim đồng hồ nhìn từ trên
        }
        prev = [L, Rr];
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
      return g;
    }

    function buildRunway() {
      if (RWY.set) return RWY.set;
      const G = new THREE.Group(); G.visible = false;
      const { x0, x1, th, hw, twz, tww, cx, hold } = RWY;
      const RW_C = 0xC9C0AF, TW_C = 0xDDD5C4, LIGHT = 0xfff3cf, GREEN = 0x3fae62, RED = 0xd8473a, BLUE = 0x4a72c8;
      // slab (như sân đỗ: thân nâu + mặt kem)
      const SX0 = -292, SX1 = 1266, SZ0 = -58, SZ1 = 120, scx = (SX0 + SX1) / 2, scz = (SZ0 + SZ1) / 2;
      const base = Bag();
      base.P(SX1 - SX0, 7, SZ1 - SZ0, scx, -3.76, scz, 0x8a7355);
      base.P(SX1 - SX0 + 0.2, 0.5, SZ1 - SZ0 + 0.2, scx, -0.25, scz, 0xfbf9f1, { soft: true });
      G.add(base.build({ receive: true }));
      // mặt đường
      const pv = Bag();
      pv.P(x1 - x0, 0.12, hw * 2, (x0 + x1) / 2, 0.06, 0, RW_C, { soft: true });                              // đường băng
      pv.P(SX1 - SX0 - 2, 0.118, tww, scx, 0.059, twz, TW_C, { soft: true });                                // đường lăn song song
      pv.P(tww, 0.118, twz - hw - tww / 2 + 0.5, cx, 0.059, (hw + twz - tww / 2) / 2, TW_C, { soft: true });  // đường nối A1
      const taxi = fPath(RWY.taxiRoute, RWY.taxiR), ret = fPath(RWY.retRoute, RWY.retR);
      RWY.taxiPath = taxi; RWY.retPath = ret;
      pv.add(ribbonGeo(taxi, tww + 4, 0.117), TW_C, { noEdge: true });                                       // bo góc (khoét rộng cho càng chính cắt góc)
      pv.add(ribbonGeo(ret, tww, 0.117, 150), TW_C, { noEdge: true });                                        // RET
      G.add(pv.build({ cast: false, receive: true }));
      // ── sơn đường băng (trắng) ──
      const pw = Bag(), Y = 0.122;
      const W = (w, d, x, z, c = WHITE) => pw.P(w, 0.002, d, x, Y, z, c, { noEdge: true });
      for (let i = 0; i < 8; i++) for (const s of [-1, 1]) W(15, 0.9, th + 1.5 + 7.5, s * (1.35 + i * 1.8));   // 16 sọc ngưỡng 30 × 1.8 m
      W(0.9, hw * 2 - 1, th, 0);                                                                                 // vạch ngang ngưỡng
      for (let x = th + 40; x < x1 - 20; x += 25) W(15, 0.45, x + 7.5, 0);                                      // tim: 30 m sơn · 20 m hở
      for (const s of [-1, 1]) W(x1 - x0 - 4, 0.45, (x0 + x1) / 2, s * (hw - 0.6));                            // vạch lề
      for (const [d, n] of [[75, 3], [150, 3], [225, 2], [300, 2], [375, 1], [450, 1]])                          // vạch vùng chạm (150 m/lần)
        for (let j = 0; j < n; j++) for (const s of [-1, 1]) W(11.25, 0.9, th + d + 5.6, s * (5 + j * 1.8));
      for (const s of [-1, 1]) W(30, 5, th + 200 + 15, s * 7.2);                                               // vạch điểm ngắm 400 m
      // chevron đoạn chống luồng xả trước ngưỡng (vàng)
      for (let k = 0; k < 3; k++) for (const s of [-1, 1]) pw.P(9, 0.002, 0.7, x0 + 4 + k * 6, Y, s * 3.4, PAINT, { noEdge: true, ry: -s * 0.9 });
      // ── sơn đường lăn (vàng = PAINT): tim + vạch chờ kiểu A (2 liền phía đường lăn, 2 đứt phía đường băng) ──
      // Bản trước sơn vàng ĐÈ đúng tim trắng (và số "09"), 2 lớp gần cùng độ cao ⇒ tranh điểm ảnh (z-fighting — G 14/10 "đường băng
      // bị nhiễu"). Nay: sơn vàng cao hơn sơn trắng 4 mm world (chỗ cắt vạch ngang / vạch lề trắng không nhiễu) và
      // · vạch DẪN VÀO ở đầu đường băng: cong vào tim rồi dừng ngay sau dải sọc ngưỡng (nằm trong khe giữa 2 sọc tâm, không chạm số "09")
      // · vạch DẪN RA RET: từ ~60 m trước điểm tiếp tuyến chạy SONG SONG cạnh tim trắng, lệch về phía RET (mép cách mép 0.9 m —
      //   ICAO Annex 14 5.2.8 · FAA AC 150/5340-1), độ lệch tan dần dọc cung rẽ (smoothstep) ⇒ vạch liền mạch
      const LEAD = 0.225 + 0.45 + 0.175, sm = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
      const rx = RWY.retRoute[1][0], tl = RWY.retR[0] * Math.tan(Math.PI / 12), sT = sNear(ret, rx - tl, 0), sE = sNear(ret, rx + tl * Math.cos(Math.PI / 6), tl * Math.sin(Math.PI / 6));   // cung rẽ ra RET 30°
      pw.add(ribbonGeo(taxi, 0.35, Y + 0.005, 0, sNear(taxi, th + 16, 0)), PAINT, { noEdge: true });
      pw.add(ribbonGeo(offPath(ret, 172, ret.len, s => LEAD * (1 - sm((s - sT) / (sE - sT)))), 0.35, Y + 0.005), PAINT, { noEdge: true });
      W(SX1 - SX0 - 4, 0.35, scx, twz, PAINT);
      for (const dz of [0.9, 1.6]) W(tww, 0.25, cx, hold + dz, PAINT);
      for (const dz of [-0.4, -1.1]) for (let k = -2; k <= 2; k++) W(1.6, 0.25, cx + k * 2.5, hold + dz, PAINT);
      for (const s of [-1, 1]) W(0.25, twz - hw - tww, cx + s * (tww / 2 - 0.3), (hw + twz - tww / 2) / 2, PAINT);   // vạch lề đường nối
      G.add(pw.build({ cast: false, receive: true }));
      // số hiệu "09" (đầu chữ hướng +x — đọc xuôi khi hạ cánh về +x)
      const num = paintText('09', th + 30, 0, 6, [1, 0], { color: WHITE, y: Y + 0.001 }); G.add(num);
      const twy = paintText('A', cx - 4.5, twz + 4.5, 2.4, [0, -1], { y: Y + 0.001 }); G.add(twy);
      // ── đèn ──
      const lb = Bag();
      const lamp = (x, z, c, h = 0.28) => { lb.C(0.1, h, x, h / 2, z, DARK, { seg: 6, noEdge: true }); lb.C(0.17, 0.1, x, h + 0.05, z, c, { seg: 8, noEdge: true }); };
      for (let x = th; x <= x1 - 5; x += 30) for (const s of [-1, 1]) lamp(x, s * (hw + 0.6), LIGHT);          // lề 60 m
      for (let z = -hw + 1; z <= hw - 1; z += 2.2) { lamp(th - 1.2, z, GREEN); lamp(x1 - 2, z, RED); }         // ngưỡng · cuối
      for (let x = -280; x <= SX1 - 6; x += 30) for (const s of [-1, 1]) lamp(x, twz + s * (tww / 2 + 0.6), BLUE, 0.22);   // lề đường lăn
      for (let x = th - 15; x >= th - 165; x -= 15) {                                                          // đèn tiếp cận: thanh 5 đèn mỗi 30 m
        lb.P(0.25, 0.9, 0.25, x, 0.45, 0, DARK, { noEdge: true }); lb.P(0.18, 0.12, 4.4, x, 0.92, 0, DARK, { noEdge: true });
        for (let k = -2; k <= 2; k++) lb.C(0.16, 0.12, x, 1.02, k * 1.05, LIGHT, { seg: 8, noEdge: true });
        if (Math.abs(x - (th - 75)) < 1) { lb.P(0.18, 0.12, 22, x, 0.92, 0, DARK, { noEdge: true }); for (let k = -10; k <= 10; k++) if (Math.abs(k) > 2) lb.C(0.16, 0.12, x, 1.02, k * 1.05, LIGHT, { seg: 8, noEdge: true }); }
      }
      // PAPI bên trái (−z) ngang điểm ngắm: 4 hộp, mỗi hộp 2 mắt; đúng dốc 3° ⇒ 2 trong đỏ · 2 ngoài trắng
      for (let i = 0; i < 4; i++) {
        const z = -(hw + 7.5 + i * 4.5), x = RWY.td;
        lb.P(1.5, 0.55, 1.1, x, 0.4, z, CREAM, {}); lb.P(0.3, 0.4, 0.9, x - 0.6, 0.1, z, DARK, { noEdge: true });
        lb.C(0.17, 0.06, x - 0.78, 0.48, z - 0.25, i < 2 ? RED : LIGHT, { axis: 'x', seg: 10, noEdge: true });
        lb.C(0.17, 0.06, x - 0.78, 0.48, z + 0.25, i < 2 ? RED : LIGHT, { axis: 'x', seg: 10, noEdge: true });
      }
      // ăng-ten đài dốc (glide slope) sau PAPI · đài hướng (localizer) sau cuối đường băng
      lb.P(0.5, 9, 0.5, RWY.td - 40, 4.5, -(hw + 30), CREAM, {}); for (const y of [3.5, 5.5, 7.5]) lb.P(0.9, 0.6, 1.4, RWY.td - 40, y, -(hw + 30) + 0.7, WHITE, {});
      lb.P(1.6, 1.2, 1.6, RWY.td - 40, 0.6, -(hw + 33), CREAM, {});
      for (let z = -13; z <= 13; z += 2) { lb.P(0.18, 1.6, 0.18, SX1 - 4, 0.8, z, DARK, { noEdge: true }); lb.P(0.7, 0.18, 0.18, SX1 - 4, 1.6, z, WHITE, {}); }
      lb.P(0.18, 0.18, 26, SX1 - 4, 1.0, 0, DARK, { noEdge: true });
      // ống gió (gió thổi từ +x ⇒ ống bay về −x) cạnh vùng chạm, có vòng sơn trắng đỏ
      { const wx = th + 330, wz = -(hw + 22);
        lb.C(0.12, 4.2, wx, 2.1, wz, DARK, { seg: 8 }); lb.P(1.6, 0.12, 1.6, wx, 0.06, wz, CREAM, {});
        for (let k = 0; k < 5; k++) lb.C(0.42 - k * 0.055, 0.62, wx - 0.35 - k * 0.62, 4.0, wz, k % 2 ? WHITE : 0xe0703a, { axis: 'x', r2: 0.42 - (k + 1) * 0.055, seg: 12 }); }
      // biển bắt buộc ở vạch chờ (nền đỏ, chữ vẽ canvas) — HAI bên vạch chờ, mặt quay về phía máy bay tới. G 16/10: biển cũ cách tim
      // đường lăn 9.25 world (18.5 m) nằm đúng vệt động cơ NGOÀI của 747-8 (sải 21.1 m, vỏ Ø 3.45 m ⇒ 9.6–11.4 world) ⇒ dời theo ICAO
      // Annex 14 Bảng 5-5 (mã số 3–4: mép gần của biển cách mép đường lăn 11–21 m) ⇒ 12 m; thấp hơn (đỉnh 1.5 world) cho gần cỡ thật
      { const c = document.createElement('canvas'); c.width = 420; c.height = 130; const g = c.getContext('2d');
        g.fillStyle = '#c8402f'; g.fillRect(0, 0, 420, 130); g.fillStyle = '#fff'; g.font = '700 84px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('A1  09-27', 210, 70);
        const t = new THREE.CanvasTexture(c), BW = 3.2, BH = 1.0, sz = hold + 1.2; t.colorSpace = THREE.SRGBColorSpace;
        for (const s of [-1, 1]) {
          const sx = cx + s * (tww / 2 + 6 + BW / 2);
          lb.P(0.18, 0.55, 0.18, sx - BW * 0.33, 0.275, sz, DARK, { noEdge: true }); lb.P(0.18, 0.55, 0.18, sx + BW * 0.33, 0.275, sz, DARK, { noEdge: true });
          lb.P(BW, BH, 0.3, sx, 0.55 + BH / 2, sz, RED, {});
          const face = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.08, BH - 0.06), new THREE.MeshBasicMaterial({ map: t }));
          face.position.set(sx, 0.55 + BH / 2, sz + 0.16); G.add(face);
        } }
      G.add(lb.build({ receive: true }));
      scene.add(G); RWY.set = G; return G;
    }
