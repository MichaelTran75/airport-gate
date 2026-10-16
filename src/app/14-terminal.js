    /* ═══ 04-terminal — nhà ga 2 tầng: sảnh hành lý tầng sân đỗ · tầng khởi hành vách kính · mái vòm cong vươn
       ra sân đỗ trên giằng xiên · giếng trời dọc đỉnh mái · mái đón landside · cầu đi bộ sang concourse phía nam.
       Footprint GIỮ NGUYÊN khối cũ (x 56–86 · z −44–38) ⇒ bố cục sân đỗ & đường chạy đoàn hành lý không đổi.
       Vẫn là khối "bóng ma" trong suốt như bản cũ (đoàn hành lý chạy VÀO sảnh vẫn phải thấy) nhưng TẮT depthWrite:
       nhiều lớp chồng nhau hoà màu đều, không lớp nào nuốt lớp sau. Cửa sảnh hành lý mở đúng z 17.4–25.8 — chỗ 2 làn
       đoàn xe chui vào nhà ga.
       KẾT CẤU (G 11/10 "study airport và detailing building structure") theo các nhà ga thật: lưới 9 ô × 18.2 m dọc nhà ga
       (Riga: dàn mái cách 18 m) · 4 trục ngang (mặt dựng sân đỗ · 2 hàng cột giữa · mặt dựng đường bộ); tầng sân đỗ cột BTCT
       0.8 m; mái = 10 DÀN THÉP Warren cong theo mặt dưới mái (cao 2.5 m giữa nhịp, thon 0.6 m ở mút đua — HK Chek Lap Kok: vỏ
       dàn thép vượt 36 m) trên CỘT CÂY rẽ chữ V (Stansted / HK T2) + dầm dọc nối dàn; thanh chống mái đua nằm đúng mặt dàn;
       mặt dựng kính mô-đun 3 m, trụ lớn ở trục lưới (HK T2: trụ thép mỗi 2 mô-đun), lam chắn nắng ngang phía sân đỗ;
       tầng sân đỗ ốp tấm có ron + lá sách phòng máy; máng xối 2 mép mái; thang thoát hiểm thép ngoài trời ở 2 đầu hồi. ═══ */
    (function terminal() {
      const X0 = 56.3, XW = 57.0, X1 = 86, Z0 = -44, Z1 = 38, ZM = (Z0 + Z1) / 2, LZ = Z1 - Z0;
      const H0 = 0.14, FB = 2.0, FL = 2.3;                                // mặt dải đi bộ · đáy sàn · mặt sàn tầng khởi hành (= sàn ống lồng)
      const RX0 = 51.2, RX1 = 88.6, RT = 0.42, ROV = 1.6;                 // mép mái phía sân đỗ / landside · dày mái · vươn đầu hồi
      const yR = (x) => 7.7 + 2.9 * Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, (x - RX0) / (RX1 - RX0))), 0.85));
      const yU = (x) => yR(x) - RT;                                       // mặt dưới mái
      const tb = Bag(), fb = Bag(), rf = Bag(), glG = [];                 // tb: tường/kính/nội thất · fb: sàn · rf: mái (đục hơn)
      const glass = (geo) => glG.push(stripUV(geo.index ? geo.toNonIndexed() : geo));
      const glassBox = (w, h, d, x, y, z) => glass(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

      /* ── tầng sân đỗ: tường bệ lùi 0.7 sau vách kính · cửa sảnh hành lý · cửa cuốn · cửa công vụ ── */
      const wy = (H0 + FB) / 2, wh = FB - H0;
      tb.P(0.3, wh, 17.4 - Z0, XW, wy, (Z0 + 17.4) / 2, CREAM, {});
      tb.P(0.3, wh, Z1 - 25.8, XW, wy, (25.8 + Z1) / 2, CREAM, {});
      tb.P(0.3, wh, LZ, X1 - 0.15, wy, ZM, CREAM, {});
      for (const z of [Z0 + 0.15, Z1 - 0.15]) tb.P(X1 - XW, wh, 0.3, (XW + X1) / 2, wy, z, CREAM, {});
      for (const zc of [17.4, 25.8]) tb.P(0.5, wh, 0.36, XW, wy, zc, WHITE, {});                       // trụ biên cửa sảnh hành lý
      for (const zc of [-36, -27, -5, 4, 31]) {                                                       // cửa cuốn kho / kỹ thuật
        tb.P(0.05, 1.3, 2.6, XW - 0.17, H0 + 0.65, zc, WHITE, { soft: true });
        for (let i = 1; i < 6; i++) tb.P(0.03, 0.02, 2.5, XW - 0.2, H0 + i * 0.22, zc, DARK, { noEdge: true });
      }
      for (const zc of [-31.5, -22, 9, 13]) tb.P(0.05, 1.45, 0.9, XW - 0.17, H0 + 0.73, zc, DARK, { soft: true });  // cửa công vụ
      // ốp tấm tường bệ: ron đứng mỗi mô-đun 3 m + ron ngang giữa (bỏ qua chỗ cửa) · gờ đỉnh dưới mép sàn khởi hành
      const opening = (z) => (z > 17.2 && z < 26.0) || [-36, -27, -5, 4, 31].some(c => Math.abs(z - c) < 1.4) || [-31.5, -22, 9, 13].some(c => Math.abs(z - c) < 0.5);
      for (let z = Z0 + 1.52; z < Z1 - 0.5; z += 1.52) if (!opening(z)) tb.P(0.03, wh - 0.1, 0.025, XW - 0.16, wy, z, DARK, { noEdge: true });
      tb.P(0.36, 0.1, LZ, XW, FB - 0.05, ZM, WHITE, { soft: true });
      // lá sách thông gió phòng máy (2 ô lưới không vướng cửa): khung + 8 lá nghiêng
      for (const zc of [Z0 + 0.5 * LZ / 9, Z0 + 3.5 * LZ / 9]) {
        tb.P(0.06, 1.15, 2.4, XW - 0.17, H0 + 0.95, zc, WHITE, { soft: true });
        for (let k = 0; k < 8; k++) tb.P(0.03, 0.04, 2.3, XW - 0.21, H0 + 0.5 + k * 0.13, zc, DARK, { noEdge: true, rz: 0.5 });
      }

      /* ── sảnh hành lý: băng chuyền chia hành lý (make-up carousel) cạnh điểm dừng dỡ hàng của đoàn xe ── */
      {
        const stad = (L, W) => {
          const s = new THREE.Shape(), hl = L / 2 - W / 2, hw = W / 2;
          s.moveTo(-hl, -hw); s.lineTo(hl, -hw); s.absarc(hl, 0, hw, -Math.PI / 2, Math.PI / 2, false);
          s.lineTo(-hl, hw); s.absarc(-hl, 0, hw, Math.PI / 2, Math.PI * 1.5, false); return s;
        };
        const ring = (Lo, Wo, Li, Wi, h, y, col, o) => {
          const s = stad(Lo, Wo); s.holes.push(stad(Li, Wi));
          const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 10 });
          g.rotateX(-Math.PI / 2); g.translate(64.5, y, 14.6); tb.add(g, col, o);
        };
        ring(11, 4.2, 9.2, 2.4, 0.5, H0, WHITE, { thresh: 30 });                                     // thân băng chuyền
        ring(10.7, 3.9, 9.5, 2.7, 0.04, H0 + 0.5, DARK, { noEdge: true });                          // mặt băng tải
      }

      /* ── sàn tầng khởi hành (Bag riêng — mờ hơn, để nhìn xuyên xuống sảnh hành lý) ── */
      fb.P(X1 - X0, FL - FB, LZ, (X0 + X1) / 2, (FB + FL) / 2, ZM, WHITE, {});

      /* ── tầng khởi hành: vách kính 2 mặt dài + 2 đầu hồi uốn theo mặt dưới mái · đố đứng · đố ngang ── */
      const hA = yU(X0) - FL, hLs = yU(X1) - FL;
      // mặt dựng kính 2 mặt dài: mô-đun 3 m (54 ô), đố thường mảnh · TRỤ LỚN ở trục lưới kết cấu (mỗi 6 mô-đun) · đố ngang ~2.9 m
      const NMOD = 54, zMod = (i) => Z0 + 0.15 + i * (LZ - 0.3) / NMOD;
      const facade = (x, h, ys) => {
        glassBox(0.05, h, LZ - 0.3, x, FL + h / 2, ZM);
        for (let i = 0; i <= NMOD; i++) { const big = i % 6 === 0; tb.P(big ? 0.26 : 0.09, h, big ? 0.2 : 0.07, x, FL + h / 2, zMod(i), WHITE, { soft: !big }); }
        for (const y of ys) tb.P(0.16, 0.09, LZ - 0.3, x, y, ZM, WHITE, { soft: true });
      };
      facade(X0, hA, [FL + 0.08, 3.8, 5.25, 6.7, 8.15, yU(X0) - 0.08]);
      facade(X1, hLs, [FL + 0.08, 3.8, 5.25, 6.7, yU(X1) - 0.08]);
      // lam chắn nắng ngang (brise-soleil) ngoài mặt kính phía sân đỗ: 2 tầng × 3 lá nghiêng, treo trên tay đỡ ở mỗi trụ lớn
      for (const y0 of [5.25, 8.15]) {
        for (let k = 0; k < 3; k++) tb.P(0.6, 0.035, LZ - 0.3, X0 - 0.5, y0 - 0.1 - k * 0.17, ZM, WHITE, { soft: true, rz: -0.3 });
        for (let i = 0; i <= NMOD; i += 6) tb.P(0.85, 0.05, 0.05, X0 - 0.42, y0 - 0.27, zMod(i), WHITE, { soft: true });
      }
      for (const z of [Z0 + 0.05, Z1 - 0.05]) {
        const s = new THREE.Shape(); s.moveTo(X0, FL); s.lineTo(X1, FL);
        for (let i = 0; i <= 24; i++) { const x = X1 - (X1 - X0) * i / 24; s.lineTo(x, yU(x)); }
        glass(new THREE.ShapeGeometry(s).translate(0, 0, z));
        for (let x = X0 + 2.95; x < X1 - 1; x += 2.95) tb.P(0.12, yU(x) - FL, 0.14, x, (FL + yU(x)) / 2, z, WHITE, { soft: true });
        tb.P(X1 - X0, 0.14, 0.18, (X0 + X1) / 2, 4.65, z, WHITE, { soft: true });
      }

      /* ── mái vòm: extrude tiết diện lưỡi liềm dọc z; pháp tuyến gán lại theo độ dốc ⇒ đổ sáng mượt, không lộ 28 vạt ── */
      const rs = new THREE.Shape(), NRF = 28;
      for (let i = 0; i <= NRF; i++) { const x = RX0 + (RX1 - RX0) * i / NRF; if (i) rs.lineTo(x, yR(x)); else rs.moveTo(x, yR(x)); }
      for (let i = NRF; i >= 0; i--) { const x = RX0 + (RX1 - RX0) * i / NRF; rs.lineTo(x, yU(x)); }
      const rg = new THREE.ExtrudeGeometry(rs, { depth: LZ + 2 * ROV, bevelEnabled: false });
      rg.translate(0, 0, Z0 - ROV);
      {
        const p = rg.attributes.position, n = rg.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          if (Math.abs(n.getZ(i)) > 0.5 || Math.abs(n.getX(i)) > 0.95) continue;    // mặt hồi & dải fascia: giữ pháp tuyến phẳng
          const x = p.getX(i), sl = (yR(x + 0.01) - yR(x - 0.01)) / 0.02;
          const up = Math.abs(p.getY(i) - yR(x)) < Math.abs(p.getY(i) - yU(x)) ? 1 : -1, L = Math.hypot(sl, 1);
          n.setXYZ(i, -sl / L * up, up / L, 0);
        }
      }
      rf.add(rg, WHITE, { thresh: 12 });
      // giếng trời dọc đỉnh mái: 2 vách kính + đố + nắp + 2 đầu bịt
      const KX0 = 66.6, KX1 = 68.9, KXC = (KX0 + KX1) / 2, KZ0 = Z0 + 3, KZ1 = Z1 - 3, KL = KZ1 - KZ0, KY = 10.5;
      for (const x of [KX0, KX1]) {
        glassBox(0.05, 0.6, KL, x, KY + 0.3, (KZ0 + KZ1) / 2);
        for (let i = 0; i <= 36; i++) tb.P(0.08, 0.64, 0.08, x, KY + 0.3, KZ0 + i * KL / 36, WHITE, { soft: true });
      }
      rf.P(KX1 - KX0 + 0.3, 0.14, KL + 0.3, KXC, KY + 0.67, (KZ0 + KZ1) / 2, WHITE, {});
      for (const z of [KZ0, KZ1]) rf.P(KX1 - KX0, 0.6, 0.1, KXC, KY + 0.3, z, WHITE, { soft: true });
      // gân mái mỗi ~4.1 dọc z (chừa đoạn dưới giếng trời) — dải "mực" phẳng bám mặt mái, KHÔNG dùng GL line:
      // hairline 1 px vật lý (dpr 2 ⇒ ½ px CSS) gần như biến mất trên mái mờ (cùng lý do với panel line cánh máy bay)
      const ribs = [], RW = 0.035;
      for (let j = 0; j <= 20; j++) {
        const z = Z0 - ROV + 0.6 + j * (LZ + 2 * ROV - 1.2) / 20;
        for (let i = 0; i < NRF; i++) {
          const xa = RX0 + (RX1 - RX0) * i / NRF, xb = RX0 + (RX1 - RX0) * (i + 1) / NRF;
          if (xb > KX0 - 0.1 && xa < KX1 + 0.1 && z > KZ0 && z < KZ1) continue;
          const ya = yR(xa) + 0.02, yb = yR(xb) + 0.02;
          ribs.push(xa, ya, z - RW, xb, yb, z - RW, xb, yb, z + RW, xa, ya, z - RW, xb, yb, z + RW, xa, ya, z + RW);
        }
      }
      /* ── KẾT CẤU ── lưới 9 ô dọc nhà ga · trục A (mặt dựng sân đỗ) · B, C (hàng cột giữa) · D (mặt dựng đường bộ) ── */
      const sb = Bag(), STEEL = 0xb9c0c7;                                 // khung kết cấu thép sơn xám nhạt: đục hơn vỏ kính để đọc rõ qua kính & mái
      const ZG = Array.from({ length: 10 }, (_, k) => Z0 + k * LZ / 9), XB = 64, XC = 74;
      const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
      const tD = (x) => 0.3 + 0.95 * sm((x - RX0) / (X0 + 1.5 - RX0)) * sm((RX1 - x) / (RX1 - (X1 - 1.5)));   // cao dàn: 1.25 (2.5 m) → 0.3 ở mút
      const yBC = (x) => yU(x) - tD(x);                                   // cao độ biên dưới dàn
      const mem = (ax, ay, bx, by, z, t, col, o = {}) => {                // thanh thẳng trong mặt phẳng x–y tại z (nối dài ½ tiết diện để khép mắt)
        const L = Math.hypot(bx - ax, by - ay);
        sb.P(L + 0.6 * t, t, t, (ax + bx) / 2, (ay + by) / 2, z, col, Object.assign({ rz: Math.atan2(by - ay, bx - ax) }, o));
      };
      // (a) 10 dàn mái Warren cong: biên trên bám mặt dưới mái, biên dưới song song cách tD(x); mắt dàn ~1.6 (3.2 m)
      const NPAN = 23, xT = (i) => RX0 + 0.25 + (RX1 - RX0 - 0.5) * i / NPAN;
      for (const z of ZG) {
        for (let i = 0; i < NPAN; i++) {
          const xa = xT(i), xb = xT(i + 1), xm = (xa + xb) / 2, xn = i < NPAN - 1 ? (xb + xT(i + 2)) / 2 : null;
          mem(xa, yU(xa) - 0.08, xb, yU(xb) - 0.08, z, 0.16, STEEL);                       // biên trên
          mem(xa, yU(xa) - 0.08, xm, yBC(xm), z, 0.08, STEEL);                             // thanh xiên ↘
          mem(xm, yBC(xm), xb, yU(xb) - 0.08, z, 0.08, STEEL);                             // thanh xiên ↗
          if (xn !== null) mem(xm, yBC(xm), xn, yBC(xn), z, 0.13, STEEL);                  // biên dưới
        }
      }
      // (b) cột cây trục B, C: thân thuôn Ø 0.8 m → 0.64 m · rẽ chữ V lên biên dưới dàn ±1.6 · dầm dọc nối các dàn ở biên dưới
      for (const x of [XB, XC]) {
        const yb = yBC(x) - 2.2, h = yb - FL;
        for (const z of ZG) {
          sb.C(0.2, h, x, FL + h / 2, z, STEEL, { r2: 0.16, seg: 12 });
          for (const s of [-1, 1]) mem(x, yb, x + s * 1.6, yBC(x + s * 1.6), z, 0.13, STEEL);
          sb.C(0.24, 0.12, x, FL + 0.06, z, STEEL, { seg: 12 });                           // đế cột trên sàn khởi hành
        }
        sb.P(0.15, 0.15, LZ, x, yBC(x), ZM, STEEL, {});                                     // dầm dọc nối dàn
      }
      // (c) thanh chống mái đua phía sân đỗ: trong ĐÚNG mặt dàn, chân ở mép sàn khởi hành (trục A), đầu đỡ biên dưới gần mút
      for (const z of ZG) {
        if (Math.abs(z - R0.z) < 3) continue;                                               // chừa hành lang ống lồng
        mem(X0 - 0.15, FL + 0.05, RX0 + 1.4, yBC(RX0 + 1.4), z, 0.2, STEEL);
      }
      // (d) tầng sân đỗ: cột BTCT 0.84 m ở mọi giao điểm lưới (trục A lùi sau tường bệ; chừa ô cửa sảnh hành lý)
      for (const z of ZG) for (const x of [XW + 0.45, XB, XC, X1 - 0.5]) {
        if (x < 60 && z > 17.0 && z < 26.2) continue;
        sb.P(0.42, FB - H0, 0.42, x, (H0 + FB) / 2, z, CREAM, {});
      }
      // (e) máng xối 2 mép mái (thép, hộp 0.7 × 0.4 m) chạy suốt chiều dài mái
      for (const x of [RX0 + 0.2, RX1 - 0.2]) sb.P(0.35, 0.2, LZ + 2 * ROV - 0.2, x, yR(x) - 0.02, ZM, WHITE, { soft: true });

      /* ── nội thất gợi ý (nhìn xuyên kính): hàng ghế phòng chờ cửa A1 · quầy cửa (cột cây đã thành kết cấu thật ở trên) ── */
      for (const x of [58.7, 60.1, 61.5]) for (const [z0, z1] of [[-24, -16.5], [-9.0, -3.0]]) {
        const zc = (z0 + z1) / 2, L = z1 - z0;
        tb.P(0.55, 0.42, L, x, FL + 0.21, zc, PAINT, { soft: true });
        tb.P(0.12, 0.42, L, x + 0.27, FL + 0.55, zc, PAINT, { soft: true });
      }
      tb.P(0.7, 1.05, 2.2, 58.0, FL + 0.53, -10.4, WHITE, {});
      tb.P(0.05, 0.42, 0.7, 57.62, FL + 1.25, -10.4, DARK, {});

      /* ── thang thoát hiểm thép ngoài trời ở 2 đầu hồi (tầng khởi hành → sân): chiếu nghỉ cửa · 2 vế 12 bậc · chiếu nghỉ giữa ·
            dầm thang · tay vịn · cột (bậc 18 × 28 cm, rộng 1.2 m) ── */
      {
        const st = Bag(), RS = (FL - H0) / 24, TR = 0.14, W2 = 0.6, SX = 78.2;
        for (const [zw, dz] of [[Z0, -1], [Z1, 1]]) {
          const zA = zw + dz * 0.75, zB = zw + dz * 1.55, xTop = SX, xMid = SX + 12 * TR + 0.7;   // vế 1 (sát tường) · vế 2 (ngoài)
          st.P(1.3, 0.06, 1.7, xTop - 0.45, FL - 0.03, zw + dz * 1.15, MID, {});                 // chiếu nghỉ cửa
          st.P(0.75, 0.06, 1.7, xMid + 0.1, FL - 0.03 - 12 * RS, zw + dz * 1.15, MID, {});        // chiếu nghỉ giữa
          for (const [zc, x0, x1, y0] of [[zA, xTop + 0.2, xMid - 0.25, FL], [zB, xMid - 0.25, xTop + 0.2, FL - 12 * RS]]) {
            const dir = Math.sign(x1 - x0);
            for (let i = 0; i < 12; i++) st.P(TR + 0.02, 0.035, W2 - 0.08, x0 + dir * (i + 0.5) * TR, y0 - (i + 1) * RS, zc, MID, { soft: true });
            for (const e of [-1, 1]) {                                                               // 2 dầm thang + tay vịn trên con tiện
              const ya = y0, yb = y0 - 12 * RS, L = Math.hypot(x1 - x0, yb - ya), rz = Math.atan2(yb - ya, x1 - x0), ze = zc + e * W2 / 2;
              st.P(L, 0.1, 0.04, (x0 + x1) / 2, (ya + yb) / 2 - 0.05, ze, DARK, { rz });
              st.P(L, 0.03, 0.03, (x0 + x1) / 2, (ya + yb) / 2 + 0.47, ze, DARK, { rz, noEdge: true });
              for (const t of [0.04, 0.36, 0.68, 0.96]) st.P(0.025, 0.47, 0.025, x0 + (x1 - x0) * t, ya + (yb - ya) * t + 0.235, ze, DARK, { noEdge: true });
            }
          }
          for (const [x, y, z] of [[xMid + 0.4, FL - 12 * RS, zA], [xMid + 0.4, FL - 12 * RS, zB], [xTop - 1.0, FL, zw + dz * 1.15]])   // cột thép
            st.P(0.08, y - H0, 0.08, x, H0 + (y - H0) / 2, z, DARK, {});
          for (const [xr, yr, zr, lx, lz] of [[xTop - 1.08, FL, zw + dz * 1.15, 0.03, 1.7], [xTop - 0.45, FL, zw + dz * 2.0, 1.3, 0.03], [xMid + 0.46, FL - 12 * RS, zw + dz * 1.15, 0.03, 1.7]]) {   // lan can ống thép quanh 2 chiếu nghỉ
            for (const hy of [0.5, 0.25]) st.P(lx, 0.03, lz, xr, yr + hy, zr, DARK, { noEdge: true });
            for (const t of [-0.45, 0, 0.45]) st.P(0.025, 0.5, 0.025, xr + (lx > 0.1 ? lx * t : 0), yr + 0.25, zr + (lz > 0.1 ? lz * t : 0), DARK, { noEdge: true });
          }
        }
        const SG2 = st.build({ receive: true }); scene.add(SG2);
      }

      /* ── landside: mái đón trả khách dọc lề + cửa kính sảnh đến ── */
      tb.P(3.4, 0.16, 68, 87.7, 3.3, -4, WHITE, {});
      for (let z = -36; z <= 28 + 1e-6; z += 8) tb.C(0.11, 3.08, 89.0, H0 + 1.54, z, MID, { seg: 8 });
      for (const z of [-26, -10, 6, 22]) tb.P(0.06, 1.55, 3.0, X1 + 0.03, H0 + 0.78, z, GLASS, { soft: true });

      /* ── cầu đi bộ sang concourse phía nam (trên cột) — cùng ngôn ngữ hành lang ống lồng ── */
      const AX = 60, AZ0 = Z1, AZ1 = 66, AL = AZ1 - AZ0, AZC = (AZ0 + AZ1) / 2;
      tb.P(3.2, 3.2, AL, AX, FL + 1.6, AZC, CREAM, {});
      tb.P(3.44, 0.22, AL, AX, FL + 3.31, AZC, WHITE, { soft: true });
      tb.P(3.3, 0.3, AL, AX, FL - 0.15, AZC, MID, { soft: true });
      for (const s of [-1, 1]) {
        tb.P(0.06, 1.1, AL - 0.6, AX + s * 1.62, FL + 2.1, AZC, GLASS, { noEdge: true });
        for (let z = AZ0 + 0.4; z <= AZ1 - 0.3; z += 1.6) tb.P(0.08, 1.16, 0.09, AX + s * 1.64, FL + 2.1, z, WHITE, { soft: true });
      }
      for (const z of [46, 54, 62]) {
        tb.C(0.3, FL - 0.52 - H0, AX, H0 + (FL - 0.52 - H0) / 2, z, MID, { seg: 12 });
        tb.P(2.2, 0.22, 0.9, AX, FL - 0.41, z, MID, { soft: true });
      }

      /* ── dựng + làm "bóng ma": clone vật liệu, trong suốt, TẮT depthWrite ── */
      const ghost = (o, op) => o.traverse(m => {
        if (!m.material) return;
        const k = m.isLineSegments ? m.material.opacity * 0.85 : op;
        m.material = m.material.clone(); Object.assign(m.material, { transparent: true, opacity: k, depthWrite: false });
      });
      const TG = tb.build({ receive: true }); ghost(TG, 0.55);
      // khung kết cấu vẽ SAU mái (kiểu X-quang như thân máy bay trong suốt): đọc được dàn mái cả khi nhìn từ trên cao
      const SG = sb.build({ receive: true }); ghost(SG, 0.6); SG.renderOrder = 4;
      const FG = fb.build({ receive: true }); ghost(FG, 0.3);
      // mái đục hơn phần còn lại (0.74) ⇒ đọc ra MỘT tấm mái cong liền khối, gân mái nét đậm hơn để lộ độ cong
      const RG = rf.build({ receive: true }); ghost(RG, 0.74);
      const rbG = new THREE.BufferGeometry(); rbG.setAttribute('position', new THREE.Float32BufferAttribute(ribs, 3)); rbG.computeVertexNormals();
      RG.add(new THREE.Mesh(rbG, new THREE.MeshBasicMaterial({ color: 0x4a3728, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })));
      // trong nhóm mái, gân & nét viền phải vẽ SAU mặt mái — tâm bao của chúng gần trùng nhau nên thứ tự sort là ngẫu nhiên
      for (const m of RG.children) if (m.isLineSegments || m.material.isMeshBasicMaterial) m.renderOrder = 1;
      RG.renderOrder = 3;                                                 // vẽ SAU cùng: mái phủ mờ lên nội thất bên dưới (không thì cột vẽ đè lên mái)
      const GL = new THREE.Mesh(mergeGeometries(glG), new THREE.MeshLambertMaterial({ color: 0x9fb4be, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide }));
      GL.renderOrder = 1;
      scene.add(TG, SG, FG, RG, GL);

      // biển số cửa "A1" trên vách kính, ngay trên chỗ hành lang ống lồng vào nhà ga
      {
        const c = document.createElement('canvas'); c.width = 256; c.height = 112;
        const x = c.getContext('2d');
        x.fillStyle = '#3a342c'; x.fillRect(0, 0, 256, 112);
        x.fillStyle = '#f3efe0'; x.font = '800 80px "Helvetica Neue", Arial, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('A1', 128, 60);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.14), new THREE.MeshBasicMaterial({ map: t }));
        m.rotation.y = -Math.PI / 2; m.position.set(X0 - 0.22, 6.6, R0.z); scene.add(m);
      }
    })();



