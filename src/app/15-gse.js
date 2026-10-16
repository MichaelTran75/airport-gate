    const GSE_X = {};                                                                 // ống/cáp nối máy bay (chuỗi khởi hành tháo ra)
    /* ═══ 06-GSE — đội xe mặt đất (mỗi xe 1 bag ≈ 4 draw calls) ═══ */
    // Xe kéo (tug) — reconstruct theo ảnh 4-view low-poly: mui vát facet nhiều mặt + cabin cao kính nghiêng.
    // Dựng bằng hull 8 đỉnh (loft 2 tiết diện, tự lật mặt theo pháp tuyến) thay cho hộp vuông.
    function tug() {
      const b = Bag();
      // hull 8 đỉnh: V[0..3] vòng A, V[4..7] vòng B tương ứng — mặt nào ngược pháp tuyến thì tự đảo winding
      const hull = (V, color, opt = {}) => {
        const cx = V.reduce((s, v) => s + v[0], 0) / 8, cy = V.reduce((s, v) => s + v[1], 0) / 8, cz = V.reduce((s, v) => s + v[2], 0) / 8;
        const quads = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
        const tris = [];
        for (const q of quads) {
          const [A, B, C, D] = q.map(i => V[i]);
          const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
          const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const fx = (A[0] + B[0] + C[0] + D[0]) / 4 - cx, fy = (A[1] + B[1] + C[1] + D[1]) / 4 - cy, fz = (A[2] + B[2] + C[2] + D[2]) / 4 - cz;
          const o = (nx * fx + ny * fy + nz * fz > 0) ? [A, B, C, A, C, D] : [A, D, C, A, C, B];
          for (const p of o) tris.push(p[0], p[1], p[2]);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
        g.computeVertexNormals();
        b.add(g, color, Object.assign({ thresh: 10 }, opt));
      };
      const loftX = (x0, b0, t0, w0, x1, b1, t1, w1, color) => hull([  // lăng trụ dọc X: tiết diện (đáy,đỉnh,nửa rộng)
        [x0, b0, -w0], [x0, b0, w0], [x0, t0, w0], [x0, t0, -w0],
        [x1, b1, -w1], [x1, b1, w1], [x1, t1, w1], [x1, t1, -w1]], color);

      /* ── thân dưới / váy hông ── */
      loftX(-1.75, 0.3, 0.86, 0.78, 1.5, 0.3, 0.82, 0.78, WHITE);
      /* ── mui vát 2 đoạn (crease giữa mui như bản vẽ) ── */
      loftX(-0.05, 0.82, 1.34, 0.8, 0.95, 0.82, 1.24, 0.78, WHITE);
      loftX(0.95, 0.82, 1.24, 0.78, 1.56, 0.8, 1.02, 0.68, WHITE);
      /* ── cabin cao — hull thẳng đứng: đáy dài, đỉnh ngắn → kính trước NGHIÊNG + hông thu vào ── */
      hull([
        [-1.7, 0.86, -0.84], [0.1, 0.86, -0.84], [0.1, 0.86, 0.84], [-1.7, 0.86, 0.84],
        [-1.66, 2.32, -0.7], [-0.48, 2.32, -0.7], [-0.48, 2.32, 0.7], [-1.66, 2.32, 0.7]], WHITE);
      /* ── kính: chắn gió nghiêng + 2 hông (tilt theo taper) + kính sau ── */
      b.P(0.06, 1.35, 1.28, -0.155, 1.59, 0, GLASS, { rz: 0.378, noEdge: true });
      for (const s of [-1, 1]) b.P(1.0, 0.82, 0.06, -0.95, 1.68, s * 0.775, GLASS, { rx: -s * 0.096, noEdge: true });
      b.P(0.06, 0.75, 1.15, -1.71, 1.8, 0, GLASS, { noEdge: true });
      /* ── nóc + đèn hiệu ── */
      b.P(1.34, 0.12, 1.52, -1.07, 2.4, 0, WHITE, { soft: true });
      b.P(0.36, 0.14, 0.5, -0.9, 2.53, 0, WHITE, {});
      b.C(0.09, 0.2, -0.9, 2.7, 0, ORANGE_GLOW, { axis: 'y', seg: 8 });
      /* ── mặt trước: khe grille + đèn + cản có hốc gió + 2 trụ góc mui ── */
      b.P(0.06, 0.16, 0.92, 1.585, 1.0, 0, DARK, {});
      for (const s of [-1, 1]) b.P(0.07, 0.12, 0.2, 1.585, 0.78, s * 0.5, PAINT, {});
      b.P(0.12, 0.3, 1.62, 1.6, 0.52, 0, MID, { soft: true });
      b.P(0.05, 0.13, 0.85, 1.665, 0.5, 0, DARK, {});
      for (const s of [-1, 1]) b.P(0.1, 0.22, 0.1, 1.38, 1.2, s * 0.6, WHITE, {});   // trụ góc tì lên mặt mui
      /* ── gương 2 bên trụ A (bám vào vách hông cabin) ── */
      for (const s of [-1, 1]) { b.P(0.05, 0.2, 0.16, -0.3, 1.95, s * 0.8, DARK, {}); b.P(0.1, 0.26, 0.07, -0.32, 1.93, s * 0.9, MID, { soft: true }); }
      /* ── đối trọng sau + móc kéo trước/sau (giữ khớp nối với dolly) ── */
      b.P(0.36, 0.66, 1.36, -1.8, 0.72, 0, WHITE, { soft: true });
      b.P(0.3, 0.15, 0.3, 1.72, 0.45, 0, PAINT, {});
      b.P(0.3, 0.15, 0.3, -1.92, 0.45, 0, PAINT, {});
      /* ── bánh chuẩn + mép vòm ── */
      for (const wx of [0.9, -1.0]) for (const s of [-1, 1]) stdWheel(b, wx, s * 0.95, 0.42);
      for (const wx of [0.9, -1.0]) for (const s of [-1, 1]) b.P(1.1, 0.14, 0.16, wx, 0.9, s * 0.87, WHITE, { soft: true });
      return b.build();
    }
    // Cargo Loader (main-deck loader) — dựng theo ảnh kỹ thuật side-view:
    // khung gầm dầm HỞ + bánh lái lớn trong hốc + bánh xoay 2 đầu · 2 cụm scissor X độc lập ·
    // deck chính chở ULD (mặt chia ô panel) · deck trước có LỒNG LAN CAN + ghế + vô lăng · dốc gập · cột mast · thang leo.
    // Local: +x = hướng máy bay (dốc gập + trạm lái); ULD/deck chính ở -x.
    // Xe nâng hàng CỠ THẬT: scale 0.39 ⇒ dài tổng 10.1 m · rộng 2.8 m (TLD-828 Wide 9.3 × 2.97 m · JBT Commander 15iS 8.69 × 3.75 m;
    // bản 0.4445 dài 11.5 m). Sàn chính/sàn trước
    // ở cao độ LOADER_DECK (local) = ngưỡng cửa hầm hàng trước (gy(−1.23)·1.1 ≈ 1.879 world) + 0.05.
    const LOADER_S = 0.39, LOADER_DECK = (gy(-1.23) * 1.1 + 0.05 - 0.12) / LOADER_S;   // 0.12 = VY (mặt sân; VY khai báo sau)
    function cargoLoader() {
      const bBase = Bag();
      const beamY = 0.22;
      const beam = (targetB, x1, y1, x2, y2, z, w, color, thick) => {
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        targetB.P(L, thick, w, (x1 + x2) / 2, (y1 + y2) / 2, z, color, { rz: a, soft: true });
      };
      const wheel = (x, z, R) => stdWheel(bBase, x, z, R);

      /* ══ KHUNG GẦM DẦM TẤT CẢ CÁC BÁNH XE (Tấm nền gầm dày 0.135) ══ */
      bBase.P(10.7, 0.135, 2.3, -0.35, beamY + 0.01, 0, CREAM, { soft: true });
      bBase.P(3.3, 0.619, 1.8, 2.65, 0.616, 0, MID, { soft: true });
      for (const s of [-0.4, 0.4]) bBase.C(0.08, 2.4, 2.65, 0.616, s, DARK, { axis: 'x', seg: 8 });

      /* ══ BÁNH XE: Bánh lái lớn thu nhỏ 20% (0.396), bánh nhỏ 0.11 (-4.24, -1.76, 4.0) ══ */
      for (const s of [-1, 1]) wheel(2.1, s * 1.0, 0.396);
      for (const ax of [-4.24, -1.76, 4.0]) for (const s of [-1, 1]) wheel(ax, s * 1.0, 0.11);

      /* ══ KHUNG SCISSOR TRƯỚC (TĨNH - Hạ chân 10%) ══ */
      const yT = LOADER_DECK;
      const scissor = (targetB, xC, reach, zH, thick, yB) => {
        for (const z of [-zH, zH]) {
          beam(targetB, xC - reach, yB, xC + reach, yT, z, 0.13, WHITE, thick);
          beam(targetB, xC + reach, yB, xC - reach, yT, z, 0.13, WHITE, thick);
        }
        targetB.C(0.075, zH * 2 + 0.2, xC, (yB + yT) / 2, 0, MID, { axis: 'z', seg: 12 });
        for (const px of [xC - reach, xC + reach]) {
          targetB.C(0.06, zH * 2 + 0.2, px, yB, 0, MID, { axis: 'z', seg: 10 });
          targetB.C(0.06, zH * 2 + 0.2, px, yT, 0, MID, { axis: 'z', seg: 10 });
        }
        targetB.P(0.12, 0.12, zH * 2, xC, yT, 0, MID, { soft: true });
      };
      scissor(bBase, 2.7, 1.45, 0.85, 0.15, beamY + (1.34 - beamY) * 0.60 + 0.10);

      /* ══ DECK CHÍNH CARGO (-x) ══ */
      const bCargo = Bag();
      const dY = LOADER_DECK;
      bCargo.P(6.32, 0.1, 2.72, -2.54, dY, 0, WHITE, { soft: true });
      bCargo.P(6.38, 0.04, 2.78, -2.54, dY - 0.07, 0, MID, { soft: true });
      for (let i = 0; i < 11; i++) bCargo.C(0.0275, 2.5, -5.5 + i * 0.58, dY + 0.05, 0, MID, { axis: 'z', seg: 8 });

      /* ══ ULD CONTAINER — LD3 (AKE) cỡ thật 2.0 × 1.63 × 1.53 m, cùng hàm ld3 với container dưới sân; bề rộng 2.0 m nằm
         NGANG sàn (song song thân máy bay) như khi chui ra cửa hầm hàng 2.64 m ══ */
      const bULD = Bag();
      ld3(bULD, 0, dY + 0.06, 0, Math.PI / 2, 0.9966 / (2.05 * LOADER_S));
      const uldGroup = new THREE.Group();
      uldGroup.add(bULD.build());
      uldGroup.position.x = -3.0;

      /* ══ DECK TRƯỚC (+x) ══ */
      bBase.P(6.37, 0.1, 2.72, 3.935, dY, 0, WHITE, { soft: true });
      bBase.P(6.43, 0.04, 2.78, 3.935, dY - 0.07, 0, MID, { soft: true });
      for (let i = 0; i < 10; i++) bBase.C(0.0275, 2.5, 1.15 + i * 0.6, dY + 0.10, 0, MID, { axis: 'z', seg: 8 });
      for (const s of [-1, 1]) for (const px of [1.15, 5.50]) bBase.P(0.075, 1.15, 0.075, px, dY + 0.1 + 0.575, s * 1.3, MID, {});

      const oW = 1.50, oD = 0.88, oY = dY + 0.05;
      const cX = 3.25, cZ = 1.74, cY = dY + 0.15;
      const stairX = 1.50;

      for (const yy of [dY + 0.1 + 1.15, dY + 0.1 + 0.63]) {
        bBase.P(0.65, 0.06, 0.06, 2.175, yy, 1.3, MID, {});
        bBase.P(1.50, 0.06, 0.06, 4.750, yy, 1.3, MID, {});
        bBase.P(4.35, 0.06, 0.06, 3.325, yy, -1.3, MID, {});
      }

      /* ══ BỆ ĐIỀU KHIỂN LÁI (Control Pedestal) ══ */
      const pedGeom = new THREE.CylinderGeometry(0.38, 0.22, 1.05, 6);
      const posAttr = pedGeom.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
        x *= 1.25; z *= 0.95;
        if (y > 0.2) y -= (x + 0.3) * 0.22;
        posAttr.setXYZ(i, x, y, z);
      }
      const PS = 0.7;
      pedGeom.scale(PS, 1, PS);
      pedGeom.computeVertexNormals();
      pedGeom.rotateY(Math.PI);
      pedGeom.translate(cX, cY + 0.55, cZ);
      bBase.add(pedGeom, CREAM, { thresh: 20 });

      const baseHex = new THREE.CylinderGeometry(0.25, 0.28, 0.08, 6);
      baseHex.scale(1.25 * PS, 1, 0.95 * PS);
      baseHex.rotateY(Math.PI);
      baseHex.translate(cX, cY + 0.04, cZ);
      bBase.add(baseHex, MID, { thresh: 20 });

      bBase.P(0.04, 0.36, 0.26 * PS, cX, cY + 0.52, cZ - 0.21 * PS, MID, { soft: true });
      bBase.P(0.06, 0.06, 0.04, cX - 0.12 * PS, cY + 0.62, cZ - 0.22 * PS, DARK, {});
      bBase.P(0.06, 0.06, 0.04, cX - 0.12 * PS, cY + 0.42, cZ - 0.22 * PS, DARK, {});
      bBase.P(0.04, 0.12, 0.04, cX + 0.12 * PS, cY + 0.52, cZ - 0.22 * PS, DARK, {});

      bBase.C(0.05, 0.18, cX + 0.12, cY + 1.15, cZ - 0.05, MID, { axis: 'y', seg: 8 });
      const swRing = new THREE.TorusGeometry(0.18, 0.026, 8, 18);
      swRing.rotateY(-Math.PI / 2); swRing.rotateZ(-0.65);
      swRing.translate(cX + 0.12, cY + 1.25, cZ - 0.05);
      bBase.add(swRing, DARK, { thresh: 24 });
      bBase.C(0.06, 0.05, cX + 0.12, cY + 1.25, cZ - 0.05, MID, { axis: 'y', seg: 10 });
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + 0.3;
        bBase.P(0.15, 0.025, 0.025, cX + 0.12 - 0.08 * Math.cos(a), cY + 1.25 + 0.04 * Math.sin(a), cZ - 0.05 + 0.08 * Math.sin(a), MID, { rz: a });
      }

      bBase.C(0.05, 0.10, cX - 0.12, cY + 1.16, cZ + 0.12, DARK, { axis: 'y', seg: 10 });
      bBase.C(0.06, 0.04, cX - 0.12, cY + 1.22, cZ + 0.12, CREAM, { axis: 'y', seg: 10 });
      bBase.C(0.045, 0.08, cX - 0.14, cY + 1.14, cZ - 0.12, DARK, { axis: 'y', seg: 10 });
      bBase.C(0.04, 0.07, cX + 0.15, cY + 1.12, cZ + 0.14, 0xdd2222, { axis: 'y', seg: 8 });
      bBase.P(0.12, 0.02, 0.18, cX - 0.02, cY + 1.09, cZ - 0.08, DARK, { soft: true });

      /* ══ SÀN CON-XON ĐỠ TRẠM LÁI ══ */
      bBase.P(oW, 0.09, oD, cX, oY, cZ, WHITE, { soft: true });
      bBase.P(oW + 0.08, 0.05, oD + 0.08, cX, oY - 0.07, cZ, MID, { soft: true });
      for (const px of [cX - 0.60, cX + 0.60]) bBase.P(0.10, 0.10, 1.073, px, dY - 0.30, 1.625, MID, { rx: -0.4844, soft: true });
      bBase.P(oW, 0.10, 0.10, cX, dY - 0.05, cZ + oD / 2 - 0.05, MID, { soft: true });

      const oZo = cZ + oD / 2 - 0.07, oZi = cZ - oD / 2 + 0.07;
      for (const px of [cX - oW / 2 + 0.07, cX + oW / 2 - 0.07]) {
        bBase.P(0.075, 1.12, 0.075, px, oY + 0.60, oZo, MID, {});
        bBase.P(0.075, 1.12, 0.075, px, oY + 0.60, oZi, MID, {});
        for (const yy of [oY + 1.12, oY + 0.66]) bBase.P(0.06, 0.06, oD - 0.14, px, yy, cZ, MID, {});
      }
      for (const yy of [oY + 1.12, oY + 0.66]) bBase.P(oW - 0.14, 0.06, 0.06, cX, yy, oZo, MID, {});

      /* ══ THANG LEO ĐỨNG ĐỘC LẬP ══ */
      const LX0 = stairX - 0.31, LX1 = stairX + 0.31, LZ = 1.43, LTOP = oY + 0.12, LBOT = 0.18;
      for (const lx of [LX0, LX1]) { bBase.P(0.09, LTOP - LBOT, 0.09, lx, (LTOP + LBOT) / 2, LZ, MID, { soft: true }); bBase.P(0.09, 1.00, 0.09, lx, LTOP + 0.50, LZ, MID, { soft: true }); }
      for (let i = 0; i < 10; i++) bBase.P(LX1 - LX0, 0.05, 0.06, stairX, LBOT + 0.16 + i * (LTOP - LBOT - 0.32) / 9, LZ, MID, {});
      bBase.P(LX1 - LX0 + 0.16, 0.08, 0.30, stairX, oY + 0.06, LZ - 0.14, MID, { soft: true });

      /* ══ SCISSOR X ĐỘNG HỌC THẬT (ANIMATABLE REAR SCISSOR LIFT) ══ */
      const SC = { xC: -2.175, zH: 0.95, yB: 0.405, thick: 0.17, w: 0.13 };
      SC.L = Math.hypot(2 * 2.25, 3.222 - SC.yB);
      const eBox = (w, h, d, color) => { const g = new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(g, M(color)); m.castShadow = true; m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), LINE)); return m; };
      const ePin = (r, len, color) => { const g = new THREE.CylinderGeometry(r, r, len, 12); g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, M(color)); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 40), LINE)); return m; };
      const scissorAnim = new THREE.Group();
      const scBeams = [];
      for (const z of [-SC.zH, SC.zH]) for (const sgn of [1, -1]) { const m = eBox(SC.L, SC.thick, SC.w, WHITE); m.position.z = z; scissorAnim.add(m); scBeams.push({ m, z, sgn }); }
      const scCenter = ePin(0.075, SC.zH * 2 + 0.2, MID); scissorAnim.add(scCenter);
      const scBase = [ePin(0.06, SC.zH * 2 + 0.2, MID), ePin(0.06, SC.zH * 2 + 0.2, MID)];
      const scTop = [ePin(0.06, SC.zH * 2 + 0.2, MID), ePin(0.06, SC.zH * 2 + 0.2, MID)];
      [...scBase, ...scTop].forEach(p => scissorAnim.add(p));
      const scFeet = [eBox(0.36, 0.2, 0.28, MID), eBox(0.36, 0.2, 0.28, MID)]; scFeet.forEach(f => scissorAnim.add(f));

      const loaderGroup = new THREE.Group();
      const cargoGroup = new THREE.Group();
      cargoGroup.add(bCargo.build());
      cargoGroup.add(uldGroup);

      loaderGroup.add(bBase.build());
      loaderGroup.add(scissorAnim);
      loaderGroup.add(cargoGroup);
      loaderGroup.userData.lift = { beams: scBeams, center: scCenter, base: scBase, top: scTop, feet: scFeet, SC, deck: cargoGroup, uld: uldGroup, dYHome: LOADER_DECK };
      return loaderGroup;
    }
    /* ══ XE NẠP NHIÊN LIỆU SÀN NÂNG (hydrant dispenser) — CỠ THẬT, đơn vị MÉT (đặt scale đều 0.498 world/m như máy bay):
       xe tải 2 trục dài 7.4 m · rộng 2.45 m · bánh Ø 1.0 m · cabin trước (+x) DÙNG CHUNG cabin cabover của xe bồn
       (fuelTruck(true)) · bảng màu chung của scene · cụm lọc/bơm + cuộn ống giữa xe · khớp nhận nhiên liệu mạn +z · 4 chân
       chống · cụm kéo X + sàn thao tác lan can 1.1 m phía sau · vòi vàng-đen vươn lên van nhiên liệu dưới cánh.
       topM = cao độ đầu súng tra xăng (m, trên mặt sân) — tính từ mặt dưới cánh thật ⇒ sàn thao tác thấp hơn 1.9 m
       (tầm với của người đứng trên sàn). ══ */
    function refueler(topM) {
      const b = Bag();
      const MID = DARK, RED = 0x8a0303, YELLOW = 0xc8a600;              // trắng kem · nâu đậm CỦA SCENE (bản trước trắng xám / đen riêng)

      const beam = (x1, y1, x2, y2, z, w, color, thick) => {
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        b.P(L, thick, w, (x1 + x2) / 2, (y1 + y2) / 2, z, color, { rz: a, soft: true });
      };

      // 1. KHUNG GẦM + 2 trục bánh Ø 1.0 m + chắn bùn
      b.P(7.0, 0.3, 1.1, -0.2, 0.85, 0, MID, { soft: true });                // 2 dầm dọc
      b.P(5.75, 0.12, 2.3, -1.025, 1.06, 0, DARK, { soft: true });           // sàn thép: đuôi → lưng cabin (x 1.85)
      for (const px of [2.25, -2.3]) for (const s of [-1, 1]) stdWheel(b, px, s * 0.98, 0.5, s);
      for (const s of [-1, 1]) b.P(1.2, 0.08, 0.36, -2.3, 1.12, s * 1.06, WHITE, { soft: true });   // chắn bùn sau (trục trước: vòm cabin)

      // 2. CABIN: cabin cabover của xe bồn, gắn cuối hàm (trục trước 6.22 của xe bồn → 2.25)

      // 3. CỤM LỌC / BƠM giữa xe: bình lọc tách nước · tủ đồng hồ · bình chữa cháy đỏ · cuộn ống dưới sàn
      b.C(0.38, 1.3, 1.1, 1.55, 0, CREAM, { axis: 'x', seg: 12 });
      b.P(0.8, 0.9, 0.7, 1.15, 1.6, 0.75, CREAM, { soft: true });
      b.P(0.04, 0.3, 0.4, 1.56, 1.7, 0.75, DARK, {});                        // mặt đồng hồ
      b.P(0.2, 0.5, 0.2, 1.75, 1.4, -1.05, RED, {});
      b.C(0.42, 0.34, 0.2, 1.55, -0.85, DARK, { axis: 'z', seg: 14 });
      b.C(0.5, 0.04, 0.2, 1.55, -0.66, MID, { axis: 'z', seg: 14 });
      b.C(0.5, 0.04, 0.2, 1.55, -1.04, MID, { axis: 'z', seg: 14 });

      // 4 chân chống thủy lực (outriggers) hạ chạm sân khi đang nạp
      for (const px of [1.45, -3.3]) for (const s of [-1, 1]) {                // cặp trước lùi sau lưng cabin (né bậc lên cabin)
        b.P(0.16, 0.6, 0.16, px, 0.55, s * 1.25, MID, { soft: true });
        b.C(0.14, 0.06, px, 0.03, s * 1.25, DARK, { seg: 10 });
      }

      // 4. CỤM KÉO X phía sau: từ sàn khung lên sàn thao tác, mỗi tầng ~0.85 m
      const scX = -1.8, zW = 0.85, yB = 1.15, pY = Math.max(yB + 0.8, topM - 1.9);
      const nS = Math.max(2, Math.round((pY - yB) / 0.85)), hS = (pY - yB) / nS;
      for (let i = 0; i < nS; i++) {
        const y0 = yB + i * hS, y1 = y0 + hS, xl = scX - 0.9, xr = scX + 0.9;
        for (const s of [-zW, zW]) { beam(xl, y0, xr, y1, s, 0.09, WHITE, 0.1); beam(xr, y0, xl, y1, s, 0.09, WHITE, 0.1); }
        b.C(0.05, zW * 2 + 0.12, scX, (y0 + y1) / 2, 0, MID, { axis: 'z', seg: 10 });
        b.P(0.08, 0.08, zW * 2 + 0.12, xl, y0, 0, MID, { soft: true });
        b.P(0.08, 0.08, zW * 2 + 0.12, xr, y0, 0, MID, { soft: true });
      }
      beam(scX - 0.6, yB + 0.15, scX + 0.25, yB + Math.min(1.4, pY - yB - 0.2), 0, 0.11, MID, 0.11);   // ty thủy lực

      // 5. SÀN THAO TÁC 2.6 × 2.2 m + lan can 1.1 m (thanh trên · giữa · tấm chắn chân) + hộp điều khiển
      b.P(2.6, 0.12, 2.2, scX, pY, 0, WHITE, { soft: true });
      b.P(2.66, 0.05, 2.26, scX, pY - 0.08, 0, MID, { soft: true });
      const rH = 1.1, rY = pY + 0.06 + rH / 2;
      for (const s of [-1, 1]) {
        b.P(2.55, 0.04, 0.04, scX, pY + 0.06 + rH, s * 1.08, WHITE, {});
        b.P(2.55, 0.04, 0.04, scX, pY + 0.06 + rH * 0.5, s * 1.08, WHITE, {});
        b.P(2.55, 0.14, 0.04, scX, pY + 0.13, s * 1.08, MID, {});
      }
      for (const sx of [-1.25, 1.25]) {
        b.P(0.04, 0.04, 2.16, scX + sx, pY + 0.06 + rH, 0, WHITE, {});
        b.P(0.04, 0.04, 2.16, scX + sx, pY + 0.06 + rH * 0.5, 0, WHITE, {});
        b.P(0.04, 0.14, 2.16, scX + sx, pY + 0.13, 0, MID, {});
      }
      for (const sx of [-1.25, -0.4, 0.45, 1.25]) for (const sz of [-1.08, 1.08]) b.P(0.04, rH, 0.04, scX + sx, rY, sz, WHITE, {});
      b.P(0.45, 0.5, 0.35, scX + 0.8, pY + 0.31, -0.7, CREAM, { soft: true });
      b.P(0.04, 0.2, 0.2, scX + 0.57, pY + 0.36, -0.7, DARK, {});

      // 6. ỐNG NHIÊN LIỆU: cuộn → lên sàn; vòi vàng-đen từ sàn vươn tới van nhiên liệu dưới cánh (đầu súng chạm topM)
      beam(0.2, 1.55, -0.6, 1.4, -0.85, 0.07, DARK, 0.07);
      beam(-0.6, 1.4, scX + 0.9, pY - 0.25, -0.85, 0.07, DARK, 0.07);
      beam(scX - 0.5, pY + 0.4, scX - 0.8, pY + 1.15, -0.7, 0.08, YELLOW, 0.08);
      beam(scX - 0.8, pY + 1.15, scX - 1.0, topM - 0.3, -0.7, 0.08, DARK, 0.08);
      b.C(0.1, 0.3, scX - 1.0, topM - 0.15, -0.7, MID, { seg: 10 });            // đầu súng tra xăng (aviation coupler)

      // 7. KHỚP NHẬN NHIÊN LIỆU mạn +z (phía xe bồn): ống ngang dưới sàn ra mép · thân khớp nối cạn quay xuống · vành vàng
      b.C(0.05, 1.06, -0.6, 0.84, 0.73, DARK, { axis: 'z', seg: 10 });
      b.C(0.075, 0.26, -0.6, 0.73, 1.26, DARK, { seg: 12 });
      b.C(0.1, 0.035, -0.6, 0.61, 1.26, YELLOW, { seg: 12 });

      const g = b.build();
      const cab = fuelTruck(true); cab.position.set(2.25 - 6.22, -0.04, 0); g.add(cab);   // bánh R 0.5 (xe bồn 0.54) ⇒ hạ 0.04
      g.userData.hoseIn = [[-0.6, 0.64, 1.26], [-0.6, 0.42, 1.28], [-0.64, 0.2, 1.4], [-0.72, 0.045, 1.62]];   // khớp → chạm sân
      return g;
    }

    /* ══════════════════ XE BỒN NHIÊN LIỆU — ĐẦU KÉO + SƠ-MI RƠ-MOÓC BỒN BẬC (học cấu trúc từ fuel_truck.glb) ══════════════════
       Tham chiếu: "Fuel Truck" — simonthedigger (Sketchfab, CC-BY-4.0). Chỉ học CẤU TRÚC & TỈ LỆ — không nhúng mesh/texture.
       Bóc cây node GLB (1 đơn vị GLB ≈ 1 đơn vị local: bề ngang 2.81 ≈ xe cũ 2.8):
         · Cube.004   → ĐẦU KÉO: cabin cabover dài 1.55 · cao 2.78 · sàn tôn sau cabin · bình dầu · hộp ắc-quy · ống xả đứng
         · Circle.010 → BỒN BẬC: đoạn trước elip nhỏ (rộng 1.98 · cao 1.28 · tâm 2.10) nằm trên mâm kéo → đoạn chuyển 1.2
                        → thân chính rộng 2.52 · cao 2.0 (đáy bè, đỉnh thon) · lan can GẬP nằm sát nóc · hố ga · ống đáy
         · Circle.003 → CỤM ĐUÔI: tang cuộn ống QUAY RA SAU · bình lọc nằm ngang · bơm · tủ đồng hồ · thang leo · cản sau
         · Cube.071   → kính cabin · 14 bánh Ø1.08 (lốp + mâm): trục trước đơn · trục chủ động đôi · 2 trục rơ-moóc đôi
       Trục bánh tính từ mũi xe (GLB): 1.18 · 4.77 · 10.31 · 11.62 ⇒ local x = 7.4 − d.
       Local: cabin +x · bồn giữa · cụm thiết bị −x. Dài 14.65 (x −7.25 → 7.4) · cao 3.1 · rộng 2.9 (kể gương).
       Trả về Group: đầu kéo + rơ-moóc; rơ-moóc treo ở CHỐT KÉO (x = KP) ⇒ xoay userData.trailer.rotation.y để gập khớp.
       userData.hosePath = đường vòi giao nhiên liệu (local): đáy tang cuộn → con lăn mép sàn → chạm sân; scene nối tiếp
       sang khớp nhận của xe tra nạp. cabOnly = true ⇒ CHỈ trả cabin (thân · kính · gương · bậc · vòm bánh · nét cửa · dải
       sơn) theo toạ độ xe bồn — xe tra nạp dùng chung cabin này cho đồng bộ. */
    function fuelTruck(cabOnly = false) {
      const cb = Bag(), tb = cabOnly ? Bag() : cb, rb = Bag();          // cb: cabin · tb: phần còn lại đầu kéo (= cb khi dựng cả xe) · rb: rơ-moóc
      const R = 0.54, AX_F = 6.22, AX_D = 2.63, AX_T1 = -2.91, AX_T2 = -4.22, KP = 2.95;
      const DZ_I = 0.8, DZ_O = 1.18;                                    // bánh đôi: tâm lốp trong / ngoài

      /* ── hull 8 đỉnh tự lật mặt (pháp tuyến · (tâm mặt − tâm khối) > 0 ⇒ giữ, ngược ⇒ đảo) ── */
      const hull = (b, V, color, opt = {}) => {
        const cx = V.reduce((s, v) => s + v[0], 0) / 8, cy = V.reduce((s, v) => s + v[1], 0) / 8, cz = V.reduce((s, v) => s + v[2], 0) / 8;
        const quads = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
        const tris = [];
        for (const q of quads) {
          const [A, B, C, D] = q.map(i => V[i]);
          const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
          const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const fx = (A[0] + B[0] + C[0] + D[0]) / 4 - cx, fy = (A[1] + B[1] + C[1] + D[1]) / 4 - cy, fz = (A[2] + B[2] + C[2] + D[2]) / 4 - cz;
          const o = (nx * fx + ny * fy + nz * fz > 0) ? [A, B, C, A, C, D] : [A, D, C, A, C, B];
          for (const p of o) tris.push(p[0], p[1], p[2]);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
        g.computeVertexNormals();
        b.add(g, color, Object.assign({ thresh: 10 }, opt));
      };
      const box8 = (b, x0, x1, y0, y1, w0, w1, color, xt0 = x0, xt1 = x1) => hull(b, [   // lăng trụ: đáy (x0..x1, ±w0) → đỉnh (xt0..xt1, ±w1)
        [x0, y0, -w0], [x1, y0, -w0], [x1, y0, w0], [x0, y0, w0],
        [xt0, y1, -w1], [xt1, y1, -w1], [xt1, y1, w1], [xt0, y1, w1]], color);
      /* ── kính bo góc: Shape chữ nhật bo → extrude mỏng (dịch −th/2 cho đối xứng TRƯỚC khi xoay) ── */
      const rrShape = (w, h, r) => {
        const s = new THREE.Shape(), hw = w / 2, hh = h / 2;
        s.moveTo(-hw + r, -hh);
        s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r);
        s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh);
        s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r);
        s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
        return s;
      };
      const rrGeo = (w, h, r, th) => new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth: th, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -th / 2);
      /* ── vòm chắn bùn: 8 đốt bám cung tròn quanh tâm bánh ── */
      const arch = (b, cx, z, w, Ra, color) => {
        for (let i = 0; i <= 7; i++) {
          const a = Math.PI * (0.1 + 0.8 * i / 7);
          b.P(0.27, 0.07, w, cx + Ra * Math.cos(a), R + Ra * Math.sin(a), z, color, { rz: a + Math.PI / 2, soft: true });
        }
      };
      /* ── mặt hông cabin: z(y) thẳng 1.12 dưới 1.95, thu 0.06 tới 2.72 · shape (x, y) → lưới ÁN lên mặt hông ── */
      const zSide = (y) => (y <= 1.95 ? 1.12 : 1.12 - (y - 1.95) / 0.77 * 0.06);
      const polyShape = (P, r = 0) => {                                 // đa giác, bo góc bán kính r (quadratic)
        const s = new THREE.Shape(), n = P.length;
        for (let i = 0; i < n; i++) {
          const [px, py] = P[i], [ax, ay] = P[(i + n - 1) % n], [bx, by] = P[(i + 1) % n];
          const la = Math.hypot(ax - px, ay - py), lb = Math.hypot(bx - px, by - py), k = Math.min(r, la / 2, lb / 2);
          const p0 = [px + (ax - px) / la * k, py + (ay - py) / la * k], p1 = [px + (bx - px) / lb * k, py + (by - py) / lb * k];
          if (i === 0) s.moveTo(p0[0], p0[1]); else s.lineTo(p0[0], p0[1]);
          s.quadraticCurveTo(px, py, p1[0], p1[1]);
        }
        s.closePath(); return s;
      };
      const WIN = [[7.13, 1.80], [6.27, 1.80], [6.27, 2.45], [7.00, 2.45]];   // kính cửa: mép trước nghiêng
      const winShape = () => polyShape(WIN, 0.07);
      const onSide = (shape, s, off) => {                               // ShapeGeometry → nằm trên mặt hông mạn s
        const g = new THREE.ShapeGeometry(shape, 4), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, s * (zSide(p.getY(i)) + off));
        if (s < 0) g.index.array.reverse();                               // mạn trái: lật winding cho mặt quay ra ngoài
        g.computeVertexNormals(); return g;
      };
      const tube = (b, pts, r, color) => b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), 28, r, 6), color, { noEdge: true });

      /* ══════════════ ĐẦU KÉO (Cube.004 + Cube.071) ══════════════ */
      // khung gầm: 2 dầm dọc + 3 dầm ngang
      for (const s of [-1, 1]) tb.P(5.9, 0.24, 0.14, 4.35, 0.86, s * 0.46, DARK, { soft: true });
      for (const cx of [6.9, 4.6, 1.6]) tb.P(0.14, 0.14, 0.92, cx, 0.86, 0, DARK, { soft: true });
      // cabin cabover: thân dưới (hông thẳng) → khoang kính (kính trước nghiêng 22°, hông thu 0.06) → mái vồng
      // THÂN DƯỚI = extrude biên dạng hông có VÒM BÁNH KHOÉT (như mẫu GLB: mép dưới cửa bị vòm bánh trước ăn cong),
      // thay hộp + tạp-dề cũ. Vòm tâm (AX_F, R) bán kính ARC 0.72 ⇒ đỉnh vòm 1.26; mép trước xuống tới đỉnh cản 0.86.
      const ARC = 0.72;
      (() => {
        const sh = new THREE.Shape(), aS = Math.asin((0.86 - R) / ARC), a1 = Math.PI - Math.acos((AX_F - 5.86) / ARC);
        sh.moveTo(5.86, 1.95); sh.lineTo(7.36, 1.95); sh.lineTo(7.37, 0.86); sh.lineTo(AX_F + ARC * Math.cos(aS), 0.86);
        sh.absarc(AX_F, R, ARC, aS, a1, false);                           // vòm bánh: từ mép trước lên đỉnh rồi xuống lưng cabin
        sh.lineTo(5.86, 1.95);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 2.24, bevelEnabled: false, curveSegments: 20 }).translate(0, 0, -1.12);
        cb.add(g, WHITE, { thresh: 10 });
      })();
      box8(cb, 5.86, 7.36, 1.95, 2.72, 1.12, 1.06, WHITE, 5.88, 7.05);
      box8(cb, 5.88, 7.05, 2.72, 2.80, 1.06, 0.98, WHITE, 5.93, 6.95);
      cb.P(0.18, 0.42, 2.36, 7.33, 0.66, 0, DARK, {});                     // cản trước
      for (const s of [-1, 1]) cb.P(0.2, 0.42, 0.12, 7.27, 0.66, s * 1.13, DARK, {});  // cản ôm góc (ngắn lại, chừa chỗ hộp bậc)
      // mặt nạ: hốc lưới tản nhiệt tối + 3 nan + logo tròn
      cb.P(0.03, 0.30, 1.40, 7.385, 1.08, 0, DARK, {});
      for (let i = 0; i < 3; i++) cb.P(0.03, 0.03, 1.32, 7.40, 0.98 + i * 0.1, 0, MID, { noEdge: true });
      cb.C(0.09, 0.02, 7.41, 1.08, 0, CREAM, { axis: 'x', seg: 14 });
      // đèn trong cản: pha · xi-nhan · sương mù
      for (const s of [-1, 1]) {
        cb.P(0.03, 0.12, 0.32, 7.425, 0.73, s * 0.8, CREAM, {});
        cb.P(0.03, 0.10, 0.12, 7.425, 0.73, s * 1.07, ORANGE_GLOW, {});
        cb.P(0.03, 0.06, 0.14, 7.425, 0.53, s * 0.8, CREAM, {});
      }
      // kính chắn gió lớn bo góc — nằm trên mặt nghiêng (7.36, 1.95) → (7.05, 2.72)
      (() => {
        const g = rrGeo(2.0, 0.70, 0.12, 0.05);
        g.rotateY(Math.PI / 2); g.rotateZ(0.3829); g.translate(7.235, 2.35, 0);
        cb.add(g, GLASS, { noEdge: true });
      })();
      for (const s of [-1, 1]) {
        // KÍNH CỬA (mẫu GLB): ngũ giác bo góc, mép TRƯỚC NGHIÊNG song song kính chắn gió, đáy 1.80 · đỉnh 2.45 ·
        // mép sau 6.27. Dựng phẳng rồi ÁN từng đỉnh lên mặt hông (thẳng dưới 1.95, thu dần phía trên) — không còn
        // tấm hộp nghiêng một góc. Bỏ kính tam giác sau cửa cũ: mẫu không có, chỗ đó là trụ B.
        cb.add(onSide(winShape(), s, 0.012), GLASS, { noEdge: true });
        // gương: chân tam giác tối ở góc dưới-trước kính → tay đỡ chéo ra ngoài → gương lớn đứng + gương cận
        cb.add(onSide(polyShape([[7.17, 1.70], [6.97, 1.78], [7.10, 1.90]]), s, 0.02), DARK, { noEdge: true });
        cb.P(0.04, 0.04, 0.3, 7.12, 1.82, s * 1.27, DARK, {});
        cb.P(0.03, 0.03, 0.26, 7.14, 2.36, s * 1.27, DARK, {});
        cb.P(0.07, 0.52, 0.17, 7.14, 2.11, s * 1.42, DARK, {});
        cb.P(0.07, 0.16, 0.14, 7.17, 1.72, s * 1.4, DARK, {});
        // bậc lên cabin ngay dưới góc trước cửa (trước vòm bánh): hộp bậc tối + 2 mặt bậc
        cb.P(0.26, 0.41, 0.06, 7.04, 0.655, s * 1.15, DARK, {});
        for (const y of [0.55, 0.78]) cb.P(0.22, 0.03, 0.14, 7.04, y, s * 1.12, MID, { noEdge: true });
        arch(cb, AX_F, s * 1.0, 0.36, 0.70, DARK);                         // ốp vòm bánh tối nằm trong mép khoét
        // tay vịn đứng trên trụ B (sau mép cửa) + nhãn nguy hiểm hình thoi đặt trên trụ B như mẫu
        cb.P(0.03, 0.75, 0.04, 5.93, 1.85, s * 1.14, DARK, {});
        cb.P(0.11, 0.11, 0.02, 6.11, 2.18, s * 1.105, PAINT, { rz: Math.PI / 4, noEdge: true });
      }
      // mái: cửa sập · 2 đèn hiệu cam · ăng-ten
      cb.P(0.55, 0.035, 0.6, 6.35, 2.82, 0, DARK, {});
      for (const s of [-1, 1]) cb.C(0.07, 0.12, 6.88, 2.86, s * 0.78, ORANGE_GLOW, { seg: 10 });
      cb.P(0.02, 0.36, 0.02, 6.1, 2.98, -0.6, DARK, { noEdge: true });
      // sau cabin: sàn tôn chống trượt · mâm kéo (5th wheel) · bình dầu · hộp ắc-quy · ống xả · thang lên sàn
      tb.P(2.3, 0.05, 1.86, 4.65, 1.12, 0, CREAM, { soft: true });
      tb.P(0.9, 0.12, 0.9, KP, 1.02, 0, DARK, { soft: true });
      tb.C(0.6, 0.1, KP, 1.13, 0, DARK, { seg: 20 });
      tb.C(0.29, 1.3, 4.45, 0.72, 0.84, DARK, { axis: 'x', seg: 14 });
      for (const x of [3.98, 4.92]) tb.C(0.305, 0.05, x, 0.72, 0.84, MID, { axis: 'x', seg: 14, soft: true });
      tb.P(1.05, 0.48, 0.5, 4.45, 0.75, -0.86, MID, { soft: true });
      tb.P(0.95, 0.02, 0.42, 4.45, 1.0, -0.86, CREAM, { soft: true });
      tb.C(0.06, 1.95, 5.7, 1.95, -0.92, DARK, { seg: 10 });
      tb.P(0.05, 0.75, 0.16, 5.7, 2.15, -1.0, MID, { soft: true });
      tb.P(0.28, 0.07, 0.07, 5.6, 2.94, -0.92, DARK, { rz: 0.35 });
      for (const x of [5.15, 5.45]) tb.P(0.04, 0.95, 0.04, x, 0.62, 1.02, MID, {});
      for (const y of [0.3, 0.55, 0.8]) tb.P(0.34, 0.03, 0.05, 5.3, y, 1.02, MID, {});
      // trục + bánh: trước đơn · chủ động đôi · chắn bùn & vạt chắn bùn trục chủ động · đèn hậu đầu kéo
      for (const ax of [AX_F, AX_D]) tb.C(0.08, 2.0, ax, R, 0, DARK, { axis: 'z', seg: 8 });
      for (const s of [-1, 1]) {
        stdWheel(tb, AX_F, s * 0.945, R);
        stdWheel(tb, AX_D, s * DZ_I, R); stdWheel(tb, AX_D, s * DZ_O, R);
        arch(tb, AX_D, s * 0.99, 0.66, 0.68, DARK);
        tb.P(0.03, 0.55, 0.62, AX_D - 0.74, 0.42, s * 0.99, DARK, { soft: true });
        tb.P(0.03, 0.1, 0.25, 1.42, 0.9, s * 0.72, PAINT, {});
      }

      /* ══════════════ RƠ-MOÓC — BỒN BẬC (Circle.010) ══════════════
         Tiết diện "trứng": nửa trên siêu-elip n 1.8 (thon), nửa dưới n 2.2 (bè) — đo bằng raycast trên GLB.
         Trạm loft [x, a (nửa rộng), hT (nửa cao trên), hB (nửa cao dưới), cy (cao độ chỗ rộng nhất)]. */
      const NS = 40;
      const FS = [0.99, 0.64, 0.64, 2.10], MS = [1.26, 1.12, 0.87, 1.84];   // đoạn trước · thân chính
      const st = (x, S, k = 1) => [x, S[0] * k, S[1] * k, S[2] * k, S[3]];
      const mix = (A, B, t) => A.map((v, i) => v + (B[i] - v) * t);
      const ring = (s, i, grow) => {
        const t = i / NS * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), n = sn >= 0 ? 1.8 : 2.2;
        const h = (sn >= 0 ? s[2] : s[3]) + grow, a = s[1] + grow;
        return [s[0], s[4] + h * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n), a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)];
      };
      const loft = (stns, color, opt = {}) => {                           // geometry CÓ index ⇒ pháp tuyến mượt quanh vòng
        const pos = [], idx = [], grow = opt.grow || 0;
        for (const s of stns) for (let i = 0; i < NS; i++) pos.push(...ring(s, i, grow));
        for (let j = 0; j < stns.length - 1; j++) for (let i = 0; i < NS; i++) {
          const a = j * NS + i, b = j * NS + (i + 1) % NS, c = (j + 1) * NS + (i + 1) % NS, d = (j + 1) * NS + i;
          idx.push(a, b, c, a, c, d);
        }
        if (!opt.noCap) for (const [j, front] of [[0, true], [stns.length - 1, false]]) {
          const ci = pos.length / 3; pos.push(stns[j][0], stns[j][4], 0);
          for (let i = 0; i < NS; i++) { const a = j * NS + i, b = j * NS + (i + 1) % NS; if (front) idx.push(ci, b, a); else idx.push(ci, a, b); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        rb.add(g, color, Object.assign({ thresh: 16 }, opt));
      };
      loft([st(4.66, FS, 0.30), st(4.62, FS, 0.62), st(4.55, FS, 0.83), st(4.45, FS, 0.95), st(4.32, FS),   // chỏm trước
        st(1.80, FS), st(1.40, mix(FS, MS, 1 / 3)), st(1.00, mix(FS, MS, 2 / 3)), st(0.60, MS),                // đoạn trước → đoạn chuyển
        st(-5.20, MS), st(-5.33, MS, 0.95), st(-5.44, MS, 0.83), st(-5.52, MS, 0.62), st(-5.56, MS, 0.30)],  // thân chính → chỏm sau
        WHITE);
      // gân vòng nổi: mép 2 chỏm · 2 mép đoạn chuyển · 2 vách khoang
      for (const [x, S] of [[4.32, FS], [1.80, FS], [0.60, MS], [-1.30, MS], [-3.25, MS], [-5.20, MS]])
        loft([st(x + 0.03, S), st(x - 0.03, S)], MID, { grow: 0.022, noCap: true, thresh: 40, soft: true });
      // nóc: lan can GẬP nằm sát nóc (như mẫu) · bản lề · 4 nắp hố ga · cụm van thở
      const TOP_F = FS[3] + FS[1], TOP_M = MS[3] + MS[1];                  // 2.74 · 2.96
      for (const s of [-1, 1]) {
        rb.P(2.5, 0.035, 0.035, 3.05, TOP_F + 0.05, s * 0.28, MID, {});
        rb.P(5.4, 0.035, 0.035, -2.25, TOP_M + 0.05, s * 0.3, MID, {});
        for (let x = 0.3; x >= -4.8; x -= 1.27) rb.P(0.06, 0.06, 0.06, x, TOP_M + 0.03, s * 0.3, DARK, { noEdge: true });
      }
      for (const [x, y] of [[3.25, TOP_F], [-0.4, TOP_M], [-2.3, TOP_M], [-4.2, TOP_M]]) {
        rb.C(0.26, 0.08, x, y + 0.01, 0, MID, { seg: 18, soft: true });
        rb.C(0.19, 0.05, x, y + 0.06, 0, CREAM, { seg: 18, soft: true });
        rb.P(0.07, 0.05, 0.18, x + 0.26, y + 0.04, 0, DARK, { noEdge: true });
      }
      rb.P(0.42, 0.1, 0.28, -3.25, TOP_M + 0.04, 0, MID, { soft: true });
      for (const z of [-0.07, 0.07]) rb.C(0.04, 0.12, -3.25, TOP_M + 0.14, z, DARK, { seg: 8 });
      // thang chỏm trước: 2 tay ống uốn theo chỏm + 4 bậc
      for (const z of [-0.24, 0.24]) tube(rb, [[4.70, 1.55, z], [4.76, 2.0, z], [4.72, 2.4, z], [4.55, 2.72, z], [4.25, 2.86, z], [3.95, 2.86, z]], 0.025, MID);
      for (const [x, y] of [[4.73, 1.75], [4.76, 2.0], [4.75, 2.25], [4.69, 2.5]]) rb.C(0.018, 0.48, x, y, 0, MID, { axis: 'z', seg: 6, noEdge: true });
      // biển báo hàng nguy hiểm 2 hông đoạn trước: bảng cam (vạch giữa) + hình thoi
      for (const s of [-1, 1]) {
        rb.P(0.42, 0.28, 0.02, 3.55, 2.12, s * 1.0, ORANGE_GLOW, {});
        rb.P(0.40, 0.02, 0.022, 3.55, 2.12, s * 1.0, DARK, { noEdge: true });
        rb.P(0.2, 0.2, 0.02, 3.12, 2.12, s * 1.0, WHITE, { rz: Math.PI / 4 });
        rb.P(0.14, 0.14, 0.022, 3.12, 2.12, s * 1.0, PAINT, { rz: Math.PI / 4, noEdge: true });
      }

      /* ── khung rơ-moóc: cổ ngỗng dưới đoạn trước + tấm chốt kéo + 2 yên đỡ · dầm xiên qua đoạn chuyển · dầm dọc thân ── */
      for (const s of [-1, 1]) {
        rb.P(3.4, 0.16, 0.12, 2.9, 1.36, s * 0.42, DARK, { soft: true });
        rb.P(1.217, 0.16, 0.12, 0.65, 1.10, s * 0.44, DARK, { rz: 0.4417, soft: true });
        rb.P(7.3, 0.18, 0.12, -3.55, 0.84, s * 0.46, DARK, { soft: true });
      }
      rb.P(1.3, 0.05, 1.0, KP, 1.245, 0, DARK, { soft: true });
      rb.C(0.06, 0.12, KP, 1.17, 0, SILVER, { seg: 10 });                  // chốt kéo (kingpin)
      for (const x of [4.0, 2.2]) rb.P(0.14, 0.12, 0.7, x, 1.48, 0, MID, { soft: true });
      // chân chống (landing gear) ngay sau đầu kéo: ống ngoài · ty trong · đế · thanh giằng · tay quay
      for (const s of [-1, 1]) {
        rb.P(0.13, 0.62, 0.13, 1.0, 0.93, s * 0.62, DARK, { soft: true });
        rb.P(0.09, 0.36, 0.09, 1.0, 0.44, s * 0.62, SILVER, {});
        rb.P(0.28, 0.05, 0.28, 1.0, 0.24, s * 0.62, DARK, { soft: true });
      }
      rb.C(0.03, 1.24, 1.0, 0.85, 0, DARK, { axis: 'z', seg: 6, noEdge: true });
      rb.P(0.04, 0.04, 0.3, 1.0, 0.95, 0.85, MID, {});
      rb.P(0.04, 0.16, 0.04, 1.0, 0.88, 1.0, MID, {});
      // hộp van & khớp nối dưới bụng (mạn phải) · ống đáy chạy về cụm đuôi
      rb.P(0.75, 0.3, 0.45, -0.7, 0.75, 0.78, MID, { soft: true });
      for (let i = 0; i < 3; i++) rb.C(0.05, 0.05, -0.95 + i * 0.25, 0.75, 1.02, DARK, { axis: 'z', seg: 10 });
      tube(rb, [[1.6, 1.4, 0.62], [0.6, 0.92, 0.62], [-0.4, 0.88, 0.62], [-5.0, 0.88, 0.62], [-5.7, 0.95, 0.62], [-6.4, 1.05, 0.62]], 0.04, DARK);
      // cụm 2 trục: dầm nhíp · trục · bánh đôi · chắn bùn liền 2 trục + 2 mép · vạt chắn bùn · thanh chống luồn gầm hông
      for (const ax of [AX_T1, AX_T2]) {
        rb.C(0.08, 2.05, ax, R, 0, DARK, { axis: 'z', seg: 8 });
        for (const s of [-1, 1]) {
          rb.P(1.0, 0.08, 0.1, ax, 0.68, s * 0.46, DARK, { soft: true });
          stdWheel(rb, ax, s * DZ_I, R); stdWheel(rb, ax, s * DZ_O, R);
        }
      }
      const TM = (AX_T1 + AX_T2) / 2;
      for (const s of [-1, 1]) {
        rb.P(2.6, 0.05, 0.56, TM, 1.21, s * 1.04, WHITE, { soft: true });
        for (const dx of [-1.3, 1.3]) rb.P(0.05, 0.3, 0.56, TM + dx, 1.07, s * 1.04, WHITE, { soft: true });
        rb.P(0.03, 0.6, 0.6, AX_T2 - 0.72, 0.42, s * 1.0, DARK, { soft: true });
        rb.P(3.0, 0.1, 0.05, -0.75, 0.62, s * 1.2, MID, { soft: true });
        for (const x of [0.4, -1.9]) rb.P(0.06, 0.3, 0.72, x, 0.74, s * 0.86, DARK, { noEdge: true });
      }

      /* ══════════════ CỤM ĐUÔI (Circle.003) ══════════════ */
      rb.P(1.75, 0.12, 2.3, -6.35, 0.72, 0, DARK, { soft: true });         // khung đế
      // tang cuộn ống quay ra sau: 2 má (sáng) · cuộn ống (tối) · moay-ơ · 6 nan · 2 trụ đỡ
      const RZ = -0.12, RY = 1.72;
      for (const x of [-5.8, -6.3]) rb.C(0.84, 0.05, x, RY, RZ, MID, { axis: 'x', seg: 24, soft: true });
      rb.C(0.62, 0.45, -6.05, RY, RZ, DARK, { axis: 'x', seg: 20 });
      rb.C(0.16, 0.6, -6.05, RY, RZ, CREAM, { axis: 'x', seg: 12 });
      for (let k = 0; k < 6; k++) rb.P(0.03, 1.5, 0.05, -6.335, RY, RZ, MID, { rx: k * Math.PI / 6, noEdge: true });
      for (const x of [-5.74, -6.36]) rb.P(0.06, 0.95, 0.06, x, 1.25, RZ, MID, {});
      // bình lọc nằm ngang (trục z) + 2 chỏm + đai nhãn · ống đứng lên moay-ơ
      rb.C(0.3, 1.4, -6.78, 1.32, 0.1, DARK, { axis: 'z', seg: 16 });
      for (const s of [-1, 1]) rb.C(0.3, 0.12, -6.78, 1.32, 0.1 + s * 0.76, DARK, { axis: 'z', seg: 16, r2: 0.18 });
      rb.C(0.305, 0.3, -6.78, 1.32, 0.1, PAINT, { axis: 'z', seg: 16, noEdge: true });
      tube(rb, [[-6.78, 1.6, 0.4], [-6.78, 1.95, 0.4], [-6.6, 2.05, 0.1], [-6.36, 1.72, RZ]], 0.045, DARK);
      // bơm + đồng hồ · tủ điều khiển góc trái + 3 đồng hồ
      rb.P(0.45, 0.4, 0.45, -6.6, 0.98, 0.78, DARK, {});
      rb.C(0.09, 0.02, -6.835, 1.05, 0.78, CREAM, { axis: 'x', seg: 12 });
      rb.P(0.42, 0.8, 0.46, -6.85, 1.18, -0.92, MID, { soft: true });
      rb.P(0.02, 0.5, 0.34, -7.07, 1.25, -0.92, DARK, {});
      for (const [y, z] of [[1.38, -1.0], [1.38, -0.84], [1.14, -0.92]]) rb.C(0.055, 0.02, -7.085, y, z, CREAM, { axis: 'x', seg: 10 });
      // thang leo góc phải: 2 tay + 8 bậc + móc trên nóc
      for (const x of [-5.62, -5.95]) rb.P(0.045, 2.5, 0.045, x, 1.66, 1.1, MID, {});
      for (let i = 0; i < 8; i++) rb.P(0.33, 0.03, 0.045, -5.785, 0.62 + i * 0.3, 1.1, MID, { noEdge: true });
      rb.P(0.4, 0.045, 0.045, -5.62, 2.9, 0.98, MID, {});
      // cản sau: đèn hậu · đèn lùi · biển số · vòi giao nhiên liệu buông từ tang cuộn
      rb.P(0.16, 0.26, 2.42, -7.17, 0.55, 0, DARK, {});
      for (const s of [-1, 1]) {
        rb.P(0.03, 0.14, 0.36, -7.255, 0.58, s * 0.86, PAINT, {});
        rb.P(0.03, 0.1, 0.12, -7.255, 0.58, s * 0.55, CREAM, {});
      }
      rb.P(0.02, 0.16, 0.4, -7.255, 0.4, 0, CREAM, {});
      // con lăn dẫn ống ở mép sàn đuôi (mạn −z, phía xe tra nạp): 2 tai đỡ · con lăn ngang · thanh chặn trên. Vòi nhả từ
      // ĐÁY tang cuộn, chạy ngang trên sàn, vắt qua con lăn rồi võng xuống sân (dựng ở scene theo userData.hosePath).
      for (const x of [-5.84, -6.26]) rb.P(0.04, 0.26, 0.08, x, 0.92, -1.2, DARK, {});
      rb.C(0.05, 0.38, -6.05, 0.86, -1.2, MID, { axis: 'x', seg: 10 });
      rb.C(0.022, 0.42, -6.05, 1.045, -1.2, DARK, { axis: 'x', seg: 8 });
      rb.C(0.07, 0.12, -5.05, TOP_M + 0.08, 0, ORANGE_GLOW, { seg: 10 });   // đèn hiệu nóc sau

      /* ══ CỬA CABIN — "mực ôm bề mặt" (kỹ thuật máy bay): viền cửa · tay nắm, dải phẳng conform hông cabin ══ */
      const INK = new THREE.MeshBasicMaterial({ color: 0x35342f, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      const zAt = (y) => zSide(y) + 0.03;
      const ribbon = (tris, pts, w, closed) => {
        const n = pts.length, m = closed ? n : n - 1, h = w / 2;
        for (let i = 0; i < m; i++) {
          const a = pts[i], bb = pts[(i + 1) % n];
          let dx = bb.x - a.x, dy = bb.y - a.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
          const ex = dx * h, ey = dy * h, nx = -dy * h, ny = dx * h;
          const ax = a.x - ex, ay = a.y - ey, bx = bb.x + ex, by = bb.y + ey;
          tris.push(ax + nx, ay + ny, a.z, ax - nx, ay - ny, a.z, bx + nx, by + ny, bb.z,
            ax - nx, ay - ny, a.z, bx - nx, by - ny, bb.z, bx + nx, by + ny, bb.z);
        }
      };
      const dt = [];
      for (const sd of [-1, 1]) {
        const p = (x, y) => new THREE.Vector3(x, y, sd * zAt(y));
        // VIỀN CỬA (khe cánh): trước đứng 7.21 tới 1.77 rồi nghiêng theo kính chắn gió tới (7.04, 2.58) · đỉnh 2.58 ·
        // sau 5.98 · đáy 1.07 tới mép vòm rồi ÔM VÒM BÁNH (bán kính ARC + 0.05) lên tới mép sau — đúng mẫu GLB
        const door = [p(7.21, 1.07), p(7.21, 1.77), p(7.04, 2.58), p(5.98, 2.58)];
        const ra = ARC + 0.05, aEnd = Math.PI - Math.acos((AX_F - 5.98) / ra), aBeg = Math.asin((1.07 - R) / ra);
        for (let k = 0; k <= 10; k++) { const a = aEnd - (aEnd - aBeg) * k / 10; door.push(p(AX_F + ra * Math.cos(a), R + ra * Math.sin(a))); }
        ribbon(dt, door, 0.035, true);
        // khung kính cửa (bám đúng biên kính bo góc)
        ribbon(dt, winShape().getPoints(4).map(v => p(v.x, v.y)), 0.03, true);
        // tay nắm âm: hốc chữ nhật + thanh nắm · gioăng ngang dưới kính
        ribbon(dt, [p(6.28, 1.62), p(6.43, 1.62), p(6.43, 1.66), p(6.28, 1.66)], 0.02, true);
        ribbon(dt, [p(6.30, 1.64), p(6.41, 1.64)], 0.035, false);
        ribbon(dt, [p(7.12, 1.76), p(6.27, 1.76)], 0.015, false);
      }
      const dm = new THREE.BufferGeometry(); dm.setAttribute('position', new THREE.Float32BufferAttribute(dt, 3));
      const doorMesh = new THREE.Mesh(dm, INK); doorMesh.userData.noFade = true; doorMesh.renderOrder = 4;

      // dải sơn livery mảnh (ý dải đỏ của mẫu): hông cabin + dọc thân bồn chính — dải phẳng ôm mặt, màu PAINT
      const LIV = new THREE.MeshBasicMaterial({ color: PAINT, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      const zBody = (S, y) => {                                         // nửa rộng giải tích của tiết diện S tại cao độ y
        const up = y >= S[3], n = up ? 1.8 : 2.2, u = Math.min(1, Math.abs(y - S[3]) / (up ? S[1] : S[2]));
        const sn = Math.pow(u, n / 2), c = Math.sqrt(Math.max(0, 1 - sn * sn));
        return S[0] * Math.pow(c, 2 / n);
      };
      const lc = [], lt = [];
      for (const sd of [-1, 1]) {
        ribbon(lc, [new THREE.Vector3(5.88, 1.5, sd * 1.132), new THREE.Vector3(7.36, 1.5, sd * 1.132)], 0.05, false);
        const zt = sd * (zBody(MS, 1.45) + 0.012);
        ribbon(lt, [new THREE.Vector3(0.55, 1.45, zt), new THREE.Vector3(-5.15, 1.45, zt)], 0.05, false);
      }
      const livMesh = (tris) => {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
        const m = new THREE.Mesh(g, LIV); m.userData.noFade = true; m.renderOrder = 4; return m;
      };

      if (cabOnly) { const cab = cb.build(); cab.add(doorMesh, livMesh(lc)); return cab; }
      const grp = new THREE.Group();
      const tractor = tb.build(); tractor.add(doorMesh, livMesh(lc)); grp.add(tractor);
      const pivot = new THREE.Group(); pivot.position.x = KP;               // khớp xoay ở chốt kéo
      const trailer = rb.build(); trailer.add(livMesh(lt)); trailer.position.x = -KP; pivot.add(trailer); grp.add(pivot);
      grp.userData.trailer = pivot;
      grp.userData.hosePath = [[-6.05, 1.1, -0.12], [-6.05, 1.06, -0.55], [-6.05, 0.975, -1.0], [-6.05, 0.955, -1.2], [-6.04, 0.86, -1.37],
        [-6.0, 0.55, -1.5], [-5.92, 0.22, -1.61], [-5.75, 0.045, -1.82]].map(p => new THREE.Vector3(p[0], p[1], p[2]));
      return grp;
    }
    // GPU cấp điện 400 Hz — rơ-moóc diesel: khung gầm · tủ máy + nắp + gờ thông gió · lá chớp gió 2 hông · khe cửa & tay
    // nắm · bảng điều khiển đầu +x (đồng hồ, nút khởi động) · ống xả · đèn hiệu · giá treo cuộn cáp · càng chữ A · 4 bánh.
    // Local +x = đầu càng / bảng điều khiển (quay về mũi máy bay); cổ cáp ra ở (1.0, 1.0, 0.3).
    function gpu() {
      const b = Bag();
      b.P(2.5, 0.14, 1.0, 0, 0.5, 0, DARK, { soft: true });
      b.P(2.1, 1.12, 1.28, -0.1, 1.13, 0, CREAM, {});
      b.P(2.16, 0.1, 1.34, -0.1, 1.74, 0, WHITE, { soft: true });
      b.P(1.1, 0.12, 0.9, -0.45, 1.85, 0, WHITE, { soft: true });
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) b.P(0.9, 0.035, 0.03, -0.55, 0.86 + i * 0.1, s * 0.655, DARK, { noEdge: true });
        b.P(0.03, 0.95, 0.03, 0.15, 1.13, s * 0.655, DARK, { noEdge: true });
        b.P(0.12, 0.05, 0.05, 0.32, 1.13, s * 0.67, DARK, {});
      }
      b.P(0.04, 0.6, 0.86, 0.96, 1.2, 0, DARK, {});
      for (const z of [-0.22, 0.05, 0.3]) b.C(0.08, 0.03, 0.985, 1.3, z, CREAM, { axis: 'x', seg: 10 });
      b.P(0.03, 0.12, 0.3, 0.985, 1.02, -0.15, ORANGE_GLOW, {});
      b.C(0.055, 0.45, -0.85, 2.0, -0.38, DARK, { seg: 8 });
      b.C(0.08, 0.14, 0.7, 1.86, 0.42, ORANGE_GLOW, { seg: 8 });
      b.P(0.08, 0.5, 0.25, 0.55, 1.35, 0.72, MID, {});
      const coil = new THREE.TorusGeometry(0.26, 0.05, 6, 14); coil.translate(0.55, 1.2, 0.86); b.add(coil, DARK, { thresh: 30 });
      for (const s of [-1, 1]) b.P(0.9, 0.07, 0.07, 1.65, 0.45, s * 0.2, MID, { ry: s * 0.4636 });
      b.C(0.09, 0.04, 2.08, 0.43, 0, DARK, { seg: 10 });
      for (const wx of [-0.75, 0.75]) for (const s of [-1, 1]) stdWheel(b, wx, s * 0.62, 0.3);
      return b.build();
    }
    // CỠ THẬT (cùng hệ 0.498 world/m với máy bay 747-8): nhóm container + dolly dựng ở scale CL_S = 0.476
    // (dolly 3.4 m kể càng · rộng 1.8 m), LD3 hệ số LD3_K ⇒ rộng đúng 2.0 m. Bản trước to 1.15–1.3×.
    const CL_S = 0.476, LD3_K = 0.9966 / (2.05 * CL_S);
    function ldCluster(list) {                                                        // container LD3 (trên đất hoặc trên dolly)
      const b = Bag();
      for (const [x, z, ry, onDolly] of list) {
        if (onDolly) dolly(b, x, z, ry);
        ld3(b, x, onDolly ? DOLLY_TOP : 0, z, ry, LD3_K);
      }
      return b.build();
    }
    // — bố trí đội hình quanh máy bay —
    const VY = 0.12; // nâng toàn bộ xe mặt đất lên 0.12 đơn vị để bánh xe tì vừa khít chuẩn mặt sàn y=0
    const beltPos = lw(CARGO_FWD_X, 0, 1.39); const NR = new THREE.Vector3(Math.sin(PROT), 0, Math.cos(PROT)); // pháp tuyến phải thân
    const belt = cargoLoader();
    belt.position.copy(beltPos.clone().add(NR.clone().multiplyScalar(7.12 * LOADER_S - 0.806))); belt.position.y = VY;   // mũi sàn trước (x 7.12) thò vào miệng khoang 0.8
    // XOAY 180°: bỏ "+ Math.PI" ⇒ DECK CHÍNH (−x, chở ULD) quay vào máy bay, còn trạm lái + thang leo
    // nằm ở đầu NGOÀI — đúng bố trí main-deck loader thật (người lái đứng phía sân, không phía thân máy bay).
    belt.rotation.y = Math.atan2(NR.z, -NR.x); belt.scale.setScalar(LOADER_S); scene.add(belt);

    // xe bồn dựng theo fuel_truck.glb (1 đơn vị = 1 m) ⇒ scale = 0.498 world/m của máy bay: dài 14.65 · rộng 2.8 m (bản trước ×1.16)
    const fuel = makeTransparent(fuelTruck(), 0.9); fuel.position.set(-5, VY, -16); fuel.rotation.y = PROT + Math.PI; fuel.scale.setScalar(S747 * 1.1); scene.add(fuel);
    // ⛽ XE BƠM XĂNG VỚI SÀN NÂNG KÉO X (dời ra xa thân 20% lên z: -9.73)
    // CỠ THẬT (1 m = 0.498 world, scale ĐỀU — bản trước dẹt 0.446/0.52 làm bánh méo, xe chỉ dài 4 m). Quay đầu ngược hướng
    // mũi máy bay để sàn thao tác (đuôi xe) nằm dưới vùng mép trước cánh, tránh ốp ray flap. Đầu súng tra xăng chạm
    // MẶT DƯỚI CÁNH thật ngay trên nó (wingBotY), chừa 0.02 world.
    const RF_S = S747 * 1.1, RF_ROT = PROT + Math.PI, RF_POS = new THREE.Vector3(-13.84, VY, -9.73);
    plane.updateMatrixWorld(true);
    const rfTip = plane.worldToLocal(new THREE.Vector3(-2.8 * RF_S, 0, -0.7 * RF_S).applyAxisAngle(new THREE.Vector3(0, 1, 0), RF_ROT).add(RF_POS));
    const refuelVehicle = makeTransparent(refueler((wingBotY(rfTip.x, Math.abs(rfTip.z)) * 1.1 - 0.02 - VY) / RF_S), 0.9);
    refuelVehicle.position.copy(RF_POS);
    refuelVehicle.rotation.y = RF_ROT;
    refuelVehicle.scale.setScalar(RF_S);
    scene.add(refuelVehicle);
    // VÒI GIAO NHIÊN LIỆU xe bồn → xe tra nạp: đáy tang cuộn → con lăn mép sàn → võng xuống sân → nằm sát sân uốn lượn nhẹ
    // → ngóc lên khớp nhận mạn xe tra nạp. Bản trước: ống nằm sân cắt cụt, đâm ngang vào khớp trắng treo dưới sàn đuôi
    // xe bồn; đầu kia chui vào giữa gầm xe tra nạp.
    (function fuelHose() {
      fuel.updateMatrixWorld(true); refuelVehicle.updateMatrixWorld(true);
      const A = fuel.userData.hosePath.map(p => fuel.localToWorld(p.clone()));
      const B = refuelVehicle.userData.hoseIn.map(p => refuelVehicle.localToWorld(new THREE.Vector3(p[0], p[1], p[2]))).reverse();
      const a = A[A.length - 1], c = B[0], d = c.clone().sub(a), perp = new THREE.Vector3(-d.z, 0, d.x).normalize();
      const mid = [[0.18, -0.3], [0.38, 1.2], [0.62, -0.9], [0.82, 0.6]].map(([t, o]) => a.clone().lerp(c, t).addScaledVector(perp, o));
      GSE_X.fuelHose = new THREE.Mesh(new THREE.TubeGeometry(onGround([...A, ...mid, ...B], 0.0225), 220, 0.0225, 8), M(DARK)); scene.add(GSE_X.fuelHose);
    })();

    const gp = gpu(); gp.position.set(1.5, VY, 10.5); gp.rotation.y = 2.1; gp.scale.set(0.576, 0.576, 0.576); scene.add(gp);   // cỡ thật: thân 2.4 × 1.5 × cao 1.95 m
    (function cable() {                                                               // cáp 400 Hz: cổ cáp GPU → buông sát đất → ổ cắm dưới mũi
      gp.updateMatrixWorld(true);
      const a = gp.localToWorld(new THREE.Vector3(1.0, 1.0, 0.3)), c = lw(13.6, gy(-1.57) - 0.03, -0.3);
      const at = (t, y) => a.clone().lerp(c, t).setY(y);
      const cv = onGround([a, at(0.05, a.y * 0.45), at(0.14, VY + 0.06), at(0.5, VY + 0.06), at(0.86, VY + 0.07), at(0.95, c.y * 0.5), c], 0.055);
      GSE_X.gpuCable = new THREE.Mesh(new THREE.TubeGeometry(cv, 80, 0.055, 6), M(DARK)); scene.add(GSE_X.gpuCable);
    })();

    // toạ độ trong danh sách viết cho scale cũ 0.56 ⇒ nhân 0.56 / CL_S để container giữ nguyên chỗ trên sân
    const cargo = ldCluster([[1, 27, 0.1, 0], [3.5, 27.5, -0.08, 0], [6, 27, 0.05, 0], [1.5, 31, 0, 1], [4.5, 31.2, 0.12, 1], [-19, 27.5, 0.3, 0], [-16.5, 28.2, 0.25, 0], [-8.5, 27.2, 0.15, 0], [-6.0, 27.8, -0.1, 0], [-11.0, 27.5, 0.05, 0]]
      .map(([x, z, ry, d]) => [x * 0.56 / CL_S, z * 0.56 / CL_S, ry, d]));
    cargo.position.y = VY; cargo.scale.set(CL_S, CL_S, CL_S); scene.add(cargo);         // đáy container / bánh dolly tì đúng mặt sân (bản cũ +0.13 ⇒ lơ lửng)

