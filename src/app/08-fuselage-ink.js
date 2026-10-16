      /* ═══ cửa sổ · cửa khách · hầm hàng — "mực" ôm mặt thân lathe (cùng kỹ thuật ribbon, thay block nổi) ═══ */
      (function fuselageInk() {
        // điểm trên da thân (tiết diện ELIP: tâm cOffX · nửa rộng rOfX · dãn đứng kyX), nhô 0.03 (+ off) ra ngoài
        const fp = (x, ang, sd, off = 0) => {
          const R = rOfX(x) + 0.03 + off;
          return new THREE.Vector3(x, FY + cOffX(x) + kyX(x) * R * Math.sin(ang), sd * R * Math.cos(ang));
        };
        function strip(tris, railA, railB, N) {                    // dải quad giữa 2 ray tham số t∈[0,1]
          for (let i = 0; i < N; i++) {
            const t0 = i / N, t1 = (i + 1) / N;
            const a0 = railA(t0), a1 = railA(t1), b0 = railB(t0), b1 = railB(t1);
            tris.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z,
              b0.x, b0.y, b0.z, b1.x, b1.y, b1.z, a1.x, a1.y, a1.z);
          }
        }
        const lerp = (a, b, t) => a + (b - a) * t;
        /* ── Ô KÍNH BO GÓC: biên siêu-ellipse |u|ⁿ+|v|ⁿ=1 trong không gian tham số (trạm x, góc ang),
           rồi quạt tam giác từ tâm. n = 3.2 ⇒ "chữ nhật góc bo" đúng kiểu cửa sổ máy bay.
           Biên đi qua fp() nên mọi đỉnh vẫn BÁM ĐÚNG mặt cong thân — không phải tấm phẳng dán lên. ── */
        const NW = 16, WSE = [];
        for (let i = 0; i < NW; i++) {
          const t = i / NW * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
          WSE.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / 3.2), Math.sign(s) * Math.pow(Math.abs(s), 2 / 3.2)]);
        }
        function roundWindow(tris, cx, ca, hx, ha, sd) {
          const C = fp(cx, ca, sd);
          for (let i = 0; i < NW; i++) {
            const u = WSE[i], v = WSE[(i + 1) % NW];
            const A = fp(cx + u[0] * hx, ca + u[1] * ha, sd), B = fp(cx + v[0] * hx, ca + v[1] * ha, sd);
            tris.push(C.x, C.y, C.z, A.x, A.y, A.z, B.x, B.y, B.z);
          }
        }
        /* ── CỬA 3D CÓ ĐỘ DÀY: cùng họ siêu-ellipse với ô kính nhưng n = 4.0 (góc bo chặt hơn, đúng dáng cửa
           khách 747). Vành CHÂN bám da (off 0) + vành MẶT nhô `th`; quạt vành mặt ⇒ cánh cửa, nối 2 vành ⇒ VÁCH DÀY.
           pf = hàm điểm da (mặc định fp; cửa tầng trên dùng skinPt trên vai bướu). ── */
        const NDR = 32, DSE = [];
        for (let i = 0; i < NDR; i++) {
          const t = i / NDR * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
          DSE.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / 4.0), Math.sign(s) * Math.pow(Math.abs(s), 2 / 4.0)]);
        }
        const dBound = (cx, ca, hx, ha) => DSE.map(u => [cx + u[0] * hx, ca + u[1] * ha]);
        // xf = phép biến đổi tuỳ chọn áp lên MỌI đỉnh — dùng để lật cánh cửa quanh bản lề khi mở.
        // backTris = mảng TUỲ CHỌN nhận thêm MẶT CÒN LẠI (off 0) — cửa đã lật mở nhìn từ ngoài vẫn có mặt thật.
        function doorSolid(tris, sd, cx, ca, hx, ha, th, xf, backTris, pf = fp) {
          const T = xf || (v => v);
          const P = dBound(cx, ca, hx, ha), C = T(pf(cx, ca, sd, th));
          const C0 = backTris ? T(pf(cx, ca, sd, 0)) : null;
          for (let i = 0; i < NDR; i++) {
            const a = P[i], b = P[(i + 1) % NDR];
            const A = T(pf(a[0], a[1], sd, th)), B = T(pf(b[0], b[1], sd, th));
            const A0 = T(pf(a[0], a[1], sd, 0)), B0 = T(pf(b[0], b[1], sd, 0));
            tris.push(C.x, C.y, C.z, A.x, A.y, A.z, B.x, B.y, B.z);                    // mặt cánh cửa
            tris.push(A0.x, A0.y, A0.z, A.x, A.y, A.z, B.x, B.y, B.z,                  // vách dày
              A0.x, A0.y, A0.z, B.x, B.y, B.z, B0.x, B0.y, B0.z);
            if (backTris) backTris.push(C0.x, C0.y, C0.z, B0.x, B0.y, B0.z, A0.x, A0.y, A0.z); // MẶT CÒN LẠI, winding ngược
          }
        }
        // nét viền bám biên bo góc, RỘNG ĐỀU — đo trong mặt phẳng (x, cung s = ang·Rs); Rs = bán kính cung theo góc
        function roundOutline(tris, sd, cx, ca, hx, ha, w, off, xf, pf = fp, Rs) {
          const T = xf || (v => v);
          const P = dBound(cx, ca, hx, ha), R = Rs || (rOfX(cx) + 0.03 + off) * kyX(cx), h = w / 2;
          for (let i = 0; i < NDR; i++) {
            const a = P[i], b = P[(i + 1) % NDR];
            let dx = b[0] - a[0], ds = (b[1] - a[1]) * R;
            const L = Math.hypot(dx, ds) || 1; dx /= L; ds /= L;   // ⇒ pháp tuyến chuẩn, nét không phình ở cạnh dài
            const nx = -ds * h, ns = dx * h;
            const q = (p, k) => T(pf(p[0] + k * nx, p[1] + k * ns / R, sd, off));
            const A1 = q(a, 1), A2 = q(a, -1), B1 = q(b, 1), B2 = q(b, -1);
            tris.push(A1.x, A1.y, A1.z, A2.x, A2.y, A2.z, B1.x, B1.y, B1.z,
              A2.x, A2.y, A2.z, B2.x, B2.y, B2.z, B1.x, B1.y, B1.z);
          }
        }
        /* ── HINGE: lật cánh cửa quanh mép TRÊN của chính nó (trục song song x, nằm trên da tại ang = ca + ha). ── */
        const hinge = (cx, ca, ha, sd, op) => {
          const R = rOfX(cx) + 0.03, aT = ca + ha;
          const hy = FY + cOffX(cx) + kyX(cx) * R * Math.sin(aT), hz = sd * R * Math.cos(aT);
          const co = Math.cos(op), si = Math.sin(op);
          return (v) => {
            const y = v.y - hy, z = v.z - hz;
            return new THREE.Vector3(v.x, hy + y * co - z * si, hz + y * si + z * co);
          };
        };
        /* ── ĐẶT THEO CAO ĐỘ: tâm cửa/ô kính ở cao độ yc (so với FY), nửa cao hh ⇒ [góc tâm, nửa góc] trên elip tại x.
           Đuôi thu nhỏ + vểnh tâm nên cùng một góc sẽ trôi lên cao — tính theo cao độ giữ hàng cửa THẲNG. ── */
        const arcAt = (x, yc, hh) => {
          const R = rOfX(x) + 0.03, k = kyX(x), s = Math.max(-0.97, Math.min(0.97, (yc - cOffX(x)) / (k * R)));
          const ca = Math.asin(s); return [ca, hh / (k * R * Math.cos(ca))];
        };
        /* ── ĐIỂM DA THÂN CÓ BƯỚU: đi qua ĐÚNG hullDeform của da thân, nhô theo pháp tuyến tính số (sai phân). ── */
        const skinRaw = (x, phi) => { const r = rOfX(x), d = hullDeform(x, r * Math.sin(phi), r * Math.cos(phi)); return new THREE.Vector3(x, FY + d.y, d.z); };
        const skinPt = (x, phi, sd, off) => {
          const P = skinRaw(x, phi), e = 0.004;
          const n = new THREE.Vector3().crossVectors(skinRaw(x + e, phi).sub(skinRaw(x - e, phi)), skinRaw(x, phi + e).sub(skinRaw(x, phi - e))).normalize();
          if (n.y * (P.y - FY) + n.z * P.z < 0) n.negate();
          P.addScaledVector(n, off); P.z *= sd; return P;
        };
        const phiAt = (x, yRel) => {                               // góc φ trên da (nửa trên) có cao độ yRel so với FY
          let lo = 0, hi = Math.PI / 2;
          for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (skinRaw(x, m).y - FY < yRel) lo = m; else hi = m; }
          return (lo + hi) / 2;
        };
        function humpWindow(tris, cx, ca, hx, ha, sd) {              // ô kính siêu-ellipse trên vai bướu
          const C = skinPt(cx, ca, sd, 0.03);
          for (let i = 0; i < NW; i++) {
            const u = WSE[i], v = WSE[(i + 1) % NW];
            const A = skinPt(cx + u[0] * hx, ca + u[1] * ha, sd, 0.03), B = skinPt(cx + v[0] * hx, ca + v[1] * ha, sd, 0.03);
            tris.push(C.x, C.y, C.z, A.x, A.y, A.z, B.x, B.y, B.z);
          }
        }
        const humpArc = (x, yc, hh) => { const a0 = phiAt(x, yc - hh), a1 = phiAt(x, yc + hh); return [(a0 + a1) / 2, (a1 - a0) / 2]; };
        const inkT = [], glassT = [], doorT = [], doorBackT = [];
        const DTH = 0.035;                                         // độ dày cánh cửa nhô khỏi da thân
        const hy = (y) => S747 * (y - 1.32);                       // cao độ GLB (m) → so với FY
        // ═══ 5 CỬA KHÁCH / bên (texture GLB): L1 26.5 · L2 13.2 · L3 1.44 (trên cánh) · L4 −10.15 · L5 −24.5 m;
        // cửa 1.10 × 1.95 m, bậc cửa y 0.75 m (5.5 m trên mặt đất). Bản trước 4 cửa/bên, to gần gấp đôi thật.
        const DOOR_X = [26.5, 13.2, 1.44, -10.15, -24.5].map(gx), DW = S747 * 0.55, DH = S747 * 0.975, DYC = hy(1.725);
        // ═══ CỬA SỔ tầng chính: ô 0.24 × 0.34 m, tâm y 1.72 m, bước 0.5 m — các đoạn đúng như texture (thưa trên gốc cánh)
        const WIN_RUNS = [[-23.2, -10.9], [-9.2, 0.4], [3.58, 3.58], [5.6, 5.6], [6.6, 11.2], [14.7, 25.4], [27.85, 31.9]];
        const WIN_HX = S747 * 0.12, WIN_HH = S747 * 0.17, WIN_YC = hy(1.72);
        // ═══ TẦNG TRÊN: ô kính tâm y 4.32 m — 2 ô · khoảng trống · 15 ô · CỬA TẦNG TRÊN z 20.8 (1.2 × 1.95 m) · 9 ô
        const UP_Z = [10.15, 10.64];
        for (let z = 12.64; z <= 19.8; z += 0.508) UP_Z.push(z);
        for (let z = 21.78; z <= 25.85; z += 0.505) UP_Z.push(z);
        const UP_YC = hy(4.32), UP_HH = S747 * 0.16, UD_X = gx(20.8), UD_YC = hy(4.40), UD_HX = S747 * 0.6;
        for (const sd of [1, -1]) {
          for (const [z0, z1] of WIN_RUNS) for (let z = z0; z <= z1 + 1e-6; z += 0.5) {
            const x = gx(z);
            if (DOOR_X.some(dx => Math.abs(x - dx) < DW + 0.12)) continue;
            const [ca, ha] = arcAt(x, WIN_YC, WIN_HH);
            roundWindow(glassT, x, ca, WIN_HX, ha, sd);
          }
          for (const dx of DOOR_X) {                               // cửa khách: khối dày + nét viền trên mặt cánh
            const [ca, ha] = arcAt(dx, DYC, DH);
            doorSolid(doorT, sd, dx, ca, DW, ha, DTH);
            roundOutline(inkT, sd, dx, ca, DW, ha, 0.02, DTH);
          }
          for (const z of UP_Z) { const x = gx(z), [ca, ha] = humpArc(x, UP_YC, UP_HH); humpWindow(glassT, x, ca, WIN_HX, ha, sd); }
          // cửa tầng trên — nằm trọn trên vai bướu ⇒ dựng bằng skinPt (cùng hullDeform), viền đo theo cung thực của vai
          {
            const [ca, ha] = humpArc(UD_X, UD_YC, DH), Rs = DH * 2 / (2 * ha);
            doorSolid(doorT, sd, UD_X, ca, UD_HX, ha, DTH, null, null, skinPt);
            roundOutline(inkT, sd, UD_X, ca, UD_HX, ha, 0.02, DTH, null, skinPt, Rs);
          }
        }
        /* ── HẦM HÀNG (mạn phải) — cỡ thật 747: cửa trước & sau 2.64 × 1.68 m, ngưỡng y −1.23 m (khớp sàn xe nâng);
           cửa bulk 1.12 × 1.19 m. Hầm TRƯỚC ĐANG MỞ: TÔ ĐEN đúng biên miệng khoang (nhô +0.005 ⇒ đè lên da, đen crisp). ── */
        const CHX = S747 * 1.32, CHH = S747 * 0.84;
        const [FCA, FHA] = arcAt(CARGO_FWD_X, hy(-0.39), CHH);
        const holeT = [];
        (() => {
          const P = dBound(CARGO_FWD_X, FCA, CHX, FHA), C = fp(CARGO_FWD_X, FCA, 1, 0.005);
          for (let i = 0; i < NDR; i++) {
            const a = P[i], b = P[(i + 1) % NDR];
            const A = fp(a[0], a[1], 1, 0.005), B = fp(b[0], b[1], 1, 0.005);
            holeT.push(C.x, C.y, C.z, A.x, A.y, A.z, B.x, B.y, B.z);
          }
        })();
        roundOutline(inkT, 1, CARGO_FWD_X, FCA, CHX, FHA, 0.02, 0);         // viền miệng khoang
        /* CÁNH CỬA KHOANG — dựng ở thế ĐÓNG rồi đặt vào nhóm quay quanh bản lề mép trên (trục // x): mở = −2.5 rad (143°, dựng
           lên & hất RA NGOÀI, cao hơn miệng khoang nên không che hốc đen). G 14/10: cửa phải ĐÓNG trước khi đẩy lùi (19b-departure
           đóng sau khi xe nâng rời đi) — trước đây cửa dựng mở cố định nên lúc lăn/bay vẫn thấy hốc đen hình thấu kính bên mạn phải. */
        const cdT = [], cdBackT = [], cdInkT = [];
        doorSolid(cdT, 1, CARGO_FWD_X, FCA, CHX, FHA, DTH, null, cdBackT);
        roundOutline(cdInkT, 1, CARGO_FWD_X, FCA, CHX, FHA, 0.02, DTH);
        roundOutline(cdInkT, 1, CARGO_FWD_X, FCA, CHX * 0.88, FHA * 0.88, 0.018, -0.003);
        for (const [cx, yc, hx, hh] of [[gx(-13.0), hy(-0.39), CHX, CHH],          // cửa hầm hàng sau
        [gx(-19.5), hy(-0.35), S747 * 0.56, S747 * 0.6]]) {                          // cửa bulk cargo
          const [ca, ha] = arcAt(cx, yc, hh);
          doorSolid(doorT, 1, cx, ca, hx, ha, DTH);
          roundOutline(inkT, 1, cx, ca, hx, ha, 0.02, DTH);
        }
        const im = new THREE.Mesh(new THREE.BufferGeometry(), INK);
        im.geometry.setAttribute('position', new THREE.Float32BufferAttribute(inkT, 3));
        im.userData.noFade = true; plane.add(im);
        const GLASS_INK = new THREE.MeshBasicMaterial({ color: GLASS, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
        const gm = new THREE.Mesh(new THREE.BufferGeometry(), GLASS_INK);
        gm.geometry.setAttribute('position', new THREE.Float32BufferAttribute(glassT, 3));
        gm.userData.noFade = true; plane.add(gm);
        // cánh cửa dùng Lambert (KHÔNG phải Basic như lớp mực): cần đổ sáng thì vách dày mới lộ ra.
        // computeVertexNormals trên geometry non-indexed ⇒ pháp tuyến phẳng từng mặt, đúng chất line-art.
        const dm2 = new THREE.BufferGeometry();
        dm2.setAttribute('position', new THREE.Float32BufferAttribute(doorT, 3));
        dm2.computeVertexNormals();
        plane.add(new THREE.Mesh(dm2, new THREE.MeshLambertMaterial({ color: CREAM, side: THREE.DoubleSide })));
        // MẶT CÒN LẠI của cánh cửa khoang (off 0) — màu WHITE khớp sơn ngoài thân, KHÁC màu CREAM
        // mặt trong. Trước đây không tồn tại mặt này (chỉ có vách dày hở đáy).
        const dm3 = new THREE.BufferGeometry();
        dm3.setAttribute('position', new THREE.Float32BufferAttribute(doorBackT, 3));
        dm3.computeVertexNormals();
        plane.add(new THREE.Mesh(dm3, new THREE.MeshLambertMaterial({ color: WHITE, side: THREE.DoubleSide })));
        // mặt tô đen khoang hàng — Basic (không đổ sáng, luôn đen tuyệt đối) + noFade để không bị làm mờ
        const hg = new THREE.BufferGeometry();
        hg.setAttribute('position', new THREE.Float32BufferAttribute(holeT, 3));
        const hm = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({
          color: 0x171613, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6
        }));
        hm.userData.noFade = true; plane.add(hm);
        // nhóm cánh cửa hầm trước: gốc ở bản lề (cùng phép tính với hinge()), lưới lùi về −bản lề
        {
          const R = rOfX(CARGO_FWD_X) + 0.03, aT = FCA + FHA, hY = FY + cOffX(CARGO_FWD_X) + kyX(CARGO_FWD_X) * R * Math.sin(aT), hZ = R * Math.cos(aT);
          const g = new THREE.Group(); g.position.set(0, hY, hZ);
          const mk = (tris, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3)); geo.translate(0, -hY, -hZ); geo.computeVertexNormals(); return new THREE.Mesh(geo, mat); };
          g.add(mk(cdT, new THREE.MeshLambertMaterial({ color: CREAM, side: THREE.DoubleSide })), mk(cdBackT, new THREE.MeshLambertMaterial({ color: WHITE, side: THREE.DoubleSide })));
          const ink = mk(cdInkT, INK); ink.userData.noFade = true; g.add(ink);
          plane.add(g);
          plane.userData.cargoDoor = { g, hole: hm, set(k) { g.rotation.x = -2.5 * k; hm.visible = k > 0.04; } };   // k: 1 mở · 0 đóng
          plane.userData.cargoDoor.set(1);
        }
      })();

      /* ══ BỤNG PHÌNH GỐC CÁNH (wing-to-body belly fairing) — khối ôm dưới thân chỗ cánh gặp thân,
         chứa hộp cánh trung tâm + khoang càng. Dựng bằng 3 đoạn trụ trục X: vuốt mũi · thân · vuốt đuôi.
         Tâm hạ thấp hơn tâm thân → phần trên chìm trong thân, chỉ phần dưới nhô ra thành bụng. ══ */
      (function bellyFairing() {
        // GLB: bụng phình trải z −8.96 → 15.09 m (x −3.45 → 7.44), đáy thấp hơn bụng thân 0.23 m (y −2.31 m), bè ngang
        // hơn thân ở tầm thấp. Elip nửa rộng 1.2 · nửa cao 0.55, đáy đúng gy(−2.31); 2 đầu vuốt thon chìm vào bụng.
        // A 1.2 → 1.3 (G 14/10): bụng phình 747 thật rộng hơn thân ở tầm thấp — chứa hốc càng cánh + càng thân khi thu
        const XA = gx(-8.96), XF = gx(15.09), A = 1.3, BH = 0.55, yc = gy(-2.31) + BH;
        const fseg = (rA, rF, xa, xf) => {                // rA = hệ số đầu sau (−x, đuôi), rF = đầu trước (+x, mũi)
          const g = new THREE.CylinderGeometry(rA, rF, xf - xa, 24);
          g.rotateZ(Math.PI / 2); g.scale(1, BH, A); g.translate((xa + xf) / 2, yc, 0);
          pb.add(g, WHITE, { thresh: 14 });
        };
        const x1 = XA + 2.45, x2 = XF - 2.45;
        fseg(0.5, 1.0, XA, x1);                           // vuốt thon về phía đuôi
        fseg(1.0, 1.0, x1, x2);                           // thân fairing (ôm hộp cánh + khoang càng)
        fseg(1.0, 0.55, x2, XF);                          // vuốt thon về phía mũi
        // 2 gờ blend dọc mép fairing — bám bề mặt elip tại cao độ +0.25
        const zr = A * Math.sqrt(1 - (0.25 / BH) ** 2);
        for (const s of [-1, 1]) pb.P(x2 - x1, 0.05, 0.05, (x1 + x2) / 2, yc + 0.25, s * zr, MID, { soft: true });
