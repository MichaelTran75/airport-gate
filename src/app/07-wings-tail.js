      // ═══ CÁNH — CẤU TRÚC CƠ KHÍ (G 12/10: "research, rebuild the wings mechanic structures") ═══
      // Bố trí theo 747-8 (Boeing · AIN 2006/2009 · Moog 747 datasheet): MÉP TRƯỚC 3 Krueger gốc (mũi gập) + 10 Krueger biến
      // cong (5 giữa 2 động cơ, 5 ngoài) nằm phẳng ở bụng mép trước · MÉP SAU: flap trong HAI KHE (flap chính + flap sau),
      // aileron trong (tốc độ cao) sau động cơ trong, flap ngoài MỘT KHE (747-8 bỏ flap 3 khe của 747-400), aileron ngoài ·
      // 6 spoiler/cánh (2 trong + 4 ngoài, đúng 1 + 4 PCU + 1 xi-lanh 3 vị trí theo Moog) đậy hốc flap.
      // Hộp cánh: dầm trước 15 %, dầm sau 60 % dây cung, sườn ~1.45 m · trục truyền flap chạy sau dầm sau từ bộ dẫn động
      // (PDU) ở gốc cánh tới 4 hộp số + vít me bi ở 4 ray flap (trong canoe) · ray thép + xe trượt · mỗi spoiler 1 xi-lanh,
      // mỗi aileron 2 bộ trợ lực (PCU), mỗi Krueger 1 bộ dẫn động. Kết cấu ĐẶC (không mờ) ⇒ đọc qua vỏ cánh trong suốt.
      // Mặt điều khiển là KHỐI RỜI có khe (thay nét mực cũ). Flap & Krueger có khớp: mở cấu hình cất cánh khi nổ máy.
      const WING_MOV = []; window.__wingMov = WING_MOV;
      const wb = Bag(), SPAR = 0xc4cad1, MECH = 0x8b939c;
      const wingStruct = (() => {
        const yOf = (s) => S747 * s - WROOT;
        const LEx = (y) => wingAt(WING_LE, y), TEx = (y) => wingAt(WING_TE, y);
        const hT = (y, u) => 0.5 * wingTc(y) * (LEx(y) - TEx(y)) * tChord(Math.min(1, Math.max(0, u)));
        const BRK = [...new Set([...WING_LE, ...WING_TE].map(p => p[1]))];
        const stations = (yA, yB, n) => {
          const a = []; for (let i = 0; i <= n; i++) a.push(yA + (yB - yA) * i / n);
          for (const b of BRK) if (b > yA + 1e-3 && b < yB - 1e-3) a.push(b);
          a.sort((p, q) => p - q); return a.filter((v, i) => !i || v - a[i - 1] > 1e-4);
        };
        const PT = (sg, y, u, h) => [LEx(y) + (TEx(y) - LEx(y)) * u, wingMidY(y + WROOT) + h, sg * (WROOT + y)];
        const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
        // khối kín bám biên dạng cánh: sải sA→sB (m), dây cung uA→uB, mặt trên hi(y,u) / dưới lo(y,u) so với mặt giữa
        function solid(sg, sA, sB, uA, uB, [hi, lo], nc = 8, perM = 0.8) {
          const ys = stations(yOf(sA), yOf(sB), Math.max(1, Math.ceil((sB - sA) * perM))), NY = ys.length, W = nc + 1, V = [], I = [];
          const grid = (fn) => { const b = V.length / 3; for (const y of ys) for (let j = 0; j <= nc; j++) { const u = uA + (uB - uA) * j / nc; V.push(...PT(sg, y, u, fn(y, u))); } return b; };
          const t0 = grid(hi), b0 = grid(lo);
          for (let i = 0; i < NY - 1; i++) for (let j = 0; j < nc; j++) {
            const a = i * W + j, b = a + 1, c = a + W + 1, d = a + W;
            I.push(t0 + a, t0 + d, t0 + b, t0 + b, t0 + d, t0 + c, b0 + a, b0 + b, b0 + d, b0 + b, b0 + c, b0 + d);
          }
          const cap = (idx) => {
            const b = V.length / 3;
            for (const k of idx) for (const o of [t0, b0]) V.push(V[(o + k) * 3], V[(o + k) * 3 + 1], V[(o + k) * 3 + 2]);
            for (let k = 0; k < idx.length - 1; k++) { const q = b + 2 * k; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
          };
          cap([...Array(W).keys()]); cap([...Array(W).keys()].map(j => (NY - 1) * W + j));
          cap([...Array(NY).keys()].map(i => i * W)); cap([...Array(NY).keys()].map(i => i * W + nc));
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
        }
        // các kiểu bề dày
        const SKIN = [(y, u) => hT(y, u), (y, u) => -hT(y, u)];
        const INNER = (d) => [(y, u) => Math.max(0.004, hT(y, u) - d), (y, u) => -Math.max(0.004, hT(y, u) - d)];
        const NOSED = (uA, nl, k = 0.93) => { const f = (u) => { const t = Math.min(1, Math.max(0, (u - uA) / nl)); return k * (0.3 + 0.7 * Math.sqrt(1 - (1 - t) * (1 - t))); }; return [(y, u) => hT(y, u) * f(u), (y, u) => -hT(y, u) * f(u)]; };
        const PLATE_UP = (off, t) => [(y, u) => hT(y, u) + off, (y, u) => hT(y, u) + off - t];
        const PLATE_LO = (off, t) => [(y, u) => -hT(y, u) - off + t, (y, u) => -hT(y, u) - off];
        const bar = (a, b, r, col, seg = 8) => {
          const d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 1e-4) return;
          const g = new THREE.CylinderGeometry(r, r, L, seg); g.translate(0, L / 2, 0);
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
          wb.add(g, col, { thresh: 40, soft: true });
        };
        const blk = (c, w, h, d, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(c.x, c.y, c.z); wb.add(g, col, { soft: true }); };
        // khớp quay: hình học dựng theo toạ độ máy bay → nhóm đặt ở điểm bản lề H, trục = đường bản lề (hướng +z)
        function hinged(geo, A, B) {
          const H = V3(A).add(V3(B)).multiplyScalar(0.5), axis = V3(B).sub(V3(A)).normalize(); if (axis.z < 0) axis.negate();
          geo.translate(-H.x, -H.y, -H.z);
          const m = edged(geo, WHITE, { mat: PW_MAT, thresh: 14 });
          const g = new THREE.Group(); g.position.copy(H); g.add(m); g.userData.isWing = true;
          return { g, H, axis };
        }
        // ── bố trí (sải m từ tim thân) ──
        const TE = [[1.11, 3.4, 'fix'], [3.4, 11.3, 'flap2'], [11.3, 11.45, 'fix'], [11.45, 13.35, 'ail'], [13.35, 13.5, 'fix'],
          [13.5, 20.9, 'flap1'], [20.9, 21.1, 'fix'], [21.1, 29.6, 'ail'], [29.6, 34.37, 'fix']];
        const SPOIL = [[6.3, 8.65], [8.75, 11.2]];
        for (let k = 0; k < 4; k++) SPOIL.push([13.6 + k * 1.8 + 0.03, 13.6 + (k + 1) * 1.8 - 0.03]);
        const KR = []; const addK = (a, b, n, vc) => { const w = (b - a) / n; for (let k = 0; k < n; k++) KR.push([a + k * w + 0.05, a + (k + 1) * w - 0.05, vc]); };
        addK(4.3, 11.15, 3, false); addK(12.75, 20.4, 5, true); addK(21.85, 30.2, 5, true);
        const TRACKS = [6.03, 8.82, 14.82, 18.25];
        const U_FS = 0.15, U_RS = 0.60, U_SP = 0.778, U_FL = 0.745;

        return function (sg) {
          const fixed = [];
          fixed.push(solid(sg, 1.11, 34.37, 0, U_RS, SKIN, 10, 1.2));                         // hộp cánh + mép trước cố định
          for (const [a, b, t] of TE) {
            if (t === 'fix') { fixed.push(solid(sg, a, b, U_RS, 1, SKIN, 6, 1.2)); continue; }
            fixed.push(solid(sg, a, b, U_RS, U_FL + 0.02, PLATE_LO(0, 0.012), 3, 1));         // tấm đáy hốc flap / aileron
            // tấm trên: spoiler ở chỗ có, còn lại tấm cố định — cùng chia khe để thấy mép
            const sp = SPOIL.filter(([p, q]) => p >= a - 1e-6 && q <= b + 1e-6);
            let c0 = a; for (const [p, q] of sp) {
              if (p - c0 > 0.05) fixed.push(solid(sg, c0, p - 0.03, U_RS, U_SP, PLATE_UP(0, 0.012), 3, 1));
              // spoiler: bản lề ở mép trước (dầm sau, mặt trên) ⇒ quay lên ~45° khi chạm đất (ground spoiler / speedbrake)
              const yp = yOf(p), yq = yOf(q), uh = U_RS + 0.005;
              const S = hinged(solid(sg, p, q, uh, U_SP, PLATE_UP(0.004, 0.014), 3, 1), PT(sg, yp, uh, hT(yp, uh) + 0.004), PT(sg, yq, uh, hT(yq, uh) + 0.004));
              plane.add(S.g); WING_MOV.push({ kind: 'sp', g: S.g, H: S.H, axis: S.axis, ang: -45, dx: 0, dy: 0 });
              c0 = q + 0.03;
            }
            if (b - c0 > 0.05) fixed.push(solid(sg, c0, b, U_RS, U_SP, PLATE_UP(0, 0.012), 3, 1));
            const ym = yOf((a + b) / 2), ch = LEx(ym) - TEx(ym);
            if (t === 'ail') { fixed.push(solid(sg, a + 0.04, b - 0.04, 0.775, 1, NOSED(0.775, 0.05), 6, 1)); continue; }
            if (t === 'flap2') {                                                                // flap chính + flap sau (2 khe)
              const uM = 0.95;
              const mainG = solid(sg, a + 0.04, b - 0.04, U_FL, uM, NOSED(U_FL, 0.05), 6, 1);
              const yA = yOf(a + 0.04), yB = yOf(b - 0.04);
              const M1 = hinged(mainG, PT(sg, yA, U_FL + 0.012, 0), PT(sg, yB, U_FL + 0.012, 0));
              const aftG = solid(sg, a + 0.1, b - 0.1, 0.935, 1, NOSED(0.935, 0.025, 0.8), 4, 1);
              const A2 = PT(sg, yOf(a + 0.1), 0.94, 0), B2 = PT(sg, yOf(b - 0.1), 0.94, 0);
              const M2 = hinged(aftG, A2, B2); M2.g.position.sub(M1.H); M1.g.add(M2.g);
              plane.add(M1.g);
              WING_MOV.push({ kind: 'flap', g: M1.g, H: M1.H, axis: M1.axis, ang: 20, dx: -0.30 * (uM - U_FL) * ch, dy: -0.10 * (uM - U_FL) * ch });
              WING_MOV.push({ kind: 'flap', g: M2.g, H: M2.g.position.clone(), axis: M2.axis, ang: 14, dx: -0.03 * ch, dy: -0.01 * ch });
            } else {                                                                            // flap ngoài 1 khe
              const fg = solid(sg, a + 0.04, b - 0.04, U_FL, 1, NOSED(U_FL, 0.05), 6, 1);
              const F = hinged(fg, PT(sg, yOf(a + 0.04), U_FL + 0.012, 0), PT(sg, yOf(b - 0.04), U_FL + 0.012, 0));
              plane.add(F.g);
              WING_MOV.push({ kind: 'flap', g: F.g, H: F.H, axis: F.axis, ang: 20, dx: -0.32 * (1 - U_FL) * ch, dy: -0.08 * (1 - U_FL) * ch });
            }
          }
          // Krueger: tấm phẳng bụng mép trước, bản lề ở mép trước ⇒ quay xuống-ra trước ~120°
          for (const [a, b, vc] of KR) {
            const g = solid(sg, a, b, 0.012, 0.135, PLATE_LO(0.008, 0.018), 5, 1);
            const ya = yOf(a), yb = yOf(b);
            const K = hinged(g, PT(sg, ya, 0.012, -hT(ya, 0.012) - 0.008), PT(sg, yb, 0.012, -hT(yb, 0.012) - 0.008));
            plane.add(K.g);
            WING_MOV.push({ kind: 'kr', g: K.g, H: K.H, axis: K.axis, ang: vc ? 125 : 112, dx: 0, dy: 0 });
            const ym = yOf((a + b) / 2);                                                      // bộ dẫn động Krueger
            bar(V3(PT(sg, ym - 0.12, 0.06, -0.45 * hT(ym, 0.06))), V3(PT(sg, ym + 0.12, 0.06, -0.45 * hT(ym, 0.06))), 0.022, MECH);
          }
          const st = new THREE.Group(); st.userData.isWing = true;
          st.add(edged(mergeGeometries(fixed), WHITE, { mat: PW_MAT, thresh: 14 })); plane.add(st);

          // ── kết cấu trong (đặc) ──
          wb.add(solid(sg, 1.11, 33.0, U_FS - 0.003, U_FS + 0.003, INNER(0.012), 1, 1.2), SPAR, { thresh: 30, soft: true });   // dầm trước
          wb.add(solid(sg, 1.11, 32.2, U_RS - 0.006, U_RS - 0.001, INNER(0.012), 1, 1.2), SPAR, { thresh: 30, soft: true });   // dầm sau
          for (let s = 2.6; s < 32.5; s += 1.45) wb.add(solid(sg, s, s + 0.05, U_FS + 0.003, U_RS - 0.006, INNER(0.014), 6, 1), SPAR, { thresh: 30, soft: true });
          // trục truyền flap + PDU + hộp số + vít me bi + ray + xe trượt
          const tube = (s) => { const y = yOf(s); return V3(PT(sg, y, 0.62, -0.35 * hT(y, 0.62))); };
          const TS = [1.6, 3.4, 6.03, 8.82, 11.3, 13.5, 14.82, 18.25, 20.6];
          for (let k = 0; k < TS.length - 1; k++) bar(tube(TS[k]), tube(TS[k + 1]), 0.018, MECH, 6);
          blk(tube(1.6), 0.28, 0.16, 0.22, MECH);                                                // PDU
          for (const s of TRACKS) {
            const y = yOf(s), xT = TEx(y);
            blk(tube(s), 0.1, 0.1, 0.1, MECH);
            const rs = V3(PT(sg, y, U_RS, -hT(y, U_RS) - 0.03)), tail = new THREE.Vector3(xT - S747 * 1.0, wingBotY(xT + 1e-3, WROOT + y) - S747 * 0.32, sg * (WROOT + y));
            bar(rs, tail, 0.026, MECH, 6);                                                         // ray flap
            const car = V3(PT(sg, y, 0.79, -hT(y, 0.79) - 0.06)); blk(car, 0.16, 0.08, 0.1, MECH);  // xe trượt
            bar(tube(s), V3(PT(sg, y, 0.8, -0.55 * hT(y, 0.8))), 0.022, MECH, 6);                  // vít me bi
          }
          for (const [a, b] of SPOIL) { const y = yOf((a + b) / 2); bar(V3(PT(sg, y, 0.605, 0)), V3(PT(sg, y, 0.70, hT(y, 0.70) - 0.03)), 0.016, MECH, 6); }
          for (const [a, b, t] of TE) if (t === 'ail') for (const f of [0.3, 0.7]) { const y = yOf(a + (b - a) * f); bar(V3(PT(sg, y, 0.605, -0.2 * hT(y, 0.605))), V3(PT(sg, y, 0.79, 0)), 0.02, MECH, 6); }
        };
      })();
      for (const sgn of [1, -1]) {
        // ═══ CÁNH 747-8 — TỈ LỆ THẬT (WING_LE/TE/MID/TC khai báo ngoài makePlane, đo từ GLB): quét 44° → 41°, gãy Yehudi
        // mép sau, mút vát (raked) quét 61°; DÀY 12% → 8% dây cung (bản trước là tấm mỏng 2.7%); mặt giữa cánh CONG
        // theo mẫu (nhị diện ~6° đoạn trong, ~3° đoạn ngoài, mút vểnh) — thay cho 1 góc xoay chung.
        // Hình học dựng với trục dày = z rồi xoay ±π/2: cánh phải lật dấu ⇒ midFn mang dấu theo bên.
        const lePts = WING_LE, tePts = WING_TE;
        const WD = (y, c) => wingTc(y) * c;
        const wMid = (y) => (sgn < 0 ? 1 : -1) * (wingMidY(y + WROOT) - WY0);
        wingStruct(sgn);                                                                   // cánh = khối rời + kết cấu (xem trên)
        const wing = new THREE.Group(); wing.position.set(0.0, WY0, sgn * WROOT); wing.userData.isWing = true;
        plane.add(wing);
        beginInk();
        const wp = (y0, y1, u0, u1) => addWingPanel(wing, lePts, tePts, WD, y0, y1, u0, u1, sgn < 0, wMid);
        wp(3.9, 4.25, 0.30, 0.38); wp(7.6, 7.95, 0.32, 0.40);                               // nắp thăm nhiên liệu
        endInk(wing, sgn < 0);

        // ═══ ĐUÔI NGANG — GLB: gốc ở tim nón đuôi (y 3.16 m), quét mép trước 43.5°, mép sau 15°, nhị diện 7.5°,
        // nửa sải 11.03 m; mép sau gốc chạm nón đuôi đã thon (z −36.5). Tọa độ x tuyệt đối, y sải từ z = 0.3.
        const hlePts = [[-12.4, 0], [gx(-28.22), S747 * 2.3 - 0.3], [gx(-28.97), S747 * 2.8 - 0.3], [gx(-36.57), S747 * 10.8 - 0.3], [gx(-36.85), S747 * 11.03 - 0.3]];
        const htePts = [[gx(-36.47), 0], [gx(-37.03), S747 * 2.8 - 0.3], [gx(-39.19), S747 * 10.8 - 0.3], [gx(-39.25), S747 * 11.03 - 0.3]];
        const HD = (y, c) => 0.09 * c;
        const hs = edged(wingShapeGeo(hlePts, htePts, HD, sgn < 0), WHITE, { mat: PW_MAT, thresh: 14 });
        // gốc nâng 3.16 → 3.60 m GLB (tâm nón đuôi 3.64): Boeing §2.3.2 đầu đuôi ngang L = 8.58–9.12 m (gốc GLB cũ ⇒ 8.41 m sau khi hạ thân)
        hs.position.set(0, gy(3.60) - (S747 * 2.8 - 0.3) * 0.131, sgn * 0.3); hs.rotation.x = -sgn * Math.atan(0.131);
        hs.userData.isWing = true;
        plane.add(hs);
        // panel line cho đuôi ngang (elevator) + vách chia elevator trong/ngoài
        addWingPanel(hs, hlePts, htePts, HD, 0.45, 4.55, 0.70, 0.96, sgn < 0);
        detailSegs(hs, hlePts, htePts, HD, sgn < 0, [[2.4, 0.70, 2.4, 0.96]]);

        // Flap track fairings ("canoe") — 4 ốp/cánh dựng theo TIẾT DIỆN đo trên mẫu GLB (G 10/10: "study air plane structure"):
        // trạm [z m, nửa rộng m, trên, dưới]. Trạm DƯỚI CÁNH: trên = 0 (áp/ngập bụng cánh), dưới = độ sâu so với mặt dưới cánh ·
        // trạm SAU MÉP SAU: trên/dưới đo so với mép sau flap. Dài 7.1 / 7.5 / 6.1 / 5.3 m, sâu 0.9 → 0.6 m, rộng 0.87 → 0.63 m,
        // nhọn 2 đầu, đuôi thò ~1.2 m sau mép flap (bản trước: nón mảnh dài 4 m, chỉ lộ như que). Tiết diện siêu-elip e 2.5,
        // nội suy Catmull-Rom giữa các trạm, lưới có chỉ số ⇒ pháp tuyến mượt.
        const CANOE = [
          [6.03, [[1.68, 0, 0, 0], [0.78, 0.245, 0, 0.36], [-0.73, 0.40, 0, 0.69], [-2.20, 0.435, 0, 0.80], [-3.07, 0.435, 0, 0.88], [-4.06, 0.405, 0, 0.87]],
            [[-4.49, 0.32, -0.07, -0.80], [-5.39, 0.01, -0.41, -0.52]]],
          [8.82, [[1.17, 0, 0, 0], [0.27, 0.235, 0, 0.34], [-1.24, 0.395, 0, 0.63], [-2.71, 0.43, 0, 0.81], [-3.83, 0.435, 0, 0.87], [-5.01, 0.41, 0, 0.85]],
            [[-5.43, 0.315, -0.07, -0.78], [-6.33, 0.01, -0.41, -0.52]]],
          [14.82, [[-2.97, 0, 0, 0], [-3.87, 0.205, 0, 0.26], [-4.70, 0.285, 0, 0.41], [-5.89, 0.355, 0, 0.56], [-6.83, 0.355, 0, 0.63], [-7.70, 0.345, 0, 0.66]],
            [[-8.33, 0.265, -0.10, -0.59], [-9.08, 0.01, -0.36, -0.46]]],
          [18.25, [[-5.69, 0, 0, 0], [-6.59, 0.185, 0, 0.29], [-7.40, 0.24, 0, 0.44], [-8.48, 0.31, 0, 0.57], [-9.55, 0.315, 0, 0.59]],
            [[-10.22, 0.245, -0.09, -0.53], [-11.00, 0.01, -0.30, -0.39]]]];
        for (const [sp, under, aft] of CANOE) {
          const fz = S747 * sp, xTE = wingAt(WING_TE, fz - WROOT), yTE = wingBotY(xTE + 1e-3, fz);
          const st = [...under.map(([z, hw, , dp]) => { const x = gx(z), yb = wingBotY(x, fz); return [x, S747 * hw, yb + 0.05, yb - S747 * dp]; }),
            ...aft.map(([z, hw, tp, bt]) => [gx(z), S747 * hw, yTE + S747 * tp, yTE + S747 * bt])];
          const cr = (k, j, t) => {                                               // Catmull-Rom 1 thành phần giữa trạm k → k+1
            const P = (i) => st[Math.max(0, Math.min(st.length - 1, i))][j], p0 = P(k - 1), p1 = P(k), p2 = P(k + 1), p3 = P(k + 2);
            return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
          };
          const NR = 14, E = 2 / 2.5, cv = [], ci = [];
          let nr = 0;
          for (let k = 0; k < st.length - 1; k++) for (let q = 0; q < (k === st.length - 2 ? 5 : 4); q++) {
            const t = q / 4, x = cr(k, 0, t), hw = Math.max(0.002, cr(k, 1, t)), tp = cr(k, 2, t), bt = Math.min(cr(k, 3, t), tp - 0.002);
            const yc = (tp + bt) / 2, hh = (tp - bt) / 2;
            for (let i = 0; i < NR; i++) {
              const th = 2 * Math.PI * i / NR, c = Math.cos(th), sn = Math.sin(th);
              cv.push(x, yc + hh * Math.sign(sn) * Math.abs(sn) ** E, sgn * fz + hw * Math.sign(c) * Math.abs(c) ** E);
            }
            nr++;
          }
          for (let k = 0; k < nr - 1; k++) for (let i = 0; i < NR; i++) {
            const a = k * NR + i, b = k * NR + (i + 1) % NR, c = (k + 1) * NR + (i + 1) % NR, d = (k + 1) * NR + i;
            ci.push(a, b, c, a, c, d);
          }
          const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cv, 3)); cg.setIndex(ci); cg.computeVertexNormals();
          pb.add(cg, MID, { thresh: 40 });
        }
      }
      { const WB = wb.build({ cast: false }); WB.traverse(o => { o.userData.noFade = true; }); plane.add(WB); }   // kết cấu cánh đặc, không mờ
      // ═══ ĐUÔI ĐỨNG — GLB: đỉnh 14.59 m (cao 9.7 m trên lưng), quét mép trước 50°, mép sau 22°, gốc 11.9 m → đỉnh 3.6 m,
      // gờ lưng (dorsal fillet) ở chân mép trước, dày 12% dây cung. Chân chìm dưới đỉnh lưng (lưng dâng nhẹ 4.71 → 4.9 m).
      // cao thêm 5.6%: đỉnh đuôi GLB 14.59 ⇒ 18.68 m trên mặt đất đúng; Boeing §2.3.2 K = 18.97–19.51 m ⇒ đỉnh 15.15 (19.24 m)
      const FIN_K = (15.15 - 4.6) / (14.59 - 4.6), FIN_Y0 = gy(4.6), fy = (y) => S747 * (y - 4.6) * FIN_K;
      const flePts = [[-9.4, 0], [gx(-22.58), fy(4.75)], [gx(-23.36), fy(4.9)], [gx(-24.44), fy(5.2)], [gx(-24.98), fy(5.5)],
      [gx(-25.58), fy(6.0)], [gx(-35.22), fy(14.0)], [gx(-35.91), fy(14.5)], [gx(-36.68), fy(14.58)]];
      const ftePts = [[-15.62, 0], [gx(-35.99), fy(4.9)], [gx(-36.43), fy(6.0)], [gx(-39.67), fy(14.0)], [gx(-39.87), fy(14.5)], [gx(-39.9), fy(14.58)]];
      const FD = (y, c) => 0.12 * c;
      const finG = wingShapeGeo(flePts, ftePts, FD, null);
      const fin = edged(finG, WHITE, { thresh: 14 }); fin.position.set(0, FIN_Y0, 0);
      fin.userData.isWing = true;
      plane.add(fin);
      // panel line rudder cho cánh đuôi đứng + vách chia rudder trên/dưới
      addWingPanel(fin, flePts, ftePts, FD, 0.25, 4.3, 0.68, 0.96, null);
      detailSegs(fin, flePts, ftePts, FD, null, [[2.3, 0.68, 2.3, 0.96]]);

