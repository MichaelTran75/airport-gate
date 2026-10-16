      // ═══ CHÓP ĐUÔI APU + ỐNG XẢ — theo mẫu GLB: đuôi 747-8 khép thành ELIP CAO-HẸP (0.46 × 1.03 m ở z −37.5)
      // rồi vuốt về miệng xả tròn ở chóp (z −37.98, tâm cao 3.69 m). Vỏ chóp = nón đơn vị nắn theo elip nội suy
      // giữa mép lathe cuối và miệng xả ⇒ liền mạch với da thân. Lỗ xả giữ cấu trúc 6 lớp đồng trục cũ
      // (vành · họng ngoài · bậc vai · họng trong · đáy kín) — nhìn vào ra "cái lỗ sâu", không phải "cái ống".
      (function makeAPU() {
        const X0 = gx(-37.5), X1 = -16.6;                                  // mép lathe cuối → chóp
        const c0 = cOffX(X0), r0 = rOfX(X0), h0 = kyX(X0) * r0;            // elip mép lathe (tâm · nửa rộng · nửa cao)
        const cE = gy(3.69) - FY, rE = 0.12;                               // miệng xả: tâm GLB 3.69 m · bán kính 0.12
        const sec = (x) => {                                               // tiết diện vỏ chóp tại x: [tâm, nửa cao, nửa rộng]
          const t = Math.min(1, Math.max(0, (x - X0) / (X1 - X0))), e = t * t * (3 - 2 * t);
          return [c0 + (cE - c0) * e, h0 + (rE - h0) * e, r0 + (rE - r0) * e];
        };
        const put = (g, color, opt = {}) => { const m = edged(g, color, opt); m.position.y = FY; plane.add(m); };
        const shell = (k = 1, seg = 28) => {                               // vỏ chóp: trụ đơn vị trục X → nắn elip theo sec()
          const g = new THREE.CylinderGeometry(1, 1, X0 - X1, seg, 6, true);
          g.rotateZ(Math.PI / 2); g.translate((X0 + X1) / 2, 0, 0);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const [c, hh, hw] = sec(p.getX(i));
            p.setY(i, c + p.getY(i) * hh * k); p.setZ(i, p.getZ(i) * hw * k);
          }
          g.computeVertexNormals(); return g;
        };
        const frustum = (rF, rA, xF, xA, seg = 24) => {                    // nón trục X tròn quanh tâm miệng xả
          const g = new THREE.CylinderGeometry(rA, rF, xF - xA, seg, 1, true);
          g.rotateZ(Math.PI / 2); g.translate((xF + xA) / 2, cE, 0); return g;
        };
        const disc = (rIn, rOut, x) => {
          const g = rIn > 0 ? new THREE.RingGeometry(rIn, rOut, 24) : new THREE.CircleGeometry(rOut, 24);
          g.rotateY(Math.PI / 2); g.translate(x, cE, 0); return g;
        };
        const FLAT = (c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
        put(shell(), SILVER, { thresh: 8 });                                // vỏ chóp — kim loại trần, khác tông sơn thân
        // vòng gân chỗ tháo chóp (tailcone attach ring): dải mỏng nhô 3% ngay sau mép lathe
        { const g = new THREE.CylinderGeometry(1, 1, 0.05, 28, 1, true); g.rotateZ(Math.PI / 2); g.translate(X0 - 0.035, 0, 0);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) { const [c, hh, hw] = sec(p.getX(i)); p.setY(i, c + p.getY(i) * hh * 1.03); p.setZ(i, p.getZ(i) * hw * 1.03); }
          g.computeVertexNormals(); put(g, MID, { thresh: 20 }); }
        const k = rE / 0.1467;                                             // lỗ xả cũ (vành ngoài 0.1467) quy về miệng xả 0.12
        put(disc(0.1148 * k, 0.1467 * k, X1), MID, { mat: FLAT(MID) });     // vành miệng xả
        put(frustum(0.1075 * k, 0.1148 * k, X1 + 0.325, X1 + 0.01), DARK, { thresh: 20 });   // họng NGOÀI
        // ═══ LỚP TRONG ═══ vành sáng → họng ngoài tối → bậc vai kim loại → họng trong sẫm hơn → đáy kín
        put(disc(0.0638 * k, 0.1075 * k, X1 + 0.335), SILVER, { mat: FLAT(SILVER) });        // bậc vai
        put(frustum(0.0602 * k, 0.0638 * k, X1 + 0.569, X1 + 0.348), DARK_NAVY, { thresh: 20 }); // họng TRONG
        put(disc(0, 0.0602 * k, X1 + 0.569), DARK_NAVY, { mat: FLAT(DARK_NAVY) });          // đáy kín — chặn nhìn xuyên vào ruột thân
        // ống thoát nước dưới chóp — chìm một nửa vào vỏ
        { const xd = X0 - 0.09, [c, hh] = sec(xd); put(new THREE.BoxGeometry(0.1, 0.1, 0.025).translate(xd, c - hh + 0.03, 0), DARK, { thresh: 20 }); }
        // hộp đèn chớp / cửa hút gió làm mát 2 mạn chỗ nối chóp
        for (const s of [-1, 1]) {
          const xs = X0 + 0.02, c = cOffX(xs), hw = rOfX(xs), hh = kyX(xs) * hw;
          const capGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8);
          capGeo.rotateZ(Math.PI / 2); capGeo.translate(xs, c + 0.35 * hh, s * hw * 0.92);
          put(capGeo, MID, { thresh: 15 });
        }
      })();




      // cánh chính — extrude swept, mặt DoubleSide
      const PW_MAT = new THREE.MeshLambertMaterial({ color: WHITE, side: THREE.DoubleSide });
      function wingShapeGeo(lePts, tePts, depth, flipX, midFn) {   // depth: số (taper cũ) hoặc hàm (y, dây cung) → bề dày; midFn(y): cao mặt giữa (trục dày)
        let yMin = lePts[0][1], yMax = lePts[lePts.length - 1][1];
        const span = yMax - yMin;

        function interp(pts, y) {
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i], p1 = pts[i + 1];
            if (y >= p0[1] && y <= p1[1]) {
              const t = (y - p0[1]) / (p1[1] - p0[1]);
              return p0[0] + (p1[0] - p0[0]) * t;
            }
          }
          return pts[pts.length - 1][0];
        }

        const NS = 48, NC = 10; // 48 phân đoạn sải (đủ dày để mút vát 747-8 không bị bo tròn), 10 phân đoạn dây cung
        const vertices = [];
        const indices = [];

        for (let si = 0; si <= NS; si++) {
          const y = yMin + (si / NS) * span;
          const t_span = si / NS;

          // Nội suy mép trước (LE) và mép sau (TE) tại lát cắt y
          const x_LE = interp(lePts, y);
          const x_TE = interp(tePts, y);

          const thickness_taper = 1.0 - 0.72 * t_span;
          const thick = typeof depth === 'function' ? depth(y, x_LE - x_TE) : depth * thickness_taper;
          const zm = midFn ? midFn(y) : 0;

          for (let ci = 0; ci <= NC; ci++) {
            const u = ci / NC;
            const x = x_LE + (x_TE - x_LE) * u;

            // Biên dạng mặt cắt cánh (airfoil profile: phình ở 25% phía trước, mỏng sắc về phía sau)
            const t_chord = (u < 0.25) ? Math.sin((u / 0.25) * Math.PI / 2) : 1.0 - 0.9 * ((u - 0.25) / 0.75);
            const z = (thick / 2) * t_chord;

            // Đỉnh mặt trên và mặt dưới cánh
            vertices.push(x, y, zm + z);
            vertices.push(x, y, zm - z);
          }
        }

        // Tạo lưới tam giác cho mặt trên và dưới
        for (let si = 0; si < NS; si++) {
          for (let ci = 0; ci < NC; ci++) {
            const i00 = (si * (NC + 1) + ci) * 2;
            const i01 = (si * (NC + 1) + (ci + 1)) * 2;
            const i10 = ((si + 1) * (NC + 1) + ci) * 2;
            const i11 = ((si + 1) * (NC + 1) + (ci + 1)) * 2;

            indices.push(i00, i10, i01);
            indices.push(i01, i10, i11);

            indices.push(i00 + 1, i01 + 1, i10 + 1);
            indices.push(i01 + 1, i11 + 1, i10 + 1);
          }
        }

        // Đóng kín các diện mặt cắt ở mút, gốc và mép trước/sau
        for (let ci = 0; ci < NC; ci++) {
          const i0 = (NS * (NC + 1) + ci) * 2;
          const i1 = (NS * (NC + 1) + (ci + 1)) * 2;
          indices.push(i0, i1, i0 + 1);
          indices.push(i1, i1 + 1, i0 + 1);
        }
        for (let ci = 0; ci < NC; ci++) {
          const i0 = ci * 2;
          const i1 = (ci + 1) * 2;
          indices.push(i0, i0 + 1, i1);
          indices.push(i1, i0 + 1, i1 + 1);
        }
        for (let si = 0; si < NS; si++) {
          const i0 = (si * (NC + 1)) * 2;
          const i1 = ((si + 1) * (NC + 1)) * 2;
          indices.push(i0, i0 + 1, i1);
          indices.push(i1, i0 + 1, i1 + 1);
        }
        for (let si = 0; si < NS; si++) {
          const i0 = (si * (NC + 1) + NC) * 2;
          const i1 = ((si + 1) * (NC + 1) + NC) * 2;
          indices.push(i0, i1, i0 + 1);
          indices.push(i1, i1 + 1, i0 + 1);
        }

        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        g.setIndex(indices);
        g.computeVertexNormals();
        if (flipX !== null) {
          g.rotateX(flipX ? -Math.PI / 2 : Math.PI / 2);
        }
        return g;
      }
      // "mực bản vẽ" cho panel lines: ribbon mesh mỏng nằm trên mặt cánh.
      // Lý do: GL hairline luôn 1 pixel vật lý (dpr 2 → ½ px CSS) nên nét dài gần song song
      // trục màn hình bị đứt quãng; polygonOffset cũng không áp dụng cho line. Ribbon là
      // tam giác thật → raster liên tục ở mọi góc (cùng kỹ thuật vạch sơn dưới sân đỗ).
      const INK = new THREE.MeshBasicMaterial({ color: 0x3a3934, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      function surfFn(lePts, tePts, depth, midFn) {    // (y, u, side) → điểm trên mặt cánh + nhô 0.015 (cùng bề dày & mặt giữa như wingShapeGeo)
        const yMin = lePts[0][1], yMax = lePts[lePts.length - 1][1], span = yMax - yMin;
        function interp(pts, y) {
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i], p1 = pts[i + 1];
            if (y >= p0[1] && y <= p1[1]) { const t = (y - p0[1]) / (p1[1] - p0[1]); return p0[0] + (p1[0] - p0[0]) * t; }
          }
          return pts[pts.length - 1][0];
        }
        return (y, u, side) => {
          const x_LE = interp(lePts, y), x_TE = interp(tePts, y);
          const taper = 1.0 - 0.72 * ((y - yMin) / (span || 1));
          const tc = (u < 0.25) ? Math.sin((u / 0.25) * Math.PI / 2) : 1.0 - 0.9 * ((u - 0.25) / 0.75);
          const thick = typeof depth === 'function' ? depth(y, x_LE - x_TE) : depth * taper;
          return new THREE.Vector3(x_LE + (x_TE - x_LE) * u, y, (midFn ? midFn(y) : 0) + side * ((thick / 2) * tc + 0.015));
        };
      }
      function ribbonTris(tris, pts, w, closed) {      // quad dẹt cho từng đoạn polyline (mặt phẳng xy, z theo đầu mút)
        const n = pts.length, m = closed ? n : n - 1, h = w / 2;
        for (let i = 0; i < m; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          let dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
          const ex = dx * h, ey = dy * h, nx = -dy * h, ny = dx * h;      // nối dài 2 đầu để khép góc
          const ax = a.x - ex, ay = a.y - ey, bx = b.x + ex, by = b.y + ey;
          tris.push(
            ax + nx, ay + ny, a.z, ax - nx, ay - ny, a.z, bx + nx, by + ny, b.z,
            ax - nx, ay - ny, a.z, bx - nx, by - ny, b.z, bx + nx, by + ny, b.z);
        }
      }
      function inkMesh(tris, flipX) {                  // 1 mesh mực / 1 bó nét — opaque nên thân transparent không phủ mờ
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
        if (flipX !== null) g.rotateX(flipX ? -Math.PI / 2 : Math.PI / 2);
        const mesh = new THREE.Mesh(g, INK);
        mesh.userData.noFade = true;
        return mesh;
      }
      let inkTris = null;                              // batch: gom nhiều panel liên tiếp vào 1 mesh mực duy nhất
      function beginInk() { inkTris = []; }
      function endInk(group, flipX) { if (inkTris && inkTris.length) group.add(inkMesh(inkTris, flipX)); inkTris = null; }
      function addWingPanel(wingGroup, lePts, tePts, depth, yStart, yEnd, uStart, uEnd, flipX, midFn) {
        const mk = surfFn(lePts, tePts, depth, midFn);
        const tris = inkTris || [], steps = 4;
        // vẽ loop ở CẢ 2 mặt cánh (mặt +z của shape úp xuống ở cánh phải sau khi bake ±π/2)
        for (const side of [1, -1]) {
          const loop = [];
          for (let i = 0; i <= steps; i++) loop.push(mk(yStart + (i / steps) * (yEnd - yStart), uStart, side));
          for (let i = steps; i >= 0; i--) loop.push(mk(yStart + (i / steps) * (yEnd - yStart), uEnd, side));
          ribbonTris(tris, loop, 0.018, true);
        }
        if (!inkTris) wingGroup.add(inkMesh(tris, flipX));
      }
      // vẽ 1 bó đoạn nét chi tiết lên mặt cánh (ribbon mực, cả 2 mặt) — 1 draw call/bó
      function detailSegs(wingGroup, lePts, tePts, depth, flipX, segs, midFn) {
        const mk = surfFn(lePts, tePts, depth, midFn);
        const tris = inkTris || [];
        for (const side of [1, -1]) for (const [yA, uA, yB, uB] of segs)
          ribbonTris(tris, [mk(yA, uA, side), mk(yB, uB, side)], 0.018, false);
        if (!inkTris) wingGroup.add(inkMesh(tris, flipX));
      }


