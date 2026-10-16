    /* ═══ 03-jet bridge — rotunda · hành lang cố định · ống lồng 3 đoạn · cột nâng + bogie · cab + ống xếp ═══
       Thứ tự đoạn đúng như cầu thật: A (sát rotunda) HẸP nhất → C (sát cab) RỘNG nhất — đoạn ngoài trượt ÔM
       đoạn trong. Có: vành miệng mỗi đoạn, đố kính, tôn sóng, bogie 2 bánh + 2 cột nâng ty sáng + xà gánh sọc sơn,
       cầu thang công vụ có tay vịn, máy lạnh PCA treo gầm đoạn B + ống gió mềm chạy sát đất vào bụng máy bay,
       vạch sơn ô đỗ bánh cầu + cung quét giới hạn.
       TỈ LỆ THẬT (05/10): cùng hệ ~0.5 world/m với máy bay 747-8 · người · xe phục vụ · vỏ nhà ga (sàn khởi hành
       2.3 ≈ 4.6 m): ống rộng 2.9 → 3.6 m, cao 3.0–3.4 m; cab 3.6 m; canopy ôm cửa L1 1.1 × 1.95 m. Bản trước to ~2×
       (ống cao bằng nửa vách kính sảnh khởi hành — thật chỉ ~¼). Sàn rotunda + hành lang = sàn khởi hành nhà ga;
       ống lồng DỐC lên tới bậc cửa L1 (cầu thật dốc ≤ 1:12, ở đây ~2%); sàn cab PHẲNG ngang bậc cửa. */
    const D = lw(L1_X, gy(1.725), -(L1_HALFW + 0.03));                                // tâm cửa L1 trên da thân (world)
    const NOUT = new THREE.Vector3(-Math.sin(PROT), 0, -Math.cos(PROT));              // pháp tuyến trái thân
    const R0 = new THREE.Vector3(20, 0, -14);                                         // tâm rotunda
    const FLR = 2.3, FLC = gy(0.75) * 1.1 - 0.02;                                     // sàn rotunda (= sàn khởi hành nhà ga) · sàn cab (= bậc cửa L1, world)

    let telGroup, cabGroup, bellowsMeshes = [];
    const BRIDGE = {};                                                                // tay cầm cho chuỗi khởi hành: rút ống lồng / xoay cab / tháo PCA
    let lenConnected = 0;

    (function jetBridge() {
      const g = new THREE.Group(); scene.add(g);
      // rotunda: đế + cột tròn + vành sàn xoay + trống có dải kính 16 đố + mái 2 tầng + đèn hiệu
      const rb = Bag();
      rb.C(0.6, 0.2, R0.x, 0.1, R0.z, CREAM, { seg: 16 });
      rb.C(0.38, FLR - 0.3, R0.x, 0.2 + (FLR - 0.3) / 2, R0.z, MID, { seg: 16 });
      rb.C(1.31, 0.14, R0.x, FLR - 0.05, R0.z, MID, { seg: 24 });
      rb.C(1.25, 1.72, R0.x, FLR + 0.94, R0.z, CREAM, { seg: 24 });
      rb.C(1.265, 0.5, R0.x, FLR + 1.07, R0.z, GLASS, { seg: 24, noEdge: true });
      for (let i = 0; i < 16; i++) {
        const a = (i + 0.5) / 16 * Math.PI * 2;
        rb.P(0.04, 0.52, 0.05, R0.x + 1.275 * Math.cos(a), FLR + 1.07, R0.z + 1.275 * Math.sin(a), WHITE, { ry: -a, soft: true });
      }
      rb.C(1.38, 0.16, R0.x, FLR + 1.87, R0.z, WHITE, { seg: 24 });
      rb.C(0.68, 0.18, R0.x, FLR + 2.04, R0.z, MID, { seg: 16 });
      rb.C(0.07, 0.12, R0.x, FLR + 2.19, R0.z, ORANGE_GLOW, { seg: 8 });
      g.add(rb.build());

      // hành lang cố định rotunda → vách kính nhà ga: thân · mái hắt · dầm đáy · dải kính có đố · cột tròn + mũ cột
      const fx0 = R0.x + 1.1, fx1 = 56.3, fL = fx1 - fx0, fcx = (fx0 + fx1) / 2, FZ = R0.z;
      const fb = Bag(), ribPts = [];
      fb.P(fL, 1.66, 1.56, fcx, FLR + 0.83, FZ, CREAM, {});
      fb.P(fL, 0.12, 1.69, fcx, FLR + 1.72, FZ, WHITE, { soft: true });
      fb.P(fL, 0.16, 1.61, fcx, FLR - 0.05, FZ, MID, { soft: true });
      for (const s of [-1, 1]) {
        fb.P(fL - 0.6, 0.57, 0.04, fcx, FLR + 1.09, FZ + s * 0.79, GLASS, { noEdge: true });
        for (let x = fx0 + 0.3; x <= fx1 - 0.3 + 1e-6; x += 1.1) fb.P(0.05, 0.6, 0.05, x, FLR + 1.09, FZ + s * 0.8, WHITE, { soft: true });
        for (let x = fx0 + 0.4; x < fx1 - 0.3; x += 0.35) ribPts.push(new THREE.Vector3(x, FLR + 0.07, FZ + s * 0.79), new THREE.Vector3(x, FLR + 0.78, FZ + s * 0.79));
      }
      for (const cx of [28, 36, 43.6]) {                                              // cột dời khỏi lòng đường công vụ (44.5–55.5)
        fb.C(0.28, 0.1, cx, 0.17, FZ, CREAM, { seg: 12 });
        fb.C(0.17, FLR - 0.32, cx, 0.12 + (FLR - 0.32) / 2, FZ, MID, { seg: 12 });
        fb.P(0.5, 0.14, 1.3, cx, FLR - 0.2, FZ, MID, { soft: true });
      }
      g.add(fb.build());
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ribPts), LINE_FAINT));

      // ống lồng 3 đoạn: rotunda → sau cab. Nhóm tel đặt ở SÀN rotunda, quay theo hướng rồi NGHIÊNG dốc lên bậc cửa
      // (Euler XYZ: nghiêng quanh trục z cục bộ trước, quay hướng sau) — mọi chi tiết trong tel tính từ mặt sàn y = 0.
      const T = D.clone().add(NOUT.clone().multiplyScalar(2.1));
      const dx = T.x - R0.x, dz = T.z - R0.z, len = Math.hypot(dx, dz);
      const lenS = Math.hypot(len, FLC - FLR), hd = Math.atan2(-dz, dx);
      lenConnected = len;
      const tel = new THREE.Group(); tel.position.set(R0.x, FLR, R0.z); tel.rotation.set(0, hd, Math.atan2(FLC - FLR, len)); g.add(tel);
      telGroup = tel;
      const secs = [[0.9, lenS * 0.42, 1.48, 1.51], [lenS * 0.38, lenS * 0.72, 1.64, 1.61], [lenS * 0.68, lenS + 0.15, 1.82, 1.72]];
      // mỗi đoạn 1 nhóm riêng ⇒ rút được kiểu ống lồng thật (C lùi vào B, B lùi vào A); A cố định ở rotunda
      const secBags = [Bag(), Bag(), Bag()], ribs = [[], [], []];
      secs.forEach(([a, b, w, h], si) => {
        const tb = secBags[si], telRib = ribs[si];
        const cx = (a + b) / 2, cy = h / 2, L = b - a;
        tb.P(L, h, w, cx, cy, 0, CREAM, {});
        tb.P(L + 0.02, 0.08, w + 0.07, cx, h + 0.04, 0, WHITE, { soft: true });     // mái hắt
        tb.P(L, 0.1, w + 0.03, cx, 0.05, 0, MID, { soft: true });                       // gờ sàn
        tb.P(0.11, h + 0.08, w + 0.08, a + 0.055, cy + 0.02, 0, WHITE, { soft: true }); // vành miệng ôm đoạn trước
        for (const s of [-1, 1]) {
          tb.P(L - 0.36, 0.5, 0.03, cx, cy + 0.29, s * (w / 2 + 0.005), GLASS, { noEdge: true });
          for (let x = a + 0.3; x <= b - 0.15; x += 0.6) tb.P(0.04, 0.52, 0.03, x, cy + 0.29, s * (w / 2 + 0.015), WHITE, { soft: true });
          for (let x = a + 0.25; x < b - 0.1; x += 0.32) telRib.push(new THREE.Vector3(x, 0.12, s * (w / 2 + 0.01)), new THREE.Vector3(x, cy + 0.02, s * (w / 2 + 0.01)));
        }
      });
      // cửa hông đoạn C ra cầu thang công vụ
      const stx = lenS - 3.9, wC = 1.82;
      secBags[2].P(0.5, 0.98, 0.02, stx, 0.52, wC / 2 + 0.01, DARK, { soft: true });
      secBags[2].P(0.26, 0.22, 0.015, stx, 0.75, wC / 2 + 0.025, GLASS, { noEdge: true });
      // máy lạnh PCA treo gầm đoạn B: thân · lá chớp gió · 4 quang treo · cổ xả gió phía cab
      const px = lenS * 0.5;
      secBags[1].P(1.46, 0.44, 0.78, px, -0.31, 0, CREAM, {});
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) secBags[1].P(0.62, 0.02, 0.02, px - 0.29, -0.46 + i * 0.083, s * 0.4, DARK, { noEdge: true });
      for (const hx of [px - 0.57, px + 0.57]) for (const s of [-1, 1]) secBags[1].P(0.04, 0.12, 0.04, hx, -0.05, s * 0.31, MID, {});
      secBags[1].C(0.13, 0.22, px + 0.83, -0.31, 0, MID, { axis: 'x', seg: 12 });
      const secG = secBags.map((bg, si) => { const gg = new THREE.Group(); gg.add(bg.build()); if (ribs[si].length) gg.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ribs[si]), LINE_FAINT)); tel.add(gg); return gg; });
      g.updateMatrixWorld(true);

      // cột nâng + bogie dẫn động (apron drive) dưới đoạn C — ĐỨNG THẲNG trên sân (nhóm riêng, chỉ quay hướng):
      // xà gánh · 2 cột (ống ngoài + ty sáng) · xà đáy sọc sơn · mâm xoay · 2 bánh + 2 hộp mô-tơ · tủ điện · đèn hiệu
      const sx = lenS - 1.77, zc = wC / 2 + 0.17;
      const sw = tel.localToWorld(new THREE.Vector3(sx, 0, 0)), yF = sw.y;           // cao sàn ống lồng tại cột
      const dg = new THREE.Group(); dg.position.set(sw.x, 0, sw.z); dg.rotation.y = hd; g.add(dg);
      const db = Bag(), yb = 0.54, yTop = yF - 0.18;
      db.P(0.32, 0.18, 2 * zc + 0.26, 0, yF - 0.09, 0, MID, { soft: true });
      for (const s of [-1, 1]) {
        const hO = (yTop - yb) * 0.55;
        db.P(0.22, hO, 0.22, 0, yb + hO / 2, s * zc, MID, {});
        db.P(0.14, yTop - yb - hO + 0.05, 0.14, 0, yb + hO + (yTop - yb - hO) / 2, s * zc, SILVER, {});
        db.P(0.17, 0.24, 0.1, -0.21, yb + 0.3, s * (zc + 0.03), CREAM, { soft: true });
        for (let k = 0; k < 3; k++) db.P(0.02, 0.16, 0.05, 0.14, 0.47, s * (zc - 0.18 - k * 0.15), PAINT, { rx: 0.62, noEdge: true });
      }
      db.P(0.26, 0.14, 2 * zc + 0.21, 0, 0.47, 0, MID, { soft: true });
      db.C(0.29, 0.05, 0, 0.36, 0, DARK, { seg: 16 });
      for (const s of [-1, 1]) {
        db.P(0.65, 0.22, 0.04, 0, 0.21, s * 0.32, MID, { soft: true });
        db.P(0.21, 0.17, 0.16, -0.26, 0.22, s * 0.2, DARK, {});
        stdWheel(db, 0.06, s * 0.2, 0.22, s);
      }
      db.C(0.05, 0.09, 0.06, 0.58, 0, ORANGE_GLOW, { seg: 8 });
      dg.add(db.build());

      // cầu thang công vụ hông đoạn C (nhóm đứng thẳng): chiếu nghỉ · 14 bậc · 2 dầm thang · tay vịn & cột
      const sp = tel.localToWorld(new THREE.Vector3(stx, 0, 0)), yS = sp.y;
      const sg = new THREE.Group(); sg.position.set(sp.x, 0, sp.z); sg.rotation.y = hd; g.add(sg);
      const sbg = Bag(), SZ0 = wC / 2 + 0.02, SZ1 = SZ0 + 0.82, nS = 14, rise = yS / (nS + 1), tread = 0.26;
      sbg.P(0.9, 0.07, SZ1 - SZ0, 0, yS - 0.035, (SZ0 + SZ1) / 2, MID, { soft: true });
      for (let i = 0; i < nS; i++) sbg.P(0.68, 0.04, 0.25, 0, yS - (i + 1) * rise, SZ1 + 0.13 + i * tread, MID, { soft: true });
      const sz1 = SZ1 + 0.13 + (nS - 1) * tread + 0.13, sAng = Math.atan2(yS - 0.06, sz1 - SZ1), sLen = Math.hypot(yS - 0.06, sz1 - SZ1);
      for (const s of [-1, 1]) {
        sbg.P(0.04, 0.15, sLen, s * 0.36, (yS + 0.06) / 2 - 0.04, (SZ1 + sz1) / 2, MID, { rx: sAng, soft: true });
        sbg.P(0.03, 0.03, sLen, s * 0.36, (yS + 0.06) / 2 + 0.45, (SZ1 + sz1) / 2, MID, { rx: sAng });
        for (let k = 0; k <= 3; k++) {
          const zz = SZ1 + k / 3 * (sz1 - SZ1 - 0.16) + 0.08, yy = yS - (zz - SZ1) * Math.tan(sAng);
          sbg.P(0.03, 0.46, 0.03, s * 0.36, yy + 0.23, zz, MID, {});
        }
        sbg.P(0.03, 0.03, SZ1 - SZ0, s * 0.45, yS + 0.46, (SZ0 + SZ1) / 2, MID, {});
        sbg.P(0.03, 0.46, 0.03, s * 0.45, yS + 0.23, SZ0 + 0.03, MID, {});
      }
      sg.add(sbg.build());

      // cab xoay (sàn y = 0 local; +z local hướng VÀO máy bay): thân · mái · gờ sàn · kính 2 hông · đèn pha gầm
      // · ống xếp (canopy) 9 nếp 2 cỡ 2 tông xen kẽ ôm cửa L1 · thanh cản · bánh dò cao độ (auto-leveler)
      const cb = Bag();
      const C = D.clone().add(NOUT.clone().multiplyScalar(1.31));
      cb.P(1.78, 1.5, 1.36, 0, 0.75, 0, CREAM, {});
      cb.P(1.84, 0.12, 1.42, 0, 1.56, 0, WHITE, { soft: true });
      cb.P(1.8, 0.1, 1.39, 0, 0.05, 0, MID, { soft: true });
      for (const s of [-1, 1]) {
        cb.P(0.03, 0.55, 0.88, s * 0.9, 1.0, -0.13, GLASS, { noEdge: true });
        for (const zz of [-0.57, -0.13, 0.31]) cb.P(0.04, 0.58, 0.04, s * 0.91, 1.0, zz, WHITE, { soft: true });
        cb.P(0.18, 0.1, 0.12, s * 0.57, -0.05, 0.47, CREAM, {});
        cb.P(0.14, 0.02, 0.09, s * 0.57, -0.11, 0.47, GLASS, { noEdge: true });
      }
      for (let i = 0; i < 9; i++) {
        const big = i % 2 === 0;
        cb.P(big ? 1.36 : 1.28, big ? 1.49 : 1.4, 0.065, 0, 0.75, 1.27 - i * 0.075, big ? 0xd6d1c4 : 0xc4bdae, { soft: true });
      }
      cb.P(1.3, 0.07, 0.12, 0, 0.12, 1.26, DARK, {});
      cb.P(0.03, 0.03, 0.31, 0.52, 0.05, 1.09, DARK, { rx: -0.5 });
      cb.C(0.05, 0.03, 0.52, -0.03, 1.23, DARK, { axis: 'x', seg: 10 });
      const cab = cb.build(); cab.position.set(C.x, FLC, C.z); cab.rotation.y = PROT; g.add(cab);
      cabGroup = cab; bellowsMeshes = cab.children;
      // RÚT ỐNG LỒNG: r (world) = quãng đoạn C lùi dọc trục ống (B lùi r/2) · cab, cột nâng, cầu thang đi theo đoạn C · cab xoay ra khỏi cửa
      {
        const sl = Math.atan2(FLC - FLR, len), ux = dx / len, uz = dz / len, home = { cab: cab.position.clone(), dg: dg.position.clone(), sg: sg.position.clone() };
        Object.assign(BRIDGE, { secG, cab, dg, sg, home, sl, ux, uz, R_MAX: 4.0 });
        BRIDGE.set = (r, swing) => {
          secG[2].position.x = -r; secG[1].position.x = -r * 0.5;
          const h = r * Math.cos(sl);
          cab.position.set(home.cab.x - ux * h, home.cab.y - r * Math.sin(sl), home.cab.z - uz * h); cab.rotation.y = PROT + swing;
          dg.position.set(home.dg.x - ux * h, home.dg.y, home.dg.z - uz * h); sg.position.set(home.sg.x - ux * h, home.sg.y, home.sg.z - uz * h);
        };
      }

      // vạch sơn cầu: ô đỗ bánh bogie (khung + chữ X) & cung quét giới hạn ống lồng (đứt nét)
      const mb = Bag(), bw = dg.position;
      const ms = (w, d, lx, lz, ry) => mb.P(w, 0.002, d, bw.x + lx * Math.cos(hd) + lz * Math.sin(hd), 0.141, bw.z - lx * Math.sin(hd) + lz * Math.cos(hd), PAINT, { ry: hd + ry, noEdge: true });
      for (const s of [-1, 1]) { ms(0.1, 1.5, s * 0.75, 0, 0); ms(1.5, 0.1, 0, s * 0.75, 0); ms(2.0, 0.07, 0, 0, s * Math.PI / 4); }
      const RA = len + 0.6;
      for (let a = hd - 0.3; a <= hd + 0.24; a += 1.4 / RA)
        mb.P(0.7, 0.002, 0.1, R0.x + RA * Math.cos(a), 0.141, R0.z - RA * Math.sin(a), PAINT, { ry: a + Math.PI / 2, noEdge: true });
      scene.add(mb.build({ cast: false, receive: true }));

      // ống gió mềm PCA: cổ xả → buông xuống đất → chạy sát đất VÒNG NGOÀI cột nâng phía xa → ngóc lên cổ nối dưới
      // bụng phình máy bay. Ống CREAM + gân PAINT mỗi 0.24 ⇒ đọc ra ống gió gân xoắn (Ø ~0.36 m thật).
      (function pcaHose() {
        const V = (x, y, z) => new THREE.Vector3(x, y, z), dW = V(dx / len, 0, dz / len);
        const o = tel.localToWorld(V(px + 0.95, -0.31, 0)), port = lw(5.6, gy(-2.31) - 0.02, -0.6);
        const pts = [o, o.clone().addScaledVector(dW, 0.3).setY(o.y - 0.5), o.clone().addScaledVector(dW, 0.8).setY(0.22),
          V(2.8, 0.2, -5.5), V(-0.5, 0.2, -5.35), V(-4.6, 0.2, -3.0), V(-8.8, 0.22, -0.3), port.clone().setY(0.55), port];
        const cv = onGround(pts, 0.075);
        const hose = new THREE.Mesh(new THREE.TubeGeometry(cv, 140, 0.075, 8), M(CREAM)); hose.castShadow = true; scene.add(hose); BRIDGE.pca = [hose];
        const rings = [], N = Math.floor(cv.getLength() / 0.24);
        for (let i = 1; i < N; i++) {
          const u = i / N, p = cv.getPointAt(u), tg = cv.getTangentAt(u);
          const r = new THREE.TorusGeometry(0.078, 0.013, 4, 10);
          r.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tg)); r.translate(p.x, p.y, p.z);
          rings.push(stripUV(r));
        }
        const rm = new THREE.Mesh(mergeGeometries(rings), M(PAINT)); scene.add(rm); BRIDGE.pca.push(rm);
      })();
    })();

