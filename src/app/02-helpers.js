    /* ═══ vật liệu & helper line-art (cream isometric + viền nét) ═══ */
    const LINE = new THREE.LineBasicMaterial({ color: 0x4a3728, transparent: true, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const LINE_SOFT = new THREE.LineBasicMaterial({ color: 0x4a3728, transparent: true, opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const LINE_FAINT = new THREE.LineBasicMaterial({ color: 0x4a3728, transparent: true, opacity: 0.12, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const WHITE = 0xfffcf5, CREAM = 0xF3EFE0, MID = 0xfffcf5, GLASS = 0x3a4b5c, DARK = 0x4a3728, PAINT = 0x8a7355, CYAN_GLOW = 0x4cd3e6, ORANGE_GLOW = 0xdf9e51, BRIGHT_ORANGE = 0xdf9e51, GOLDEN_TURBINE = 0xfffcf5, DARK_NAVY = 0x1c2b3a, SILVER = 0xd5dce4;
    const materialCache = new Map();
    const M = (c) => {
      if (!materialCache.has(c)) {
        materialCache.set(c, new THREE.MeshLambertMaterial({
          color: c,
          polygonOffset: c === PAINT,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -4
        }));
      }
      return materialCache.get(c);
    };
    const stripUV = (g) => { if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1'); return g; };
    function edged(geo, matColor, opt = {}) {
      stripUV(geo);                                       // vật liệu toàn màu phẳng, không cần toạ độ texture
      const mesh = new THREE.Mesh(geo, opt.mat || M(matColor));
      mesh.castShadow = opt.cast !== false; mesh.receiveShadow = !!opt.receive;
      let edgesGeo = new THREE.EdgesGeometry(geo, opt.thresh || 1);
      if (opt.keep) {                                     // lọc nét: giữ đoạn (a, b) khi opt.keep(a, b) đúng
        const p = edgesGeo.attributes.position, v = [];
        for (let i = 0; i < p.count; i += 2) { const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)]; if (opt.keep(a, b)) v.push(...a, ...b); }
        edgesGeo = new THREE.BufferGeometry(); edgesGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      }
      const eg = new THREE.LineSegments(edgesGeo, opt.soft ? LINE_SOFT : LINE);
      mesh.add(eg); return mesh;
    }
    const box = (w, h, d, c, opt) => edged(new THREE.BoxGeometry(w, h, d), c, opt);
    const cyl = (r, h, c, seg = 20, opt = {}) => edged(new THREE.CylinderGeometry(r, r, h, seg), c, Object.assign({ thresh: 30 }, opt));
    function makeTransparent(obj, opacity = 0.55) {
      const variants = new WeakMap();
      const transparentVariant = (material, targetOpacity) => {
        let byOpacity = variants.get(material);
        if (!byOpacity) { byOpacity = new Map(); variants.set(material, byOpacity); }
        if (!byOpacity.has(targetOpacity)) {
          const variant = material.clone();
          variant.transparent = true;
          variant.opacity = targetOpacity;
          byOpacity.set(targetOpacity, variant);
        }
        return byOpacity.get(targetOpacity);
      };
      obj.traverse(child => {
        if (child.userData && child.userData.noFade) return;   // panel lines giữ nguyên độ đậm
        if (child.material) {
          let targetOpacity = opacity;
          let p = child;
          while (p) {
            if (p.userData && p.userData.isWing) { targetOpacity = 0.55; break; } // 45% transparent
            p = p.parent;
          }
          const finalOpacity = child.isLine || child.isLineSegments || child.isLineLoop ? targetOpacity * 0.6 : targetOpacity;
          child.material = transparentVariant(child.material, finalOpacity);
        }
      });
      return obj;
    }

    // Bag: gom mọi part tĩnh → 1 mesh/màu + 1 lớp viền merge (draw calls thấp — pattern craneSTS)
    function Bag() {
      const parts = [];
      const bag = {
        add(geo, color, opt = {}) {
          if (geo.index) geo = geo.toNonIndexed();
          stripUV(geo);                                  // không material nào dùng texture → bỏ uv (8B/đỉnh)
          parts.push({ geo, color, thresh: opt.thresh || 1, soft: !!opt.soft, noEdge: !!opt.noEdge }); return bag;
        },
        P(w, h, d, x, y, z, color, opt = {}) {
          const g = new THREE.BoxGeometry(w, h, d);
          if (opt.rz) g.rotateZ(opt.rz); if (opt.rx) g.rotateX(opt.rx); if (opt.ry) g.rotateY(opt.ry);
          g.translate(x, y, z); bag.add(g, color, opt); return bag;
        },
        C(r, h, x, y, z, color, opt = {}) {   // cylinder (mặc định trục y; axis:'x'/'z' để làm bánh xe, bồn…)
          const g = new THREE.CylinderGeometry(opt.r2 !== undefined ? opt.r2 : r, r, h, opt.seg || 16);
          if (opt.axis === 'x') g.rotateZ(Math.PI / 2); if (opt.axis === 'z') g.rotateX(Math.PI / 2);
          g.translate(x, y, z); bag.add(g, color, Object.assign({ thresh: 30 }, opt)); return bag;
        },
        build(opt = {}) {
          const g = new THREE.Group(); const byColor = new Map();
          for (const p of parts) { if (!byColor.has(p.color)) byColor.set(p.color, []); byColor.get(p.color).push(p.geo); }
          for (const [c, gs] of byColor) {
            const m = new THREE.Mesh(mergeGeometries(gs), M(c));
            m.castShadow = opt.cast !== false; m.receiveShadow = !!opt.receive; g.add(m);
          }
          const hard = [], soft = [];
          for (const p of parts) { if (p.noEdge) continue; (p.soft ? soft : hard).push(new THREE.EdgesGeometry(p.geo, p.thresh)); }
          if (hard.length) g.add(new THREE.LineSegments(mergeGeometries(hard), LINE));
          if (soft.length) g.add(new THREE.LineSegments(mergeGeometries(soft), LINE_SOFT));
          // giải phóng ngay geometry trung gian (đã gộp xong) — hạ đỉnh RAM lúc dựng scene
          for (const eg of hard) eg.dispose();
          for (const eg of soft) eg.dispose();
          for (const p of parts) p.geo.dispose();
          parts.length = 0;
          return g;
        }
      };
      return bag;
    }

    // ═══ BÁNH XE CHUẨN (dùng chung mọi GSE) — lốp phồng lathe + mâm lõm 2 tầng + hub sao 10 răng.
    // Chuẩn hoá từ thiết kế cargo loader. (b, x, z, R[, side]); tâm trục y = R (bánh tì đất). seg tự co theo R.
    // side = ±1 chỉ định mạn đặt hub khi khối không nằm quanh z = 0 (dolly ở cụm container, bogie ống lồng).
    function stdWheel(b, x, z, R, side) {
      const sgn = side || (z >= 0 ? 1 : -1), k = R / 0.535, t = 0.2 * k, cy = R;
      const seg = R < 0.34 ? 12 : 18;                                  // bánh nhỏ ít mặt hơn (tiết kiệm tris)
      const prof = [[0.17, -0.20], [0.31, -0.215], [0.43, -0.185], [0.505, -0.115],
      [0.535, 0], [0.505, 0.115], [0.43, 0.185], [0.31, 0.215], [0.17, 0.20]]
        .map(([r, h]) => new THREE.Vector2(r * k, h * k));
      const tire = new THREE.LatheGeometry(prof, seg);
      tire.rotateX(Math.PI / 2); tire.translate(x, cy, z);
      b.add(tire, DARK, { thresh: 24 });
      for (const f of [-1, 1]) {
        b.C(0.32 * k, 0.05, x, cy, z + f * t * 0.875, MID, { axis: 'z', seg });
        b.C(0.27 * k, 0.04, x, cy, z + f * t * 1.025, CREAM, { axis: 'z', seg });
      }
      for (let i = 0; i < 10; i++) {                                   // hub sao 10 răng
        const a = i / 10 * Math.PI * 2;
        b.P(0.13 * k, 0.05, 0.09, x + 0.075 * k * Math.cos(a), cy + 0.075 * k * Math.sin(a), z + sgn * t * 1.075, DARK, { rz: a });
      }
      b.C(0.055 * k, 0.1, x, cy, z + sgn * t * 1.2, MID, { axis: 'z', seg: 10 });
    }

    // ═══ CÀNG ĐÁP — bộ dựng chung, học từ 2 mẫu GLB: a350-1000_landing_gear.glb (N.S Studios, CC-BY-4.0 — cấu trúc & số đo,
    // đơn vị mét) + b777x_gears.glb (Hashbrown5, Sketchfab Standard — biên dạng lốp/mâm & màu vật liệu). Chỉ học số liệu, không nhúng mesh.
    // Màu = vật liệu mẫu 777X (linear → sRGB): lốp · mâm · sơn càng · ống dầu/dây · đĩa phanh carbon · cờ chốt khoá đất.
    // Ống trượt mạ crom dùng SILVER của scene. Mọi hàm nhận toạ độ PLANE (đã quy mét × S747).
    const GEAR_C = { tire: 0x2b2b2b, rim: 0xe7e7e7, paint: 0xd0d0d0, hose: 0x2b201e, carbon: 0x2a2a29, flag: 0xed4a42 };
    const _gUp = new THREE.Vector3(0, 1, 0), _gX = new THREE.Vector3(1, 0, 0), _gZ = new THREE.Vector3(0, 0, 1), _gXZ = new THREE.Vector3(1, 0, 1).normalize();
    // ống tròn nối a → c (bán kính r0 ở a, r1 ở c)
    function gRod(b, a, c, r0, r1, col, seg = 10, opt = {}) {
      const d = new THREE.Vector3().subVectors(c, a), L = d.length();
      const g = new THREE.CylinderGeometry(r1, r0, L, seg);
      g.translate(0, L / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_gUp, d.normalize()));
      g.translate(a.x, a.y, a.z);
      b.add(g, col, Object.assign({ thresh: 30 }, opt));
    }
    // thanh dẹt (link) nối a → c: bề rộng w vuông góc n, bề dày d dọc n (mặc định n = trục z)
    function gBar(b, a, c, w, d, col, n = _gZ, opt = {}) {
      const yv = new THREE.Vector3().subVectors(c, a), L = yv.length(); yv.normalize();
      const zv = n.clone().addScaledVector(yv, -n.dot(yv)).normalize(), xv = new THREE.Vector3().crossVectors(yv, zv);
      const g = new THREE.BoxGeometry(w, L, d); g.translate(0, L / 2, 0);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(xv, yv, zv).setPosition(a));
      b.add(g, col, opt);
    }
    // chốt / khớp: trụ ngắn trục n, tâm p
    function gPin(b, p, n, r, len, col, seg = 10, opt = {}) {
      const h = n.clone().normalize().multiplyScalar(len / 2);
      gRod(b, p.clone().sub(h), p.clone().add(h), r, r, col, seg, opt);
    }
    // ống dầu / bó dây mềm qua các điểm neo
    function gHose(b, pts, r, col = GEAR_C.hose) {
      const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      b.add(new THREE.TubeGeometry(cv, pts.length * 7, r, 5, false), col, { noEdge: true });
    }
    // BÁNH CÀNG — lốp radial vai vuông + 4 rãnh dọc (đo từ lốp 777X: rãnh ở ±0.39 / ±0.57 nửa bề rộng, sâu 1 cm),
    // mâm: vành bích · đĩa lõm có vòng 12 lỗ giảm trọng · moay-ơ + chụp trục; mặt TRONG (tuỳ chọn): khe đĩa carbon,
    // vỏ piston 5 xy-lanh + tay đòn phản lực xuống tai thanh phanh. Biên dạng [r, a]: lốp theo (tanh rb · cao H · nửa rộng W),
    // mâm theo (rb, W); a dọc trục, +a = mặt ngoài. c = tâm bánh, R = bán kính lốp, o = ±1 hướng mặt ngoài theo z.
    // Trả về điểm tai phanh (nối thanh phanh) khi có phanh. opt.spin: bag riêng nhận phần QUAY (lốp + mâm + lỗ) để bánh lăn được;
    // phanh carbon + vỏ piston + tay đòn vẫn ở bag b (đứng yên theo trục).
    const TIRE_V = (() => {
      const h = [[0, -0.86], [0.12, -0.94], [0.52, -1], [0.86, -0.93], [0.95, -0.82], [1, -0.68],
      [1, -0.6], [0.965, -0.6], [0.965, -0.54], [1, -0.54], [1, -0.42], [0.965, -0.42], [0.965, -0.36], [1, -0.36]];
      return h.concat(h.slice().reverse().map(([v, u]) => [v, -u]));
    })();
    const RIM_V = [[0.34, -0.806], [0.716, -0.881], [0.966, -0.919], [1.074, -0.937], [1.138, -0.911], [1.152, -0.844],
    [0.98, -0.806], [0.98, 0.806], [1.152, 0.844], [1.138, 0.911], [1.074, 0.937], [0.966, 0.9], [0.913, 0.769], [0.841, 0.731],
    [0.483, 0.731], [0.429, 0.844], [0.34, 0.9], [0.268, 0.937], [0.215, 1.031], [0, 1.069]];
    function gearWheel(b, c, R, W, rb, o, opt = {}) {
      const H = R - rb, ax = new THREE.Vector3(0, 0, o), sb = opt.spin || b;
      const lath = (prof, col, n, eo) => {
        const g = new THREE.LatheGeometry(prof.map(([r, a]) => new THREE.Vector2(r, a)), n);
        g.rotateX(o * Math.PI / 2); g.translate(c.x, c.y, c.z); sb.add(g, col, eo);
      };
      lath(TIRE_V.map(([v, u]) => [rb + v * H, u * W]), GEAR_C.tire, opt.seg || 32, { noEdge: true });
      lath(RIM_V.map(([r, a]) => [r * rb, a * W]), GEAR_C.rim, 24, { thresh: 25 });
      for (let i = 0; i < 12; i++) {                                   // 12 lỗ giảm trọng (đĩa tối sát mặt đĩa lõm)
        const t = (i + 0.5) / 12 * Math.PI * 2, g = new THREE.CircleGeometry(0.079 * rb, 8);
        if (o < 0) g.rotateY(Math.PI);
        g.translate(c.x + Math.cos(t) * 0.662 * rb, c.y + Math.sin(t) * 0.662 * rb, c.z + o * (0.731 * W + 0.002));
        sb.add(g, GEAR_C.tire, { noEdge: true });
      }
      if (!opt.brake) return null;
      const A = (a) => c.clone().addScaledVector(ax, a);
      gRod(b, A(-0.93 * W), A(-1.04 * W), 0.8 * rb, 0.8 * rb, GEAR_C.carbon, 20, { noEdge: true });     // khe chồng đĩa carbon
      gRod(b, A(-1.04 * W), A(-1.24 * W), 0.64 * rb, 0.6 * rb, GEAR_C.paint, 20);                       // vỏ piston phanh
      for (let i = 0; i < 5; i++) {                                                                     // 5 xy-lanh phanh
        const t = (i / 5 + 0.1) * Math.PI * 2, d = new THREE.Vector3(Math.cos(t) * 0.5 * rb, Math.sin(t) * 0.5 * rb, 0);
        gRod(b, A(-1.2 * W).add(d), A(-1.34 * W).add(d), 0.1 * rb, 0.1 * rb, GEAR_C.paint, 6, { noEdge: true });
      }
      const lug = A(-1.14 * W).add(new THREE.Vector3(0, -0.95 * rb, 0));
      gBar(b, A(-1.14 * W), lug, 0.3 * rb, 0.14 * W, GEAR_C.paint, ax);                                // tay đòn phản lực
      return lug;
    }

    // ═══ CHỮ SƠN SÂN ĐỖ — canvas chữ trắng → tấm phẳng NẰM BẸT sát mặt sân; Lambert nhân màu PAINT ⇒ cùng tông,
    // cùng đổ sáng & nhận bóng như vạch sơn trong Bag. up = hướng "đầu chữ" trên mặt đất [x, z].
    function paintText(text, x, z, h, up, opt = {}) {
      const c = document.createElement('canvas'), g = c.getContext('2d');
      const F = (opt.weight || 800) + ' 160px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
      g.font = F; const tw = Math.ceil(g.measureText(text).width) + 24;
      c.width = tw; c.height = 180; g.font = F;
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, tw / 2, 96);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(h * tw / 180, h);
      geo.rotateX(-Math.PI / 2);                                       // nằm bẹt — đầu chữ hướng −z
      geo.rotateY(Math.atan2(-up[0], -up[1]));                         // quay đầu chữ về hướng up
      geo.translate(x, opt.y || 0.143, z);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        map: t, color: opt.color || PAINT, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6
      }));
      m.receiveShadow = true; scene.add(m); return m;
    }

    // ═══ CONTAINER LD3 (AKE) — tiết diện mặt cửa có GÓC VÁT ôm bụng máy bay: đáy = 77% bề ngang nóc, vát cao 38%.
    // Mặt +z là mặt cửa: rèm bạt (ngũ giác thụt 0.07) + 3 đai dọc + 1 đai ngang. (b, x, y đáy, z, ry, k = tỉ lệ)
    function ld3(b, x, y, z, ry = 0, k = 1) {
      const W = 2.05 * k, H = 1.66 * k, D = 1.566 * k, WB = W * 0.77, HC = H * 0.38, i = 0.07 * k;   // tỉ lệ AKE thật: 2.007 × 1.625 × 1.534 m
      const pent = (n) => {
        const s = new THREE.Shape();
        s.moveTo(-W / 2 + n, n); s.lineTo(-W / 2 + WB - n * 0.6, n); s.lineTo(W / 2 - n, HC + n * 0.6);
        s.lineTo(W / 2 - n, H - n); s.lineTo(-W / 2 + n, H - n); s.lineTo(-W / 2 + n, n);
        return s;
      };
      const put = (g, col, o) => { g.rotateY(ry); g.translate(x, y, z); b.add(g, col, o); };
      put(new THREE.ExtrudeGeometry(pent(0), { depth: D, bevelEnabled: false }).translate(0, 0, -D / 2), CREAM, { thresh: 20 });
      put(new THREE.ShapeGeometry(pent(i)).translate(0, 0, D / 2 + 0.012 * k), WHITE, { soft: true });     // rèm bạt mặt cửa
      const c = Math.cos(ry), sn = Math.sin(ry);
      const P = (w, h, d, lx, ly, lz) => b.P(w, h, d, x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c, PAINT, { ry, noEdge: true });
      // for (const lx of [-W * 0.27, 0, W * 0.24]) P(0.045 * k, H - 2 * i, 0.02 * k, lx, H / 2, D / 2 + 0.02 * k);  // 3 đai dọc
      // P(W - 2 * i, 0.045 * k, 0.02 * k, 0, H * 0.58, D / 2 + 0.02 * k);                                            // đai ngang
    }

    // ═══ DOLLY chở container — khung sàn + 7 con lăn · 4 cột chặn góc · càng kéo chữ A + vòng móc · móc sau · 4 bánh.
    // Local +x = đầu càng kéo. Mặt con lăn y 0.56 ⇒ đặt ld3() ở y DOLLY_TOP.
    const DOLLY_TOP = 0.562;
    function dolly(b, x, z, ry = 0) {
      const c = Math.cos(ry), sn = Math.sin(ry);
      const at = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
      const P = (w, h, d, lx, ly, lz, col, o = {}) => { const p = at(lx, lz); b.P(w, h, d, p[0], ly, p[1], col, Object.assign({}, o, { ry: ry + (o.yaw || 0) })); };
      // CỠ THẬT (SPS CD-04/05/14: dài 3.9 m kể càng 1.05–1.1 m · rộng 1.66–1.76 m; sàn con lăn ~0.51 m) — bản trước sàn 0.73 m, dài 3.4 m
      P(2.5, 0.12, 1.85, 0, 0.45, 0, MID, { soft: true });                                      // khung sàn (đáy 0.39 > đỉnh bánh 0.38)
      for (let i = 0; i < 7; i++) P(0.1, 0.05, 1.6, -1.02 + i * 0.34, 0.535, 0, CREAM, { soft: true }); // con lăn: mặt 0.56 đv ≈ 0.53 m
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(0.08, 0.3, 0.08, sx * 1.18, 0.66, sz * 0.86, DARK, {});  // cột chặn góc
      for (const s of [-1, 1]) P(1.3, 0.06, 0.06, 1.88, 0.34, s * 0.25, DARK, { yaw: s * 0.3 });  // càng chữ A dài 1.1 m
      P(0.14, 0.05, 0.14, 2.55, 0.33, 0, DARK, {});                                              // vòng móc
      P(0.16, 0.12, 0.2, -1.32, 0.36, 0, DARK, {});                                              // móc sau
      for (const wx of [-0.85, 0.85]) for (const s of [-1, 1]) { const p = at(wx, s * 0.8); stdWheel(b, p[0], p[1], 0.19, s); }
    }

