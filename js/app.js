/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Gate A1 · Sân bay 3D (Boeing 747-8) — mã cảnh. three.js r171 WebGPU (esm.sh).
   Tệp đi kèm: css/app.css · js/wind-worker.js (bộ giải gió Navier–Stokes, chạy luồng riêng) · assets/cfm56.bin (lưới CFM56-7B).
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  const fail = (m) => { const e = document.getElementById('err'); if (e) { e.textContent = 'Không tải được Three.js (cần mạng). ' + m; e.style.display = 'block'; } const l = document.getElementById('loading'); if (l) l.style.display = 'none'; };
  const _V = 'https://esm.sh/three@0.171.0';
  // phiên bản file (?v= trên thẻ <script>, publish.sh tự đóng dấu) — dùng cho worker & lưới động cơ để trình duyệt không lẫn bản cũ
  const APP_V = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || '0'; } catch (e) { return '0'; } })();
  // lưới CFM56-7B (assets/cfm56.bin: zlib) — tải + giải nén song song lúc tải three.js; lỗi ⇒ máy chỉ còn nacelle/pylon
  const _cfm = fetch('assets/cfm56.bin?v=' + APP_V).then(r => r.ok ? new Response(r.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer() : null).catch(() => null);
  Promise.all([import(_V + '/webgpu'), import(_V + '/examples/jsm/utils/BufferGeometryUtils.js?external=three'), _cfm])
    .then(([m, u, cfm]) => { try { build(m, u.mergeGeometries, u.toCreasedNormals, cfm); } catch (e) { console.error(e); fail(e.message); } }).catch(e => { console.error(e); fail(e.message); });

  function build(THREE, mergeGeometries, toCreasedNormals, CFM_BUF) {

    /* ═══ 00-engine — nguyên pattern World Kit ═══ */
    const container = document.getElementById('scene');
    const W = () => container.clientWidth, Hv = () => container.clientHeight;
    const clock = new THREE.Clock();
    const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xE2D6C0, 300, 1000);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000); camera.zoom = 1.0; camera.layers.enable(1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a0, 0.72));
    scene.add(new THREE.AmbientLight(0xffffff, 0.36));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.85);
    sun.position.set(90, 140, 55); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;            // hết sọc chéo "shadow acne" trên mặt sân khi zoom gần
    const sc = sun.shadow.camera; sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.near = 1; sc.far = 480;
    scene.add(sun);

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

    /* ═══ 01-environment — diorama sân đỗ: slab beige nổi trên nền xám ═══ */
    const slab = box(154.8, 7, 116.8, 0x8a7355, { receive: true }); slab.position.set(17.5, -3.76, 11.5); scene.add(slab);
    const top = box(155, 0.5, 117, 0xfbf9f1, { receive: true, soft: true }); top.position.set(17.5, -0.25, 11.5); scene.add(top);
    const stand = box(96, 0.12, 84, 0xF3EFE0, { receive: true, soft: true, cast: false }); stand.position.set(-12, 0.06, 0); scene.add(stand);
    const walk = box(38, 0.14, 117, 0xF3EFE0, { receive: true, soft: true, cast: false }); walk.position.set(70, 0.07, 11.5); scene.add(walk);
    // dải lề giữa khu đỗ và nhà ga (x 36–51): nâng mặt lên 0.13 cho liền mạch sân đỗ 0.12 ↔ dải đi bộ 0.14 — vạch sơn
    // đường công vụ (y 0.141) hết lơ lửng trên mặt slab y 0, đoàn hành lý chạy qua không hụt bậc
    const shoulder = box(15, 0.13, 117, 0xfbf9f1, { receive: true, soft: true, cast: false }); shoulder.position.set(43.5, 0.065, 11.5); scene.add(shoulder);

    // khe co giãn bê tông — lưới line mờ
    (function joints() {
      const pts = [];
      for (let x = -56; x <= 32; x += 11) pts.push(new THREE.Vector3(x, 0.14, -42), new THREE.Vector3(x, 0.14, 42));
      for (let z = -42; z <= 42; z += 12) pts.push(new THREE.Vector3(-58, 0.14, z), new THREE.Vector3(34, 0.14, z));
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), LINE_FAINT));
    })();

    /* ═══ máy bay — vị trí & hướng đỗ (mũi về ĐN, cửa L1 quay về nhà ga) ═══ */
    const PROT = -0.55, PPOS = new THREE.Vector3(-16, 0, -2);
    const PDIR = new THREE.Vector3(Math.cos(PROT), 0, -Math.sin(PROT));            // hướng mũi
    const PPERP = new THREE.Vector3(-PDIR.z, 0, PDIR.x);                            // vuông góc
    // ═══ TỈ LỆ THẬT 747-8 — MỌI kích thước máy bay lấy từ mẫu GLB "Boeing 747-8i" (Sketchfab, đơn vị mét) qua MỘT
    // hệ số S747 = 0.453 local/m (giữ chiều dài thân 33.47 như trước). Dọc thân: x = gx(z_glb) (mũi 35.91 → 16.873);
    // cao độ: y = gy(y_glb), mặt đất GLB = −4.09 ≙ mặt sân 0.109 local — theo BOEING D6-58326-3 Rev E (01/2026) §2.3.2 Ground
    // Clearances 747-8: đáy thân 1.75–2.01 · ngưỡng hầm hàng trước 2.75–3.09 · ngưỡng cửa 1 4.78–5.16 · đỉnh bướu 9.44–9.84 m ⇒ cả 4 điểm
    // của thân GLB cùng thoả khi mặt đất ở GLB −4.09…−4.03. (Bản trước suy từ ĐỈNH ĐUÔI 14.59 − 19.35 = −4.76: đuôi GLB ngắn ~0.55 m
    // nên cả thân bị nâng cao ~0.67 m — cửa L1 5.51 m, bụng 2.68 m.)
    // ngang: z = S747·x_glb. Bản trước giữ bán kính thân 1.9 (mập hơn thật ~30%) — nay đúng 6.45 m.
    const S747 = 0.453;
    const gx = (z) => S747 * z + 0.606;
    const gy = (y) => S747 * (y + 4.09) + 0.109;
    const FY = gy(1.32);                                                            // tâm thân (GLB 1.32 m ⇒ cao 5.41 m trên mặt đất)

    /* ═══ vạch sơn sân đỗ (thanh mỏng, noEdge — vạch chính là nét vẽ) ═══ */
    (function paint() {
      const pb = Bag();
      const strip = (w, d, x, z, ry = 0, c = PAINT) => pb.P(w, 0.002, d, x, 0.141, z, c, { ry, noEdge: true });
      // lead-in line + vạch dừng chữ T
      for (let t = -50; t <= -24; t += 5.4) strip(3.3, 0.5, PPOS.x + PDIR.x * t, PPOS.z + PDIR.z * t, PROT);
      strip(42, 0.5, PPOS.x, PPOS.z, PROT);
      strip(0.5, 7, PPOS.x + PDIR.x * 21.5, PPOS.z + PDIR.z * 21.5, PROT);
      // biên khu đỗ (trapezoid mở về taxiway)
      for (const s of [-1, 1]) strip(56, 0.35, PPOS.x - PDIR.x * 4 + PPERP.x * 17 * s, PPOS.z - PDIR.z * 4 + PPERP.z * 17 * s, PROT + s * 0.16);
      // ô đỗ thiết bị (outline chữ nhật)
      function rect(cx, cz, w, d) {
        strip(w, 0.3, cx, cz - d / 2); strip(w, 0.3, cx, cz + d / 2);
        strip(0.3, d, cx - w / 2, cz); strip(0.3, d, cx + w / 2, cz);
      }
      // (G 11/10: bỏ ô đỗ GSE)
      // đường công vụ dọc nhà ga: 2 biên + tim đường đứt nét
      strip(0.4, 117, 44.5, 11.5); strip(0.4, 117, 55.5, 11.5);
      for (let z = -42; z <= 63; z += 7) strip(0.35, 3.2, 50, z);
      // hatch an toàn chéo trước nhà ga
      for (let i = 0; i < 7; i++) strip(8.5, 0.8, 47.5, 3 + i * 2.2, 0.62);
      // đường landside sau nhà ga (mặt slab y 0): vạch lề + tim đứt nét + mép ngoài
      for (const x of [89.35, 94.6]) pb.P(0.22, 0.002, 116, x, 0.004, 11.5, PAINT, { noEdge: true });
      for (let z = -45; z <= 68; z += 6) pb.P(0.2, 0.002, 2.6, 91.95, 0.004, z, PAINT, { noEdge: true });
      scene.add(pb.build({ cast: false, receive: true }));
      // chữ sơn: số vị trí đỗ cạnh vạch dẫn · ô đỗ thiết bị — xoay cho người xem đọc xuôi (G bỏ chữ "747" cạnh vạch dừng 05/10)
      const BACK = [-PDIR.x, -PDIR.z];
      { const t = -41, o = -5.4; paintText('A1', PPOS.x + PDIR.x * t + PPERP.x * o, PPOS.z + PDIR.z * t + PPERP.z * o, 5.0, BACK); }

    })();

    /* ═══ 02-aircraft — 747-8 line-art: thân lathe + cánh extrude + bag chi tiết ═══ */
    // ═══ HÌNH HỌC DÙNG CHUNG (máy bay · cọc tiêu · chèn bánh · xe nạp nhiên liệu · ống lồng · nhãn) — số đo GLB (mét) ═══
    // Bảng nội suy tuyến tính [khoá, giá trị] (khoá tăng dần)
    const lin = (tab, k) => {
      if (k <= tab[0][0]) return tab[0][1];
      for (let i = 0; i < tab.length - 1; i++) if (k <= tab[i + 1][0]) return tab[i][1] + (tab[i + 1][1] - tab[i][1]) * (k - tab[i][0]) / (tab[i + 1][0] - tab[i][0]);
      return tab[tab.length - 1][1];
    };
    // CÁNH — [sải m, z mép trước / mép sau (đã gồm flap)]; mút vát (raked) từ sải 32 m. Gốc cánh có gờ lượn (fillet).
    const WING_LE_M = [[0, 12.62], [3.3, 12.62], [4, 10.86], [5, 9.60], [6, 8.67], [10, 4.93], [14, 1.26], [20, -4.19], [26, -9.31],
    [30, -12.69], [32, -14.60], [33, -16.11], [34, -18.02], [34.37, -18.75]];
    const WING_TE_M = [[0, -3.29], [3.3, -3.29], [4, -3.52], [6, -4.19], [10, -5.53], [12, -6.37], [16, -8.51], [20, -10.65], [22, -11.78],
    [26, -14.19], [28, -15.40], [30, -16.62], [32, -17.85], [33, -18.56], [34, -19.35], [34.37, -19.65]];
    const WING_MID_GLB = [[0, -0.45], [3.5, -0.42], [5, -0.33], [6, -0.20], [7, -0.05], [8, 0.03], [9, 0.15], [10, 0.27], [11, 0.35],
    [12, 0.415], [14, 0.53], [16, 0.64], [18, 0.755], [20, 0.87], [22, 0.965], [24, 1.05], [26, 1.135], [28, 1.21], [30, 1.30],
    [33, 1.52], [34, 1.71], [34.37, 1.79]];                                        // cao mặt giữa cánh GLB (m): nhị diện ~6° trong · ~3° ngoài · mút vát vểnh
    // NHỊ DIỆN: mặt giữa GLB chỉ ~3° ở cánh ngoài (máy ngoài thấp hơn thật 0.9 m, đầu cánh 5.88 m sau khi hạ thân) — Boeing §2.3.2:
    // đầu cánh 6.51–6.80 m (M), đáy vỏ máy trong / ngoài 0.73–0.96 / 1.90–2.07 m ⇒ cộng thêm theo sải (gốc giữ nguyên trong thân):
    // +0.32 m ở máy trong · +0.885 m ở máy ngoài · +0.775 m ở đầu cánh (cánh ngoài cong xuống dưới tải nhiên liệu khi đỗ)
    const WING_DIH = [[0, 0], [4, 0], [11.93, 0.32], [21.18, 0.885], [34.37, 0.775]];
    const WING_MID_M = [...new Set([...WING_MID_GLB, ...WING_DIH].map(p => p[0]))].sort((a, b) => a - b).map(sp => [sp, lin(WING_MID_GLB, sp) + lin(WING_DIH, sp)]);   // gồm cả trạm máy ⇒ pylon khớp
    const WING_TC_M = [[0, 0.12], [3.3, 0.12], [10, 0.104], [20, 0.09], [30, 0.082], [34.37, 0.08]];   // dày / dây cung
    const WROOT = 0.5;                                                              // z local của gốc cánh (y sải = 0)
    const toWing = (m) => m.map(([s, z]) => [gx(z), Math.max(0, S747 * s - WROOT)]);
    const WING_LE = toWing(WING_LE_M), WING_TE = toWing(WING_TE_M);                  // [x, y sải local]
    const wingAt = (pts, y) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        if (y >= p0[1] && y <= p1[1] && p1[1] > p0[1]) return p0[0] + (p1[0] - p0[0]) * (y - p0[1]) / (p1[1] - p0[1]);
      }
      return y < pts[0][1] ? pts[0][0] : pts[pts.length - 1][0];
    };
    const wingMidY = (s) => gy(lin(WING_MID_M, s / S747));                         // s = z local (sải)
    const WY0 = wingMidY(WROOT);                                                    // cao mặt giữa tại gốc cánh
    const wingTc = (y) => lin(WING_TC_M, (y + WROOT) / S747);
    const tChord = (u) => (u < 0.25) ? Math.sin((u / 0.25) * Math.PI / 2) : 1.0 - 0.9 * ((u - 0.25) / 0.75);   // biên dạng airfoil (như wingShapeGeo)
    const wingHalfT = (x, s) => {
      const y = s - WROOT, le = wingAt(WING_LE, y), te = wingAt(WING_TE, y), c = le - te;
      return 0.5 * wingTc(y) * c * tChord(Math.min(1, Math.max(0, (le - x) / c)));
    };
    const wingBotY = (x, s) => wingMidY(s) - wingHalfT(x, s);                      // mặt dưới cánh tại (x, sải s)
    window.__wingY = (x, s) => [wingMidY(s), wingHalfT(x, s)];                     // debug: [tâm, nửa dày] cánh tại (x, sải) — đo càng thu có lọt cánh
    // ĐỘNG CƠ — GLB: sải 11.93 / 21.09 m · mép miệng hút z 8.52 / 0.19 · nacelle Ø 3.45 m (⇒ hệ số mô hình cutaway ES = 1.184).
    // Tâm cao: GLB −1.84 / −1.27 m ⇒ với mặt đất đúng, đáy vỏ máy chỉ 0.53 / 1.10 m; Boeing §2.3.2: máy TRONG 0.73–0.96 (P),
    // máy NGOÀI 1.90–2.07 m (N) ⇒ nâng tâm lên −1.52 / −0.38 m (đáy 0.85 / 1.99 m) — cùng nhị diện cánh nâng theo (WING_DIH).
    const ES = 1.184;
    const ENG = [{ s: S747 * 11.925, lip: gx(8.52), y: gy(-1.52) }, { s: S747 * 21.085, lip: gx(0.19), y: gy(-0.38) }];
    const ENG_SPANS = ENG.map(e => e.s);
    const engOf = (s) => ENG.reduce((a, e) => Math.abs(e.s - s) < Math.abs(a.s - s) ? e : a);
    const engX = (s) => engOf(s).lip - 0.83 * ES;
    const engY = (s) => engOf(s).y;
    // CÀNG — càng cánh thu NGANG vào bụng nên trạm dọc GLB giữ nguyên z −1.64 m; vệt càng cánh 11 m, càng thân 3.84 m,
    // càng thân sau càng cánh 3 m; càng mũi z 28.0 m (⇒ chiều dài cơ sở 29.6 m ≈ 29.7 m của 747-8).
    // Lốp chính 52×21.0R22 (747-8) Ø 1.32 m · lốp mũi 49×19.0-22 Ø 1.245 m.
    const WG_X = gx(-1.64), WG_Z = S747 * 5.5, BG_X = gx(-4.64), BG_Z = S747 * 1.92, NG_X = gx(28.0);
    const TIRE_R = S747 * 0.66, NTIRE_R = S747 * 0.622, BOGIE_GS = 0.529;          // bán kính lốp chính / mũi · bogie 2 trục cách 1.47 m
    // CỬA — GLB texture: L1 z 26.5 (ống lồng nối vào), bậc cửa y 0.75 m; hầm hàng trước (mạn phải) z 17.5, ngưỡng y −1.23 m
    const L1_X = gx(26.5), L1_HALFW = S747 * 2.883, CARGO_FWD_X = gx(17.5);
    const plane = new THREE.Group();
    const fans = [];
    // rô-to theo thứ tự dựng: phải-trong (#3) · phải-ngoài (#4) · trái-trong (#2) · trái-ngoài (#1) → chỉ số SPOOL (khởi động 4-3-2-1)
    const ENG_SPOOL = [1, 0, 2, 3];
    const compressors = [];
    const hpcs = [];
    const allCombMats = [];
    const allFuelRingMats = [];
    const windSimulations = [];
    let FLOW_GEO = null;                                   // biên dạng vật rắn GEnx-2B cho mô phỏng gió (đơn vị lathe, gốc engX)
    let windFlow = null;                                   // luồng gió kiểu mô phỏng (dựng sau 4 động cơ, gọi mỗi khung)
    const enginePointLights = [];
    plane.position.copy(PPOS); plane.rotation.y = PROT; plane.scale.set(1.1, 1.1, 1.1); scene.add(plane);
    (function makePlane() {
      const pb = Bag();
      const eb = Bag();                                   // ruột động cơ tĩnh (nằm trong vỏ) — dựng riêng, KHÔNG đổ bóng
      // càng đáp — dựng riêng, ĐẶC (không mờ theo vỏ), đổ bóng. THU CÀNG (G 14/10): mỗi cụm càng = 1 "rig" gồm nhiều bag khâu:
      //   strut (trụ + chạc + giằng xoắn, quay quanh trunnion T) · truck (bogie: dầm + bánh + phanh, nghiêng quanh chốt TP)
      //   up (khâu trên giằng — khung chữ A quay quanh điểm treo W trên khung máy bay) · lo (khâu dưới: S trên trụ → gối K)
      //   k1 / k2 (thanh khoá 2 đoạn: gối K → khớp J → tai L trên trụ). 12-lights-close dựng nhóm, flight/20-gear-rig giải động học.
      let lgb = Bag(); const GEAR_RIG = [];
      const gearRig = (kind, u, axis) => { const r = { kind, u, axis, part: {}, pin: {}, wheels: [] }; GEAR_RIG.push(r); gearPart(r, 'strut'); return r; };
      const gearPart = (r, name) => { lgb = r.part[name] || (r.part[name] = Bag()); };
      // bánh LĂN (G 15/10): lốp + mâm mỗi bánh 1 bag riêng, nhóm đặt ở tâm trục bánh (con của bogie / trụ mũi) — 20-gear-rig quay quanh z
      const wheelPart = (r, c) => { const name = 'w' + r.wheels.length; r.wheels.push({ name, c: c.clone() }); return (r.part[name] = Bag()); };
      // nâng trunnion (m) cho đủ chỗ thu: càng thân thu về trước vào hốc bụng · càng mũi thu về trước vào hốc dưới sàn buồng lái
      const GEAR_LIFT = { body: 0.85, nose: 1.0 };
      const seg = 2 * Math.PI / 120;
      // ═══ THÂN 747-8 — TỈ LỆ THẬT: bảng đo trực tiếp từ mẫu GLB (mét), mỗi trạm z: nửa-rộng W · đỉnh lưng T · đáy B ═══
      // Tiết diện = ELIP nền (tâm 1.32 m ở thân trụ & mũi — chóp mũi GLB nằm ngang tâm; ở đuôi tâm = giữa đỉnh/đáy)
      // + BƯỚU tầng trên cộng theo vai (φ 38°→62°) ở phần đỉnh vượt elip. Thân trụ cao 6.79 m / rộng 6.45 m (oval 1.06).
      const ss = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
      // nội suy Hermite đơn điệu (Fritsch–Carlson) — bảng số đo GLB không bị vọt lố giữa các mốc
      const monoTab = (tab) => {
        const n = tab.length, X = tab.map(p => p[0]), Y = tab.map(p => p[1]), d = [], m = [];
        for (let i = 0; i < n - 1; i++) d.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
        m.push(d[0]);
        for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : 3 * (X[i + 1] - X[i - 1]) / ((2 * X[i + 1] - X[i] - X[i - 1]) / d[i - 1] + (X[i + 1] + X[i] - 2 * X[i - 1]) / d[i]));
        m.push(d[n - 2]);
        return (x) => {
          if (x <= X[0]) return Y[0];
          if (x >= X[n - 1]) return Y[n - 1];
          let i = 0; while (x > X[i + 1]) i++;
          const h = X[i + 1] - X[i], t = (x - X[i]) / h, t2 = t * t, t3 = t2 * t;
          return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1];
        };
      };
      // [z, W nửa-rộng, T đỉnh, B đáy] — mét, cắt lát mẫu GLB (đuôi −37.5 → chóp mũi 35.91)
      const FUS_M = [
        [-37.5, 0.463, 4.715, 2.660], [-37.0, 0.565, 4.876, 2.399], [-36.5, 0.651, 4.900, 2.253], [-36.0, 0.733, 4.885, 2.144],
        [-35.0, 0.896, 4.856, 1.926], [-34.0, 1.059, 4.827, 1.708], [-33.0, 1.223, 4.798, 1.490], [-32.0, 1.386, 4.769, 1.272],
        [-31.0, 1.550, 4.740, 1.054], [-30.0, 1.721, 4.716, 0.838], [-29.0, 1.925, 4.713, 0.632], [-28.0, 2.128, 4.710, 0.427],
        [-27.0, 2.316, 4.708, 0.219], [-26.0, 2.451, 4.708, 0.007], [-25.0, 2.587, 4.708, -0.205], [-24.0, 2.723, 4.708, -0.417],
        [-23.0, 2.859, 4.708, -0.630], [-22.0, 2.969, 4.708, -0.836], [-21.0, 3.032, 4.708, -1.031], [-20.0, 3.095, 4.708, -1.227],
        [-19.0, 3.158, 4.708, -1.422], [-18.0, 3.202, 4.708, -1.594], [-17.0, 3.211, 4.708, -1.723], [-16.0, 3.219, 4.708, -1.852],
        [-15.0, 3.225, 4.708, -1.957], [-14.0, 3.225, 4.708, -2.006], [-13.0, 3.225, 4.708, -2.055], [-12.0, 3.224, 4.708, -2.084],
        [-6.0, 3.21, 4.708, -2.084], [0.0, 3.20, 4.708, -2.084], [1.5, 3.20, 4.71, -2.084], [3.0, 3.20, 4.87, -2.084],
        [4.5, 3.20, 5.07, -2.084], [6.0, 3.20, 5.24, -2.084], [7.5, 3.20, 5.41, -2.084], [9.0, 3.20, 5.53, -2.084],
        [10.5, 3.21, 5.63, -2.084], [12.0, 3.21, 5.69, -2.084], [13.5, 3.21, 5.75, -2.084], [16.5, 3.22, 5.75, -2.084],
        [20.0, 3.225, 5.747, -2.084], [20.75, 3.209, 5.747, -2.070], [21.5, 3.181, 5.747, -2.045], [22.25, 3.154, 5.747, -2.021],
        [23.0, 3.126, 5.747, -1.996], [23.75, 3.098, 5.747, -1.971], [24.5, 3.046, 5.741, -1.929], [25.25, 2.985, 5.733, -1.881],
        [26.0, 2.924, 5.724, -1.833], [26.75, 2.863, 5.716, -1.784], [27.5, 2.800, 5.705, -1.733], [28.25, 2.695, 5.653, -1.627],
        [29.0, 2.590, 5.563, -1.521], [29.75, 2.475, 5.409, -1.404], [30.5, 2.334, 5.092, -1.240], [31.25, 2.193, 4.523, -1.076],
        [32.0, 2.007, 3.988, -0.908], [32.75, 1.815, 3.609, -0.651], [33.5, 1.584, 3.222, -0.355], [34.25, 1.323, 2.828, -0.028],
        [35.0, 0.959, 2.361, 0.379], [35.5, 0.671, 1.995, 0.694], [35.75, 0.392, 1.709, 0.947], [35.85, 0.188, 1.506, 1.137],
        [35.91, 0.0, 1.32, 1.32]];
      const Wm = monoTab(FUS_M.map(r => [r[0], r[1]])), Tm = monoTab(FUS_M.map(r => [r[0], r[2]])), Bm = monoTab(FUS_M.map(r => [r[0], r[3]]));
      const CM = 1.32;                                                                    // tâm thân GLB (m)
      const zOf = (x) => (x - 0.606) / S747;
      const cM = (z) => z < -12 ? (Tm(z) + Bm(z)) / 2 : CM;                               // tâm tiết diện (m)
      const hM = (z) => cM(z) - Bm(z);                                                    // nửa-cao elip nền (m)
      const rOfX = (x) => S747 * Wm(zOf(x));                                              // bán kính lathe = nửa-rộng (local)
      const kyX = (x) => { const z = zOf(x), w = Wm(z); return w > 1e-4 ? hM(z) / w : 1; };   // hệ số dãn đứng của elip
      const cOffX = (x) => S747 * (cM(zOf(x)) - CM);                                      // tâm tiết diện so với FY
      const humpX = (x) => { const z = zOf(x); return z < -12 ? 0 : Math.max(0, S747 * (Tm(z) - CM - hM(z))); };   // bướu trên elip
      // tiết diện bướu: VAI dốc giữa φ 38°→62° (GLB đo được thành bên gần đứng); vào chóp mũi chuyển dần sang sin²φ cho tròn đều
      const lobe = (phi, x) => { const w = ss(14.7, 15.8, x); return ss(0.663, 1.082, phi) * (1 - w) + Math.sin(phi) ** 2 * w; };
      const droop = (x) => cOffX(x);                                                      // tâm tiết diện (đuôi vểnh) — mũi GLB không chúi
      const topY = (x) => cOffX(x) + kyX(x) * rOfX(x) + humpX(x);                         // cao độ đỉnh lưng (local, chưa +FY)

      // ═══ BIẾN DẠNG DA THÂN — HÀM DÙNG CHUNG (da thân · hõm kính · khung kính · cửa/ô kính tầng trên) ═══
      // Lathe tròn bán kính = nửa-rộng; hàm này: dãn đứng thành elip · dời tâm (đuôi) · cộng bướu theo vai.
      // Bướu tính theo TRẠM x (không theo bán kính điểm) ⇒ điểm nhô offset vẫn song song da.
      const hullDeform = (x, y, z) => {
        const cy = cOffX(x);
        let yy = cy + kyX(x) * y;
        if (y > 0) { const h = humpX(x); if (h > 0) yy += h * lobe(Math.atan2(y, Math.abs(z)), x); }
        return { y: yy, z, cy };
      };

      // ═══ THÂN 747-8: lathe từ đuôi tới TRẠM NỐI 26.0 m — mũi + khối kính lái dựng bằng lưới cấu trúc riêng (buildNose) ═══
      const Z_SEAM = 26.0;
      const zSt = new Set(FUS_M.map(r => r[0]).filter(z => z <= Z_SEAM));
      for (let z = -10; z <= 0; z += 2) zSt.add(z);
      for (let z = 1.5; z <= 13.5; z += 0.75) zSt.add(+z.toFixed(2));
      const prof = [...zSt].sort((a, b) => a - b).map(z => [S747 * Wm(z), gx(z)]);
      const fusGeo = new THREE.LatheGeometry(prof.map(([r, s]) => new THREE.Vector2(r, s)), 120);
      fusGeo.rotateZ(-Math.PI / 2);
      const NPT = prof.length, fPos = fusGeo.attributes.position;
      for (let i = 0; i < fPos.count; i++) { const d = hullDeform(fPos.getX(i), fPos.getY(i), fPos.getZ(i)); fPos.setY(i, d.y); fPos.setZ(i, d.z); }
      fusGeo.computeVertexNormals();
      const X_SEAM = gx(Z_SEAM), fus = edged(fusGeo, WHITE, { thresh: 2, soft: false, keep: (a, b) => a[0] < X_SEAM - 1e-4 || b[0] < X_SEAM - 1e-4 });   // bỏ vòng biên hở ở trạm nối
      fus.position.y = FY; plane.add(fus);

      // ═══ MŨI + KHỐI KÍNH LÁI 747-8 — LƯỚI CẤU TRÚC GỌN (G 11/10: "improve the mesh structure; make it efficient mesh") ═══
      // Bản trước: lathe mũi 66 trạm × 120 cột (trạm 0.1 m qua khối kính) nắn theo mặt GLB rồi ÉP ĐỈNH vào 24 mặt kính ⇒ ô lưới
      // xoắn, nét gãy 2° lởm chởm (đường chéo, nét đứt, răng cưa quanh kính); khung bạc + kính + ống viền chồng 3 lớp trên da.
      // Bản này:
      // (1) Da mũi = lưới vòng × kinh tuyến nối liền trạm 26.0 m: trạm 0.25 m, 120 cột tới đường nối radome 32.99 m → 60 cột →
      //     30 cột ở chóp (chuyển 2:1 bằng dải 3 tam giác), trạm chóp chia đều theo cung biên dạng 0.16 m ⇒ ô gần vuông.
      // (2) Hình da = lệch bán kính tới mặt GLB (tia từ tâm tiết diện) đo trên lưới chuẩn 0.1 m × 3°, làm mịn rồi NỘI SUY ⇒
      //     mặt trơn, không phụ thuộc lưới hiển thị.
      // (3) Khối kính = 1 lưới trên dải 12 mặt GLB (toạ độ dải u dọc mép · v ngang): 6 ô kính bo góc + khung, phân rã thành các
      //     dải hình thang theo đỉnh ô & nếp gãy ⇒ khung và kính chung đỉnh, không chồng lớp, không cần đẩy lệch chiều sâu.
      // (4) Da cắt lỗ ĐÚNG biên khối kính: ô lưới bị biên cắt qua được tách đa giác rồi chia tam giác; đỉnh biên dùng chung với
      //     khối kính ⇒ kín khít; da sát biên kéo dần cho đi qua đúng mép kính (tắt trong 0.12 ≈ 0.26 m).
      // (5) Nét da mũi chỉ chạy theo đường lưới (bỏ hẳn đường chéo): kinh tuyến hiện khi góc gãy giữa 2 ô > 2° như thân, vòng chỉ
      //     khi > 6° (vài vòng sát chóp) ⇒ mũi cùng kiểu nét dọc với thân; lọc khe & khúc lẻ ≤ 2 đoạn ⇒ nét liền, dừng đúng mép kính.
      //     Mũi + kính: 21 016 → 9 910 tam giác, 7 908 → 3 857 đoạn nét.
      // da mũi mẫu GLB (z ≥ 23.9 m, 620 tam giác gồm cả 24 mặt kính) — mét GLB
      const NOSE_V = [2.174,1.317,31.347,1.73,1.317,33.082,1.681,0.866,33.082,2.144,0.75,31.347,2.098,2.047,31.347,1.673,1.861,33.082,1.876,2.62,31.347,1.497,2.304,33.082,1.308,3.56,31.347,1.213,2.752,33.082,1.033,3.864,31.452,0.805,3.193,33.082,0.672,4.042,31.581,0.398,3.374,33.082,0.334,4.107,31.686,0,4.122,31.737,0,3.441,33.082,1.766,-0.356,31.347,1.344,0.037,33.082,1.017,-0.278,33.082,1.36,-0.754,31.347,2.013,0.141,31.347,1.56,0.425,33.082,1.31,1.317,34.288,1.25,0.982,34.288,1.257,1.697,34.288,1.136,2.024,34.288,0.916,2.337,34.288,0.621,2.616,34.288,0.326,2.761,34.288,0,2.808,34.288,0.577,-0.451,33.082,0.385,0.056,34.288,0,-0.011,34.288,0,-0.537,33.082,0.722,0.193,34.288,0.954,0.402,34.288,1.141,0.683,34.288,0.307,1.238,35.81,0.622,1.163,35.545,0.644,1.317,35.545,0.318,1.317,35.81,0.622,1.484,35.545,0.307,1.4,35.81,0.558,1.64,35.545,0.275,1.477,35.81,0.455,1.773,35.545,0.225,1.542,35.81,0.322,1.875,35.545,0.159,1.593,35.81,0.167,1.94,35.545,0.082,1.625,35.81,0,1.962,35.545,0,1.636,35.81,0,1.012,35.81,0,0.723,35.545,0.167,0.743,35.545,0.082,1.023,35.81,0.322,0.802,35.545,0.159,1.053,35.81,0.455,0.897,35.545,0.225,1.102,35.81,0.558,1.02,35.545,0.275,1.165,35.81,0,1.317,35.908,1.071,1.317,34.787,1.024,1.046,34.787,1.032,1.619,34.787,0.933,1.878,34.787,0.759,2.139,34.787,0.522,2.353,34.787,0.272,2.467,34.787,0,2.503,34.787,0.304,0.303,34.787,0,0.256,34.787,0.579,0.414,34.787,0.771,0.581,34.787,0.93,0.807,34.787,1.488,3.729,30.434,2.196,2.867,29.552,0.976,4.316,30.787,0.727,4.295,31.22,0.423,4.223,31.495,0.205,4.257,31.529,0,4.274,31.551,1.678,3.856,29.552,1.483,4.155,29.552,1.262,4.231,30.081,0.816,5.117,29.552,0.646,5.015,30.224,0.823,4.872,30.09,0.998,4.873,29.552,0,5.478,29.552,0,5.244,30.224,0.209,5.221,30.224,0.289,5.446,29.552,0.597,5.317,29.552,0.448,5.143,30.224,0.744,4.872,30.306,0.538,4.872,30.613,0,5.03,30.613,0.166,5.015,30.613,0.356,4.968,30.613,0.144,4.872,30.812,0,4.872,30.825,0.326,4.872,30.762,2.482,0.658,29.552,2.513,1.317,29.552,2.43,2.117,29.552,1.6,-1.094,29.552,2.061,-0.634,29.552,2.324,-0.057,29.552,2.098,3.829,27.46,1.914,3.892,28.562,2.493,2.974,27.46,1.36,4.772,28.562,1.045,5.173,28.562,0.36,5.582,28.562,0,5.631,28.562,0.74,5.415,28.562,2.771,0.577,27.46,2.806,1.317,27.46,2.73,2.147,27.46,1.772,-1.354,27.46,2.296,-0.849,27.46,2.597,-0.229,27.46,1.669,4.683,27.46,1.324,5.16,27.46,0.419,5.645,27.46,0,5.708,27.46,0.903,5.458,27.46,2.717,3.008,23.939,3.033,0.508,23.939,3.091,1.317,23.939,3.032,2.168,23.939,0,-1.739,27.46,0,-1.965,23.939,1.187,-1.792,23.939,1.101,-1.636,27.46,1.848,-1.464,23.939,2.399,-0.94,23.939,2.755,-0.331,23.939,1.957,4.608,23.939,1.501,5.156,23.939,0.564,5.665,23.939,0,5.747,23.939,1.047,5.474,23.939,0.825,-0.825,31.936,0.587,-1.581,28.122,0.825,-1.341,29.612,0.587,-1.368,29.612,0,-0.921,31.963,0,-1.645,28.122,-2.174,1.317,31.347,-2.144,0.75,31.347,-1.681,0.866,33.082,-1.73,1.317,33.082,-2.098,2.047,31.347,-1.673,1.861,33.082,-1.876,2.62,31.347,-1.497,2.304,33.082,-1.308,3.56,31.347,-1.213,2.752,33.082,-1.033,3.864,31.452,-0.805,3.193,33.082,-0.672,4.042,31.581,-0.398,3.374,33.082,-0.334,4.107,31.686,-1.766,-0.356,31.347,-1.36,-0.754,31.347,-1.017,-0.278,33.082,-1.344,0.037,33.082,-2.013,0.141,31.347,-1.56,0.425,33.082,-1.25,0.982,34.288,-1.31,1.317,34.288,-1.257,1.697,34.288,-1.136,2.024,34.288,-0.916,2.337,34.288,-0.621,2.616,34.288,-0.326,2.761,34.288,-0.577,-0.451,33.082,-0.385,0.056,34.288,-0.722,0.193,34.288,-0.954,0.402,34.288,-1.141,0.683,34.288,-0.307,1.238,35.81,-0.318,1.317,35.81,-0.644,1.317,35.545,-0.622,1.163,35.545,-0.307,1.4,35.81,-0.622,1.484,35.545,-0.275,1.477,35.81,-0.558,1.64,35.545,-0.225,1.542,35.81,-0.455,1.773,35.545,-0.159,1.593,35.81,-0.322,1.875,35.545,-0.082,1.625,35.81,-0.167,1.94,35.545,-0.082,1.023,35.81,-0.167,0.743,35.545,-0.159,1.053,35.81,-0.322,0.802,35.545,-0.225,1.102,35.81,-0.455,0.897,35.545,-0.275,1.165,35.81,-0.558,1.02,35.545,-1.024,1.046,34.787,-1.071,1.317,34.787,-1.032,1.619,34.787,-0.933,1.878,34.787,-0.759,2.139,34.787,-0.522,2.353,34.787,-0.272,2.467,34.787,-0.304,0.303,34.787,-0.579,0.414,34.787,-0.771,0.581,34.787,-0.93,0.807,34.787,-1.488,3.729,30.434,-2.196,2.867,29.552,-0.976,4.316,30.787,-0.727,4.295,31.22,-0.423,4.223,31.495,-0.205,4.257,31.529,-1.678,3.856,29.552,-1.262,4.231,30.081,-1.483,4.155,29.552,-0.816,5.117,29.552,-0.998,4.873,29.552,-0.823,4.872,30.09,-0.646,5.015,30.224,-0.289,5.446,29.552,-0.209,5.221,30.224,-0.597,5.317,29.552,-0.448,5.143,30.224,-0.744,4.872,30.306,-0.538,4.872,30.613,-0.166,5.015,30.613,-0.356,4.968,30.613,-0.144,4.872,30.812,-0.326,4.872,30.762,-2.513,1.317,29.552,-2.482,0.658,29.552,-2.43,2.117,29.552,-2.061,-0.634,29.552,-1.6,-1.094,29.552,-2.324,-0.057,29.552,-2.098,3.829,27.46,-2.493,2.974,27.46,-1.914,3.892,28.562,-1.36,4.772,28.562,-1.045,5.173,28.562,-0.36,5.582,28.562,-0.74,5.415,28.562,-2.806,1.317,27.46,-2.771,0.577,27.46,-2.73,2.147,27.46,-2.296,-0.849,27.46,-1.772,-1.354,27.46,-2.597,-0.229,27.46,-1.669,4.683,27.46,-1.324,5.16,27.46,-0.419,5.645,27.46,-0.903,5.458,27.46,-2.717,3.008,23.939,-3.091,1.317,23.939,-3.033,0.508,23.939,-3.032,2.168,23.939,-1.101,-1.636,27.46,-1.187,-1.792,23.939,-1.848,-1.464,23.939,-2.399,-0.94,23.939,-2.755,-0.331,23.939,-1.957,4.608,23.939,-1.501,5.156,23.939,-0.564,5.665,23.939,-1.047,5.474,23.939,-0.825,-0.825,31.936,-0.587,-1.581,28.122,-0.825,-1.341,29.612,-0.587,-1.368,29.612,0.888,1.317,35.135,0.851,1.096,35.135,0.857,1.56,35.135,0.775,1.772,35.135,0.633,1.985,35.135,0.44,2.15,35.135,0.228,2.241,35.135,0,2.271,35.135,0.244,0.492,35.135,0,0.458,35.135,0.469,0.582,35.135,0.634,0.717,35.135,0.77,0.9,35.135,-0.851,1.096,35.135,-0.888,1.317,35.135,-0.857,1.56,35.135,-0.775,1.772,35.135,-0.633,1.985,35.135,-0.44,2.15,35.135,-0.228,2.241,35.135,-0.244,0.492,35.135,-0.469,0.582,35.135,-0.634,0.717,35.135,-0.77,0.9,35.135,0.587,-1.438,29.121,0,-1.503,29.121,-0.587,-1.438,29.121,0,-1.434,29.612,0,-1.478,29.298,0.171,-1.459,29.298,0.171,-1.484,29.121,-0.171,-1.459,29.298,-0.171,-1.484,29.121];
      const NOSE_I = [0,1,2,2,3,0,4,5,1,1,0,4,6,7,5,5,4,6,8,9,6,10,11,9,9,8,10,12,13,11,11,10,12,14,13,12,15,16,13,13,14,15,17,18,19,19,20,17,21,22,18,18,17,21,3,2,22,22,21,3,1,23,24,24,2,1,5,25,23,23,1,5,7,26,25,25,5,7,9,27,26,26,7,9,11,28,27,27,9,11,13,29,28,28,11,13,16,30,29,29,13,16,31,32,33,33,34,31,19,35,32,32,31,19,18,36,35,35,19,18,22,37,36,36,18,22,2,24,37,37,22,2,38,39,40,40,41,38,41,40,42,42,43,41,43,42,44,44,45,43,45,44,46,46,47,45,47,46,48,48,49,47,49,48,50,50,51,49,51,50,52,52,53,51,54,55,56,56,57,54,57,56,58,58,59,57,59,58,60,60,61,59,61,60,62,62,63,61,63,62,39,39,38,63,41,64,38,43,64,41,45,64,43,47,64,45,49,64,47,51,64,49,53,64,51,57,64,54,59,64,57,61,64,59,63,64,61,38,64,63,65,66,24,24,23,65,67,65,23,23,25,67,68,67,25,25,26,68,69,68,26,26,27,69,70,69,27,27,28,70,71,70,28,28,29,71,72,71,29,29,30,72,73,74,33,33,32,73,75,73,32,32,35,75,36,76,75,75,35,36,37,77,76,76,36,37,24,66,77,77,37,24,78,6,79,10,8,80,10,80,81,81,12,10,12,81,82,82,14,12,83,84,15,15,14,83,9,7,6,85,78,79,85,86,87,87,78,85,14,82,83,88,89,90,90,91,88,92,93,94,94,95,92,96,97,89,89,88,96,95,94,97,97,96,95,89,98,90,89,99,98,93,100,101,101,94,93,97,102,99,99,89,97,94,101,102,102,97,94,103,101,100,100,104,103,102,105,99,105,102,101,101,103,105,3,106,107,107,0,3,0,107,108,108,4,0,4,108,79,79,6,4,20,109,110,110,17,20,17,110,111,111,21,17,21,111,106,106,3,21,78,8,6,112,113,114,115,91,86,86,113,115,91,116,88,95,117,118,118,92,95,88,116,119,119,96,88,96,119,117,117,95,96,106,120,121,121,107,106,107,121,122,122,108,107,108,122,114,114,79,108,109,123,124,124,110,109,110,124,125,125,111,110,111,125,120,120,106,111,113,112,126,126,115,113,115,126,127,127,116,115,117,128,129,129,118,117,116,127,130,130,119,116,119,130,128,128,117,119,113,85,79,113,79,114,86,85,113,78,87,80,8,78,80,114,131,112,120,132,133,133,121,120,121,133,134,134,122,121,122,134,131,131,114,122,135,136,137,137,138,135,138,137,139,139,123,138,123,139,140,140,124,123,124,140,141,141,125,124,125,141,132,132,120,125,142,126,112,112,131,142,126,142,143,143,127,126,128,144,145,145,129,128,127,143,146,146,130,127,130,146,144,144,128,130,20,19,147,135,138,148,138,123,109,109,149,138,19,31,147,149,109,20,20,147,149,148,149,150,34,151,147,147,31,34,149,148,138,148,152,135,153,154,155,155,156,153,157,153,156,156,158,157,159,157,158,158,160,159,161,159,162,163,161,162,162,164,163,165,163,164,164,166,165,167,165,166,15,167,166,166,16,15,168,169,170,170,171,168,172,168,171,171,173,172,154,172,173,173,155,154,156,155,174,174,175,156,158,156,175,175,176,158,160,158,176,176,177,160,162,160,177,177,178,162,164,162,178,178,179,164,166,164,179,179,180,166,16,166,180,180,30,16,181,34,33,33,182,181,170,181,182,182,183,170,171,170,183,183,184,171,173,171,184,184,185,173,155,173,185,185,174,155,186,187,188,188,189,186,187,190,191,191,188,187,190,192,193,193,191,190,192,194,195,195,193,192,194,196,197,197,195,194,196,198,199,199,197,196,198,53,52,52,199,198,54,200,201,201,55,54,200,202,203,203,201,200,202,204,205,205,203,202,204,206,207,207,205,204,206,186,189,189,207,206,187,186,64,190,187,64,192,190,64,194,192,64,196,194,64,198,196,64,53,198,64,200,54,64,202,200,64,204,202,64,206,204,64,186,206,64,174,208,209,209,175,174,175,209,210,210,176,175,176,210,211,211,177,176,177,211,212,212,178,177,178,212,213,213,179,178,179,213,214,214,180,179,180,214,72,72,30,180,33,74,215,215,182,33,182,215,216,216,183,182,184,183,216,216,217,184,185,184,217,217,218,185,174,185,218,218,208,174,219,220,159,163,221,161,163,165,222,222,221,163,165,167,223,223,222,165,224,167,15,15,84,224,162,159,160,225,220,219,225,219,226,226,227,225,167,224,223,228,229,230,230,231,228,92,232,233,233,93,92,234,228,231,231,235,234,232,234,235,235,233,232,231,230,236,231,236,237,93,233,238,238,100,93,235,231,237,237,239,235,233,235,239,239,238,233,240,104,100,100,238,240,239,237,241,241,240,238,238,239,241,154,153,242,242,243,154,153,157,244,244,242,153,157,159,220,220,244,157,169,168,245,245,246,169,168,172,247,247,245,168,172,154,243,243,247,172,219,159,161,248,249,250,251,250,227,227,229,251,229,252,251,232,92,118,118,253,232,228,234,254,254,252,228,234,232,253,253,254,234,243,242,255,255,256,243,242,244,257,257,255,242,244,220,249,249,257,244,246,245,258,258,259,246,245,247,260,260,258,245,247,243,256,256,260,247,250,251,261,261,248,250,251,252,262,262,261,251,253,118,129,129,263,253,252,254,264,264,262,252,254,253,263,263,264,254,250,220,225,250,249,220,227,250,225,219,221,226,161,221,219,249,248,265,256,255,266,266,267,256,255,257,268,268,266,255,257,249,265,265,268,257,135,269,270,270,136,135,269,259,271,271,270,269,259,258,272,272,271,259,258,260,273,273,272,258,260,256,267,267,273,260,274,265,248,248,261,274,261,262,275,275,274,261,263,129,145,145,276,263,262,264,277,277,275,262,264,263,276,276,277,264,169,278,170,135,279,269,269,280,246,246,259,269,170,278,181,280,278,169,169,246,280,279,281,280,34,181,278,278,151,34,280,269,279,279,135,152,90,98,80,80,87,90,98,99,81,81,80,98,81,99,105,105,82,81,104,84,83,83,103,104,91,90,87,87,86,91,82,105,103,103,83,82,230,226,221,221,236,230,236,221,222,222,237,236,222,223,241,241,237,222,104,240,224,224,84,104,229,227,226,226,230,229,223,224,240,240,241,223,229,228,252,91,115,116,282,283,66,66,65,282,284,282,65,65,67,284,285,284,67,67,68,285,286,285,68,68,69,286,287,286,69,69,70,287,288,287,70,70,71,288,289,288,71,71,72,289,290,291,74,74,73,290,292,290,73,73,75,292,76,293,292,292,75,76,77,294,293,293,76,77,66,283,294,294,77,66,208,295,296,296,209,208,209,296,297,297,210,209,210,297,298,298,211,210,211,298,299,299,212,211,212,299,300,300,213,212,213,300,301,301,214,213,214,301,289,289,72,214,291,302,215,215,74,291,215,302,303,303,216,215,303,304,217,217,216,303,304,305,218,218,217,304,305,295,208,208,218,305,40,39,283,283,282,40,42,40,282,282,284,42,44,42,284,284,285,44,46,44,285,285,286,46,48,46,286,286,287,48,50,48,287,287,288,50,52,50,288,288,289,52,56,55,291,291,290,56,58,56,290,290,292,58,60,58,292,292,293,60,62,60,293,293,294,62,39,62,294,294,283,39,189,188,296,296,295,189,296,188,191,191,297,296,297,191,193,193,298,297,298,193,195,195,299,298,299,195,197,197,300,299,300,197,199,199,301,300,301,199,52,52,289,301,291,55,201,201,302,291,302,201,203,203,303,302,303,203,205,205,304,303,304,205,207,207,305,304,207,189,295,295,305,207,148,306,307,307,152,148,148,152,307,307,306,148,279,152,307,307,308,279,307,152,279,279,308,307,150,149,147,150,147,151,150,151,309,309,310,311,311,150,309,306,150,311,311,312,306,306,312,311,150,306,311,150,311,310,150,310,309,147,149,150,147,150,309,147,309,151,310,307,312,312,311,310,310,311,312,312,307,310,281,309,151,281,151,278,281,278,280,309,313,310,313,309,281,308,314,313,313,281,308,281,280,278,309,281,278,309,278,151,281,309,310,281,310,313,313,314,308,281,313,308,310,313,314,314,307,310,314,313,310,310,307,314];
      (function buildNose() {
        const TAU = Math.PI * 2;
        const L3 = (q) => [gx(q[2]), gy(q[1]) - FY, S747 * q[0]];                      // GLB (m) → local, y so với tâm thân FY
        const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
        const outward = (p, n) => dot(n, [0.4, p[1] - cOffX(p[0]), p[2]]) >= 0;   // hướng ra ngoài: từ điểm trục lùi 0.4 về sau

        // ── 1. MẶT DA: nền elip + bướu (hullDeform) · lệch bán kính tới mặt GLB trên lưới chuẩn, làm mịn, nội suy ──
        const base = (x, phi) => { const r = rOfX(x), d = hullDeform(x, -r * Math.sin(phi), r * Math.cos(phi)), dy = d.y - d.cy; return { cy: d.cy, dy, dz: d.z, r0: Math.hypot(dy, d.z) }; };
        const NT = [];
        { const V = []; for (let k = 0; k < NOSE_V.length; k += 3) V.push(L3([NOSE_V[k], NOSE_V[k + 1], NOSE_V[k + 2]]));
          for (let k = 0; k < NOSE_I.length; k += 3) { const a = V[NOSE_I[k]], b = V[NOSE_I[k + 1]], c = V[NOSE_I[k + 2]]; NT.push({ a, e1: sub(b, a), e2: sub(c, a), x0: Math.min(a[0], b[0], c[0]) - 1e-4, x1: Math.max(a[0], b[0], c[0]) + 1e-4 }); } }
        const NBX = 64, bx0N = Math.min(...NT.map(q => q.x0)), bxS = NBX / (Math.max(...NT.map(q => q.x1)) - bx0N), BKT = Array.from({ length: NBX }, () => []);
        const bin = (x) => Math.min(NBX - 1, Math.max(0, Math.floor((x - bx0N) * bxS)));
        NT.forEach(q => { for (let b = bin(q.x0); b <= bin(q.x1); b++) BKT[b].push(q); });   // ngăn theo x ⇒ mỗi tia chỉ thử ~1/30 số tam giác
        const rayGLB = (x, cy, ey, ez, r0) => {                                       // tia (x, cy, 0) theo (0, ey, ez) — Möller–Trumbore, lấy giao gần r0
          let hit = -1; const d = [0, ey, ez];
          for (const q of BKT[bin(x)]) {
            if (x < q.x0 || x > q.x1) continue;
            const p = crs(d, q.e2), det = dot(q.e1, p); if (Math.abs(det) < 1e-12) continue;
            const inv = 1 / det, s0 = [x - q.a[0], cy - q.a[1], -q.a[2]], u = dot(s0, p) * inv; if (u < -1e-6 || u > 1 + 1e-6) continue;
            const qq = crs(s0, q.e1), v = dot(d, qq) * inv; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
            const t = dot(q.e2, qq) * inv; if (t > 0 && (hit < 0 || Math.abs(t - r0) < Math.abs(hit - r0))) hit = t;
          }
          return hit;
        };
        const RZ0 = 26.0, RDZ = 0.1, RNR = 99, RNC = 120, dRf = new Float32Array(RNR * RNC), hasR = new Uint8Array(RNR * RNC);
        for (let i = 0; i < RNR; i++) {
          const x = gx(RZ0 + i * RDZ);
          for (let c = 0; c < RNC; c++) {
            const b = base(x, c * TAU / RNC); if (b.r0 < 1e-4 || Math.atan2(b.dy, Math.abs(b.dz)) < 0.33) continue;
            const t = rayGLB(x, b.cy, b.dy / b.r0, b.dz / b.r0, b.r0);
            if (t > 0 && Math.abs(t - b.r0) < 0.4) { dRf[i * RNC + c] = t - b.r0; hasR[i * RNC + c] = 1; }
          }
        }
        const smooth = (passes, both) => {                                           // [1 2 1] có mặt nạ — chỉ trộn điểm có số đo
          for (let p = 0; p < passes; p++) {
            const src = dRf.slice();
            for (let i = 0; i < RNR; i++) for (let c = 0; c < RNC; c++) {
              const k = i * RNC + c; if (!hasR[k]) continue; let s0 = 0, w0 = 0;
              for (let a = both ? -1 : 0; a <= (both ? 1 : 0); a++) for (let b = -1; b <= 1; b++) {
                const i2 = i + b; if (i2 < 0 || i2 >= RNR) continue; const k2 = i2 * RNC + (c + a + RNC) % RNC; if (!hasR[k2]) continue;
                const w = (2 - Math.abs(a)) * (2 - Math.abs(b)); s0 += w * src[k2]; w0 += w;
              }
              dRf[k] = s0 / w0;
            }
          }
        };
        smooth(3, true); smooth(5, false);
        const dRat = (x, phi) => {
          const fi = (zOf(x) - RZ0) / RDZ; if (fi <= 0 || fi >= RNR - 1) return 0;
          const i0 = Math.floor(fi), ti = fi - i0, fc = ((phi / TAU * RNC) % RNC + RNC) % RNC, c0 = Math.floor(fc) % RNC, c1 = (c0 + 1) % RNC, tc = fc - Math.floor(fc);
          const g = (i, c) => dRf[i * RNC + c];
          return (g(i0, c0) * (1 - tc) + g(i0, c1) * tc) * (1 - ti) + (g(i0 + 1, c0) * (1 - tc) + g(i0 + 1, c1) * tc) * ti;
        };
        const NX0 = gx(26.2), NX1 = gx(27.5), NXA = gx(35.55), NXB = gx(35.8);
        const skinAt = (x, phi) => {                                                 // điểm da mũi [x, y (so FY), z] + tâm & hướng tia
          const b = base(x, phi); let r = b.r0;
          if (x > NX0 && b.r0 > 1e-6) { const w = ss(NX0, NX1, x) * ss(0.35, 0.70, Math.atan2(b.dy, Math.abs(b.dz))) * (1 - ss(NXA, NXB, x)); if (w > 0) r += w * dRat(x, phi); }
          const ey = b.r0 > 1e-9 ? b.dy / b.r0 : 0, ez = b.r0 > 1e-9 ? b.dz / b.r0 : 0;
          return { p: [x, b.cy + ey * r, ez * r], cy: b.cy, ey, ez, r };
        };
        const phiOf = (p) => {                                                       // góc lathe φ có tia đi qua p (cùng trạm) — θ(φ) giảm đơn điệu
          const x = p[0], tg = Math.atan2(p[1] - cOffX(x), p[2]);
          const f = (phi) => { const b = base(x, phi), d = Math.atan2(b.dy, b.dz) - tg; return Math.atan2(Math.sin(d), Math.cos(d)); };
          let lo = -tg - 0.7, hi = -tg + 0.7;
          for (let k = 0; k < 32; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
          return (((lo + hi) / 2) % TAU + TAU) % TAU;
        };

        // ── 2. DẢI KÍNH (GLB, 1 mạn x ≥ 0): mép TRÊN (y 4.872) & mép DƯỚI, giữa → sau; mặt i = tứ giác TOP[i..i+1] × BOT[i..i+1].
        //    Toạ độ dải u ∈ [−6, 6] (mặt i ↔ u ∈ [i, i+1], âm = mạn trái) · v ∈ [0, 1] (mép dưới → mép trên) ──
        const WS_TOP = [[0, 4.872, 30.826], [0.144, 4.872, 30.812], [0.326, 4.872, 30.762], [0.538, 4.872, 30.613], [0.744, 4.872, 30.306], [0.823, 4.872, 30.090], [0.998, 4.873, 29.552]];
        const WS_BOT = [[0, 4.274, 31.551], [0.205, 4.257, 31.529], [0.423, 4.223, 31.495], [0.727, 4.295, 31.220], [0.976, 4.316, 30.787], [1.262, 4.231, 30.081], [1.483, 4.155, 29.552]];
        const band = (u, v) => {
          const s = u < 0 ? -1 : 1, a = Math.min(6, Math.abs(u)), i = Math.min(5, Math.floor(a)), f = a - i, q = [];
          for (let k = 0; k < 3; k++) { const b = WS_BOT[i][k] + (WS_BOT[i + 1][k] - WS_BOT[i][k]) * f, t = WS_TOP[i][k] + (WS_TOP[i + 1][k] - WS_TOP[i][k]) * f; q.push(b + (t - b) * v); }
          q[0] *= s; return L3(q);
        };
        const lenUV = (u, v, du, dv) => { const e = 1e-4, p = band(u, v), q = band(u + du * e, v + dv * e); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / e; };
        const bandN = (u, v) => { const e = 1e-4, p = band(u, v), n = unit(crs(sub(band(u + e, v), p), sub(band(u, v + e), p))); return outward(p, n) ? n : n.map(t => -t); };
        // ô kính (u ≥ 0) đo trên texture GLB: [mép trong dưới, mép trong trên, mép ngoài dưới, mép ngoài trên, v dưới, v trên],
        // bo 4 góc bán kính THẬT rc (Bézier bậc 2, đổi ra u/v theo độ dài thật tại góc) ⇒ đa giác lồi CCW 16 đỉnh
        const paneLoop = (ub0, ut0, ub1, ut1, vb, vt, rc) => {
          const C = [[ub0, vb], [ub1, vb], [ut1, vt], [ut0, vt]], out = [];
          for (let k = 0; k < 4; k++) {
            const P0 = C[(k + 3) % 4], P1 = C[k], P2 = C[(k + 1) % 4];
            const [A, B] = [P0, P2].map(Q => { const d = [Q[0] - P1[0], Q[1] - P1[1]], l = Math.hypot(d[0], d[1]); d[0] /= l; d[1] /= l; const s = rc / lenUV(P1[0], P1[1], d[0], d[1]); return [P1[0] + d[0] * s, P1[1] + d[1] * s]; });
            for (const t of [0, 1 / 3, 2 / 3, 1]) { const a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; out.push([a * A[0] + b * P1[0] + c * B[0], a * A[1] + b * P1[1] + c * B[1]]); }
          }
          return out;
        };
        const PANES = [paneLoop(0.29, 0.39, 3.82, 3.77, 0.09, 0.91, 0.022),            // ô 1 (trước) — trải 4 mặt A–D
                       paneLoop(4.12, 4.15, 4.86, 4.81, 0.105, 0.89, 0.018),           // ô 2 (hông)
                       paneLoop(5.095, 5.095, 5.897, 5.897, 0.10, 0.908, 0.018)];      // ô 3 (sau)
        // gộp mốc u gần trùng (≤ 0.004): góc bo trên & dưới của cùng một mép lệch nhau vài phần vạn u ⇒ tránh dải hình kim
        { const all = []; PANES.forEach((pl, a) => pl.forEach((q, b) => all.push({ u: q[0], a, b }))); all.sort((p, q) => p.u - q.u);
          let g = []; const flush = () => { if (g.length) { const m = g.reduce((s, e) => s + e.u, 0) / g.length; g.forEach(e => { PANES[e.a][e.b][0] = m; }); } g = []; };
          for (const e of all) { if (g.length && e.u - g[0].u > 0.004) flush(); g.push(e); } flush(); }
        // phân rã dải: mốc u = nếp gãy 0…6 + mọi đỉnh ô kính ⇒ trong mỗi dải mép ô là đoạn thẳng, ô = hình thang
        const brk = [0, 1, 2, 3, 4, 5, 6]; PANES.forEach(pl => pl.forEach(q => brk.push(q[0]))); brk.sort((a, b) => a - b);
        const US = []; for (const u of brk) if (!US.length || u - US[US.length - 1] > 1e-5) US.push(u);
        const paneSpan = (uL, uR) => {                                             // ô kính phủ dải [uL, uR] → [[v dưới tại uL, uR], [v trên tại uL, uR]]
          const um = (uL + uR) / 2;
          for (const pl of PANES) {
            let lo = null, hi = null;
            for (let k = 0; k < pl.length; k++) {
              const a = pl[k], b = pl[(k + 1) % pl.length]; if ((a[0] - um) * (b[0] - um) >= 0) continue;
              const f = (u) => a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]), vm = f(um);
              if (!lo || vm < lo.vm) lo = { vm, f }; if (!hi || vm > hi.vm) hi = { vm, f };
            }
            if (lo && hi && hi.vm > lo.vm + 1e-6) return [[lo.f(uL), lo.f(uR)], [hi.f(uL), hi.f(uR)]];
          }
          return null;
        };
        const SLABS = [];                                                            // { uL, uR, bd: biên lớp [v tại uL, v tại uR], glass: lớp kính }
        for (let k = 0; k < US.length - 1; k++) {
          const uL = US[k], uR = US[k + 1], sp = paneSpan(uL, uR), bd = sp ? [[0, 0], sp[0], sp[1], [1, 1]] : [[0, 0], [1, 1]];
          SLABS.push({ uL, uR, bd, glass: sp ? 1 : -1 });
          SLABS.push({ uL: -uR, uR: -uL, bd: bd.map(([a, b]) => [b, a]), glass: sp ? 1 : -1 });   // mạn trái = soi gương u → −u
        }
        // biên khối kính (u, v) đi vòng: mép dưới −6 → 6 · mép sau phải · mép trên 6 → −6 · mép sau trái; đỉnh thật = mọi mốc u
        const UB = [...US.slice(1).map(u => -u).reverse(), ...US], BR = [];
        UB.forEach(u => BR.push([u, 0])); UB.slice().reverse().forEach(u => BR.push([u, 1]));
        const BD = [];                                                               // biên mịn ≤ 0.02 u / 0.025 v: { u, v, p, x, phi, real }
        for (let k = 0; k < BR.length; k++) {
          const a = BR[k], b = BR[(k + 1) % BR.length], n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]) / 0.02, Math.abs(b[1] - a[1]) / 0.025)));
          for (let j = 0; j < n; j++) { const t = j / n, u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t, p = band(u, v); BD.push({ u, v, p, x: p[0], phi: phiOf(p), real: j === 0 }); }
        }
        const NB = BD.length;

        // ── 3. LƯỚI DA MŨI: trạm (m GLB) 0.25 m tới đường nối radome 32.99 (120 cột) → radome 60 cột → chóp 30 cột ──
        const ZS = [];
        for (let k = 0; k <= 27; k++) ZS.push(26.0 + 0.25 * k);                    // 26.0 → 32.75
        ZS.push(32.989);                                                             // đường nối radome (= trạm lathe 15.55 cũ)
        for (let k = 0; k <= 6; k++) ZS.push(33.25 + 0.25 * k);                    // 33.25 → 34.75
        ZS.push(34.882, 35.012, 35.143, 35.272, 35.398, 35.516, 35.627, 35.724, 35.804, 35.864);   // chóp: bước cung biên dạng 0.16 m
        const NR = ZS.length, XS = ZS.map(gx), X_TIP = gx(35.91), I_RAD = 28, I_T2 = 38, NCOL = (i) => i <= I_RAD ? 120 : i <= I_T2 ? 60 : 30;
        const pos = [], gs = [], vid = [];
        const addV = (p, g = null) => { pos.push(p[0], p[1], p[2]); gs.push(g); return pos.length / 3 - 1; };
        const PV = (k) => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]];
        for (let i = 0; i < NR; i++) {
          const n = NCOL(i), row = [];
          for (let c = 0; c < n; c++) {
            if (i === 0) { const j = c * NPT + NPT - 1; row.push(addV([fPos.getX(j), fPos.getY(j), fPos.getZ(j)])); }   // vòng nối = đúng đỉnh lathe
            else { const s = skinAt(XS[i], c * TAU / n); row.push(addV(s.p, s)); }
          }
          vid.push(row);
        }
        const vTip = addV([X_TIP, 0, 0]);
        // vùng ô lưới có thể bị biên kính cắt
        const PH1 = TAU / 120, PH = (c) => c * PH1;
        let bx0 = 1e9, bx1 = -1e9, bp0 = 1e9, bp1 = -1e9;
        for (const q of BD) { bx0 = Math.min(bx0, q.x); bx1 = Math.max(bx1, q.x); bp0 = Math.min(bp0, q.phi); bp1 = Math.max(bp1, q.phi); }
        const ri0 = Math.max(1, XS.findIndex(x => x > bx0) - 1), ri1 = XS.findIndex(x => x > bx1), ci0 = Math.floor(bp0 / PH1) - 1, ci1 = Math.ceil(bp1 / PH1) + 1;
        const inB = (x, phi) => { let r = false; for (let j = 0, k = NB - 1; j < NB; k = j++) { const a = BD[j], b = BD[k]; if ((a.phi > phi) !== (b.phi > phi) && x < (b.x - a.x) * (phi - a.phi) / (b.phi - a.phi) + a.x) r = !r; } return r; };
        const INS = new Map();
        for (let i = ri0; i <= ri1; i++) for (let c = ci0; c <= ci1 + 1; c++) INS.set(i * 1000 + c, inB(XS[i], PH(c)));
        const ins = (i, c) => INS.get(i * 1000 + c) || false;
        // giao điểm biên × cạnh lưới (kinh tuyến c giữa hàng i, i+1 · vòng i giữa cột c, c+1): toạ độ dải (u, v) ĐÚNG trên mép kính
        const bkey = (u, v) => Math.round(u * 1e5) + ',' + Math.round(v * 1e5);
        const sV = new Map(), skinBV = (u, v) => { const k = bkey(u, v); let id = sV.get(k); if (id === undefined) { id = addV(band(u, v)); sV.set(k, id); } return id; };
        const crossM = new Map(), crossR = new Map();
        const addX = (map, key, X) => { if (!map.has(key)) map.set(key, []); const L = map.get(key); if (!L.some(Y => Math.abs(Y.t - X.t) < 1e-7)) L.push(X); };
        const mkX = (j, tj, t) => {
          const a = BD[j], b = BD[(j + 1) % NB]; let u = a.u + (b.u - a.u) * tj, v = a.v + (b.v - a.v) * tj;
          if (tj < 1e-7 && a.real) { u = a.u; v = a.v; } else if (tj > 1 - 1e-7 && b.real) { u = b.u; v = b.v; }
          return { t, beta: j + tj, u, v };
        };
        for (let j = 0; j < NB; j++) {
          const a = BD[j], b = BD[(j + 1) % NB];
          if (Math.abs(b.phi - a.phi) > 1e-12) for (let c = Math.ceil(Math.min(a.phi, b.phi) / PH1); c <= Math.floor(Math.max(a.phi, b.phi) / PH1); c++) {
            const tj = (PH(c) - a.phi) / (b.phi - a.phi); if (tj < 0 || tj >= 1) continue;
            const x = a.x + (b.x - a.x) * tj;
            for (let i = ri0; i < ri1; i++) if (x >= XS[i] && x <= XS[i + 1]) { addX(crossM, c * 1000 + i, mkX(j, tj, (x - XS[i]) / (XS[i + 1] - XS[i]))); break; }
          }
          if (Math.abs(b.x - a.x) > 1e-12) for (let i = ri0; i <= ri1; i++) {
            const tj = (XS[i] - a.x) / (b.x - a.x); if (tj < 0 || tj >= 1) continue;
            const phi = a.phi + (b.phi - a.phi) * tj, c = Math.floor(phi / PH1);
            addX(crossR, i * 1000 + c, mkX(j, tj, (phi - PH(c)) / PH1));
          }
        }
        // kéo da sát biên về đúng mép kính: δ = bán kính mép kính − bán kính da tại biên, nội suy Shepard, tắt dần trong RK
        const RK = 0.12, dB = BD.map(q => { const s = skinAt(q.x, q.phi); return Math.hypot(q.p[1] - s.cy, q.p[2]) - s.r; });
        for (let i = Math.max(1, ri0 - 2); i <= Math.min(I_RAD - 1, ri1 + 2); i++) for (let c = ci0 - 3; c <= ci1 + 3; c++) {
          const cc = (c + 120) % 120, id = vid[i][cc], g = gs[id]; if (!g || ins(i, c)) continue;
          let sw = 0, sd = 0, dmin = 1e9;
          for (let j = 0; j < NB; j++) { const q = BD[j]; if (Math.abs(q.x - XS[i]) > 2 * RK) continue; const d = Math.hypot(q.x - XS[i], (q.phi - PH(c)) * g.r); if (d < dmin) dmin = d; if (d < 2 * RK) { const w = 1 / (d * d + 1e-6); sw += w; sd += w * dB[j]; } }
          if (dmin >= RK || !sw) continue;
          const r = g.r + (sd / sw) * (1 - ss(0, RK, dmin));
          pos[3 * id + 1] = g.cy + g.ey * r; pos[3 * id + 2] = g.ez * r;
        }

        // ── 4. MẶT LƯỚI (đa giác gốc trước khi chia tam giác: tứ giác · đa giác cắt · ngũ giác chuyển 2:1 · quạt chóp) ──
        const faces = [], tris = [];
        const quad = (a, b, c, d) => {                                               // chia theo đường chéo ngắn
          faces.push([a, b, c, d]);
          const A = PV(a), B = PV(b), C = PV(c), D = PV(d);
          if (Math.hypot(...sub(A, C)) <= Math.hypot(...sub(B, D))) tris.push(a, b, c, a, c, d); else tris.push(a, b, d, b, c, d);
        };
        const earClip = (Q) => {                                                     // đa giác đơn → tam giác (giữ mọi đỉnh, ưu tiên góc nhỏ nhất lớn)
          const n = Q.length; let A2 = 0; for (let k = 0; k < n; k++) { const a = Q[k], b = Q[(k + 1) % n]; A2 += a[0] * b[1] - b[0] * a[1]; }
          const idx = [...Array(n).keys()]; if (A2 < 0) idx.reverse();
          const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
          const ang = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - a[0], c[1] - a[1]]; return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1)))); };
          const out = [];
          while (idx.length > 3) {
            let best = -1, bq = -1;
            for (let k = 0; k < idx.length; k++) {
              const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length], a = Q[ia], b = Q[ib], c = Q[ic];
              if (cr(a, b, c) <= 1e-12) continue;
              let ok = true;
              for (const j of idx) { if (j === ia || j === ib || j === ic) continue; const p = Q[j]; if (cr(a, b, p) >= -1e-12 && cr(b, c, p) >= -1e-12 && cr(c, a, p) >= -1e-12) { ok = false; break; } }
              if (!ok) continue;
              const q = Math.min(ang(a, b, c), ang(b, c, a), ang(c, a, b)); if (q > bq) { bq = q; best = k; }
            }
            if (best < 0) break;
            out.push([idx[(best + idx.length - 1) % idx.length], idx[best], idx[(best + 1) % idx.length]]); idx.splice(best, 1);
          }
          if (idx.length === 3 && Math.abs(cr(Q[idx[0]], Q[idx[1]], Q[idx[2]])) > 1e-12) out.push([idx[0], idx[1], idx[2]]);
          return out;
        };
        const cutCell = (i, c) => {                                                  // ô (i, c) trừ phần trong khối kính → đa giác → tam giác
          const x0 = XS[i], x1 = XS[i + 1], p0 = PH(c), p1 = PH(c + 1), R = rOfX(x0);
          const corner = (ii, cc, x, p) => ({ kind: 'c', id: vid[ii][cc % 120], q: [x, p * R], ins: ins(ii, cc) });
          const xs = (L, rev) => (L || []).slice().sort((a, b) => rev ? b.t - a.t : a.t - b.t);
          const S = [corner(i, c, x0, p0)];
          for (const X of xs(crossM.get(c * 1000 + i), false)) S.push({ kind: 'x', X, q: [x0 + (x1 - x0) * X.t, p0 * R] });
          S.push(corner(i + 1, c, x1, p0));
          for (const X of xs(crossR.get((i + 1) * 1000 + c), false)) S.push({ kind: 'x', X, q: [x1, (p0 + PH1 * X.t) * R] });
          S.push(corner(i + 1, c + 1, x1, p1));
          for (const X of xs(crossM.get((c + 1) * 1000 + i), true)) S.push({ kind: 'x', X, q: [x0 + (x1 - x0) * X.t, p1 * R] });
          S.push(corner(i, c + 1, x0, p1));
          for (const X of xs(crossR.get(i * 1000 + c), true)) S.push({ kind: 'x', X, q: [x0, (p0 + PH1 * X.t) * R] });
          const XL = S.filter(e => e.kind === 'x');
          if (!XL.length) { if (!S[0].ins) quad(S[0].id, S[1].id, S[2].id, S[3].id); return; }
          let st = false; for (const e of S) { st = e.kind === 'c' ? e.ins : !st; e.after = st; }
          // ghép giao điểm thành các khúc biên nằm trong ô (theo thứ tự trên biên)
          XL.sort((a, b) => a.X.beta - b.X.beta);
          const inCell = (bt) => { bt = ((bt % NB) + NB) % NB; const j = Math.floor(bt), t = bt - j, A = BD[j], B = BD[(j + 1) % NB], x = A.x + (B.x - A.x) * t, p = A.phi + (B.phi - A.phi) * t; return x > x0 && x < x1 && p > p0 && p < p1; };
          if (XL.length > 1) for (let k = 0; k < XL.length; k++) {
            const A = XL[k], B = XL[(k + 1) % XL.length]; let bB = B.X.beta; if (bB <= A.X.beta) bB += NB;
            if (inCell((A.X.beta + bB) / 2)) { A.next = B; B.prev = A; }
          }
          const chainVerts = (A) => { const out = []; let bB = A.next.X.beta; if (bB <= A.X.beta) bB += NB; for (let j = Math.floor(A.X.beta) + 1; j < bB; j++) { const q = BD[j % NB]; if (q.real && j > A.X.beta + 1e-9 && j < bB - 1e-9) out.push({ id: skinBV(q.u, q.v), q: [q.x, q.phi * R] }); } return out; };
          const used = new Set();
          for (let s0 = 0; s0 < S.length; s0++) {
            const e0 = S[s0]; if (used.has(s0) || (e0.kind === 'c' ? e0.ins : e0.after)) continue;
            const poly = []; let k = s0, guard = 0;
            do {
              const e = S[k]; used.add(k);
              if (e.kind === 'c') { poly.push({ id: e.id, q: e.q }); k = (k + 1) % S.length; continue; }
              poly.push({ id: skinBV(e.X.u, e.X.v), q: e.q });
              if (e.after && (e.next || e.prev)) {                                  // đi vào khối kính → men theo biên tới giao điểm ra
                const verts = e.next ? chainVerts(e) : chainVerts(e.prev).reverse(), partner = e.next || e.prev;
                poly.push(...verts); k = S.indexOf(partner);
              } else k = (k + 1) % S.length;
            } while (k !== s0 && ++guard < 80);
            const P = []; for (const w of poly) if (!P.length || P[P.length - 1].id !== w.id) P.push(w);
            if (P.length > 2 && P[0].id === P[P.length - 1].id) P.pop();
            if (P.length < 3) continue;
            faces.push(P.map(w => w.id));
            for (const t of earClip(P.map(w => w.q))) tris.push(P[t[0]].id, P[t[1]].id, P[t[2]].id);
          }
        };
        for (let i = 0; i < NR - 1; i++) {
          const n0 = NCOL(i), n1 = NCOL(i + 1);
          if (n0 === n1) for (let c = 0; c < n0; c++) {
            if (n0 === 120 && i >= ri0 && i < ri1 && c >= ci0 && c <= ci1) { cutCell(i, c); continue; }
            quad(vid[i][c], vid[i + 1][c], vid[i + 1][(c + 1) % n0], vid[i][(c + 1) % n0]);
          }
          else for (let k = 0; k < n1; k++) {                                       // chuyển 2:1 — ngũ giác chia 3 tam giác
            const a0 = vid[i][2 * k], a1 = vid[i][2 * k + 1], a2 = vid[i][(2 * k + 2) % n0], b0 = vid[i + 1][k], b1 = vid[i + 1][(k + 1) % n1];
            faces.push([a0, b0, b1, a2, a1]); tris.push(a0, a1, b0, a1, b1, b0, a1, a2, b1);
          }
        }
        { const n = NCOL(NR - 1); for (let c = 0; c < n; c++) { const a = vid[NR - 1][c], b = vid[NR - 1][(c + 1) % n]; faces.push([a, b, vTip]); tris.push(a, b, vTip); } }
        for (let k = 0; k < tris.length; k += 3) {                                   // quay mọi tam giác ra ngoài
          const A = PV(tris[k]), B = PV(tris[k + 1]), C = PV(tris[k + 2]), c = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
          if (!outward(c, crs(sub(B, A), sub(C, A)))) { const t = tris[k + 1]; tris[k + 1] = tris[k + 2]; tris[k + 2] = t; }
        }
        const noseGeo = new THREE.BufferGeometry();
        noseGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); noseGeo.setIndex(tris); noseGeo.computeVertexNormals();
        fusGeo.computeBoundingSphere(); noseGeo.boundingSphere = fusGeo.boundingSphere.clone();   // da mũi + thân = 1 lớp da trong suốt: sắp thứ tự vẽ như thân (nội thất buồng lái không lộ khác trước)
        const nose = new THREE.Mesh(noseGeo, M(WHITE)); nose.castShadow = true; nose.position.y = FY; plane.add(nose);

        // ── 5. NÉT DA MŨI: chỉ cạnh lưới (kinh tuyến / vòng), góc gãy giữa 2 đa giác kề > 2°, lọc khe & khúc lẻ ≤ 2 đoạn ──
        const fN = faces.map(f => {                                                  // pháp tuyến Newell, quay ra ngoài
          let n = [0, 0, 0], c = [0, 0, 0];
          for (let k = 0; k < f.length; k++) { const a = PV(f[k]), b = PV(f[(k + 1) % f.length]); n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); c = [c[0] + a[0] / f.length, c[1] + a[1] / f.length, c[2] + a[2] / f.length]; }
          n = unit(n); return outward(c, n) ? n : n.map(t => -t);
        });
        const eF = new Map(), ek = (a, b) => a < b ? a * 1e6 + b : b * 1e6 + a;
        faces.forEach((f, fi) => { for (let k = 0; k < f.length; k++) { const key = ek(f[k], f[(k + 1) % f.length]); if (!eF.has(key)) eF.set(key, []); eF.get(key).push(fi); } });
        const crease = (a, b) => { const L = eF.get(ek(a, b)); return L && L.length === 2 ? Math.acos(Math.max(-1, Math.min(1, dot(fN[L[0]], fN[L[1]])))) * 180 / Math.PI : 0; };
        const pieces = (a, b, L, startIn) => {                                       // cạnh lưới a→b tách tại giao điểm biên → các mẩu ngoài kính
          if (!L || !L.length) return startIn ? [] : [[a, b]];
          const pts = [a, ...L.slice().sort((p, q) => p.t - q.t).map(X => skinBV(X.u, X.v)), b], out = [];
          let inside = startIn; for (let k = 0; k < pts.length - 1; k++) { if (!inside) out.push([pts[k], pts[k + 1]]); inside = !inside; }
          return out;
        };
        const RING_TH = 6;                                                           // vòng chỉ hiện ở chỗ cong gắt (chóp) — mũi giữ kiểu nét dọc như thân
        const segM = [], segR = [];
        const draw = (list, segs, th) => {                                           // list: các mẩu theo thứ tự trên 1 đường lưới
          const chains = []; let cur = null;
          for (const p of list) { if (cur && cur[cur.length - 1][1] === p[0]) cur.push(p); else { cur = [p]; chains.push(cur); } }
          for (const ch of chains) {
            const n = ch.length, vis = ch.map(([a, b]) => crease(a, b) > th);
            const runs = (val) => { const R = []; let s = -1; for (let k = 0; k <= n; k++) { const on = k < n && vis[k] === val; if (on && s < 0) s = k; if (!on && s >= 0) { R.push([s, k]); s = -1; } } return R; };
            for (const [s, e] of runs(false)) if (s > 0 && e < n && e - s <= 2) for (let k = s; k < e; k++) vis[k] = true;
            for (const [s, e] of runs(true)) if (e - s <= 2) for (let k = s; k < e; k++) vis[k] = false;
            ch.forEach(([a, b], k) => { if (vis[k]) segs.push(...PV(a), ...PV(b)); });
          }
        };
        for (let c = 0; c < 120; c++) {                                              // kinh tuyến: 120 → (chẵn) 60 → (chia 4) 30 → chóp
          const L = [];
          for (let i = 0; i < I_RAD; i++) L.push(...pieces(vid[i][c], vid[i + 1][c], crossM.get(c * 1000 + i), ins(i, c)));
          if (c % 2 === 0) {
            const k = c / 2; L.push([vid[I_RAD][c], vid[I_RAD + 1][k]]);
            for (let i = I_RAD + 1; i < I_T2; i++) L.push([vid[i][k], vid[i + 1][k]]);
            if (k % 2 === 0) {
              const m = k / 2; L.push([vid[I_T2][k], vid[I_T2 + 1][m]]);
              for (let i = I_T2 + 1; i < NR - 1; i++) L.push([vid[i][m], vid[i + 1][m]]);
              L.push([vid[NR - 1][m], vTip]);
            }
          }
          draw(L, segM, 2);
        }
        for (let i = 1; i < NR; i++) {                                               // vòng (bỏ vòng nối 26.0 — liền mặt với thân)
          const n = NCOL(i), L = [];
          for (let c = 0; c < n; c++) L.push(...pieces(vid[i][c], vid[i][(c + 1) % n], n === 120 ? crossR.get(i * 1000 + c) : null, n === 120 && ins(i, c)));
          draw(L, segR, RING_TH);
        }
        for (const [sg, nm] of [[segM, 'noseMer'], [segR, 'noseRing']]) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(sg, 3)); const ls = new THREE.LineSegments(lg, LINE); ls.name = nm; nose.add(ls); }
        // đường nối radome — vòng chỉ tối đúng trạm 32.99 m
        { const pts = []; for (let c = 0; c <= 120; c++) pts.push(new THREE.Vector3(...PV(vid[I_RAD][c % 120])));
          const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3d3b36 })); ln.position.y = FY; plane.add(ln); }

        // ── 6. KHỐI KÍNH: khung + 6 ô kính chung đỉnh; biên nhận đủ mọi giao điểm lưới da ⇒ kín khít với lỗ da ──
        const bVm = new Map(), bpos = [];
        const blockV = (u, v) => { const k = bkey(u, v); let id = bVm.get(k); if (id === undefined) { id = bpos.length / 3; const p = band(u, v); bpos.push(p[0], p[1], p[2]); bVm.set(k, id); } return id; };
        const BP = (k) => [bpos[3 * k], bpos[3 * k + 1], bpos[3 * k + 2]];
        const botU = [], topU = [], lineV = new Map();
        const addLV = (u, v) => { const k = Math.round(u * 1e5); if (!lineV.has(k)) lineV.set(k, []); lineV.get(k).push(v); };
        for (const L of [...crossM.values(), ...crossR.values()]) for (const X of L) {
          if (Math.abs(X.v) < 1e-9) botU.push(X.u); else if (Math.abs(X.v - 1) < 1e-9) topU.push(X.u); else if (Math.abs(Math.abs(X.u) - 6) < 1e-9) addLV(X.u, X.v);
        }
        for (const s of SLABS) for (const b of s.bd) { addLV(s.uL, b[0]); addLV(s.uR, b[1]); }
        const onLine = (u, v0, v1) => {                                              // đỉnh nằm giữa trên đường mốc u (từ dải bên cạnh)
          const lo = Math.min(v0, v1), hi = Math.max(v0, v1), r = [...new Set((lineV.get(Math.round(u * 1e5)) || []).filter(v => v > lo + 1e-7 && v < hi - 1e-7).map(v => +v.toFixed(9)))].sort((a, b) => a - b);
          return v0 < v1 ? r : r.reverse();
        };
        const frameT = [], glassT = [];
        for (const s of SLABS) for (let j = 0; j < s.bd.length - 1; j++) {
          const b0 = s.bd[j], b1 = s.bd[j + 1], P = [[s.uL, b0[0]]];
          if (j === 0) botU.filter(u => u > s.uL + 1e-7 && u < s.uR - 1e-7).sort((a, b) => a - b).forEach(u => P.push([u, 0]));
          P.push([s.uR, b0[1]]); onLine(s.uR, b0[1], b1[1]).forEach(v => P.push([s.uR, v])); P.push([s.uR, b1[1]]);
          if (j === s.bd.length - 2) topU.filter(u => u > s.uL + 1e-7 && u < s.uR - 1e-7).sort((a, b) => b - a).forEach(u => P.push([u, 1]));
          P.push([s.uL, b1[0]]); onLine(s.uL, b1[0], b0[0]).forEach(v => P.push([s.uL, v]));
          const Q = []; for (const p of P) { const l = Q[Q.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 1e-9 || Math.abs(l[1] - p[1]) > 1e-9) Q.push(p); }
          if (Q.length > 2 && Math.abs(Q[0][0] - Q[Q.length - 1][0]) < 1e-9 && Math.abs(Q[0][1] - Q[Q.length - 1][1]) < 1e-9) Q.pop();
          if (Q.length < 3) continue;
          const um = (s.uL + s.uR) / 2, vm = (b0[0] + b0[1] + b1[0] + b1[1]) / 4, su = lenUV(um, vm, 1, 0), sv = lenUV(um, vm, 0, 1), ids = Q.map(([u, v]) => blockV(u, v));
          for (const t of earClip(Q.map(([u, v]) => [u * su, v * sv]))) (j === s.glass ? glassT : frameT).push(ids[t[0]], ids[t[1]], ids[t[2]]);
        }
        for (const T of [frameT, glassT]) for (let k = 0; k < T.length; k += 3) {
          const A = BP(T[k]), B = BP(T[k + 1]), C = BP(T[k + 2]);
          if (!outward([(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3], crs(sub(B, A), sub(C, A)))) { const t = T[k + 1]; T[k + 1] = T[k + 2]; T[k + 2] = t; }
        }
        const bAll = new THREE.BufferGeometry(); bAll.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); bAll.setIndex([...frameT, ...glassT]); bAll.computeVertexNormals();
        const mkBlock = (T, mat, ro) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', bAll.attributes.position); g.setAttribute('normal', bAll.attributes.normal); g.setIndex(T); const m = new THREE.Mesh(g, mat); m.position.y = FY; m.userData.noFade = true; m.renderOrder = ro; plane.add(m); return m; };
        mkBlock(frameT, new THREE.MeshLambertMaterial({ color: 0xc3c7cc, side: THREE.DoubleSide }), 3);
        mkBlock(glassT, new THREE.MeshPhongMaterial({ color: 0x262c32, transparent: true, opacity: 0.95, shininess: 100, side: THREE.DoubleSide }), 4);

        // ── 7. MỰC: viền khối kính (dải rộng đều nằm TRONG biên, trên mặt kính) + gioăng 6 ô (dải rộng đều ôm mép ô) ──
        const inkT = [], LIFT = 0.0015;
        const lifted = (u, v) => { const p = band(u, v), n = bandN(u, v); return [p[0] + n[0] * LIFT, p[1] + n[1] * LIFT, p[2] + n[2] * LIFT]; };
        const quadInk = (A, B, C, D) => inkT.push(...A, ...B, ...C, ...A, ...C, ...D);
        { const W = 0.009, IN = BR.map(([u, v]) => {                               // biên lùi vào trong W (độ dài thật) — mép sau lùi theo u, mép trên/dưới theo v
            const du = Math.abs(Math.abs(u) - 6) < 1e-9 ? -Math.sign(u) * W / lenUV(u - Math.sign(u) * 1e-3, v, 1, 0) : 0, dv = v < 0.5 ? W / lenUV(u, 0, 0, 1) : -W / lenUV(u, 1, 0, 1);
            return [u + du, v + dv]; });
          for (let k = 0; k < BR.length; k++) { const k2 = (k + 1) % BR.length; quadInk(lifted(...BR[k]), lifted(...BR[k2]), lifted(...IN[k2]), lifted(...IN[k])); } }
        for (const sd of [-1, 1]) for (const pl of PANES) {
          const L = [];                                                              // đỉnh ô + điểm cắt nếp gãy (để dải bẻ theo mặt)
          for (let k = 0; k < pl.length; k++) {
            const a = pl[k], b = pl[(k + 1) % pl.length]; L.push(a);
            const ts = []; for (let m = Math.ceil(Math.min(a[0], b[0])); m <= Math.floor(Math.max(a[0], b[0])); m++) { const t = (m - a[0]) / (b[0] - a[0]); if (t > 1e-6 && t < 1 - 1e-6) ts.push([t, m]); }
            ts.sort((p, q) => p[0] - q[0]).forEach(([t, m]) => L.push([m, a[1] + (b[1] - a[1]) * t]));   // theo chiều đi của cạnh
          }
          const W = 0.0045, n = L.length, P3 = L.map(([u, v]) => band(sd * u, v)), N3 = L.map(([u, v]) => { const m = Math.abs(u - Math.round(u)) < 1e-6; const n0 = bandN(sd * (u - (m ? 1e-3 : 0)), v), n1 = bandN(sd * (u + (m ? 1e-3 : 0)), v); return unit([n0[0] + n1[0], n0[1] + n1[1], n0[2] + n1[2]]); });
          const side = P3.map((p, k) => { const t = unit(sub(P3[(k + 1) % n], P3[(k + n - 1) % n])); return unit(crs(N3[k], t)); });
          const off = (k, s) => [P3[k][0] + side[k][0] * s + N3[k][0] * LIFT, P3[k][1] + side[k][1] * s + N3[k][1] * LIFT, P3[k][2] + side[k][2] * s + N3[k][2] * LIFT];
          for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; quadInk(off(k, W), off(k2, W), off(k2, -W), off(k, -W)); }
        }
        { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(inkT, 3)); g.computeVertexNormals();
          const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2e2b24, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
          m.position.y = FY; m.userData.noFade = true; m.renderOrder = 5; plane.add(m); }

        // ── 8. 2 CẦN GẠT nằm nghỉ dọc mép dưới ô 1: nắp trục góc dưới-ngoài, lưỡi chạy vào trụ giữa ──
        const wGeo = [], fo = new THREE.Object3D();
        const rod = (p1, p2, r) => {
          const d = new THREE.Vector3().subVectors(p2, p1), g = new THREE.CylinderGeometry(r, r, d.length(), 6);
          g.rotateX(Math.PI / 2); fo.position.copy(p1).addScaledVector(d, 0.5); fo.lookAt(p2); fo.updateMatrix(); wGeo.push(g.applyMatrix4(fo.matrix));
        };
        for (const sd of [-1, 1]) {
          const W3 = (u, v, h) => { const p = band(sd * u, v), n = bandN(sd * u, v); return new THREE.Vector3(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h); };
          const piv = W3(3.43, 0.18, 0.012);
          wGeo.push(new THREE.SphereGeometry(0.014, 8, 6).translate(piv.x, piv.y, piv.z));
          rod(piv, W3(2.43, 0.24, 0.008), 0.005);
          rod(W3(2.96, 0.22, 0.010), W3(0.98, 0.19, 0.010), 0.007);
        }
        { const m = new THREE.Mesh(mergeGeometries(wGeo), new THREE.MeshLambertMaterial({ color: 0x2e2b24 })); m.position.y = FY; m.userData.noFade = true; m.renderOrder = 4; plane.add(m); }
      })();

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
      })();

      // bag chi tiết: động cơ, càng, cửa sổ, cửa, ăng-ten
      // sử dụng chung pb đã khai báo ở đầu
      for (const sgn of [1, -1]) {
        // ═══ CÀNG CHÍNH 747-8 — dựng lại theo cấu trúc mẫu GLB (A350-1000: bố cục & số đo mét · 777X: lốp/mâm/vật liệu) ═══
        // Hệ dựng (mét): gốc = mặt sân dưới trục trụ, x tới mũi, y lên, z ra NGOÀI mạn (u = ±1 theo mạn).
        // Bogie 4 bánh 747: 2 trục cách 1.47 m, 2 lốp/trục cách 1.12 m, lốp 52×21.0R22 (Ø 1.32 m, rộng 0.53 m).
        // Trụ giảm chấn: ống ngoài sơn Ø 0.42 m + nắp đệm kín + ống trượt mạ crom lộ ~0.36 m; chạc 2 má kẹp dầm bogie + chốt xoay;
        // giằng xoắn (torque link) 2 đoạn phía SAU (đỉnh lệch 0.56 m như mẫu); xy-lanh chỉnh nghiêng bogie phía TRƯỚC;
        // phanh carbon mặt trong mỗi bánh + 4 thanh phanh về chạc; ống dầu phanh dọc trụ xuống dầm (đai kẹp).
        // Càng CÁNH: giằng bên gập (thanh dưới + khung chữ A treo lên bụng cánh, phía TRONG — càng thu ngang vào trong) +
        // thanh khoá 2 đoạn. Càng THÂN: giằng kéo gập phía TRƯỚC lên bụng (càng thu về trước). Cờ đỏ chốt khoá đất ở khớp gối.
        // THU CÀNG (G 14/10): mỗi cụm là 1 rig (05-fuselage-nose) — trụ quay quanh chốt trunnion T, bogie nghiêng quanh chốt TP,
        // giằng gập ở khớp gối (khâu trên treo khung máy bay, khâu dưới theo trụ) — flight/20-gear-rig giải động học khâu phẳng.
        // opt.lift (m): nâng trunnion vào sâu trong thân (càng thân: hốc càng ở bụng — ống ngoài kéo dài lên, khuất trong da).
        const mainGear = (cx, cz, opt) => {
          const u = Math.sign(cz), K = S747, LIFT = 0.109, X = _gX, Z = _gZ;
          const rig = gearRig(opt.kind, u, opt.kind === 'wing' ? 'x' : 'z');
          const P = (x, y, z) => new THREE.Vector3(cx + x * K, LIFT + y * K, cz + u * z * K);
          const rod = (a, c, r0, r1, col, seg, o) => gRod(lgb, a, c, r0 * K, r1 * K, col, seg, o);
          const lugBox = (p, w, h, d, col = GEAR_C.paint) => lgb.P(w * K, h * K, d * K, p.x, p.y, p.z, col, {});
          const TOP0 = (opt.top - LIFT) / K, TOPm = TOP0 + (opt.lift || 0);           // đỉnh trụ nhìn thấy · đỉnh trụ thật (trunnion) (m trên mặt sân)
          const R = 0.66, W = 0.2667, RB = 0.2794, YA = R, AX = 0.735, WZ = 0.56;     // lốp 52×21.0R22 · tâm trục = bán kính lốp
          const YG = YA + 0.8, YB = YG + 0.4 * (TOP0 - YG);                            // đáy ống ngoài (nắp đệm) · tai giằng
          rig.pin.T = P(0, TOPm - 0.14, 0); rig.pin.TP = P(0, YA, 0);
          // — 4 bánh + phanh + thanh phanh (tai phanh dưới trục → tai dưới chạc) — thuộc BOGIE
          gearPart(rig, 'truck');
          for (const ax of [-AX, AX]) for (const wz of [-WZ, WZ]) {
            const c = P(ax, YA, wz), lug = gearWheel(lgb, c, R * K, W * K, RB * K, Math.sign(u * wz), { brake: true, spin: wheelPart(rig, c) });
            gRod(lgb, lug, new THREE.Vector3(cx + Math.sign(ax) * 0.17 * K, lug.y, lug.z), 0.024 * K, 0.024 * K, GEAR_C.paint, 6);
            gPin(lgb, lug, Z, 0.036 * K, 0.09 * K, SILVER, 8, { noEdge: true });
          }
          for (const ax of [-AX, AX]) rod(P(ax, YA, -0.84), P(ax, YA, 0.84), 0.085, 0.085, GEAR_C.paint, 10);   // trục bánh
          // — dầm bogie: thân côn 2 đầu + đoạn giữa dày (ổ chốt) + 2 ống lồng trục + chỏm
          rod(P(-1.0, YA, 0), P(-0.3, YA, 0), 0.1, 0.13, WHITE, 14);
          rod(P(0.3, YA, 0), P(1.0, YA, 0), 0.13, 0.1, WHITE, 14);
          rod(P(-0.32, YA, 0), P(0.32, YA, 0), 0.15, 0.15, WHITE, 16);
          for (const ax of [-AX, AX]) gPin(lgb, P(ax, YA, 0), Z, 0.13 * K, 0.38 * K, WHITE, 14);
          for (const s of [-1, 1]) rod(P(s * 1.0, YA, 0), P(s * 1.07, YA, 0), 0.1, 0.06, WHITE, 14);
          // — chạc kẹp dầm (2 má) + chốt xoay + đầu chạc nối ống trượt + tai thanh phanh dưới 2 má — thuộc TRỤ
          gearPart(rig, 'strut');
          gPin(lgb, P(0, YA, 0), Z, 0.07 * K, 0.52 * K, SILVER, 12);
          for (const s of [-1, 1]) lugBox(P(0, YA + 0.01, s * 0.215), 0.34, 0.62, 0.05);
          rod(P(0, YA + 0.3, 0), P(0, YA + 0.44, 0), 0.24, 0.16, GEAR_C.paint, 18);
          for (const s of [-1, 1]) lugBox(P(s * 0.17, YA - 0.265, 0), 0.1, 0.09, 0.56);
          // — ống trượt crom · nắp đệm kín · ống ngoài · 3 đai kẹp · trunnion đỉnh
          rod(P(0, YA + 0.44, 0), P(0, YG + 0.3, 0), 0.13, 0.13, SILVER, 18);
          rod(P(0, YG, 0), P(0, YG + 0.08, 0), 0.235, 0.235, GEAR_C.paint, 20);
          rod(P(0, YG + 0.08, 0), P(0, TOPm, 0), 0.21, 0.2, GEAR_C.paint, 20);
          for (const y of [YG + 0.42, YB + 0.3, TOPm - 0.55]) rod(P(0, y - 0.015, 0), P(0, y + 0.015, 0), 0.228, 0.228, WHITE, 20);
          gPin(lgb, P(0, TOPm - 0.14, 0), opt.kind === 'wing' ? X : Z, 0.11 * K, 0.95 * K, GEAR_C.paint, 14);
          // — giằng xoắn 2 đoạn phía sau: tai ống ngoài → đỉnh → tai đầu chạc
          const TU = P(-0.19, YG + 0.2, 0), TL = P(-0.19, YA + 0.38, 0), TA = P(-0.56, (YG + 0.2 + YA + 0.38) / 2, 0);
          gBar(lgb, TU, TA, 0.13 * K, 0.07 * K, WHITE); gBar(lgb, TA, TL, 0.13 * K, 0.07 * K, WHITE);
          for (const q of [TU, TL]) { gPin(lgb, q, Z, 0.045 * K, 0.22 * K, SILVER, 8); lugBox(new THREE.Vector3(q.x + 0.07 * K, q.y, q.z), 0.17, 0.11, 0.2); }
          gPin(lgb, TA, Z, 0.055 * K, 0.13 * K, SILVER, 8);
          // — xy-lanh chỉnh nghiêng bogie phía trước: đầu chạc → tai trên dầm
          const PT0 = P(0.21, YA + 0.4, 0), PT1 = P(0.62, YA + 0.15, 0), PTm = PT0.clone().lerp(PT1, 0.55);
          lugBox(P(0.17, YA + 0.4, 0), 0.12, 0.09, 0.12);
          gearPart(rig, 'truck');                                                      // xy-lanh đi theo bogie (lệch nhỏ ở đầu chạc khi nghiêng)
          gRod(lgb, PT0, PTm, 0.05 * K, 0.05 * K, GEAR_C.paint, 10); gRod(lgb, PTm, PT1, 0.028 * K, 0.028 * K, SILVER, 8);
          for (const q of [PT0, PT1]) gPin(lgb, q, Z, 0.04 * K, 0.15 * K, SILVER, 8);
          lugBox(P(0.62, YA + 0.11, 0), 0.12, 0.08, 0.12, WHITE);
          gearPart(rig, 'strut');
          // — cờ đỏ "REMOVE BEFORE FLIGHT" của chốt khoá đất (dải lụa treo ở khớp gối)
          const flag = (p) => gBar(lgb, p.clone().add(new THREE.Vector3(0.02 * K, -0.04 * K, 0)), p.clone().add(new THREE.Vector3(0.06 * K, -0.5 * K, 0.03 * K)), 0.07 * K, 0.006 * K, GEAR_C.flag, _gXZ, { noEdge: true });
          // — giằng gập: thanh dưới (tai trụ → khớp gối) + khung chữ A (gối → 2 điểm treo) + thanh khoá 2 đoạn (gối → tai trên trụ)
          const brace = (B0, QA, QB, L2, n) => {
            const KN = B0.clone().lerp(QA.clone().lerp(QB, 0.5), 0.5).add(new THREE.Vector3(0, -0.05 * K, 0));   // gối quá tâm nhẹ (khoá)
            const J = KN.clone().lerp(L2, 0.5).add(new THREE.Vector3(0, -0.06 * K, 0));
            Object.assign(rig.pin, { W: QA.clone().lerp(QB, 0.5), S: B0.clone(), K: KN.clone(), J: J.clone(), L: L2.clone() });
            gearPart(rig, 'lo');                                                       // khâu dưới: tai trụ → gối
            gRod(lgb, B0, KN, 0.075 * K, 0.07 * K, GEAR_C.paint, 12); gPin(lgb, B0, n, 0.06 * K, 0.24 * K, SILVER, 8);
            gearPart(rig, 'up');                                                       // khung chữ A: gối → 2 điểm treo trên khung máy bay
            for (const q of [QA, QB]) { gRod(lgb, KN, q, 0.06 * K, 0.055 * K, GEAR_C.paint, 10); gPin(lgb, q, n, 0.05 * K, 0.18 * K, SILVER, 8); }
            gPin(lgb, KN, n, 0.07 * K, 0.3 * K, SILVER, 10);
            gearPart(rig, 'flag'); flag(KN);                                           // cờ chốt khoá đất: rút trước khi đẩy lùi
            gearPart(rig, 'k1'); gBar(lgb, KN, J, 0.07 * K, 0.04 * K, WHITE, n); gPin(lgb, J, n, 0.035 * K, 0.1 * K, SILVER, 8);   // thanh khoá đoạn 1
            gearPart(rig, 'k2'); gBar(lgb, J, L2, 0.07 * K, 0.04 * K, WHITE, n); gPin(lgb, L2, n, 0.04 * K, 0.16 * K, SILVER, 8);   // đoạn 2 → tai trụ
            gearPart(rig, 'strut');
          };
          if (opt.kind === 'wing') {                                                   // giằng BÊN, treo lên bụng cánh phía trong
            const zq = -1.1, yq = (wingBotY(cx, Math.abs(cz) + zq * K) - LIFT) / K + 0.05;
            lugBox(P(0, YB, -0.24), 0.24, 0.16, 0.1); lugBox(P(0, YB + 0.62 * (TOPm - YB), -0.22), 0.16, 0.12, 0.08);
            brace(P(0, YB, -0.26), P(-0.42, yq, zq), P(0.42, yq, zq), P(0, YB + 0.62 * (TOPm - YB), -0.24), X);
          } else {                                                                     // giằng KÉO phía trước, treo lên bụng thân
            const yq = TOPm - 0.08;
            lugBox(P(0.24, YB, 0), 0.1, 0.16, 0.24); lugBox(P(0.22, YB + 0.55 * (TOPm - YB), 0), 0.08, 0.12, 0.16);
            brace(P(0.26, YB, 0), P(1.35, yq, -0.38), P(1.35, yq, 0.38), P(0.24, YB + 0.55 * (TOPm - YB), 0), Z);
          }
          // — 2 ống dầu phanh (trục sau / trục trước): dọc mặt SAU ống ngoài → bám 2 bên giằng xoắn qua hành trình giảm chấn
          //   (như càng thật) → đầu chạc → nóc dầm (ống trục trước vòng ngoài má chạc) → tách 2 nhánh vào 2 vỏ phanh
          const TUy = YG + 0.2, TLy = YA + 0.38, TAx = -0.56, TAy = (TUy + TLy) / 2;
          for (const s of [1, -1]) {
            const ex = -s * 0.6, pts = [P(-0.175, TOPm - 0.4, s * 0.135), P(-0.175, YG + 0.4, s * 0.135), P(-0.2, TUy + 0.04, s * 0.125),
            P(TAx + 0.06, TAy + 0.02, s * 0.08), P(-0.22, TLy + 0.02, s * 0.125)];
            if (s > 0) pts.push(P(-0.32, YA + 0.24, 0.08), P(ex, YA + 0.16, 0));
            else pts.push(P(-0.12, YA + 0.34, -0.27), P(0.14, YA + 0.34, -0.27), P(0.32, YA + 0.21, -0.07), P(ex, YA + 0.16, 0));
            gHose(lgb, pts, 0.014 * K);
            gearPart(rig, 'truck');                                                    // nhánh vào 2 vỏ phanh đi theo bogie
            for (const wz of [-1, 1]) gHose(lgb, [P(ex, YA + 0.16, 0), P(-s * 0.66, YA + 0.17, wz * 0.12), P(-s * 0.7, YA + 0.16, wz * 0.24)], 0.012 * K);
            gearPart(rig, 'strut');
          }
          // — càng cánh: cửa gắn trụ (strut door) mặt NGOÀI phần trên ống ngoài + 2 giá đỡ (thu ngang ⇒ mặt ngoài thành mặt đáy).
          //   Càng thân thu về trước: hốc có cửa riêng trên thân, đóng lại sau khi thả càng ⇒ không gắn cửa trụ.
          if (opt.kind === 'wing') {
            const dW = 1.3, dH = 1.05, dY = TOPm - 0.1 - dH / 2;
            lgb.P(dW * K, dH * K, 0.03 * K, cx, LIFT + dY * K, cz + u * 0.42 * K, WHITE, { soft: true, rx: -u * 0.1 });  // cửa gắn trụ: thu cùng càng (14/10 — trước ở vỏ pb, càng thu thì cửa treo lại)
            for (const y of [dY - dH * 0.28, dY + dH * 0.28]) gBar(lgb, P(0, y, 0.19), P(0, y, 0.4), 0.08 * K, 0.05 * K, GEAR_C.paint, X);
          }
        };
        mainGear(WG_X, sgn * WG_Z, { kind: 'wing', top: wingBotY(WG_X, WG_Z) + 0.06 });    // càng CÁNH: z GLB −1.64 m, vệt 11 m, đỉnh trụ trong bụng cánh
        // Tổng 4 cụm càng chính (2 cánh + 2 thân) = 16 bánh chính, + càng mũi ⇒ 18 bánh (chuẩn 747).
        mainGear(BG_X, sgn * BG_Z, { kind: 'body', top: gy(-2.084) + 0.08, lift: GEAR_LIFT.body });   // càng THÂN: sau càng cánh 3 m, vệt 3.84 m

        // ═══ CFM56-7B — LƯỚI THẬT của engine_cfm56-7b.glb ("Engine CFM56-7B", Michael Zhang, Sketchfab, CC-BY-4.0) ═══
        // G 10/10 lần 7 ("modify toàn bộ 4 động cơ về 747"): CẢ 4 máy dùng chung mẫu này (máy jet_engine cánh +z trong đã gỡ). Ruột CFM56-7B
        // được chèn cấp cho đúng GEnx-2B67 (quạt 1 · booster 3 · HPC 10 · HPT 2 · LPT 6; CFM56: HPC 9 · HPT 1 · LPT 4) ngay lúc đóng gói
        // (py/pack.py GX_OPS): chép cấp cuối HPC, cấp HPT, cấp 3 LPT (×2) sang khe mới; vỏ, trục, trống, ống phía sau mặt chèn lùi theo.
        // GX_AM(a) = cùng phép dời đó cho mọi bảng đơn vị u viết theo lưới gốc (vỏ lõi, côn, buồng đốt, pylon). 2 trục quay NGƯỢC chiều như GEnx.
        const dsMat = new Map();                                  // vật liệu 2 mặt cho cánh (tấm mỏng nhìn được cả 2 phía)
        const DS = (c) => { if (!dsMat.has(c)) dsMat.set(c, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); return dsMat.get(c); };
        const GX_AM = (a) => a + (a > 0.272 ? 0.0314 : 0) + (a > 0.574 ? 0.068 : 0) + (a > 0.7535 ? 0.108 : 0);   // khớp GX_OPS trong pack.py
        // G 10/10 lần 3 ("detailing 99% từ file GLB, ống chạy chính xác như file, render như file"): nhúng NGUYÊN hình học 52 chi tiết
        // của mẫu (≈ 91k đỉnh · 160k tam giác: vỏ, 33 hàng cánh, EEC, hộp số, bó dây/ống đúng đường đi, giá, que đo…). Đóng gói:
        // hàn đỉnh trùng, lượng tử 1/8000 u, đỉnh xếp theo thứ tự dùng, chênh lệch Int16 + chỉ số varint zigzag, zlib → base64 trong
        // file assets/cfm56.bin, giải nén bằng DecompressionStream trước khi dựng cảnh (CFM_BUF). Màu mỗi tam giác = trung vị texture
        // mẫu tại 4 điểm → bảng 24 màu (sai số TB 5.6/255). Pháp tuyến tính lại theo góc gãy 34° (toCreasedNormals) như file CAD; vật liệu
        // 2 mặt như mẫu. Đơn vị mẫu u: mút cánh quạt r 0.565 ⇔ Ø 1.55 m. 4 động cơ CÙNG CỠ: nacelle r 0.86 u = nacelle 2 máy cánh +z.
        // 3 cách hiển thị (G 10/10): 'full' = nacelle 737NG tự dựng (mẫu không có vỏ/ống xả/côn) + vỏ & stato cắt hở 81°, rô-to & phụ kiện
        // giữ nguyên — dùng cho máy NGOÀI cánh +z, có hoạt cảnh bật máy (rô-to thấp áp / cao áp quay ngược chiều, buồng đốt sáng, đèn, gió);
        // 'ghost' = cùng thiết kế đầy đủ, KHÔNG cắt, mặt mờ 90% (đục 10%) chỉ còn nét viền line-art — máy NGOÀI cánh −z (vị trí 2);
        // 'bare' = máy trần đúng như mẫu, dựng ĐẶC. G 10/10 lần 8 thêm 'core' = CHỈ LÕI (côn, quạt, booster, HPC, buồng đốt, turbine,
        // trục; bỏ nacelle, vỏ quạt, khung quạt, cánh OGV, giá, ống, bó dây, hộp phụ kiện), dựng ĐẶC, vỏ lõi & stato cắt hở 81°.
        // G 10/10 lần 9: 'core' hiện lại vỏ (nacelle + răng cưa) và khung quạt (vỏ quạt, khung, cánh OGV) dạng NÉT line-art mờ 90%,
        // vẫn không ống / hộp phụ kiện; có hoạt cảnh bật máy như máy ngoài (rô-to quay ngược chiều, buồng đốt sáng, đèn, gió).
        // Bố trí hiện tại: +z ngoài 'full' + hoạt cảnh · +z trong 'core' + hoạt cảnh · −z ngoài 'ghost' · −z trong 'full' (lát cắt lật sang phía −z).
        // G 10/10 lần 5 — NGOẠI HÌNH 747-8 / GEnx-2B (ruột vẫn là lưới thật CFM56): bỏ 24 cánh quạt CFM56 khỏi dữ liệu nhúng, thay bằng
        // quạt 18 cánh composite vuốt cong (dây cung rộng, mép trước titan bạc, xoắn 26° → 60°, mép trước vuốt ra trước giữa sải rồi
        // vuốt ngược ở mút) · côn đen hình ogive có vệt xoắn trắng · nacelle thon dài tới mép xả mỏng a 0.80 + 18 răng cưa (chevron)
        // quanh ống xả quạt, 14 răng cưa quanh ống xả lõi. Côn + quạt quay cùng trục thấp áp ở máy chạy hoạt cảnh.
        const CFM = (() => {
          if (!CFM_BUF) return null;
          const dv = new DataView(CFM_BUF), QS = 8000;
          let p = 0;
          const nM = dv.getUint16(p, true), nP = dv.getUint8(p + 2); p += 3;
          const pal = [];
          for (let i = 0; i < nP; i++, p += 3) pal.push((dv.getUint8(p) << 16) | (dv.getUint8(p + 1) << 8) | dv.getUint8(p + 2));
          const out = [];
          for (let m = 0; m < nM; m++) {
            const id = dv.getUint8(p), nv = dv.getUint32(p + 1, true); p += 5;
            const pos = new Float32Array(nv * 3);
            for (let c = 0; c < 3; c++) {
              let acc = 0;
              for (let i = 0; i < nv; i++, p += 2) { acc = (acc + dv.getUint16(p, true)) & 0xffff; pos[i * 3 + c] = ((acc << 16) >> 16) / QS; }
            }
            const nG = dv.getUint16(p, true); p += 2;
            const groups = [];
            for (let g = 0; g < nG; g++) {
              const pi = dv.getUint8(p), ni = dv.getUint32(p + 1, true), nb = dv.getUint32(p + 5, true); p += 9;
              const idx = new Uint32Array(ni);
              let acc = 0, q = p;
              for (let i = 0; i < ni; i++) {
                let v = 0, sh = 0, b;
                do { b = dv.getUint8(q++); v |= (b & 0x7f) << sh; sh += 7; } while (b & 0x80);
                acc += (v >>> 1) ^ -(v & 1); idx[i] = acc;
              }
              p += nb; groups.push({ c: pal[pi], idx });
            }
            out.push({ id, pos, groups });
          }
          return out;
        })();
        // chi tiết QUAY (không cắt) · phụ kiện ngoài (không cắt); còn lại = vỏ & stato → cắt hở ở máy đầy đủ
        const CFM_ROT = new Set([0, 3, 5, 16, 17, 21, 22, 23, 27, 28, 29, 35, 38, 40]);
        const CFM_EXT = new Set([4, 6, 7, 8, 9, 10, 11, 13, 30, 31, 32, 33, 34, 43, 46, 48, 50, 51]);
        // ── TỶ LỆ THẬT GEnx-2B67 (G 10/10 lần 6: "kích cỡ engine vào kích thước 747-8 (GEnx-2B), scaling càng chính xác càng tốt") ──
        // Datasheet GE: quạt Ø 104.7 in = 2.659 m · dài máy cơ sở 169.7 in = 4.310 m (mặt bích trước vỏ quạt → mặt bích ngoài sau khung
        // turbine sau). Lưới (u): mút cánh quạt r 0.5645 · mặt bích trước vỏ quạt a −0.875 → mặt bích sau GX_AM(0.995) = 1.2024 (2.077 u sau
        // khi chèn cấp) ⇒ hệ số hướng kính GX_SR = 1.3297 m·S747 / 0.5645 u, dọc trục GX_SA = 4.310 m·S747 / 2.077 u. Nacelle 747-8 khai báo bằng MÉT THẬT [z sau mép môi hút, r] rồi quy về u (M2U): Ø lớn nhất 3.42 m = máy trong cánh +z
        // (nacelle/quạt 1.29, cùng cỡ GE9X 174/134 in = 1.30) · môi hút Ø 2.86 m, họng Ø 2.60 m · mút cánh quạt cách mép môi 1.10 m · mép xả
        // quạt cách môi 4.68 m (+ răng cưa 0.30 m) · đầu côn xả cách môi 6.57 m. Côn, vỏ lõi, ống xả lõi bám lưới CFM (đơn vị u).
        const GX_SA = 4.310 * S747 / (GX_AM(0.995) + 0.875), GX_SR = 1.3297 * S747 / 0.5645, GX_ALIP = -0.75 - 0.5 / GX_SA;
        const M2U = (t) => t.map(([z, r]) => [GX_ALIP + z * S747 / GX_SA, r * S747 / GX_SR]);
        const CFM_NAC = {
          lip: M2U([[0.30, 1.300], [0.18, 1.306], [0.09, 1.325], [0.035, 1.355], [0.008, 1.392], [0, 1.43], [0.008, 1.468], [0.035, 1.505], [0.09, 1.54], [0.18, 1.572], [0.30, 1.600]]),
          barrel: M2U([[0.30, 1.300], [0.45, 1.305], [0.62, 1.33], [0.804, 1.38]]),
          out: M2U([[0.30, 1.600], [0.55, 1.648], [0.85, 1.680], [1.20, 1.703], [1.55, 1.712], [1.95, 1.708], [2.40, 1.690], [2.85, 1.660], [3.30, 1.615],
            [3.75, 1.556], [4.20, 1.482], [4.50, 1.428], [4.676, 1.392]]),
          duct: M2U([[2.726, 1.354], [3.20, 1.370], [3.70, 1.378], [4.20, 1.374], [4.676, 1.362], [4.676, 1.392]]),
          cowl: [[1.08, 0.36], [0.95, 0.395], [0.80, 0.41], [0.60, 0.425], [0.35, 0.432], [0.15, 0.425], [0.0, 0.40], [-0.06, 0.37], [-0.13, 0.363]].map(([a, r]) => [GX_AM(a), r]),
          nozIn: [[0.96, 0.375], [1.08, 0.352]].map(([a, r]) => [GX_AM(a), r]),
          plug: [[1.62, 0], [1.55, 0.04], [1.40, 0.10], [1.25, 0.16], [1.10, 0.21], [0.99, 0.235], [0.96, 0.237], [0.96, 0]].map(([a, r]) => [GX_AM(a), r]) };
        const CFM_LP = new Set([0, 3, 5, 16, 17, 27, 28, 29, 35, 38, 40]), CFM_HP = new Set([21, 22, 23]);   // trục thấp áp · trục cao áp
        const ghostMats = new Map();
        const GHOST = (c) => { if (!ghostMats.has(c)) ghostMats.set(c, new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })); return ghostMats.get(c); };
        // ── GEnx-2B: quạt 18 cánh + côn xoắn (hệ máy u: x = −a, y = r·cosφ, z = r·sinφ) — sinh 1 lần, mỗi máy clone ──
        // Mặt cắt cánh: đường khum tích phân dc/da = −tan β (β = góc đặt cánh + khum, cùng chiều xoắn với cánh CFM56 đo từ mẫu) ·
        // dày kiểu NACA 4 số (gốc 1.6% → mút 0.5% u) · 12 trạm sải × 13 trạm dây cung (dồn mau ở 2 mép) · 2 trạm đầu = dải titan bạc.
        const GX_C = { blade: 0x2f3238, edge: 0xb9bec5, spin: 0x2a2c30, swirl: 0xf2f2ee };
        // ĐĨA MỜ CHUYỂN ĐỘNG của quạt (G 14/10 "khi bay cho 4 động cơ hoạt động, nhất là cánh quạt"): quạt thật ~40 vòng/s — khung hình 60/s
        // không bắt được (đứng hình / quay ngược). Vành mờ xám có vệt 18 cánh rất nhạt, độ đục theo N1, quay cùng rô-to ở tốc độ hiển thị.
        const FAN_BLUR = (() => {
          const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
          for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1, r = Math.hypot(x, y), th = Math.atan2(y, x), o = (j * N + i) * 4;
            const ring = Math.max(0, Math.min(1, (r - 0.34) / 0.08)) * Math.max(0, Math.min(1, (1 - r) / 0.05));
            const a = ring * (0.62 + 0.22 * Math.cos(18 * th + r * 5.2) * (0.4 + 0.6 * r) + 0.1 * r);
            im.data[o] = 44; im.data[o + 1] = 47; im.data[o + 2] = 53; im.data[o + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
          }
          g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
          const geo = new THREE.CircleGeometry(0.565, 48); geo.rotateY(Math.PI / 2); geo.translate(0.70, 0, 0);
          return { geo, mat: new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }) };
        })();
        let gxFan = null;
        const GX_FAN = () => {
          if (gxFan) return gxFan;
          const NB = 18, NS = 12, NC = 12, R0 = 0.19, R1 = 0.5635, D = Math.PI / 180;
          const ts = [...Array(NC + 1)].map((_, j) => (1 - Math.cos(Math.PI * j / NC)) / 2);
          const sec = [];
          for (let i = 0; i <= NS; i++) {
            const s = i / NS, r = R0 + (R1 - R0) * s;
            const le = -0.777 - 0.026 * Math.sin(Math.PI * s) + 0.027 * s * s, ch = -0.622 - 0.04 * s - le;   // mép trước vuốt · dài dọc trục
            const bs = (26 + 34 * Math.pow(s, 0.9)) * D, kc = (30 - 22 * s) * D, tm = 0.005 + 0.011 * (1 - s);
            const cs = [0];
            for (let j = 1; j <= NC; j++) cs.push(cs[j - 1] - Math.tan(bs + kc * (0.5 - (ts[j - 1] + ts[j]) / 2)) * (ts[j] - ts[j - 1]) * ch);
            const cm = cs[NC / 2], up = [], dn = [];
            for (let j = 0; j <= NC; j++) {
              const t = ts[j], b = bs + kc * (0.5 - t), a = le + t * ch, c = cs[j] - cm;
              const h = 5 * tm * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
              up.push([a + h * Math.sin(b), c + h * Math.cos(b)]); dn.push([a - h * Math.sin(b), c - h * Math.cos(b)]);
            }
            sec.push({ r, up, dn });
          }
          const pos = [], iB = [], iE = [], iT = [], W = NC + 1;
          const put = (a, c, r, p0) => { const q = p0 + c / r; pos.push(-a, r * Math.cos(q), r * Math.sin(q)); };
          for (let k = 0; k < NB; k++) {
            const p0 = 2 * Math.PI * k / NB, b0 = pos.length / 3, d0 = b0 + (NS + 1) * W;
            for (const side of ['up', 'dn']) for (const sc of sec) for (const [a, c] of sc[side]) put(a, c, sc.r, p0);
            for (let i = 0; i < NS; i++) for (let j = 0; j < NC; j++) {
              const u = b0 + i * W + j, d = d0 + i * W + j, L = j < 2 ? iE : iB;
              L.push(u, u + W, u + 1, u + W, u + W + 1, u + 1, d, d + 1, d + W, d + W, d + 1, d + W + 1);
            }
            const t0 = pos.length / 3, st = sec[NS];                                 // nắp mút cánh (đỉnh riêng ⇒ pháp tuyến không lẫn mặt cánh)
            for (const side of ['up', 'dn']) for (const [a, c] of st[side]) put(a, c, st.r, p0);
            for (let j = 0; j < NC; j++) iT.push(t0 + j, t0 + W + j, t0 + j + 1, t0 + W + j, t0 + W + j + 1, t0 + j + 1);
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex([...iB, ...iE, ...iT]); geo.computeVertexNormals();
          const part = (ix) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal); g.setIndex(ix); return g.toNonIndexed(); };
          // côn ogive đen (bọc ngoài côn CFM56: r = 0.1995·(1 − (1 − t)^1.5), mũi a −1.004 → chân a −0.742) · vệt xoắn trắng 0.8 vòng, nở dần
          const spR = (t) => 0.1995 * (1 - Math.pow(1 - t, 1.5)), spA = (t) => -1.004 + 0.262 * t, sp = [];
          for (let i = 0; i <= 24; i++) { const t = 1 - i / 24; sp.push(new THREE.Vector2(spR(t), -spA(t))); }
          const spin = new THREE.LatheGeometry(sp, 48).rotateZ(-Math.PI / 2); spin.deleteAttribute('uv');
          const sw = [], si = [], NW = 40;
          for (let i = 0; i <= NW; i++) {
            const u = i / NW, r0 = 0.012 + 0.178 * u, a = spA(1 - Math.pow(1 - r0 / 0.1995, 2 / 3)), r = r0 + 0.003;   // nhìn chính diện: bán kính tăng đều theo góc
            const ph = 2 * Math.PI * 0.8 * u, hw = (0.004 + 0.022 * u) / r;
            for (const k of [-1, 0, 1]) sw.push(-a, r * Math.cos(ph + k * hw), r * Math.sin(ph + k * hw));
            if (i < NW) for (const v of [i * 3, i * 3 + 1]) si.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
          }
          const swirl = new THREE.BufferGeometry();
          swirl.setAttribute('position', new THREE.Float32BufferAttribute(sw, 3)); swirl.setIndex(si); swirl.computeVertexNormals();
          gxFan = [[GX_C.blade, part(iB)], [GX_C.edge, part(iE)], [GX_C.blade, part(iT)], [GX_C.spin, spin.toNonIndexed()], [GX_C.swirl, swirl.toNonIndexed()]];
          return gxFan;
        };
        // răng cưa mép xả: n răng tam giác cong theo mặt nón (bám tiếp tuyến vỏ, mũi chúc vào dòng xả `dip`), 1 mặt, pháp tuyến quay
        // VÀO như vỏ nacelle; khe giữa 2 răng nằm đúng đỉnh (dưới pylon). skip(ψ) = bỏ răng nằm trong lát cắt hở.
        const GX_CHEV = (n, a0, len, r0, slope, dip, skip) => {
          const pos = [], idx = [], NU = 4, NV = 4;
          for (let k = 0; k < n; k++) {
            const psi = 2 * Math.PI * (k + 0.5) / n, hw = Math.PI / n;
            if (skip && skip(psi)) continue;
            const b = pos.length / 3;
            for (let i = 0; i <= NU; i++) {
              const u = i / NU, a = a0 + len * u, r = r0 - slope * len * u - dip * u * u, w = hw * (1 - 0.97 * u);
              for (let j = 0; j <= NV; j++) { const q = psi + w * (2 * j / NV - 1); pos.push(-a, r * Math.cos(q), r * Math.sin(q)); }
            }
            for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const v = b + i * (NV + 1) + j; idx.push(v, v + 1, v + NV + 1, v + 1, v + NV + 2, v + NV + 1); }
          }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
          return g;
        };
        // chế độ 'core': chỉ giữ chi tiết lõi (mesh 39 = vỏ booster/splitter + 60 cánh OGV ⇒ bỏ tam giác có tâm r > 0.40 u)
        const CFM_CORE = new Set([0, 1, 2, 3, 5, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 35, 36, 37, 38, 39, 40, 44, 47, 49]);
        const CFM_FRAME = new Set([4, 26, 34, 41, 42, 45]);                     // 'core': khung quạt + vỏ quạt → nét line-art (39: phần cánh OGV)
        const cfm56 = (spanVal, mode, anim = false) => {
          const ghost = mode === 'ghost', core = mode === 'core', cased = mode === 'full' || ghost, solid = !cased, cutOn = mode === 'full' || core;
          const CR = sgn > 0 ? 0 : -2.5278, P0 = 0.4 + CR;                      // lát cắt hở quay về phía NGOÀI cánh (cánh −z: lật đối xứng)
          const Sa = GX_SA, Sr = GX_SR;                                            // u → đơn vị máy bay theo kích thước thật GEnx-2B
          const ez = sgn * spanVal, lipX = engX(spanVal) + 0.84 * ES, X0 = lipX + GX_ALIP * Sa, EY = engY(spanVal);
          const T = (g) => g.scale(Sa, Sr, Sr).translate(X0, EY, ez);             // hệ máy (u: x = −a, y lên, z) → hệ máy bay
          const lathM = (t, c, seg) => T(new THREE.LatheGeometry(t.map(([a, r]) => new THREE.Vector2(Math.max(0, r), -a)), seg,
            c ? P0 : 0, c ? Math.PI * 1.55 : Math.PI * 2).rotateZ(-Math.PI / 2));   // [a, r] SAU → TRƯỚC ⇒ pháp tuyến ra ngoài
          const inCut = (ang) => { const q = (((ang - CR - Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return q < 0.4 || q > 0.4 + Math.PI * 1.55; };
          // ═══ 1. LƯỚI MẪU: mẫu (x, y, z = −a) → hệ máy (x = −a, y, z = −x) là phép QUAY (giữ chiều tam giác); máy đầy đủ cắt vỏ/stato ═══
          if (CFM) {
            const byCol = new Map(), byGhost = new Map(), spin = { lp: new Map(), hp: new Map() };
            const jobs = core ? CFM.flatMap((m) => m.id === 39 ? [[m, 's'], [m, 'g']] : CFM_CORE.has(m.id) ? [[m, 's']] : CFM_FRAME.has(m.id) ? [[m, 'g']] : [])
              : CFM.map((m) => [m, 's']);                                            // 's' = đặc / theo chế độ · 'g' = nét line-art
            for (const [m, part] of jobs) {
              const cut = cutOn && part === 's' && !CFM_ROT.has(m.id) && !CFM_EXT.has(m.id), P = m.pos, idx = [], counts = [];
              const sp = anim && part === 's' ? (CFM_LP.has(m.id) ? spin.lp : CFM_HP.has(m.id) ? spin.hp : null) : null;   // rô-to quay: giữ hệ máy, nhóm lo biến đổi
              for (const g of m.groups) {
                let n = 0;
                for (let i = 0; i < g.idx.length; i += 3) {
                  const a = g.idx[i] * 3, b = g.idx[i + 1] * 3, c = g.idx[i + 2] * 3;
                  if (cut && inCut(Math.atan2(-(P[a] + P[b] + P[c]), P[a + 1] + P[b + 1] + P[c + 1]))) continue;
                  if (core && m.id === 39 && (Math.hypot(P[a] + P[b] + P[c], P[a + 1] + P[b + 1] + P[c + 1]) > 1.2) !== (part === 'g')) continue;
                  idx.push(g.idx[i], g.idx[i + 1], g.idx[i + 2]); n++;
                }
                counts.push(n);
              }
              if (!idx.length) continue;
              const pe = new Float32Array(P.length);
              for (let i = 0; i < P.length; i += 3) { pe[i] = P[i + 2]; pe[i + 1] = P[i + 1]; pe[i + 2] = -P[i]; }
              // máy có vỏ: phụ kiện gắn vỏ quạt CFM56 (EEC, hộp số, bó dây; r 0.62 → 0.89 u) không lọt nacelle 747-8 cỡ thật (r 0.727 u) ⇒
              // ép theo bán kính phần r > 0.60 u còn 35% (giữ nguyên góc & vị trí dọc trục ⇒ ống vẫn nối liền); máy trần giữ nguyên hình mẫu
              if (cased || core) for (let i = 0; i < pe.length; i += 3) {
                const r = Math.hypot(pe[i + 1], pe[i + 2]);
                if (r > 0.6 && pe[i] > -0.2) { const f = (0.6 + (r - 0.6) * 0.35) / r; pe[i + 1] *= f; pe[i + 2] *= f; }
              }
              const g0 = new THREE.BufferGeometry();
              g0.setAttribute('position', new THREE.BufferAttribute(pe, 3)); g0.setIndex(idx);
              const gcr = toCreasedNormals(g0, 0.6), gc = sp ? gcr : T(gcr), pa = gc.attributes.position.array, na = gc.attributes.normal.array;
              let t0 = 0;
              m.groups.forEach((g, gi) => {
                const n = counts[gi]; if (!n) return;
                const sub = new THREE.BufferGeometry();
                sub.setAttribute('position', new THREE.BufferAttribute(pa.slice(t0 * 9, (t0 + n) * 9), 3));
                sub.setAttribute('normal', new THREE.BufferAttribute(na.slice(t0 * 9, (t0 + n) * 9), 3));
                const dst = sp || (part === 'g' ? byGhost : byCol);
                if (!dst.has(g.c)) dst.set(g.c, []);
                dst.get(g.c).push(sub); t0 += n;
              });
            }
            for (const [c, g0] of GX_FAN()) {                                       // GEnx-2B: quạt 18 cánh + côn xoắn (quay theo trục thấp áp)
              const dst = anim ? spin.lp : byCol;
              if (!dst.has(c)) dst.set(c, []);
              dst.get(c).push(anim ? g0 : T(g0.clone()));
            }
            for (const [c, list] of byCol) {
              const geo = mergeGeometries(list), mesh = new THREE.Mesh(geo, ghost ? GHOST(c) : DS(c));
              mesh.castShadow = solid; mesh.receiveShadow = solid;
              if (solid) mesh.userData.noFade = true;                               // máy trần / chỉ lõi: ĐẶC, không mờ theo vỏ
              if (ghost) {                                                           // mờ 90%: chỉ còn nét viền line-art
                mesh.userData.noFade = true; mesh.renderOrder = 2;
                const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), LINE_SOFT); ln.userData.noFade = true; mesh.add(ln);   // nét mảnh cho ruột · nét đậm cho vành nacelle
              }
              plane.add(mesh);
            }
            for (const [c, list] of byGhost) {                                     // khung / vỏ quạt dạng nét (chế độ 'core')
              const geo = mergeGeometries(list), mesh = new THREE.Mesh(geo, GHOST(c)); mesh.userData.noFade = true; mesh.renderOrder = 2;
              const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), LINE_SOFT); ln.userData.noFade = true; mesh.add(ln); plane.add(mesh);
            }
            for (const [key, list] of [['lp', fans], ['hp', hpcs]]) {             // rô-to quay quanh trục máy (x cục bộ của nhóm)
              if (!spin[key].size) continue;
              const grp = new THREE.Group(); grp.position.set(X0, EY, ez); grp.scale.set(Sa, Sr, Sr);
              grp.userData.eng = ENG_SPOOL[list.length];                               // trục này thuộc máy nào (SPOOL — thứ tự khởi động 4-3-2-1)
              for (const [c, l] of spin[key]) {
                const geo = mergeGeometries(l), ms = new THREE.Mesh(geo, ghost ? GHOST(c) : DS(c));
                if (solid || ghost) ms.userData.noFade = true;
                if (ghost) { ms.renderOrder = 2; const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), LINE_SOFT); ln.userData.noFade = true; ms.add(ln); }   // máy mờ: quạt cũng chỉ nét
                grp.add(ms);
              }
              if (key === 'lp') {                                                       // đĩa mờ chuyển động trên mặt quạt (hiện theo N1)
                const blur = new THREE.Mesh(FAN_BLUR.geo, FAN_BLUR.mat.clone()); blur.userData.noFade = true; blur.renderOrder = 3; grp.add(blur); grp.userData.blur = blur;
              }
              plane.add(grp); list.push(grp);
            }
          }
          // ═══ hoạt cảnh bật máy (chỉ máy anim): buồng đốt vành khuyên sáng · vòng góp nhiên liệu đỏ · đèn trong buồng đốt · luồng gió ═══
          if (anim) {
            const combMat = new THREE.MeshLambertMaterial({ color: 0x757676, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
            const comb = new THREE.Mesh(lathM([[0.50, 0.19], [0.50, 0.27], [0.44, 0.305], [0.36, 0.31], [0.33, 0.28], [0.34, 0.22], [0.40, 0.18], [0.50, 0.19]].map(([a, r]) => [GX_AM(a), r]), true, 40), combMat);
            comb.userData.noFade = true; comb.traverse(o => o.layers.enable(1)); plane.add(comb); allCombMats.push(combMat);
            const fuelMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
            const ring = new THREE.Mesh(T(new THREE.TorusGeometry(0.335, 0.006, 6, 64).rotateY(Math.PI / 2).translate(-GX_AM(0.36), 0, 0)), fuelMat);
            ring.userData.noFade = true; plane.add(ring); allFuelRingMats.push(fuelMat);
            const pl = new THREE.PointLight(0xff5500, 0.0, 0.45); pl.layers.set(1); pl.position.set(X0 - GX_AM(0.42) * Sa, EY, ez); plane.add(pl); enginePointLights.push(pl);
            if (!core && anim === true) windSimulations.push({ ex: engX(spanVal), ey: EY, ez });   // máy CHỈ LÕI / máy chỉ quay (cánh −z): KHÔNG luồng gió
            if (!FLOW_GEO) {                                // biên dạng vật rắn cho mô phỏng gió: đơn vị lathe (÷ES), gốc engX, x tới TRƯỚC
              const XL = (a) => 0.84 + (GX_ALIP - a) * Sa / ES, RL = (r) => r * Sr / ES, N = CFM_NAC, asc = (t) => t.map(([a, r]) => [XL(a), RL(r)]).reverse();
              const iLip = N.lip.reduce((m, p, i) => p[0] < N.lip[m][0] ? i : m, 0);
              const inner = [...N.lip.slice(0, iLip + 1).reverse(), ...N.barrel.slice(1), [-0.86, 0.567], [-0.05, 0.567], ...N.duct.slice(0, -1)];
              const outer = [...N.lip.slice(iLip), ...N.out.slice(1)];
              const plugR = (a) => { const t = N.plug.slice(0, -1).slice().reverse(); for (let i = 0; i < t.length - 1; i++) if (a <= t[i + 1][0]) return t[i][1] + (t[i + 1][1] - t[i][1]) * (a - t[i][0]) / (t[i + 1][0] - t[i][0]); return 0; };
              const aCn = N.cowl[0][0], aTip = N.plug[0][0], body = [];
              for (let i = 0; i <= 12; i++) { const t = i / 12; body.push([-1.004 + 0.262 * t, 0.1995 * (1 - Math.pow(1 - t, 1.5))]); }
              body.push([-0.62, 0.22], [-0.601, 0.22], [-0.60, 0.36], ...N.cowl.slice().reverse().filter(([a]) => a > -0.6), [aCn + 1e-3, plugR(aCn)],
                ...N.plug.slice(0, -1).slice().reverse().filter(([a]) => a > aCn + 1e-3));
              FLOW_GEO = { wallIn: asc(inner), wallOut: asc(outer), body: asc(body), xLip: XL(N.lip[iLip][0]), xTE: XL(N.out[N.out.length - 1][0]),
                xSpin: XL(-1.004), xPlug: XL(aTip), fan: [XL(-0.62), XL(-0.78), RL(0.21), RL(0.565)], xSplit: XL(-0.60), rSplit: RL(0.36), rHub: RL(0.22),
                xCore: XL(aCn), rPlugC: RL(plugR(aCn)), rCowlC: RL(0.36), lips: [[XL(N.out[N.out.length - 1][0]), RL(N.out[N.out.length - 1][1])], [XL(aCn), RL(0.36)]] };
            }
          }
          // ═══ 2. NACELLE 747-8 (máy đầy đủ & máy mờ): vỏ ngoài ma cắt hở · môi hút bạc · ống lót · vách bypass · vỏ lõi · ống xả · côn ·
          //      18 răng cưa ống xả quạt + 14 răng cưa ống xả lõi ═══
          const TE = CFM_NAC.out[CFM_NAC.out.length - 1];                         // mép xả quạt (z 4.676 m sau môi)
          const chevF = (skip) => T(GX_CHEV(18, TE[0], 0.30 * S747 / Sa, TE[1] - 0.001, 0.2 * Sa / Sr, 0.02 * S747 / Sr, skip));   // răng dài 0.30 m, chúc 2 cm
          const chevC = (skip) => T(GX_CHEV(14, GX_AM(1.08), 0.22 * S747 / Sa, 0.357, 0.27, 0.008, skip));
          // vây chặn xoáy (nacelle strake) 747-8 — mẫu GLB: phía TRONG mỗi vỏ (lệch 42° từ đỉnh về phía thân), 0.84 → 2.27 m sau mép
          // môi, cao 0.37 m, mép trước cong · mép sau thẳng; tấm dày 3 cm, chân ngập vào vỏ
          const strake = () => {
            const outR = (a) => { const t = CFM_NAC.out; for (let i = 0; i < t.length - 1; i++) if (a <= t[i + 1][0]) return t[i][1] + (t[i + 1][1] - t[i][1]) * (a - t[i][0]) / (t[i + 1][0] - t[i][0]); return t[t.length - 1][1]; };
            const prof = [[0.84, 0], [1.05, 0.20], [1.31, 0.33], [1.65, 0.37], [2.27, 0.345]], sh = new THREE.Shape(), th = 0.03 * S747 / Sr;
            const P2 = ([dz, h]) => { const a = GX_ALIP + dz * S747 / Sa; return [-a, outR(a) - 0.006 + h * S747 / Sr]; };
            prof.forEach((q, i) => { const [x, y] = P2(q); i ? sh.lineTo(x, y) : sh.moveTo(x, y); });
            for (const dz of [2.27, 1.8, 1.3, 0.84]) { const [x, y] = P2([dz, -0.01]); sh.lineTo(x, y); }
            const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }).translate(0, 0, -th / 2);
            return T(g.rotateX(-sgn * 42 * Math.PI / 180));
          };
          if (ghost || core) {                                                       // vỏ dạng nét: máy mờ · máy chỉ lõi
            const N = CFM_NAC, gl = (t, c, seg = 48) => {
              const geo = lathM(t, false, seg), mesh = new THREE.Mesh(geo, GHOST(c)); mesh.userData.noFade = true; mesh.renderOrder = 2;
              const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), LINE); ln.userData.noFade = true; mesh.add(ln); plane.add(mesh);
            };
            gl(N.out, 0xe6e6e4); gl(N.lip, 0xc9ccd0); gl(N.barrel, 0xd9d9d6); gl(N.duct, 0xc9cac7); gl(N.cowl, 0xa9acaf, 40);
            if (core) { const pg = edged(lathM(N.plug, false, 40), 0x9a9990, { thresh: 30 }); pg.userData.noFade = true; pg.children[0].userData.noFade = true; plane.add(pg); }   // côn xả đặc
            else gl(N.plug, 0x9a9990, 40);
            for (const [geo, c] of [[chevF(), 0xe6e6e4], [chevC(), 0xa9acaf], [strake(), 0xe6e6e4]]) {
              const mesh = new THREE.Mesh(geo, GHOST(c)); mesh.userData.noFade = true; mesh.renderOrder = 2;
              const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), LINE); ln.userData.noFade = true; mesh.add(ln); plane.add(mesh);
            }
          } else if (mode === 'full') {
            const N = CFM_NAC;
            pb.add(lathM(N.out, true, 48), 0xe6e6e4, { thresh: 15 });           // liệt kê trước → sau ⇒ pháp tuyến quay vào (ma, như 3 máy kia)
            plane.add(edged(lathM(N.lip, true, 48), 0xc9ccd0, { mat: DS(0xc9ccd0), thresh: 40 }));
            eb.add(lathM(N.barrel, true, 48), 0xd9d9d6, { thresh: 20 });
            eb.add(lathM(N.duct, true, 48), 0xc9cac7, { thresh: 25 });
            pb.add(lathM(N.cowl, true, 40), 0xa9acaf, { thresh: 20 });
            eb.add(lathM(N.nozIn, true, 40), 0x1c1d1e, { noEdge: true });
            pb.add(lathM(N.plug, false, 40), 0x9a9990, { thresh: 30 });
            pb.add(chevF(inCut), 0xe6e6e4, { thresh: 30 }); pb.add(chevC(inCut), 0xa9acaf, { thresh: 30 }); pb.add(strake(), 0xe6e6e4, { thresh: 30 });
            const PHI = [P0, P0 + Math.PI * 1.55];                              // mặt cắt vách vỏ (dày 0.03 u) ở 2 biên lát cắt
            const atPhi = (g, phi) => {
              const q = g.attributes.position;
              for (let i = 0; i < q.count; i++) { const x = q.getX(i), r = q.getY(i), z = q.getZ(i); q.setXYZ(i, x, -r * Math.sin(phi) - z * Math.cos(phi), r * Math.cos(phi) - z * Math.sin(phi)); }
              g.computeVertexNormals(); return g;
            };
            const base = new THREE.ShapeGeometry(new THREE.Shape([...N.out, ...N.out.slice().reverse().map(([a, r]) => [a, r - (a > TE[0] - 0.2 ? 0.011 : 0.03)])].map(([a, r]) => new THREE.Vector2(-a, r)))), gs = [];
            for (const phi of PHI) for (const flip of [0, 1]) {
              const g = atPhi(base.clone(), phi);
              if (flip) { g.setIndex(Array.from(g.index.array).reverse()); g.computeVertexNormals(); }
              gs.push(stripUV(g));
            }
            eb.add(T(mergeGeometries(gs)), 0x8a8a88, { noEdge: true });
          }
          // ═══ 3. PYLON: mép dưới bám đỉnh nacelle / vỏ quạt → vỏ lõi / giá treo sau → vểnh lên chạm bụng cánh (như 3 máy kia) ═══
          {
            const L = (a) => X0 - a * Sa, Yr = (r) => EY + r * Sr;
            const tipA = GX_ALIP + (spanVal < 7 ? 12.22 : 10.8) * S747 / Sa;
            // đuôi pylon (aft pylon fairing) theo mẫu GLB 747-8: mép dưới [m sau mép môi hút, m trên trục máy] — rời đỉnh vỏ lõi ở miệng
            // xả lõi, buông thấp sát trục (0.33 m) quanh 7–8 m rồi vểnh lên bụng cánh (bản trước vểnh từ 5.8 m, cao hơn ~0.5 m)
            const PYL_AFT = spanVal < 7
              ? [[5.31, 0.86], [5.5, 0.72], [6.0, 0.56], [6.5, 0.45], [7.0, 0.34], [7.5, 0.33], [8.0, 0.34], [8.5, 0.57], [9.0, 0.83], [9.5, 1.07], [10.0, 1.31], [10.5, 1.55], [11.0, 1.68], [11.5, 1.82]]
              : [[5.31, 0.86], [5.5, 0.72], [6.0, 0.56], [6.5, 0.45], [7.0, 0.34], [7.5, 0.33], [8.0, 0.34], [8.5, 0.61], [9.0, 0.87], [9.5, 1.13], [10.0, 1.42]];
            const outTop = CFM_NAC.out.filter(([a]) => a >= GX_ALIP + 0.30).map(([a, r]) => [a, r - 0.004]);
            const lowAR = cased || core
              ? [...outTop, [CFM_NAC.out[CFM_NAC.out.length - 1][0] + 0.03, 0.41],
                ...PYL_AFT.map(([dz, dy]) => [GX_ALIP + dz * S747 / Sa, dy * S747 / Sr])]
              : core   // chỉ lõi: mép dưới bám đỉnh vỏ booster (r 0.37) → bắc qua eo HPC → vỏ buồng đốt / turbine → khung turbine sau (u sau chèn cấp)
              ? [[-0.55, 0.385], [-0.35, 0.385], [-0.10, 0.372], [0.35, 0.345], [0.60, 0.345], [0.80, 0.40], [1.05, 0.40]]
              : [[-0.82, 0.655], [-0.40, 0.655], [-0.06, 0.655], [0.0, 0.52], [0.30, 0.49], [0.80, 0.50], [0.98, 0.50], [1.10, 0.52]].map(([a, r]) => [GX_AM(a), r]);
            const lower = lowAR.map(([a, r]) => [L(a), Yr(r)]);
            const s = spanVal, yT = wingBotY(L(tipA), s) - 0.04, y0 = lower[lower.length - 1][1];
            const aR = lowAR[lowAR.length - 1][0];                              // máy trần (không ống xả): vểnh lên ngay sau giá treo sau
            for (const f of (cased || core) ? [1.0] : [0.25, 0.45, 0.7, 1.0]) lower.push([L(aR + (tipA - aR) * f), y0 + (yT - y0) * Math.pow(f, 1.6)]);
            const xLE = wingAt(WING_LE, s - WROOT), tipX = lower[lower.length - 1][0];
            const upper = [];
            for (let i = 0; i <= 16; i++) { const x = tipX + (xLE - 0.03 - tipX) * i / 16; upper.push([x, wingBotY(x, s) + 0.03]); }
            upper[0][1] = Math.max(upper[0][1], lower[lower.length - 1][1] + 0.02);
            const shp = new THREE.Shape();
            [...lower, ...upper].forEach(([x, y], i) => i ? shp.lineTo(x, y) : shp.moveTo(x, y));
            const PW = 0.36, pyG = new THREE.ExtrudeGeometry(shp, { depth: PW, bevelEnabled: false, curveSegments: 1 });
            pyG.translate(0, 0, -PW / 2);
            {
              const p = pyG.attributes.position, xF = lower[0][0];
              for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), tA = Math.min(1, (x - tipX) / 1.2), tF = Math.min(1, (xF - x) / 0.6);
                p.setZ(i, p.getZ(i) * (0.35 + 0.65 * Math.max(0, Math.min(tA, tF))));
              }
            }
            pyG.translate(0, 0, ez);
            pb.add(pyG, WHITE, { thresh: 25 });
            const i0 = (cased || core) ? outTop.length : lowAR.length - 2, hs0 = lower.slice(i0, i0 + ((cased || core) ? 7 : 4)), HSH = 0.13, hsS = new THREE.Shape();   // tấm chắn nhiệt dọc vùng xả
            [...hs0, ...hs0.slice().reverse().map(([x, y]) => [x, y + HSH])].forEach(([x, y], i) => i ? hsS.lineTo(x, y) : hsS.moveTo(x, y));
            const hsG = new THREE.ExtrudeGeometry(hsS, { depth: PW + 0.016, bevelEnabled: false, curveSegments: 1 });
            hsG.translate(0, 0, ez - (PW + 0.016) / 2);
            pb.add(hsG, DARK_NAVY, { thresh: 25 });
          }
        };
        // 4 động cơ GEnx-2B (2/bên) — sải & vị trí dọc theo mẫu GLB 747-8 (ENG_SPANS / engX / engY khai báo ngoài, dùng chung với cọc tiêu)
        for (const spanVal of ENG_SPANS) {
          const outb = spanVal === Math.max(...ENG_SPANS);
          if (sgn < 0) { cfm56(spanVal, outb ? 'ghost' : 'full', 'spin'); continue; }   // cánh −z: ngoài = mờ 90% chỉ nét · trong = đầy đủ cắt hở · G 14/10: cả 4 máy quay khi bay
          if (outb) { cfm56(spanVal, 'full', true); continue; }                    // cánh +z ngoài: đầy đủ + hoạt cảnh bật máy
          cfm56(spanVal, 'core', true);                                              // cánh +z trong: lõi đặc + vỏ nét line-art, có hoạt cảnh
        }
      }
      // ══ LUỒNG GIÓ — NAVIER–STOKES ĐỐI XỨNG TRỤC trong WEB WORKER (js/wind-worker.js) · G 11/10: "tối ưu giả lập cho giống thật" ══
      // Toàn bộ bộ giải + 2400 sợi khói (vệt 18 điểm, mép mềm, nở về đuôi) chạy ở luồng riêng: lưới SO LE 464 × 80 (h 0.025 lathe ≈ 6.5 cm), đối lưu MacCormack,
      // độ nhớt rối hiệu chỉnh theo thực nghiệm dòng tự do (lớp trượt Brown & Roshko · tia tròn Hussein, Capp & George — Pope 2000),
      // khuếch tán ẩn ADI, áp suất SOR đỏ-đen; chỉ đĩa quạt tạo lực (khí trong ống & miệng xả theo bảo toàn khối lượng); hạt mang
      // dao động rối Langevin theo cả góc vòng ⇒ khói tản 3D. Luồng vẽ chỉ chép mảng; worker chậm hơn khung hình thì giả lập chậm lại
      // (dt kẹp 1/24 s) chứ cảnh không giật. Mở file:// trực tiếp (không có máy chủ) ⇒ không tạo được worker ⇒ không có luồng gió.
      // Miền tính = hộp HẦM GIÓ: x −8 → 3.6 lathe (≈ 21 m sau → 9.4 m trước tâm máy), bán kính 2.0 lathe (≈ 5.2 m); cửa trước
      // thổi gió U∞ ≈ 0.25 × luồng quạt (như lúc cất cánh), cuối hầm mở. Màu khói: lõi nóng T ≥ 0.9 đỏ thẫm & đậm (tam giác nóng),
      // lớp trộn cam → vàng nhạt, luồng quạt xanh vừa, gió hầm xanh mờ.
      {
        const TSL = THREE.TSL, DOM = { H: 0.025, X0: -8.0, X1: 3.6, R1: 2.0 }, NPW = 2400, NTW = 18;
        plane.updateMatrixWorld(true);
        const ENG = windSimulations.map(w => ({ ex: w.ex, ey: w.ey, ez: w.ez, axisH: (plane.position.y + w.ey * 1.1 - 0.12) / (1.1 * ES) }));   // độ cao trục trên mặt sân (lathe)
        const NV = NPW * NTW * 2;
        const idx = new Uint32Array(NPW * (NTW - 1) * 6);
        for (let p = 0, o = 0; p < NPW; p++) for (let j = 0; j < NTW - 1; j++) {
          const b = (p * NTW + j) * 2;
          idx[o++] = b; idx[o++] = b + 1; idx[o++] = b + 2; idx[o++] = b + 1; idx[o++] = b + 3; idx[o++] = b + 2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NV * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NV * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(NV), 1).setUsage(THREE.DynamicDrawUsage));
        { const e = new Float32Array(NV); for (let v = 0; v < NV; v++) e[v] = v & 1 ? -1 : 1; geo.setAttribute('edge', new THREE.BufferAttribute(e, 1)); }   // ±1 hai mép dải khói
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        const mat = new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        const uFade = TSL.uniform(0);
        const soft = TSL.float(1).sub(TSL.attribute('edge', 'float').mul(TSL.attribute('edge', 'float')));   // mép khói mềm: 1 − e²
        mat.opacityNode = TSL.attribute('alpha', 'float').mul(uFade).mul(soft);
        const flowMesh = new THREE.Mesh(geo, mat);
        flowMesh.frustumCulled = false; flowMesh.renderOrder = 99; flowMesh.visible = false; flowMesh.userData.noFade = true;
        plane.add(flowMesh);
        // lượt "xuyên" mờ (bỏ kiểm độ sâu): luồng khuất sau cánh / vỏ trong mờ vẫn hiện nhạt như ảnh X-quang — chung geometry
        const matX = new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
        const uGhost = TSL.uniform(0);
        matX.opacityNode = TSL.attribute('alpha', 'float').mul(uGhost).mul(soft);
        const flowX = new THREE.Mesh(geo, matX);
        flowX.frustumCulled = false; flowX.renderOrder = 98; flowX.visible = false; flowX.userData.noFade = true;
        plane.add(flowX);
        // ── worker: gửi bước (dt, vòng quay, hướng nhìn) kèm 3 mảng rỗng → nhận lại 3 mảng đã điền (chuyền qua lại, không cấp phát mới) ──
        let ww = null, busy = false, spare = null, acc = 0, wasOn = false;
        if (ENG.length && FLOW_GEO) {
          try {
            ww = new Worker('js/wind-worker.js?v=' + APP_V);
            ww.postMessage({ type: 'init', fg: FLOW_GEO, dom: DOM, eng: ENG, ES, NP: NPW, NT: NTW });
            spare = [new Float32Array(NV * 3), new Float32Array(NV * 3), new Float32Array(NV)];
            ww.onmessage = (e) => {
              const m = e.data; if (m.type !== 'frame') return;
              const P = new Float32Array(m.pos), Cc = new Float32Array(m.col), A = new Float32Array(m.alp), at = geo.attributes;
              if (wasOn) { at.position.array.set(P); at.color.array.set(Cc); at.alpha.array.set(A); at.position.needsUpdate = at.color.needsUpdate = at.alpha.needsUpdate = true; }
              spare = [P, Cc, A]; busy = false;
            };
            ww.onerror = (e) => { console.warn('Luồng gió: worker lỗi —', e.message || e); ww = null; };
          } catch (e) { console.warn('Luồng gió: không tạo được worker —', e); ww = null; }
        }
        const cd = new THREE.Vector3(), qInv = new THREE.Quaternion();
        windFlow = (dt, glow) => {
          if (glow < 0.01) {
            flowMesh.visible = flowX.visible = false;
            if (wasOn) { wasOn = false; if (ww) ww.postMessage({ type: 'reset' }); geo.attributes.alpha.array.fill(0); geo.attributes.alpha.needsUpdate = true; }
            return;
          }
          wasOn = true; flowMesh.visible = flowX.visible = true; uFade.value = glow; uGhost.value = glow * 0.25;
          acc += dt;
          if (!ww || busy || !spare) return;
          camera.getWorldDirection(cd); cd.applyQuaternion(qInv.copy(plane.quaternion).invert());
          const lpp = (camera.top / camera.zoom) / (renderer.domElement.clientHeight / 2) / 1.1;   // đơn vị máy bay / điểm ảnh
          const [P, Cc, A] = spare; spare = null; busy = true;
          ww.postMessage({ type: 'step', dt: Math.min(acc, 1 / 24), spool: Math.min(1, glow / 0.92), cam: [cd.x, cd.y, cd.z], lpp, pos: P.buffer, col: Cc.buffer, alp: A.buffer }, [P.buffer, Cc.buffer, A.buffer]);
          acc = 0;
        };
        // ═══ HẦM GIÓ (G 11/10): hộp nét viền đúng bằng miền tính (đáy cắt ở mặt sân) — 12 cạnh đậm · lưới chắn tổ ong 2 đầu ·
        // 3 khung giữa mảnh; chỉ hiện khi bấm Engine, rõ dần theo vòng quay ──
        const tunMat = new THREE.LineBasicMaterial({ color: 0x2e2b24, transparent: true, opacity: 0, depthWrite: false });
        const tunSoft = new THREE.LineBasicMaterial({ color: 0x4a3728, transparent: true, opacity: 0, depthWrite: false });
        const tunnel = new THREE.Group(); tunnel.visible = false; tunnel.userData.noFade = true;
        ENG.forEach(w => {
          const xa = w.ex + DOM.X0 * ES, xb = w.ex + DOM.X1 * ES, h = DOM.R1 * ES, y0 = w.ey - Math.min(DOM.R1, w.axisH) * ES, y1 = w.ey + h, z0 = w.ez - h, z1 = w.ez + h;
          const E = [], G = [], L = (A, x0, ya, za, x1, yb, zb) => A.push(x0, ya, za, x1, yb, zb);
          for (const x of [xa, xb]) { L(E, x, y0, z0, x, y1, z0); L(E, x, y1, z0, x, y1, z1); L(E, x, y1, z1, x, y0, z1); L(E, x, y0, z1, x, y0, z0); }
          for (const [y, z] of [[y0, z0], [y1, z0], [y1, z1], [y0, z1]]) L(E, xa, y, z, xb, y, z);
          for (const x of [xa, xb]) for (let k = 1; k < 8; k++) {                     // lưới chắn tổ ong 8 × 8 ở 2 đầu hầm
            const y = y0 + (y1 - y0) * k / 8, z = z0 + (z1 - z0) * k / 8; L(G, x, y, z0, x, y, z1); L(G, x, y0, z, x, y1, z);
          }
          for (let k = 1; k < 4; k++) { const x = xa + (xb - xa) * k / 4; L(G, x, y0, z0, x, y1, z0); L(G, x, y1, z0, x, y1, z1); L(G, x, y1, z1, x, y0, z1); L(G, x, y0, z1, x, y0, z0); }
          const mk = (A, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A, 3)); const l = new THREE.LineSegments(g, m); l.userData.noFade = true; l.renderOrder = 97; tunnel.add(l); };
          mk(E, tunMat); mk(G, tunSoft);
        });
        plane.add(tunnel);
        const flowCore = windFlow;
        windFlow = (dt, glow) => { tunnel.visible = glow >= 0.01; tunMat.opacity = Math.min(1, glow / 0.3); tunSoft.opacity = 0.32 * Math.min(1, glow / 0.3); flowCore(dt, glow); };
        if (!ENG.length) windFlow = null;
      }
      // ═══ CÀNG MŨI 747-8 — dựng lại theo bố cục càng mũi mẫu A350-1000: chạc trunnion chữ A trên đỉnh · giằng kéo gập phía
      // TRƯỚC (càng thu về trước) + thanh khoá · cổ bẻ lái ngay trên nắp đệm + 2 xy-lanh lái · giằng xoắn phía SAU · chân trụ
      // chữ T ôm trục + tai kéo phía trước; bánh/mâm kiểu 777X (2 bánh, không phanh). Lốp mũi 49×19.0-22 (Ø 1.245 m),
      // 2 bánh cách 0.89 m. Hệ dựng (mét): gốc = mặt sân dưới trục trụ, x tới mũi, y lên.
      {
        const K = S747, LIFT = 0.109, X = _gX, Z = _gZ;
        const rig = gearRig('nose', 0, 'z'); rig.doors = [];
        const P = (x, y, z) => new THREE.Vector3(NG_X + x * K, LIFT + y * K, z * K);
        const rod = (a, c, r0, r1, col, seg, o) => gRod(lgb, a, c, r0 * K, r1 * K, col, seg, o);
        const lugBox = (p, w, h, d, col = GEAR_C.paint) => lgb.P(w * K, h * K, d * K, p.x, p.y, p.z, col, {});
        // trunnion nâng GEAR_LIFT.nose vào hốc càng (dưới sàn buồng lái) ⇒ thu về trước bánh lọt hẳn trong vỏ; ống ngoài kéo dài lên tới đó
        const NTOP = gy(-1.66) + 0.1 + GEAR_LIFT.nose * K, TOPm = (NTOP - LIFT) / K, BELLY = (gy(-1.66) - LIFT) / K;   // đỉnh trụ · bụng mũi (m)
        const R = 0.622, W = 0.2413, RB = 0.2794, YA = R, WZ = 0.4435, YG = YA + 0.5;
        rig.pin.T = P(0, TOPm - 0.16, 0);                                            // chốt chạc chữ A = trục thu càng
        // BẺ LÁI (G 15/10 "máy bay rẽ thì bánh mũi bẻ trước"): phần quay quanh trục đứng của trụ — bánh, trục, chân trụ chữ T, ống
        // trượt crom, cổ bẻ lái + giằng xoắn (cổ quay ⇒ giằng xoắn kéo chân trụ quay theo); ống ngoài, nắp đệm, 2 xy-lanh lái đứng yên
        gearPart(rig, 'steer'); rig.pin.SG = P(0, YA, 0);
        // — 2 bánh + trục + chân trụ chữ T (ống trục) + tai kéo
        for (const s of [-1, 1]) { const c = P(0, YA, s * WZ); gearWheel(lgb, c, R * K, W * K, RB * K, s, { spin: wheelPart(rig, c) }); }
        gPin(lgb, P(0, YA, 0), Z, 0.065 * K, 0.98 * K, GEAR_C.paint, 10);
        gPin(lgb, P(0, YA, 0), Z, 0.11 * K, 0.4 * K, GEAR_C.paint, 16);
        rod(P(0, YA + 0.04, 0), P(0, YA + 0.2, 0), 0.13, 0.1, GEAR_C.paint, 14);
        lugBox(P(0.17, YA - 0.03, 0), 0.16, 0.07, 0.12); gPin(lgb, P(0.22, YA - 0.03, 0), Z, 0.025 * K, 0.16 * K, SILVER, 8);
        // — ống trượt crom · nắp đệm kín · cổ bẻ lái · ống ngoài · vòng tai cố định · đai kẹp
        rod(P(0, YA + 0.2, 0), P(0, YG + 0.3, 0), 0.085, 0.085, SILVER, 14);
        gearPart(rig, 'strut'); rod(P(0, YG, 0), P(0, YG + 0.05, 0), 0.16, 0.16, GEAR_C.paint, 16);
        gearPart(rig, 'steer'); rod(P(0, YG + 0.05, 0), P(0, YG + 0.25, 0), 0.175, 0.175, GEAR_C.paint, 18);   // cổ bẻ lái
        gearPart(rig, 'strut'); rod(P(0, YG + 0.25, 0), P(0, TOPm, 0), 0.14, 0.135, GEAR_C.paint, 16);
        rod(P(0, YG + 0.68, 0), P(0, YG + 0.78, 0), 0.165, 0.165, GEAR_C.paint, 16);
        for (const y of [YG + 1.2, TOPm - 0.55]) rod(P(0, y - 0.012, 0), P(0, y + 0.012, 0), 0.152, 0.152, WHITE, 16);
        // — 2 xy-lanh lái: tai cổ bẻ lái → tai vòng cố định (thân sơn + ty crom)
        for (const s of [-1, 1]) {
          const a = P(-0.03, YG + 0.17, s * 0.2), c = P(-0.2, YG + 0.73, s * 0.17), m = a.clone().lerp(c, 0.45);
          gRod(lgb, a, m, 0.026 * K, 0.026 * K, SILVER, 8); gRod(lgb, m, c, 0.045 * K, 0.045 * K, GEAR_C.paint, 10);
          for (const q of [a, c]) { gPin(lgb, q, Z, 0.035 * K, 0.08 * K, SILVER, 8); lugBox(q.clone().add(new THREE.Vector3(0.04 * K, 0, -s * 0.03 * K)), 0.12, 0.08, 0.08); }
        }
        // — giằng xoắn phía sau: tai cổ bẻ lái → đỉnh → tai chân trụ
        gearPart(rig, 'steer');
        const TU = P(-0.18, YG + 0.13, 0), TL = P(-0.13, YA + 0.13, 0), TA = P(-0.42, (YG + 0.13 + YA + 0.13) / 2, 0);
        gBar(lgb, TU, TA, 0.1 * K, 0.06 * K, WHITE); gBar(lgb, TA, TL, 0.1 * K, 0.06 * K, WHITE);
        for (const q of [TU, TL]) { gPin(lgb, q, Z, 0.035 * K, 0.17 * K, SILVER, 8); lugBox(new THREE.Vector3(q.x + 0.05 * K, q.y, q.z), 0.12, 0.08, 0.15); }
        gPin(lgb, TA, Z, 0.045 * K, 0.11 * K, SILVER, 8);
        gearPart(rig, 'strut');
        // — giằng kéo gập phía trước: thanh dưới (tai ống ngoài → gối) + khung chữ A lên bụng mũi + thanh khoá 2 đoạn + cờ đỏ
        const B0 = P(0.18, YG + 0.75, 0), QA = P(1.1, TOPm - 0.12, -0.3), QB = P(1.1, TOPm - 0.12, 0.3), L2 = P(0.17, TOPm - 0.65, 0);
        const KN = B0.clone().lerp(QA.clone().lerp(QB, 0.5), 0.5).add(new THREE.Vector3(0, -0.04 * K, 0));
        lugBox(P(0.15, YG + 0.75, 0), 0.08, 0.14, 0.2); lugBox(P(0.15, TOPm - 0.65, 0), 0.07, 0.1, 0.14);
        const J = KN.clone().lerp(L2, 0.5).add(new THREE.Vector3(0, -0.05 * K, 0));
        Object.assign(rig.pin, { W: QA.clone().lerp(QB, 0.5), S: B0.clone(), K: KN.clone(), J: J.clone(), L: L2.clone() });
        gearPart(rig, 'lo'); gRod(lgb, B0, KN, 0.06 * K, 0.055 * K, GEAR_C.paint, 12); gPin(lgb, B0, Z, 0.05 * K, 0.2 * K, SILVER, 8);
        gearPart(rig, 'up');
        for (const q of [QA, QB]) { gRod(lgb, KN, q, 0.05 * K, 0.045 * K, GEAR_C.paint, 10); gPin(lgb, q, Z, 0.04 * K, 0.14 * K, SILVER, 8); }
        gPin(lgb, KN, Z, 0.055 * K, 0.24 * K, SILVER, 10);
        gearPart(rig, 'flag');                                                       // cờ chốt khoá đất: rút trước khi đẩy lùi
        gBar(lgb, KN.clone().add(new THREE.Vector3(0.02 * K, -0.04 * K, 0)), KN.clone().add(new THREE.Vector3(0.05 * K, -0.48 * K, 0.04 * K)), 0.07 * K, 0.006 * K, GEAR_C.flag, _gXZ, { noEdge: true });
        gearPart(rig, 'k1'); gBar(lgb, KN, J, 0.06 * K, 0.035 * K, WHITE); gPin(lgb, J, Z, 0.03 * K, 0.09 * K, SILVER, 8);
        gearPart(rig, 'k2'); gBar(lgb, J, L2, 0.06 * K, 0.035 * K, WHITE);
        gearPart(rig, 'strut');
        // — chạc trunnion chữ A: xà ngang trên đỉnh (2 chốt treo) + 2 càng chéo xuống ôm ống ngoài
        gPin(lgb, P(0, TOPm - 0.16, 0), Z, 0.075 * K, 0.96 * K, GEAR_C.paint, 12);
        for (const s of [-1, 1]) {
          rod(P(0, TOPm - 0.16, s * 0.44), P(0, TOPm - 0.85, s * 0.13), 0.055, 0.05, GEAR_C.paint, 10);
          gPin(lgb, P(0, TOPm - 0.16, s * 0.5), Z, 0.09 * K, 0.08 * K, SILVER, 12);
        }
        // — 2 đèn taxi trên giá phía trước ống ngoài (vỏ + kính)
        lugBox(P(0.15, 2.2, 0), 0.1, 0.09, 0.36);
        for (const s of [-1, 1]) {
          gPin(lgb, P(0.24, 2.2, s * 0.115), X, 0.065 * K, 0.13 * K, GEAR_C.paint, 12);
          gPin(lgb, P(0.305, 2.2, s * 0.115), X, 0.055 * K, 0.012 * K, GLASS, 12, { noEdge: true });
        }
        // — 2 ống dầu lái: dọc 2 bên ống ngoài xuống 2 xy-lanh
        for (const s of [-1, 1]) gHose(lgb, [P(0.06, TOPm - 0.4, s * 0.135), P(0.06, YG + 1.1, s * 0.135), P(-0.04, YG + 0.86, s * 0.17), P(-0.16, YG + 0.78, s * 0.2)], 0.012 * K);
        // — 2 cửa hốc càng mũi: bản lề dọc mép hốc (z ±0.5 m, bụng mũi), mở nghiêng ~25° ra 2 mạn khi càng thả;
        //   thu càng xong thì đóng kín (quay quanh bản lề tới nằm ngang ôm bụng) — bag riêng để quay, vẫn mờ theo vỏ
        for (const s of [-1, 1]) {
          const d = Bag(); d.P(1.35 * K, 0.85 * K, 0.025 * K, NG_X + 0.35 * K, LIFT + (BELLY - 0.385) * K, s * 0.68 * K, WHITE, { soft: true, rx: -s * 0.44 });
          rig.doors.push({ bag: d, s, H: new THREE.Vector3(NG_X + 0.35 * K, LIFT + BELLY * K, s * 0.5 * K) });
        }
      }

      // Sàn tầng chính ngăn hầm hàng bên dưới (mặt sàn = bậc cửa GLB y 0.75 m) — x −7 → 11.5, trong da thân
      // (sàn cũ thay bằng sàn theo tiết diện trong khối NỘI THẤT)
      // Sàn TẦNG TRÊN trong bướu (mặt sàn = bậc cửa tầng trên y 3.43 m) — lộ qua da trong suốt, đọc ra kết cấu 2 tầng của 747
      // (ĐÃ BỎ vách ngăn cockpit — đĩa 120 nan hội tụ về tâm, lộ rõ qua thân trong suốt thành vệt "phễu" ở mũi)
      // Ghế phi công (trái + phải) — buồng lái 747 nằm TRÊN tầng trên, ngay sau kính lái
      // (ghế lái: dựng lại trong khối NỘI THẤT — buồng lái đầy đủ)


      /* ═══ NỘI THẤT 747-8I (G 13/10: "do research and add interior") — cấu hình kiểu Lufthansa 364 ghế (8F · 80J · 32W · 244Y):
         TẦNG CHÍNH: hạng nhất 8 phòng 1-2-1 ở mũi · L1 bếp/WC · thương gia 2-2-2 · L2 bếp + CẦU THANG CONG lên tầng trên (Boeing:
         "sweeping staircase at the door-two entryway") · phổ thông đặc biệt 2-4-2 · phổ thông 3-4-3 (đuôi thu hẹp ⇒ tự giảm 3-3-3 / 2-4-2)
         · bếp/WC ở L3–L5 · khoang nghỉ tiếp viên trên trần đuôi. TẦNG TRÊN: buồng lái (2 ghế lái + 2 ghế quan sát, bàn điều khiển
         giữa, bảng 6 màn hình, bảng trần) · bếp/WC · thương gia 2-2 (lối thoát ở cửa tầng trên chia 3 + 5 hàng). TẦNG DƯỚI: hầm hàng
         trước 10 × 2 container LD-3, hầm sau 6 × 2, khoang hàng rời. Kích thước theo mét, ghế khớp TIẾT DIỆN THÂN (Wm/hM/cM).
         Đặc (noFade) ⇒ nhìn xuyên vỏ thân trong suốt kiểu X-quang. ═══ */
      {
        const IN = Bag();
        const ECO = 0x6f7f90, BIZ = 0x56616e, FST = 0x8a7355, SHELL = 0xe9e4d6, GAL = 0xd5dce4, ULD = 0xc9cfd6, SCR = 0x26303a;
        const MD = 0.75, UD = 3.43;                                          // mặt sàn tầng chính / tầng trên (GLB m)
        const hwAt = (z, y) => { const c = cM(z), h = hM(z), t = (y - c) / h; return Wm(z) * Math.sqrt(Math.max(0, 1 - t * t)); };   // nửa-rộng elip nền (m)
        // ── NỬA-RỘNG DA THẬT (m GLB) tại trạm z, cao độ y: thân = lathe + elip + BƯỚU theo vai (đúng hàm hullDeform của da);
        //    mũi (z ≥ 23.94) lấy thêm vòng tiết diện lưới GLB NOSE_V (da mũi nắn theo nó) — lấy giá trị NHỎ hơn cho chắc ──
        const skinLathe = (z, y) => {
          const x = gx(z), r = rOfX(x), yl = gy(y) - FY, cy = cOffX(x), ky = kyX(x), hp = humpX(x);
          const ys = (t) => cy + ky * r * Math.sin(t) + (t > 0 && hp > 0 ? hp * lobe(t, x) : 0);
          if (yl <= ys(-Math.PI / 2) || yl >= ys(Math.PI / 2)) return 0;
          let a = -Math.PI / 2, b = Math.PI / 2; for (let k = 0; k < 36; k++) { const m = (a + b) / 2; if (ys(m) < yl) a = m; else b = m; }
          return r * Math.cos((a + b) / 2) / S747;
        };
        const NRING = (() => {                                                           // vòng tiết diện mũi GLB (nửa phải), xếp theo góc
          const by = new Map(); for (let k = 0; k < NOSE_V.length; k += 3) { const w = NOSE_V[k], y = NOSE_V[k + 1], z = +NOSE_V[k + 2].toFixed(3); if (w < -1e-6) continue; if (!by.has(z)) by.set(z, []); by.get(z).push([w, y]); }
          return [...by].filter(([, pts]) => pts.length >= 4).map(([z, pts]) => ({ z, pts: pts.sort((p, q) => Math.atan2(p[1] - 1.32, p[0]) - Math.atan2(q[1] - 1.32, q[0])) })).sort((a, b) => a.z - b.z);
        })();
        const ringHW = (R, y) => { let best = -1; for (let i = 0; i < R.pts.length - 1; i++) { const [w0, y0] = R.pts[i], [w1, y1] = R.pts[i + 1]; if ((y - y0) * (y - y1) <= 0 && y0 !== y1) best = Math.max(best, w0 + (w1 - w0) * (y - y0) / (y1 - y0)); } return best; };
        const skinNose = (z, y) => {
          let lo = null, hi = null;
          for (const R of NRING) { const h = ringHW(R, y); if (h < 0) continue; if (R.z <= z) lo = [R.z, h]; else if (!hi) hi = [R.z, h]; }
          if (!lo && !hi) return 0; if (!lo) return hi[1]; if (!hi) return lo[1];
          return lo[1] + (hi[1] - lo[1]) * (z - lo[0]) / (hi[0] - lo[0]);
        };
        // mũi + khối kính: BẮN TIA ngang từ trục ra mạn phải lên CHÍNH các lưới da đang dựng (da mũi · kính · khung) — vòng GLB không tả
        // được độ dốc kính lái (sai tới 0.37 m) ⇒ lấy giao gần nhất; tia lọt (trên nóc / ngoài tiết diện) ⇒ 0 (không đặt gì)
        const noseRay = (() => {
          plane.updateMatrixWorld(true);
          const inv = plane.matrixWorld.clone().invert(), XS = gx(25.6), TR = [], v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
          plane.traverse(o => {
            if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
            const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (g.boundingBox.max.x < XS - 1) return;
            const m = o.matrixWorld.clone().premultiply(inv), P = g.attributes.position, I = g.index, n = I ? I.count / 3 : P.count / 3;
            for (let t = 0; t < n; t++) {
              for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(P, I ? I.getX(3 * t + k) : 3 * t + k).applyMatrix4(m);
              if (Math.max(v[0].x, v[1].x, v[2].x) < XS || Math.max(v[0].z, v[1].z, v[2].z) < 0) continue;
              TR.push([v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z]);
            }
          });
          const NB = 96, x0 = XS, x1 = gx(36.0), bs = NB / (x1 - x0), BK = Array.from({ length: NB }, () => []);
          const bi = (x) => Math.max(0, Math.min(NB - 1, Math.floor((x - x0) * bs)));
          for (const q of TR) { const a = Math.min(q[0], q[3], q[6]), b = Math.max(q[0], q[3], q[6]); for (let k = bi(a); k <= bi(b); k++) BK[k].push(q); }
          return (z, y) => {                                                              // m GLB → nửa-rộng (m), 0 nếu tia lọt
            const X = gx(z), Y = gy(y); let best = Infinity;
            for (const q of BK[bi(X)]) {
              const [ax, ay, az, bx, by, bz, cx, cy, cz] = q, d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue;
              const w1 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / d, w2 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / d, w3 = 1 - w1 - w2;
              if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
              const zz = w1 * az + w2 * bz + w3 * cz; if (zz > 1e-4 && zz < best) best = zz;
            }
            return best === Infinity ? 0 : best / S747;
          };
        })();
        const skinHW = (z, y) => z < 25.6 ? skinLathe(z, y) : Math.min(skinLathe(z, y) || Infinity, noseRay(z, y));
        window.__skinHW = skinHW;
        // mọi khối: kẹp vào trong da (lớp ốp 0.07 m) ở cả 4 góc (đầu/cuối dọc thân × đáy/đỉnh) — lệch vào trong, hẹp lại, hoặc bỏ nếu không vừa
        const LINING = 0.07;
        const B = (z, y, l, dz, dy, dl, col, o = {}) => {
          let ez = dz, ey = dy, el = dl;                                                   // bao của khối đã xoay
          if (o.rz) { const c = Math.abs(Math.cos(o.rz)), s = Math.abs(Math.sin(o.rz)); ez = dz * c + dy * s; ey = dz * s + dy * c; }
          if (o.ry) { const c = Math.abs(Math.cos(o.ry)), s = Math.abs(Math.sin(o.ry)); ez = dz * c + dl * s; el = dz * s + dl * c; }
          let hw = Infinity; for (const zz of [z - ez / 2, z, z + ez / 2]) for (const yy of [y - ey / 2, y + ey / 2]) hw = Math.min(hw, skinHW(zz, yy));
          hw -= LINING; if (hw < 0.03) return;
          if (Math.abs(l) + el / 2 > hw) {
            if (el > 2 * hw || Math.abs(l) < 1e-6) { const k = Math.min(1, 2 * hw / el); dl *= k; el *= k; l = 0; if (dl < 0.04) return; }
            else l = Math.sign(l) * (hw - el / 2);
          }
          IN.P(S747 * dz, S747 * dy, S747 * dl, gx(z), gy(y), S747 * l, col, Object.assign({ soft: true }, o));
        };
        // ── sàn theo đoạn (rộng = tiết diện tại mặt sàn) ──
        const floor = (z0, z1, y, inset, col) => { for (let z = z0; z < z1 - 1e-6; z += 1.0) { const zb = Math.min(z1, z + 1.0), zm = (z + zb) / 2, w = 2 * (Math.min(hwAt(z, y), hwAt(zb, y)) - inset); if (w > 0.3) B(zm, y - 0.03, 0, zb - z, 0.06, w, col, { noEdge: true }); } };
        floor(-26.3, 32.4, MD, 0.08, CREAM);
        // ── ghế ── kind: e (phổ thông) · w (phổ thông đặc biệt) · j (thương gia nằm phẳng) · f (phòng hạng nhất)
        const SEAT = { e: { w: 0.46, a: 0.48, c: ECO }, w: { w: 0.5, a: 0.5, c: ECO }, j: { w: 0.66, a: 0.55, c: BIZ }, f: { w: 0.82, a: 0.6, c: FST } };
        function seat(z, l, k, y0) {
          const S = SEAT[k], w = S.w - 0.04;
          if (k === 'e' || k === 'w') {
            B(z, y0 + 0.42, l, 0.46, 0.1, w, S.c);                                           // nệm
            B(z - 0.25, y0 + 0.8, l, 0.08, 0.72, w, S.c, { rz: 0.16 });                      // tựa ngả
            B(z, y0 + 0.2, l, 0.3, 0.36, w * 0.6, DARK, { noEdge: true });                  // chân ghế
          } else if (k === 'j') {
            B(z + 0.15, y0 + 0.45, l, 0.95, 0.12, w, S.c);                                   // nệm dài (giường)
            B(z - 0.42, y0 + 0.85, l, 0.12, 0.85, w, S.c, { rz: 0.12 });
            B(z - 0.05, y0 + 0.6, l + Math.sign(l || 1) * (w / 2 + 0.03), 1.3, 0.55, 0.06, SHELL);   // vách vỏ ghế
            B(z + 0.75, y0 + 0.35, l, 0.25, 0.5, w * 0.8, SHELL);                            // bệ gác chân
          } else {
            B(z, y0 + 0.65, l + Math.sign(l || 1) * 0.45, 2.0, 1.3, 0.05, SHELL);            // vách phòng
            B(z - 0.95, y0 + 0.65, l, 0.05, 1.3, 0.9, SHELL);
            B(z - 0.2, y0 + 0.45, l, 0.8, 0.12, w, S.c); B(z - 0.55, y0 + 0.85, l, 0.12, 0.8, w, S.c, { rz: 0.1 });
            B(z + 0.65, y0 + 0.4, l, 0.45, 0.8, w * 0.6, SHELL);                             // bàn + tủ
          }
        }
        // 1 hàng ghế theo cấu hình [3,4,3] … — tự giảm nếu không vừa tiết diện tại cao độ tựa tay
        function row(z, k, cfgs, y0 = MD, hwFix, cap = 99) {
          const S = SEAT[k], avail = (hwFix ?? Math.min(hwAt(z - 0.4, y0 + 0.15), hwAt(z + 0.3, y0 + 0.15), hwAt(z, y0 + 0.65)) - 0.12) * 2;   // vừa cả chân ghế sát sàn
          const cfg = cfgs.find(c => c.reduce((a, n) => a + n, 0) <= cap && c.reduce((a, n) => a + n * S.w, 0) + (c.length - 1) * S.a <= avail); if (!cfg) return 0;
          let x = -(cfg.reduce((a, n) => a + n * S.w, 0) + (cfg.length - 1) * S.a) / 2, cnt = 0;
          cfg.forEach((n, bi) => { for (let i = 0; i < n; i++) { seat(z, x + (i + 0.5) * S.w, k, y0); cnt++; } x += n * S.w + S.a; });
          return cnt;
        }
        // thùng hành lý: 2 bên (+ giữa nếu 2 lối đi)
        const bins = (z0, z1, centre) => {                                              // từng ngăn ~1.5 m (như thật) — mỗi ngăn bám theo độ thu của thân
          const n = Math.max(1, Math.round((z1 - z0) / 1.5)), L = (z1 - z0) / n;
          for (let k = 0; k < n; k++) { const zm = z0 + (k + 0.5) * L;
            for (const s of [-1, 1]) B(zm, 2.48, s * 9, L - 0.04, 0.45, 0.62, CREAM);      // s·9 ⇒ B tự đẩy sát vách theo da tại ngăn đó
            if (centre) B(zm, 2.6, 0, L - 0.04, 0.4, 1.5, CREAM); }
        };
        const hwBox = (z, dz) => Math.min(hwAt(z - dz / 2, MD + 0.1), hwAt(z + dz / 2, MD + 0.1), hwAt(z, MD + 2.1)) - 0.05;   // nửa-rộng an toàn trong vỏ
        const lav = (z, l) => { const m = hwBox(z, 1.0) - 0.475; B(z, MD + 1.05, Math.sign(l) * Math.min(Math.abs(l), m), 1.0, 2.1, 0.95, GAL); };
        const galley = (z, l, w) => { const m = hwBox(z, 0.8); w = Math.min(w, 2 * (m - Math.abs(l))); B(z, MD + 0.55, l, 0.8, 1.1, w, GAL); B(z, MD + 1.65, l, 0.5, 0.9, w, GAL); };
        const N = { f: 0, j: 0, w: 0, e: 0 };
        // ── TẦNG CHÍNH ── (Lufthansa 747-8I: 8 F · 80 J (48 tầng chính + 32 tầng trên) · 32 W · 244 Y = 364)
        for (const z of [29.2, 27.55]) N.f += row(z, 'f', [[1, 2, 1]]);
        galley(26.0, 0, 1.8); lav(26.0, -2.0); lav(26.0, 2.0);
        for (let z = 25.0; z > 16.5; z -= 1.2) N.j += row(z, 'j', [[2, 2, 2]]);           // 8 hàng × 6 = 48
        bins(16.1, 25.5, true);
        galley(12.4, 1.2, 1.6); lav(12.4, -0.6);                                           // L2: bếp + WC, lối ngang cửa ở 13.2
        for (let z = 11.5; z > 8.0; z -= 1.0) N.w += row(z, 'w', [[2, 4, 2]]);           // 4 hàng × 8 = 32
        bins(7.9, 12.0, true); lav(7.3, -0.6); lav(7.3, 0.6);
        const Y = (z, cfgs) => { const c = row(z, 'e', cfgs, MD, undefined, 244 - N.e); N.e += c; return c; };
        for (let z = 6.6; z > 2.3; z -= 0.81) Y(z, [[3, 4, 3]]);                          // khoang C: 6 hàng
        for (let z = 0.6; z > -8.6; z -= 0.81) Y(z, [[3, 4, 3]]);                         // khoang D (sau cửa thoát L3): 12 hàng
        bins(-8.8, 6.9, true);
        galley(-10.0, 0, 2.4); lav(-9.6, -2.1); lav(-9.6, 2.1); lav(-10.7, -2.1); lav(-10.7, 2.1);   // L4
        let zE = -11.6; for (; zE > -22.9 && N.e < 244; zE -= 0.81) Y(zE, [[3, 4, 3], [3, 3, 3], [2, 4, 2], [2, 3, 2], [2, 2, 2], [2, 2], [2]]);   // khoang E tới đủ 244
        bins(zE + 0.4, -11.3, true);
        for (let z = zE - 0.3; z > -23.4; z -= 1.15) { lav(z, -1.5); lav(z, 1.5); }       // cụm WC đuôi
        galley(-24.4, 0, 2.6); galley(-25.4, 0, 2.2);                                       // L5 bếp đuôi
        B(-19.0, 3.55, 0, 6.0, 0.75, 2.4, SHELL);                                         // khoang nghỉ tiếp viên trên trần đuôi
        // ── CẦU THANG CONG (L2 → tầng trên): 14 bậc vòng cung, lan can ──
        for (let i = 0; i < 14; i++) {
          const t = i / 13, z = 15.85 - 2.45 * t, l = -1.45 + 0.4 * Math.sin(Math.PI * t), y = MD + (i + 1) * (UD - MD) / 14;   // chân cầu thang sau hàng J cuối, lên tới đầu sau tầng trên
          B(z, y - 0.02, l, 0.28, 0.04, 0.95, SHELL, { ry: 0.35 * (t - 0.5) });
          B(z, y + 0.5, l - 0.5, 0.05, 1.0, 0.04, GAL, { noEdge: true });                 // trụ lan can
        }
        // ── TẦNG TRÊN ──
        floor(13.0, 27.4, UD, 0.25, CREAM);
        let ur = 0; for (let z = 26.0; z > 15.0 && ur < 8; z -= 1.15) { if (Math.abs(z - 20.8) < 0.6) continue; N.j += row(z, 'j', [[2, 2]], UD, 1.62); ur++; }   // 8 hàng × 4 = 32
        B(26.95, UD + 1.0, -1.05, 0.7, 2.0, 0.9, GAL); B(26.95, UD + 0.55, 0.9, 0.7, 1.1, 1.2, GAL);   // WC + bếp sau buồng lái
        B(27.35, UD + 1.0, 0, 0.06, 2.0, 2.8, SHELL);                                     // vách buồng lái (cửa giữa)
        // ── BUỒNG LÁI ──
        // buồng lái theo kính lái GLB (mép dưới kính y 4.27 m · giữa z 31.55 · kính hông tới z 29.55 · mép trên 4.87):
        // mái che chói ngay dưới mép kính, bảng 6 màn hình sau đó, ghế lái lùi ~1.1 m, bảng trần ôm dưới nóc
        floor(27.35, 31.1, UD, 0.15, CREAM);
        B(30.92, 4.13, 0, 0.42, 0.08, 1.9, DARK);                                        // mái che chói (glareshield)
        B(30.78, 3.8, 0, 0.26, 0.6, 1.85, SHELL);                                         // bảng điều khiển chính
        for (const l of [-0.75, -0.43, -0.14, 0.14, 0.43, 0.75]) B(30.64, 3.86, l, 0.02, 0.22, 0.24, SCR, { noEdge: true });   // 6 màn hình
        B(30.1, 3.75, 0, 0.9, 0.62, 0.42, SHELL);                                         // bệ giữa (cần ga · phanh tốc độ · flap)
        for (const l of [-0.6, 0.6]) {                                                   // ghế cơ trưởng (trái) · cơ phó (phải)
          B(29.55, UD + 0.47, l, 0.52, 0.12, 0.5, DARK); B(29.22, UD + 0.9, l, 0.1, 0.78, 0.48, DARK, { rz: 0.12 });
          B(29.55, UD + 0.22, l, 0.3, 0.38, 0.28, DARK, { noEdge: true });
          B(30.3, UD + 0.3, l, 0.08, 0.6, 0.08, SCR, { noEdge: true }); B(30.26, UD + 0.62, l, 0.06, 0.04, 0.32, SCR, { noEdge: true });   // cần lái + vô lăng
        }
        B(29.9, 5.02, 0, 0.95, 0.07, 0.95, SHELL, { rz: -0.18 });                         // bảng trần (dưới nóc, dốc theo kính)
        for (const l of [-0.5, 0.5]) { B(28.45, UD + 0.45, l, 0.45, 0.1, 0.45, DARK); B(28.25, UD + 0.8, l, 0.08, 0.6, 0.45, DARK); }   // 2 ghế quan sát
        // ── TẦNG DƯỚI: hầm hàng LD-3 (đáy 1.56 · rộng nóc 2.01 · cao 1.63 · sâu 1.53 m), container nhôm có vát ngoài ──
        const ld3 = (z, side, yf) => {
          const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.56, 0); sh.lineTo(1.56, 0.0); sh.lineTo(1.56, 0.66); sh.lineTo(2.01, 1.12); sh.lineTo(2.01, 1.63); sh.lineTo(0, 1.63); sh.lineTo(0, 0);
          const g = new THREE.ExtrudeGeometry(sh, { depth: 1.53, bevelEnabled: false });
          g.translate(0, 0, -0.765); g.rotateY(Math.PI / 2);                             // dài (sâu) theo trục thân
          if (side > 0) g.scale(1, 1, -1);                                        // ngoài vát hướng ra vỏ
          g.scale(S747, S747, S747); g.translate(gx(z), gy(yf), side * S747 * 0.03);
          IN.add(g, ULD, { thresh: 20, soft: true });
        };
        const fitsLD3 = (zc, yf) => [zc - 0.77, zc + 0.77].every(zz => skinHW(zz, yf + 0.05) - LINING >= 1.6 && skinHW(zz, yf + 0.66) - LINING >= 1.6 && skinHW(zz, yf + 1.12) - LINING >= 2.05 && skinHW(zz, yf + 1.63) - LINING >= 2.05);
        const hold = (z0, z1) => { for (let z = z0; z > z1 + 1.55; z -= 1.6) { const yf = Bm(z - 0.8) + 0.42; if (fitsLD3(z - 0.8, yf)) for (const s of [-1, 1]) ld3(z - 0.8, s, yf); B(z - 0.8, yf - 0.03, 0, 1.6, 0.06, 2 * hwAt(z - 0.8, yf) - 0.1, CREAM, { noEdge: true }); } };
        hold(21.6, 5.4); hold(-6.4, -16.2);
        for (let i = 0; i < 26; i++) { const z = -16.6 - (i % 7) * 0.5, l = ((i * 37) % 11 - 5) * 0.16, yf = Bm(z) + 0.4; B(z, yf + 0.18 + ((i * 13) % 3) * 0.12, l, 0.55, 0.3, 0.35, PAINT); }   // khoang hàng rời: vali
        const IG = IN.build({ cast: false }); IG.traverse(o => { o.userData.noFade = true; }); plane.add(IG);
        window.__interior = { group: IG, seats: N, total: N.f + N.j + N.w + N.e };
      }
      const pMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      [-1, 1].forEach(s => {                            // ống pitot 2 mạn mũi, dưới kính lái — bám đúng da (cùng hullDeform)
        const rp = rOfX(15.0), dp = hullDeform(15.0, rp * Math.sin(0.25), rp * Math.cos(0.25));
        const pb = new THREE.Vector3(15.0, FY + dp.y, s * (dp.z + 0.02));
        const bg = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6); bg.rotateZ(Math.PI / 2); bg.translate(pb.x, pb.y, pb.z); plane.add(new THREE.Mesh(bg, pMat));
        const tg = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6); tg.rotateX(Math.PI / 2); tg.translate(pb.x + 0.06, pb.y, pb.z + s * 0.03); plane.add(new THREE.Mesh(tg, pMat));
      });
      // cửa khách L1–L4: đã chuyển sang fuselageInk (khung outline ôm thân, cả 2 mạn)
      // (ĐÃ BỎ khối hộp tối "cargo bay cavity" — nó là hộp 1.3×1.0×1.2 lửng bên trong thân, lộ ra qua
      //  da trong suốt thành tấm đen chữ nhật lệch hẳn khỏi miệng khoang. Thay bằng mặt tô đen đúng
      //  biên cửa khoang, dựng trong fuselageInk.)
      // cửa hầm hàng sau + bulk cargo: đã chuyển sang fuselageInk (outline mạn phải)
      pb.P(0.3, 0.25, 0.05, 5.5, FY + topY(5.5) + 0.1, 0, WHITE, {});                  // ăng-ten (đứng trên lưng bướu)
      // ═══ ĐÈN NGOÀI (G 13/10): CHỚP ĐỎ CHỐNG VA CHẠM (beacon) trên lưng + dưới bụng — bật NGAY TRƯỚC khi nổ máy, chớp suốt lúc máy
      // còn quay (IATA, CAA UK: người & xe phải tránh miệng hút / luồng xả khi đèn này bật · FAR 25.1401: 40–100 chớp/phút ⇒ 51,
      // 2 đèn so le) · ĐÈN HÀNG HẢI luôn sáng khi máy bay có điện: ĐỎ mút cánh TRÁI (−z) · XANH mút cánh PHẢI · TRẮNG hướng sau ở 2 mút ═══
      {
        const glowTex = (() => {
          const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
          const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
        })();
        const lamp = (x, y, z, col, r, glow, on) => {
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); m.userData.noFade = true;
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: on ? 0.9 : 0 }));
          sp.scale.setScalar(glow); sp.position.set(x, y, z); sp.userData.noFade = true; sp.renderOrder = 6;
          plane.add(m, sp); return { m, sp, col: new THREE.Color(col) };
        };
        const beacons = [lamp(gx(0.0), FY + topY(gx(0.0)) + 0.045, 0, 0xff1a10, 0.05, 1.3, false),        // lưng (trên hộp cánh)
          lamp(gx(16.0), gy(-2.084) - 0.045, 0, 0xff1a10, 0.05, 1.3, false)];                              // bụng (trước bụng cánh)
        const sT = S747 * 34.37, yT = sT - WROOT, xL = wingAt(WING_LE, yT), xR = wingAt(WING_TE, yT), yW = wingMidY(sT);
        for (const sg of [-1, 1]) {
          lamp(xL - 0.06, yW, sg * (sT + 0.02), sg < 0 ? 0xff2a1a : 0x1aff5a, 0.035, 0.75, true);           // đỏ trái · xanh phải
          lamp(xR + 0.03, yW, sg * (sT - 0.02), 0xfff6e0, 0.03, 0.55, true);                                // trắng hướng sau
        }
        plane.userData.lights = { beacons };
        for (const b of beacons) b.m.material.color.copy(b.col).multiplyScalar(0.3);
      }
      plane.add(pb.build());
      plane.add(eb.build({ cast: false }));
      // càng đặc (lốp không nhìn xuyên lốp) · mỗi rig: nhóm TRỤ quay ở trunnion T; BOGIE con của trụ (chốt TP); khâu trên giằng
      // quay ở điểm treo W (con của máy bay); khâu dưới + thanh khoá đoạn 2 con của trụ; thanh khoá đoạn 1 con của khâu trên (gối K).
      // Mỗi nhóm đặt ở chốt của nó, lưới lùi về −chốt ⇒ lúc nghỉ trùng khít hình dựng ban đầu. Động học: flight/20-gear-rig.
      plane.userData.gear = GEAR_RIG.map((r) => {
        const mk = (name, piv, parent) => {
          const g = new THREE.Group(); g.userData.piv = piv.clone(); g.position.copy(piv); if (parent) g.position.sub(parent.userData.piv);
          const b = r.part[name];
          if (b) { const m = b.build(); m.traverse(o => { o.userData.noFade = true; }); m.position.copy(piv).negate(); g.add(m); }
          (parent || plane).add(g); return g;
        };
        const p = r.pin, strut = mk('strut', p.T), up = mk('up', p.W);
        const G = { strut, up, truck: r.part.truck ? mk('truck', p.TP, strut) : null, lo: mk('lo', p.S, strut), k1: mk('k1', p.K, up), k2: mk('k2', p.L, strut) };
        G.flag = r.part.flag ? mk('flag', p.K, up) : null;
        G.steer = r.part.steer ? mk('steer', p.SG, strut) : null;                              // càng mũi: phần bẻ lái quay quanh trục đứng của trụ
        G.wheels = r.wheels.map((w) => mk(w.name, w.c, G.steer || G.truck || strut));          // bánh lăn: quay quanh trục z của nhóm
        if (r.kind === 'body' && G.truck) G.truck.rotation.order = 'YZX';                      // bogie càng thân: bẻ lái (y) rồi mới nghiêng (z)
        G.doors = (r.doors || []).map((d) => { const g = new THREE.Group(); g.position.copy(d.H); const m = d.bag.build(); m.position.copy(d.H).negate(); g.add(m); plane.add(g); return { g, s: d.s }; });
        return { kind: r.kind, u: r.u, axis: r.axis, pin: p, g: G, J: p.J.clone() };
      });
      makeTransparent(plane, 0.75);
    })();
    plane.updateMatrixWorld(true);
    const lw = (x, y, z) => plane.localToWorld(new THREE.Vector3(x, y, z));           // helper local→world
    // ỐNG / CÁP NẰM SÂN: spline qua các điểm neo cách xa nhau VÕNG XUỐNG DƯỚI mặt sân (y 0.12) giữa 2 điểm neo (ống PCA
    // chìm 0.3, cáp GPU chìm 0.08 — hiện thành ống đứt khúc, đầu nhọn cắm xuống đất) ⇒ lấy mẫu đều theo cung, kẹp tâm ống
    // ≥ mặt sân + bán kính, dựng lại spline từ mẫu đã kẹp: đoạn chạm đất nằm SÁT mặt sân, liền một mạch.
    function onGround(pts, r, n = 240) {
      const yMin = 0.12 + r + 0.002;
      const sp = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getSpacedPoints(n);
      for (const p of sp) if (p.y < yMin) p.y = yMin;
      return new THREE.CatmullRomCurve3(sp, false, 'centripetal');
    }

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

    /* ═══ 05-apron — thiết bị mặt sân quanh máy bay: cọc tiêu · chèn bánh · cột đèn pha · bảng dẫn đỗ VDGS ═══ */
    let APRON_RM = null;                                                              // cọc tiêu + chèn bánh (gỡ trước khi đẩy lùi)
    const CREW = {};                                                                  // người trên sân (sprite tải sau)
    (function apronKit() {
      const ab = Bag(), rmb = Bag();
      // cọc tiêu cam + đai phản quang trắng: trước cửa hút 2 động cơ cánh TRÁI · đuôi · mũi (lệch trái, tránh cáp GPU).
      // G bỏ (05/10): 2 cọc mút cánh + 2 cọc trước động cơ cánh phải.
      const cone = (p) => {
        rmb.P(0.25, 0.025, 0.25, p.x, VY + 0.0125, p.z, DARK, { soft: true });                 // cỡ thật: cao 0.75 m (bản trước 1.2 m)
        rmb.C(0.1, 0.35, p.x, VY + 0.2, p.z, ORANGE_GLOW, { r2: 0.02, seg: 10 });
        rmb.C(0.066, 0.062, p.x, VY + 0.236, p.z, WHITE, { r2: 0.055, seg: 10, noEdge: true });
      };
      for (const s of ENG_SPANS) cone(lw(engX(s) + 2.85, 0, -s));                       // trước cửa hút 2 động cơ cánh trái (bám vị trí động cơ)
      cone(lw(-18.6, 0, 0)); cone(lw(19.6, 0, -1.4));
      // chèn bánh: trước + sau 2 bánh mũi · trước cặp bánh đầu của 2 càng cánh (tì sát mặt lốp)
      const chock = (lx, lz) => { const p = lw(lx, 0, lz); rmb.P(0.2, 0.15, 0.3, p.x, VY + 0.075, p.z, DARK, { ry: PROT, soft: true }); };
      for (const wz of [-0.2, 0.2]) for (const lx of [NG_X + NTIRE_R + 0.09, NG_X - NTIRE_R - 0.09]) chock(lx, wz);
      for (const s of [-1, 1]) for (const wz of [-0.48 * BOGIE_GS, 0.48 * BOGIE_GS]) chock(WG_X + 0.63 * BOGIE_GS + TIRE_R + 0.09, s * WG_Z + wz);

      // cột đèn pha cao 16 ở mép xa sân đỗ: móng · trụ côn · sàn công tác · giàn 2×4 pha chúc về tâm khu đỗ · đèn báo không
      for (const [mx, mz] of [[-36, -44.6], [10, -44.6]]) {
        const H = 16, hd = Math.atan2(mz, -12 - mx), c = Math.cos(hd), sn = Math.sin(hd);
        const at = (lx, lz) => [mx + lx * c + lz * sn, mz - lx * sn + lz * c];
        ab.C(0.8, 0.36, mx, 0.18, mz, CREAM, { seg: 12 });
        ab.C(0.34, H, mx, 0.36 + H / 2, mz, MID, { r2: 0.16, seg: 12 });
        ab.C(0.75, 0.08, mx, H - 0.3, mz, MID, { seg: 12, soft: true });
        const [bx, bz] = at(0.3, 0); ab.P(0.24, 0.24, 3.4, bx, H + 0.55, bz, MID, { ry: hd, soft: true });
        for (const lz of [-1.25, -0.42, 0.42, 1.25]) for (const ly of [0.2, 0.86]) {
          const [qx, qz] = at(0.62, lz), [gx, gz] = at(0.62 + 0.18 * Math.cos(0.55), lz);
          ab.P(0.34, 0.46, 0.62, qx, H + 0.2 + ly, qz, CREAM, { rz: -0.55, ry: hd });
          ab.P(0.03, 0.38, 0.54, gx, H + 0.2 + ly - 0.18 * Math.sin(0.55), gz, GLASS, { rz: -0.55, ry: hd, noEdge: true });
        }
        ab.C(0.09, 0.16, mx, H + 1.4, mz, 0x8a0303, { seg: 8 });
      }

      // bảng dẫn đỗ VDGS trên trụ trước mũi (vạch dừng + 9.5): +x local quay VỀ buồng lái
      {
        const t = 31, vx = PPOS.x + PDIR.x * t, vz = PPOS.z + PDIR.z * t, hd = Math.atan2(PDIR.z, -PDIR.x);
        const c = Math.cos(hd), sn = Math.sin(hd), at = (lx) => [vx + lx * c, vz - lx * sn];
        ab.C(0.42, 0.2, vx, VY + 0.1, vz, CREAM, { seg: 10 });
        ab.C(0.13, 4.9, vx, VY + 2.65, vz, MID, { seg: 10 });
        ab.P(0.46, 1.3, 1.05, vx, VY + 5.6, vz, CREAM, { ry: hd });
        const [hx, hz] = at(0.12); ab.P(0.7, 0.06, 1.15, hx, VY + 6.28, hz, WHITE, { ry: hd, soft: true });   // mái che màn hình
        const [sx, sz] = at(0.24); ab.P(0.03, 1.0, 0.82, sx, VY + 5.58, sz, GLASS, { ry: hd, noEdge: true });  // màn hình
        const [ax, az] = at(0.26);
        for (let i = 0; i < 3; i++) ab.P(0.02, 0.07, 0.46 - i * 0.12, ax, VY + 5.3 + i * 0.16, az, ORANGE_GLOW, { ry: hd, noEdge: true });  // vạch dẫn
      }
      scene.add(ab.build());
      APRON_RM = rmb.build(); scene.add(APRON_RM);
    })();

    // 🧍 NHÂN VIÊN VẬN HÀNH 1 (Human Worker 1 at x: -1.10, z: 12.45)
    (function addHumanWorkers() {
      const texLoader = new THREE.TextureLoader();
      texLoader.load('https://static.wixstatic.com/media/1ded0e_9cf5b8a0b940487ba5a322e3bb1171a3~mv2.png', (texture) => {
        texture.anisotropy = 4;
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1 });
        const human = new THREE.Sprite(mat);
        human.scale.set(0.692, 1.029, 1.0);  // cỡ thật: người cao nhất trong ảnh (88.6% chiều cao sprite) = 1.83 m kể cả mũ — bản trước 2.64 m
        human.position.set(-1.10, VY + 1.029 * (0.5 - 0.056), 12.45);   // chân ở 5.6% đáy ảnh ⇒ hạ tâm cho chân chạm sân
        scene.add(human); CREW.h1 = human;
      });

      // 🧍‍♂️ NHÂN VIÊN VẬN HÀNH 2 (Human Worker 2 - Thu nhỏ thêm 5%)
      texLoader.load('https://static.wixstatic.com/media/1ded0e_94e5922df4d44258bf16d9fe244c0795~mv2.png', (texture2) => {
        texture2.anisotropy = 4;
        const mat2 = new THREE.SpriteMaterial({ map: texture2, transparent: true, alphaTest: 0.1 });
        const human2 = new THREE.Sprite(mat2);
        human2.scale.set(0.673, 1.0, 1.0);    // cỡ thật: đỉnh mũ ở 91% ảnh (tay giơ cao hơn) = 1.83 m — bản trước 2.03 m
        human2.position.set(-12.94, VY + 0.497, -11.08); // Chân chạm sát mặt sàn
        scene.add(human2); CREW.h2 = human2;
      });

      // 🧍‍♂️ NHÂN VIÊN VẬN HÀNH 3 (Human Worker 3 - Thu nhỏ thêm 5%)
      texLoader.load('https://static.wixstatic.com/media/1ded0e_c00966bf2ab74cf28c2634968f604028~mv2.png', (texture3) => {
        texture3.anisotropy = 4;
        const mat3 = new THREE.SpriteMaterial({ map: texture3, transparent: true, alphaTest: 0.1 });
        const human3 = new THREE.Sprite(mat3);
        human3.scale.set(0.547, 0.813, 1.0);  // cỡ thật: người NGỒI XỔM cao 1.15 m (70% ảnh) — bản trước 1.49 m
        human3.position.set(-18.89, VY + 0.407, -2.40); // ngồi xổm sát sau bánh sau càng thân (cách lốp ≈ 0.7 m) — G 11/10
        scene.add(human3); CREW.h3 = human3;
      });
    })();

    /* ═══ 07-labels — tái dùng addLabel World Kit (mặc định ẩn cho khung hình sạch) ═══ */
    const labelGroup = new THREE.Group(); labelGroup.visible = true; scene.add(labelGroup);
    function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function addLabel(text, dot, pos, to, url, scaleMult = 1.0) {
      const lines = text.split('\n');
      const c = document.createElement('canvas'), mm = c.getContext('2d'), f = '600 46px Inter, system-ui, Arial'; mm.font = f;
      const tw = Math.max(...lines.map(l => mm.measureText(l).width)), pad = 92;
      const h = lines.length > 1 ? 148 : 108; c.width = Math.ceil(tw + pad + 40); c.height = h; const x = c.getContext('2d'); x.font = f;
      rr(x, 3, 3, c.width - 6, h - 6, 40); x.fillStyle = 'rgba(250,248,242,0.5)'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(75,74,70,0.5)'; x.stroke();
      x.beginPath(); x.arc(54, h / 2, 16, 0, 7); x.fillStyle = dot; x.fill(); x.fillStyle = '#000'; x.textBaseline = 'middle';
      if (lines.length > 1) {
        x.fillText(lines[0], pad, h / 2 - 22);
        x.fillText(lines[1], pad, h / 2 + 28);
      } else {
        x.fillText(text, pad, h / 2 + 2);
      }
      const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
      sp.renderOrder = 20; const k = 0.052 * scaleMult; sp.scale.set(c.width * k, h * k, 1); sp.position.copy(pos);
      if (url) sp.userData = { url };
      labelGroup.add(sp);
      const lg = new THREE.BufferGeometry().setFromPoints([pos.clone().add(new THREE.Vector3(0, -h * k * 0.5, 0)), to]);
      const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x3a3530, transparent: true, opacity: 0.5, depthTest: false })); ln.renderOrder = 19; labelGroup.add(ln);
      return [sp, ln];
    }
    addLabel('Nhà ga hành khách', '#5a8f7b', new THREE.Vector3(70, 52, -6), new THREE.Vector3(70, 10.6, -6));
    const FUEL_LABEL = addLabel('Jet Fuel 60,000 - 200,000 lít/lần', '#0099ff', new THREE.Vector3(-5, 22.25, -16), new THREE.Vector3(-5, 1.75, -16), null, 0.5);
    // nhãn động cơ bám máy bay khi đẩy lùi: nhóm riêng, ma trận = máy bay hiện tại × nghịch đảo lúc đỗ (19b-departure)
    const ENG_LABEL = new THREE.Group(); ENG_LABEL.matrixAutoUpdate = false; labelGroup.add(ENG_LABEL);
    ENG_LABEL.add(...addLabel('Jet Engine (YouTube)', '#ff5500', lw(engX(ENG_SPANS[1]), 16.5, ENG_SPANS[1]), lw(engX(ENG_SPANS[1]), engY(ENG_SPANS[1]) + 0.35, ENG_SPANS[1]), 'https://www.youtube.com/watch?v=QtxVdC7pBQM', 0.45));

    /* ═══ KÍCH HOẠT 4 ĐỘNG CƠ (x6 Speed, Fiery Combustion Glow & Wind Intake/Out Simulation) ═══ */
    let isEngineIgnited = false;
    window.isEngineIgnited = isEngineIgnited;
    let engineSpeedMult = 1.0;
    const wingK = { kr: 0, flap: 0, f30: 0, sp: 0 };               // độ mở Krueger / flap (0 thu · 1 cất cánh 20°) · f30: thêm tới 30° (hạ cánh) · spoiler
    let combGlowVal = 0.7;
    let windGlowVal = 0.0;
    const engineButton = document.getElementById('btnIgnite');

    // ── TRỤC QUAY từng máy (G 11/10 khuya): khởi động như thật, nén thời gian — máy khởi động khí nén quay N2 → bắt lửa ở
    // ~20 % N2 (phụt) → tự tăng tốc lên chạy không tải (N2 68 % · N1 22 %) → giữ 1.5 s → tăng ga cất cánh (N1 ~98 %, ~4 s).
    // 4 máy bắt đầu lệch nhau 0.45 s và N1 lệch vài phần nghìn (tone quạt "đập" như máy bay 4 động cơ thật).
    // Tắt máy: cắt nhiên liệu, rô-to quay chậm dần (N2 τ 5 s, quạt quán tính lớn τ 6 s). Quạt, gió, âm thanh đều theo N1 này.
    const SPOOL = [0, 1, 2, 3].map(e => ({ n1: 0, n2: 0, lit: false, starter: false, t: 0, dwell: 0, whumps: 0, delay: e * 0.45, dN: [-0.0042, -0.0013, 0.0016, 0.004][e] }));
    // idle true: chuỗi khởi hành/bay — không hầm gió, máy dừng ở KHÔNG TẢI trừ khi n2 (mục tiêu N2, 21-flight đặt theo cần ga) khác null
    const ENG_MODE = { idle: false, n2: null };
    const n2For = (n1) => n1 <= 0.22 ? 0.68 : 0.68 + (n1 - 0.22) * (0.285 / 0.76);   // nghịch đảo n1Of (từ không tải trở lên)
    const n1Of = (n2) => n2 < 0.68 ? 0.22 * Math.pow(Math.max(0, n2) / 0.68, 2.2) : 0.22 + (n2 - 0.68) * (0.76 / 0.285);
    function spoolStep(dt) {
      for (const s of SPOOL) {
        if (isEngineIgnited) {
          s.t += dt;
          if (s.t >= s.delay) {
            if (!s.lit) { if (s.n2 < 0.2) { s.starter = true; s.n2 += 0.075 * dt; } else { s.lit = true; s.whumps++; } }
            if (s.lit) {
              const tgt = ENG_MODE.n2 !== null ? ENG_MODE.n2 + s.dN * 0.5 : (s.dwell < 1.5 || ENG_MODE.idle) ? 0.68 : 0.965 + s.dN;
              s.n2 += (tgt - s.n2) * (1 - Math.exp(-dt / 1.45));
              if (s.n2 > 0.5) s.starter = false;                           // máy khởi động ngắt ở ~50 % N2
              if (s.n2 > 0.655) s.dwell += dt;
            }
          }
        } else { s.t = 0; s.dwell = 0; s.lit = false; s.starter = false; s.n2 *= Math.exp(-dt / 5); }
        s.n1 += (n1Of(s.n2) - s.n1) * (1 - Math.exp(-dt / (isEngineIgnited ? 0.8 : 6)));
      }
    }
    window.__spool = SPOOL;
    // ── ÂM THANH (js/engine-audio.js, tải khi bấm Engine lần đầu; AudioContext tạo ngay trong cú bấm để Safari/iOS cho phát) ──
    let engAudio = null, audioCtx = null, soundMuted = false;
    try { soundMuted = localStorage.getItem('gateA1.mute') === '1'; } catch (e) { }
    const soundButton = document.getElementById('btnSound');
    const syncSound = () => { if (soundButton) { soundButton.innerHTML = '<i class="ti ti-volume' + (soundMuted ? '-off' : '') + '"></i>'; soundButton.setAttribute('aria-pressed', String(!soundMuted)); } };
    function ensureAudio() {
      if (audioCtx) { if (audioCtx.state === 'suspended' && !document.hidden) audioCtx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      audioCtx = new AC(); audioCtx.resume();
      const sc = document.createElement('script'); sc.src = 'js/engine-audio.js?v=' + APP_V;
      sc.onload = () => { try { engAudio = window.createEngineAudio(audioCtx); engAudio.setMuted(soundMuted); } catch (e) { console.warn('âm thanh động cơ:', e); } };
      document.head.appendChild(sc);
    }
    if (soundButton) soundButton.addEventListener('click', () => { soundMuted = !soundMuted; try { localStorage.setItem('gateA1.mute', soundMuted ? '1' : '0'); } catch (e) { } syncSound(); ensureAudio(); if (engAudio) engAudio.setMuted(soundMuted); });
    syncSound();
    document.addEventListener('visibilitychange', () => { if (!audioCtx) return; if (document.hidden) audioCtx.suspend(); else audioCtx.resume(); });
    const _aV = new THREE.Vector3(), _aF = new THREE.Vector3(), _aQ = new THREE.Quaternion(), _aP = new THREE.Vector3();

    function toggleEngineIgnition() {
      ensureAudio();
      isEngineIgnited = !isEngineIgnited;
      window.isEngineIgnited = isEngineIgnited;
      for (const mat of allCombMats) mat.color.setHex(isEngineIgnited ? 0xff3300 : 0x757676);
      for (const mat of allFuelRingMats) mat.color.setHex(isEngineIgnited ? 0xff1100 : 0x606060);
      if (engineButton) {
        engineButton.innerHTML = isEngineIgnited ? "<i class='ti ti-bolt'></i> Engine (On)" : "<i class='ti ti-flame'></i> Engine";
        engineButton.style.background = isEngineIgnited ? "linear-gradient(135deg, #ff0000, #ff5500)" : "linear-gradient(135deg, #ff4500, #ff8c00)";
        engineButton.setAttribute('aria-pressed', String(isEngineIgnited));
      }
    }
    window.toggleEngineIgnition = toggleEngineIgnition;
    if (engineButton) engineButton.addEventListener('click', toggleEngineIgnition);

    /* ═══ 00-engine/camera — orbit + wheel zoom + WASD pan (Default Full Land Size View) · trên trời: khoá khung, chỉ xoay ═══ */
    let theta = 0.42, phi = 0.9, tTheta = theta, tPhi = phi, radius = 420, autoRotate = false;
    const target = new THREE.Vector3(12, 0, 6); camera.zoom = 0.58;
    const keys = {};
    // G 15/10 "fix screen" — CHỈ khi máy bay đang TRÊN TRỜI (cảnh sky): khoá khung — không zoom (lăn chuột để trang nhúng Wix cuộn
    // bình thường), không kéo chuột phải, không WASD; chỉ CHUỘT TRÁI (một ngón trên cảm ứng) để xoay. Sân đỗ / đường băng: như cũ.
    const skyLock = () => FLT.set === 'sky';
    window.addEventListener('keydown', e => { if (!skyLock() && ['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) { keys[e.key.toLowerCase()] = true; FLT.tgtT = null; } });
    window.addEventListener('keyup', e => { if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
    const dom = renderer.domElement; let drag = false, panDrag = false, lx = 0, ly = 0; dom.style.touchAction = 'none';
    dom.addEventListener('contextmenu', e => e.preventDefault());                     // chuột phải dành cho kéo pan

    // Raycaster cho nhãn liên kết click & tính tọa độ 3D mặt đất
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();

    // Tạo thẻ HUD hiển thị Tọa độ 3D & Footer "Michael Tran" dạng ĐƠN GIẢN (Middle Footer Position)
    const coordHud = document.createElement('div');
    coordHud.id = 'coordHud';
    coordHud.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:999;background:none;color:#222222;font-family:"SF Mono",ui-monospace,monospace;font-size:14px;font-weight:600;pointer-events:none;letter-spacing:0.5px;text-shadow:0 1px 2px rgba(255,255,255,0.8);white-space:nowrap;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;';
    coordHud.innerHTML = '<span id="coordVal">X: 0.00, Y: 0.00, Z: 0.00</span><span style="font-size:12px;font-weight:700;color:#5a4738;letter-spacing:1.2px;text-transform:uppercase;">Michael Tran</span>';
    document.body.appendChild(coordHud);

    dom.addEventListener('pointerdown', e => { if (skyLock() && e.button !== 0) return; panDrag = e.button === 2; drag = !panDrag; if (panDrag) FLT.tgtT = null; autoRotate = false; syncBtn(); lx = e.clientX; ly = e.clientY; dom.setPointerCapture && dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => {
      if (drag) {
        tTheta -= (e.clientX - lx) * 0.005; tPhi -= (e.clientY - ly) * 0.005; tPhi = Math.max(0.2, Math.min(1.4, tPhi)); lx = e.clientX; ly = e.clientY;
      } else if (panDrag) {
        // pan: k = đơn vị world / 1 px màn hình (camera ortho). Ngang → dọc trục "phải" của camera trên mặt sân;
        // dọc → dọc hướng nhìn chiếu xuống mặt sân, chia cos φ vì mặt sân bị nhìn xiên (co ngắn theo chiều dọc màn hình)
        const k = (camera.right - camera.left) / camera.zoom / Math.max(1, W());
        const dx = (e.clientX - lx) * k, dy = (e.clientY - ly) * k / Math.cos(phi);
        target.x -= Math.cos(theta) * dx + Math.sin(theta) * dy;
        target.z -= -Math.sin(theta) * dx + Math.cos(theta) * dy;
        lx = e.clientX; ly = e.clientY;
      }
      const rect = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Rò tọa độ 3D chạm mặt sàn y=0 (Raycast onto ground plane)
      if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
        const el = document.getElementById('coordVal');
        if (el) el.innerHTML = `X: ${intersectPoint.x.toFixed(2)}, Y: ${intersectPoint.y.toFixed(2)}, Z: ${intersectPoint.z.toFixed(2)}`;
      }

      if (labelGroup.visible) {
        const intersects = raycaster.intersectObjects(labelGroup.children);
        let hoverLink = false;
        for (let i = 0; i < intersects.length; i++) {
          if (intersects[i].object.isSprite && intersects[i].object.userData.url) { hoverLink = true; break; }
        }
        dom.style.cursor = hoverLink ? 'pointer' : (drag || panDrag ? 'grabbing' : 'default');
      } else {
        dom.style.cursor = drag || panDrag ? 'grabbing' : 'default';
      }
    });
    dom.addEventListener('click', e => {
      if (!labelGroup.visible) return;
      const rect = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(labelGroup.children);
      for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.isSprite && intersects[i].object.userData.url) {
          window.open(intersects[i].object.userData.url, '_blank');
          break;
        }
      }
    });

    window.addEventListener('pointerup', () => { drag = false; panDrag = false; });
    dom.addEventListener('wheel', e => { if (skyLock()) return; e.preventDefault(); FLT.zoomT = 0; camera.zoom *= (e.deltaY > 0 ? 0.92 : 1.08); camera.zoom = Math.max(0.1, Math.min(10, camera.zoom)); camera.updateProjectionMatrix(); }, { passive: false });
    const bR = document.getElementById('btnRotate'), bL = document.getElementById('btnLabels'), bRe = document.getElementById('btnReset');
    function syncBtn() { if (bR) bR.innerHTML = '<i class="ti ti-player-' + (autoRotate ? 'pause' : 'play') + '"></i>Tự xoay'; }
    if (bR) bR.addEventListener('click', () => { autoRotate = !autoRotate; syncBtn(); });
    if (bL) bL.addEventListener('click', () => {
      labelGroup.visible = !labelGroup.visible;
      bL.innerHTML = '<i class="ti ti-' + (labelGroup.visible ? 'tag' : 'tag-off') + '"></i>Nhãn';
    });
    if (bRe) bRe.addEventListener('click', () => { tTheta = 0.42; tPhi = 0.9; camera.zoom = 0.58; target.set(12, 0, 6); camera.updateProjectionMatrix(); autoRotate = false; syncBtn(); });

    // ĐỘ PHÂN GIẢI VẼ (G 16/10 "giảm độ phân giải cho nhẹ"): bộ đệm khung hình của WebGPU tốn ~88 B / điểm ảnh (khung HDR 16-bit
    // MSAA 4× + độ sâu MSAA + bản giải + khung canvas MSAA — đo bằng footprint tiến trình GPU: thu khung 13.3 → 1.9 triệu điểm ảnh
    // giải phóng ~1 GB). Vẽ đủ Retina 2097×1583 × 2 = 13.3 triệu điểm ảnh ⇒ ~1.15 GB RAM. Giới hạn ~4 triệu điểm ảnh ⇒ ~350 MB;
    // tỉ lệ điểm ảnh trong [0.75, 2] (khung nhỏ vẫn đủ Retina), khử răng cưa 4× giữ cạnh mịn.
    const MAX_PX = 4.0e6;
    function resize() {
      const w = W(), h = Hv();
      if (!w || !h) return;
      const pr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PX / (w * h))));
      if (Math.abs(renderer.getPixelRatio() - pr) > 1e-3) renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      const a = w / h, d = 46;
      camera.left = -d * a; camera.right = d * a; camera.top = d; camera.bottom = -d;
      camera.updateProjectionMatrix();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    window.__info = () => ({ calls: renderer.info.render.drawCalls, tris: renderer.info.render.triangles });
    // debug: đặt góc nhìn từ console — __view({theta, phi, zoom, target:[x,y,z]})
    window.__view = (o = {}) => { if (o.theta !== undefined) tTheta = theta = o.theta; if (o.phi !== undefined) tPhi = phi = o.phi; if (o.zoom) { camera.zoom = o.zoom; camera.updateProjectionMatrix(); } if (o.target) target.set(o.target[0], o.target[1], o.target[2]); autoRotate = false; syncBtn(); };
    /* ═══ 08-departure — CHUỖI KHỞI HÀNH Ở CỔNG (G 14/10, bước 1 kế hoạch "cất cánh – bay – hạ cánh") ═══
       Đúng thứ tự thật (IATA / CAA UK: người & xe phải tránh xa miệng hút, luồng xả khi đèn chớp bật; máy được nổ trong lúc đẩy lùi):
       1 rút ống lồng, tháo ống gió điều hoà PCA + cáp điện GPU → 2 xe phục vụ rời đi (xe nâng hạ sàn, xe tra & xe bồn rút khỏi cánh)
       → 3 xe kéo không càng (towbarless) lùi vào ôm càng mũi, gỡ chèn bánh + cọc tiêu → 4 bật đèn chớp đỏ, bắt đầu đẩy lùi
       → 5 nổ lần lượt 4 máy, dừng ở KHÔNG TẢI (N1 ≈ 22 %, không dựng hầm gió) → 6 xe kéo tách, đặt cánh tà → sẵn sàng lăn bánh.
       ĐẨY LÙI = động học xe 2 trục: trục sau = tâm 4 càng chính, trục lái = càng mũi (chiều dài cơ sở ≈ 29.7 m như Boeing);
       lùi thẳng ~24 m → bánh mũi bẻ 50° quay đủ 90° → lùi thêm ~6 m. Đã thử bằng mô phỏng: mút cánh, mũi, đuôi cách mép sân,
       cột đèn, cụm container ≥ 5.8 m suốt đường lùi. Thời gian nén ~2× (xe kéo thật ~3–5 km/h). "Về cổng" đặt lại mọi thứ. */
    const DEP = { active: false, t: 0, beacon: false, flaps: false, loader: null, hideTrain: false, step: -1 };
    const depBtn = document.getElementById('btnDepart'), depCap = document.getElementById('depCap');
    const WSC = S747 * 1.1;                                                            // world / mét
    const NGX_W = NG_X * 1.1, MX_W = (WG_X + BG_X) / 2 * 1.1, LW_W = NGX_W - MX_W;     // càng mũi · tâm càng chính (dọc thân, world)
    const fwd = (psi) => [Math.cos(psi), -Math.sin(psi)];                               // trục dọc thân trong mặt sân (x, z)
    const ease = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
    const win = (t, a, b) => ease((t - a) / (b - a));
    const vis = (arr, on) => { for (const o of arr) if (o) o.visible = on; };

    // XE KÉO ĐẨY LÙI KHÔNG CÀNG cỡ máy thân rộng (kiểu Goldhofer AST-1 / Douglas TBL): dài 8 · rộng 3.6 · cabin thấp lệch trái.
    // Hệ dựng (mét): gốc = tâm NÔI ôm bánh mũi trên mặt sân, +x hướng ra xa máy bay; 2 càng nôi hở giữa 2.1 m cho cặp bánh mũi.
    const pushTug = (() => {
      const b = Bag();
      for (const s of [-1, 1]) {
        b.P(2.8, 0.75, 0.75, -0.1, 0.65, s * 1.42, MID, {});                         // 2 càng nôi (x −1.5 … 1.3)
        b.P(0.9, 0.35, 0.18, -0.95, 0.45, s * 0.98, DARK, {});                       // tay kẹp lốp
        b.P(5.0, 0.12, 0.05, 3.9, 0.95, s * 1.82, PAINT, { noEdge: true });          // sọc sơn hông
      }
      b.P(5.2, 0.9, 3.6, 3.9, 0.75, 0, MID, {});                                     // thân trước đặc (x 1.3 … 6.5)
      b.P(5.0, 0.12, 3.4, 3.9, 1.26, 0, CREAM, { soft: true });                       // nắp máy
      b.P(1.6, 0.08, 2.1, -0.1, 0.12, 0, DARK, { soft: true });                       // sàn nôi (bánh mũi lăn lên)
      b.P(0.25, 0.7, 2.1, 1.25, 0.6, 0, DARK, {});                                    // tấm chặn trước nôi
      b.P(1.7, 1.15, 1.6, 4.9, 1.85, -0.9, CREAM, {});                                // cabin
      b.P(1.74, 0.1, 1.64, 4.9, 2.47, -0.9, WHITE, { soft: true });
      b.P(0.05, 0.6, 1.3, 5.76, 1.95, -0.9, GLASS, { noEdge: true });
      b.P(1.2, 0.6, 0.05, 4.9, 1.95, -1.71, GLASS, { noEdge: true });
      b.C(0.09, 0.14, 4.9, 2.6, -0.9, ORANGE_GLOW, { seg: 8 });                       // đèn hiệu cam
      for (const [x, s] of [[0.2, -1], [0.2, 1], [5.4, -1], [5.4, 1]]) stdWheel(b, x, s * 1.62, 0.55, s);
      const g = b.build(); g.scale.setScalar(WSC); g.visible = false; scene.add(g); return g;
    })();

    const home = { pos: plane.position.clone(), rot: plane.rotation.y, inv: new THREE.Matrix4().compose(plane.position, plane.quaternion, plane.scale).invert() };
    const LEFT0 = [-Math.sin(home.rot), -Math.cos(home.rot)], RIGHT0 = [Math.sin(home.rot), Math.cos(home.rot)];   // ngang thân (trái = −z)
    const gseHome = new Map();
    const remember = (o) => { if (o && !gseHome.has(o)) gseHome.set(o, { p: o.position.clone(), v: o.visible, ry: o.rotation.y }); };
    const move = (o, dir, d) => { const h = gseHome.get(o); if (h) o.position.set(h.p.x + dir[0] * d, h.p.y, h.p.z + dir[1] * d); };
    const mainOf = () => { const [cx, cz] = fwd(plane.rotation.y); return [plane.position.x + MX_W * cx, plane.position.z + MX_W * cz]; };
    const noseOf = () => { const [cx, cz] = fwd(plane.rotation.y); return [plane.position.x + NGX_W * cx, plane.position.z + NGX_W * cz]; };
    function setPlanePose(M, psi) { const [cx, cz] = fwd(psi); plane.position.x = M[0] - MX_W * cx; plane.position.z = M[1] - MX_W * cz; plane.rotation.y = psi; }

    // lùi thẳng 4 → bẻ bánh mũi −60° quay 90° → lùi thêm 2. Mô phỏng (Python, đúng động học này): đầu cánh trái cách mép slab x −60
    // ≥ 6 world (~12 m); bản d1 12 / −50° thò cánh ra ngoài slab 6,5 world
    const PUSH = { d1: 4, d3: 2, dMax: -60 * Math.PI / 180, vMax: 1.25 };            // world · rad (bánh mũi) · world/s (~2.5 m/s)
    const push = { phase: 0, s: 0, s3: 0, turned: 0, delta: 0, v: 0, t: 0, stopT: -1 };
    function pushStep(dt) {
      const P = push; P.t += dt;
      if (P.phase === 1 && P.s >= PUSH.d1) P.phase = 2;
      if (P.phase === 2 && Math.abs(P.turned) >= Math.PI / 2 - 0.02) { P.phase = 3; P.s3 = 0; }
      P.delta += Math.max(-0.44 * dt, Math.min(0.44 * dt, (P.phase === 2 ? PUSH.dMax : 0) - P.delta));   // bánh mũi bẻ ≤ 25°/s
      let vT = PUSH.vMax * Math.min(1, P.t / 2);
      if (P.phase === 3) { const left = PUSH.d3 - P.s3; vT = left > 0 ? Math.min(vT, Math.max(0.15, left * 0.6)) : 0; if (left <= 0 && Math.abs(P.delta) < 0.02) P.phase = 4; }
      P.v += (vT - P.v) * Math.min(1, dt * 2.5);
      let psi = plane.rotation.y, M = mainOf();
      const v = -P.v, [cx, cz] = fwd(psi);                                            // lùi: vận tốc âm dọc thân
      M = [M[0] + v * cx * dt, M[1] + v * cz * dt];
      const dpsi = (v / LW_W) * Math.tan(P.delta) * dt; psi += dpsi; P.turned += dpsi;
      P.s += P.v * dt; if (P.phase === 3) P.s3 += P.v * dt;
      setPlanePose(M, psi); STEER.nose = P.delta; STEER.live = true;                 // bánh mũi nằm trong nôi xe kéo ⇒ bẻ đúng góc xe kéo
      const N = noseOf(); pushTug.position.set(N[0], VY, N[1]); pushTug.rotation.y = psi + P.delta;   // nôi ôm bánh mũi, quay theo bánh mũi
    }

    // ── XE PHỤC VỤ RÚT ĐI (G 14/10, theo quy trình mặt đất IATA IGOM / CAA UK — kiểm tra viên ground handling):
    //  · xe đỗ sẵn mũi hướng RA để rời tàu bay bằng số TIẾN, không lùi dưới thân; người chỉ dẫn (banksman) điều xe rời đi
    //  · ≤ 10 km/h trong vùng an toàn quanh tàu bay (1.4 world/s), ≤ 25 km/h khi đã ra khỏi vị trí đỗ (3.5 world/s)
    //  · chèn bánh chỉ gỡ sau khi rút ống lồng; cọc tiêu chỉ gỡ khi MỌI xe đã rời vị trí, cửa đã đóng
    //  Xe tra nạp + xe bồn (đỗ dọc thân, đầu xe quay về đuôi) chạy thẳng về sau ra mép sân · xe nâng hàng đi đầu cabin (−x)
    //  ra phía +z · GPU kéo vào bãi tập kết thiết bị bên phải mũi, ĐỖ LẠI (ra khỏi hành lang xe kéo vào ôm càng mũi).
    const GSE_RUN = [];
    const SF = (a, b) => [PPOS.x + PDIR.x * a + PPERP.x * b, PPOS.z + PDIR.z * a + PPERP.z * b];   // toạ độ vị trí đỗ: dọc thân a · ngang b
    // CHUYỂN ĐỘNG XE (G 15/10 "vehicle physics"): mô hình xe 2 trục — trục sau bám tim đường, đầu xe LUÔN theo tiếp tuyến (không
    // trượt ngang, không xoay tại chỗ; bán kính bo cua 4 world = 8 m ≥ bán kính quay nhỏ nhất của xe phục vụ). Đường nào cũng bắt đầu
    // bằng một đoạn THẲNG dọc trục xe ở chỗ đỗ ⇒ lúc lăn bánh hướng xe liền mạch. Tốc độ (IATA AHM 913 / quy định sân đỗ): trong vùng
    // an toàn quanh tàu bay ≤ 5 km/h (đi bộ, 0.7 world/s), ra ngoài ≤ 25 km/h (3.4 world/s); tăng tốc ≤ 1 m/s², phanh ≤ 2 m/s².
    function gseRoutes() {
      GSE_RUN.length = 0;
      const add = (o, t0, pts, sgn, park) => {
        const h = gseHome.get(o), ax = [sgn * Math.cos(h.ry), -sgn * Math.sin(h.ry)], a = pts[0], b = pts[1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], turn = Math.acos(Math.max(-1, Math.min(1, u[0] * ax[0] + u[1] * ax[1])));
        if (turn > 0.03) { const e = Math.min(L * 0.5, 4 * Math.tan(turn / 2) + 0.6); pts = [a, [a[0] + ax[0] * e, a[1] + ax[1] * e], ...pts.slice(1)]; }   // đoạn thẳng dọc trục xe
        GSE_RUN.push({ o, t0, P: fPath(pts, new Array(Math.max(0, pts.length - 2)).fill(4)), sgn, park, s: 0, v: 0, ry: h.ry, y: h.p.y });
      };
      const H = (o) => [gseHome.get(o).p.x, gseHome.get(o).p.z], A = [-PDIR.x, -PDIR.z];
      const r = H(refuelVehicle), f = H(fuel), b = H(belt), by = gseHome.get(belt).ry, B = [-Math.cos(by), Math.sin(by)];
      add(refuelVehicle, 3, [r, [r[0] + A[0] * 51, r[1] + A[1] * 51]], 1, false);
      add(fuel, 4, [f, [f[0] + A[0] * 57, f[1] + A[1] * 57]], 1, false);
      add(belt, 6.5, [b, [b[0] + B[0] * 74, b[1] + B[1] * 74]], -1, false);
      add(gp, 2.5, [H(gp), SF(25.9, 5.8), SF(23.3, 18.0)], -1, true);
    }
    function gseDrive(r, t, dt) {
      if (t < r.t0 || !r.o.visible) return;
      const o = fSample(r.P, r.s);
      let vT = r.s < 6 ? 0.7 : 3.4;                                                     // vùng an toàn quanh tàu bay: tốc độ đi bộ
      for (let d = 0; d <= 8; d += 1) { fSample(r.P, r.s + d, o); if (o.k > 1e-3) vT = Math.min(vT, Math.sqrt(0.5 / o.k + 2 * 1.0 * d)); }   // cua: a_ngang ≤ 1 m/s²
      if (r.park) vT = Math.min(vT, Math.sqrt(Math.max(0, 2 * 1.0 * (r.P.len - r.s))));
      r.v += Math.max(-1.0 * dt, Math.min(0.5 * dt, vT - r.v)); r.s = Math.min(r.P.len, r.s + r.v * dt);
      fSample(r.P, r.s, o); r.ry = Math.atan2(-o.tz, o.tx) + (r.sgn < 0 ? Math.PI : 0);   // trục sau trên tim, đầu xe theo tiếp tuyến
      r.o.position.set(o.x, r.y, o.z); r.o.rotation.y = r.ry;
      if (!r.park && r.s >= r.P.len) r.o.visible = false;
    }

    // G 14/10: ẩn TOÀN BỘ nhãn khi máy bay di chuyển / cất cánh / bay; về cổng thì trả lại đúng trạng thái người xem đã chọn
    let lblSaved = null;
    function labelsHide(on) {
      if (on && lblSaved === null) { lblSaved = labelGroup.visible; labelGroup.visible = false; }
      else if (!on && lblSaved !== null) { labelGroup.visible = lblSaved; lblSaved = null; }
      if (bL) bL.innerHTML = '<i class="ti ti-' + (labelGroup.visible ? 'tag' : 'tag-off') + '"></i>Nhãn';
    }
    // MỜ DẦN rồi biến mất (G 14/10 "hàng hoá và người từ từ biến mất khi máy bay di chuyển"): vật liệu Bag dùng CHUNG theo màu
    // cho cả sân ⇒ nhân bản vật liệu riêng của nhóm rồi mới hạ opacity · k = 1 trả vật liệu gốc (về cổng) · setVis false: chỉ đổi độ
    // đục, không đụng ẩn/hiện (thùng hàng trên đoàn xe do vòng lặp hành lý tự ẩn/hiện)
    const FADES = new Map();
    function fadeObj(o, k, setVis = true) {
      if (!o) return;
      let f = FADES.get(o);
      if (k >= 0.999) { if (f) { for (const [m, orig] of f) m.material = orig; FADES.delete(o); } if (setVis) o.visible = true; return; }
      if (!f) {
        f = []; o.traverse((m) => { if (m.material && !Array.isArray(m.material)) { const c = m.material.clone(); c.transparent = true; c.userData.op = m.material.opacity; f.push([m, m.material, c]); m.material = c; } });
        FADES.set(o, f);
      }
      for (const [, , c] of f) c.opacity = c.userData.op * k;
      if (setVis) o.visible = k > 0.003;
    }
    const gearPins = (on) => { for (const R of plane.userData.gear || []) if (R.g.flag) R.g.flag.visible = on; };

    function setIgnite(on) {                                                          // như nút Engine nhưng không đổi nhãn nút đó
      isEngineIgnited = on; window.isEngineIgnited = on;
      for (const mat of allCombMats) mat.color.setHex(on ? 0xff3300 : 0x757676);
      for (const mat of allFuelRingMats) mat.color.setHex(on ? 0xff1100 : 0x606060);
    }

    const STEPS = [
      [0, '1 · Đóng cửa khách — rút ống lồng, tháo ống gió (PCA), cáp điện (GPU) · rút chốt khoá càng'],
      [3, '2 · Xe phục vụ rời đi bằng số tiến — xe nâng hạ sàn lùi ra, đóng cửa hầm hàng · xe tra nạp & xe bồn rút về sau'],
      [9, '3 · Xe kéo đẩy lùi vào ôm càng mũi — gỡ chèn bánh và cọc tiêu'],
      [16, '4 · Bật đèn chớp đỏ chống va chạm — mọi người tránh xa động cơ · bắt đầu đẩy lùi'],
      [22, '5 · Nổ máy trong lúc đẩy lùi — lần lượt 4 máy lên không tải (N1 ≈ 22 %)'],
      [null, '6 · Xe kéo tách khỏi càng mũi — đặt cánh tà cất cánh'],
      [null, '✓ Sẵn sàng lăn bánh — tháo chốt lái (bypass pin) giơ cho tổ lái thấy, người ra hiệu chào']];

    function departureStep(dt) {
      if (!DEP.active) return;
      const t = (DEP.t += dt), p0x = plane.position.x, p0z = plane.position.z;
      // 1 · ống lồng (đoạn C lùi 4 world ≈ 8 m, cab xoay ra) · PCA · cáp GPU · người dưới bụng rời đi
      BRIDGE.set(BRIDGE.R_MAX * win(t, 0.3, 7), 0.35 * win(t, 4, 8.5));
      vis(BRIDGE.pca, t < 0.8); vis([GSE_X.gpuCable], t < 1.2);
      for (const h of [CREW.h2, CREW.h3]) fadeObj(h, 1 - win(t, 0.4, 2.0));              // 2 người dưới bụng mờ dần rời đi
      // 2 · xe phục vụ rời đi
      vis([GSE_X.fuelHose], t < 2.5);
      // đoàn xe hành lý mờ dần (1–3 s) thay vì biến mất tức thì; mờ hết mới dừng vòng chạy
      { const k = 1 - win(t, 1, 3); for (const o of [tugUnit, ...dollyCarts]) fadeObj(o, k); for (const o of cargoBoxes) fadeObj(o, k, false); }
      DEP.hideTrain = t >= 3; if (DEP.hideTrain) vis([tugUnit, ...dollyCarts, ...cargoBoxes], false);
      DEP.loader = win(t, 2.5, 6);
      for (const r of GSE_RUN) gseDrive(r, t, dt);
      vis(FUEL_LABEL, t < 4);
      // đóng cửa hầm hàng trước SAU KHI xe nâng hạ sàn & lùi ra (cửa hất lên-ra ngoài, sàn xe nâng còn kê sát ngưỡng thì không đóng được)
      plane.userData.cargoDoor.set(1 - win(t, 8.5, 12));
      gearPins(t < 3);                                                                // rút 5 chốt khoá càng + cờ đỏ (người tai nghe giữ, đưa tổ lái xem lúc tách xe kéo)
      // 3 · xe kéo lùi vào ôm càng mũi (13 world ≈ 26 m) · gỡ chèn bánh + cọc tiêu
      if (t >= 9 && push.phase === 0) {
        const k = win(t, 9, 15), N = noseOf(), [cx, cz] = fwd(home.rot), off = 13 * (1 - k);
        pushTug.visible = true; pushTug.position.set(N[0] + cx * off, VY, N[1] + cz * off); pushTug.rotation.y = home.rot;
      }
      vis([APRON_RM], t < 14);
      // 4 · đèn chớp → đẩy lùi
      DEP.beacon = t >= 16;
      if (t >= 18 && push.phase === 0) { push.phase = 1; labelsHide(true); }       // máy bay bắt đầu di chuyển ⇒ ẩn mọi nhãn (G 14/10)
      // máy bay di chuyển ⇒ cụm container LD3 + người tai nghe mờ dần rồi biến mất
      if (t >= 18) { fadeObj(cargo, 1 - win(t, 18, 21.5)); fadeObj(CREW.h1, 1 - win(t, 18.5, 21)); }
      if (push.phase >= 1 && push.phase < 4) pushStep(dt);
      // 5 · nổ máy lần lượt (độ trễ từng máy đặt lúc bắt đầu), dừng ở không tải
      if (t >= 22 && !isEngineIgnited) setIgnite(true);
      // 6 · xe kéo tách, chạy lên trước rồi rời khỏi khung · đặt cánh tà
      if (push.phase === 4) {
        if (push.stopT < 0) push.stopT = t;
        const k = win(t, push.stopT + 1.5, push.stopT + 7.5), N = noseOf(), hdg = plane.rotation.y, [cx, cz] = fwd(hdg);
        pushTug.position.set(N[0] + cx * 16 * k, VY, N[1] + cz * 16 * k); pushTug.rotation.y = hdg;
        if (t > push.stopT + 1.5) DEP.flaps = true;
        if (k >= 1) pushTug.visible = false;
        if (t > push.stopT + 9.5) { DEP.active = false; flightBegin(); return; }      // → 21-flight: lăn ra, đường băng, cất cánh…
      }
      target.x += plane.position.x - p0x; target.z += plane.position.z - p0z;         // camera đi theo máy bay
      plane.updateMatrix(); ENG_LABEL.matrix.multiplyMatrices(plane.matrix, home.inv); ENG_LABEL.matrixWorldNeedsUpdate = true;   // nhãn động cơ bám máy bay
      let st = 0; for (let i = 0; i < 5; i++) if (t >= STEPS[i][0]) st = i;
      if (push.phase === 4) st = pushTug.visible ? 5 : 6;
      if (st !== DEP.step) { DEP.step = st; depCap.textContent = STEPS[st][1]; }
    }

    function depStart() {
      ensureAudio();
      if (isEngineIgnited) toggleEngineIgnition();                                    // đang thử Engine ⇒ tắt trước
      for (const o of [belt, fuel, refuelVehicle, gp]) remember(o);
      gseRoutes();
      Object.assign(DEP, { active: true, t: 0, beacon: false, flaps: false, loader: 0, hideTrain: false, step: -1 });
      Object.assign(push, { phase: 0, s: 0, s3: 0, turned: 0, delta: 0, v: 0, t: 0, stopT: -1 });
      ENG_MODE.idle = true;
      SPOOL.forEach((s, e) => { s.delay = [0, 5, 10, 15][e]; });                      // lần lượt từng máy, cách 5 s
      if (engineButton) engineButton.disabled = true;
      depBtn.innerHTML = '<i class="ti ti-arrow-back-up"></i>Về cổng'; depCap.hidden = false;
    }
    function depReset() {
      target.x += home.pos.x - plane.position.x; target.z += home.pos.z - plane.position.z;
      plane.position.copy(home.pos); plane.rotation.y = home.rot;
      Object.assign(DEP, { active: false, beacon: false, flaps: false, loader: null, hideTrain: false, step: -1 });
      setIgnite(false); ENG_MODE.idle = false;
      SPOOL.forEach((s, e) => Object.assign(s, { n1: 0, n2: 0, lit: false, starter: false, t: 0, dwell: 0, delay: e * 0.45 }));
      wingK.kr = 0; wingK.flap = 0;
      BRIDGE.set(0, 0); vis(BRIDGE.pca, true);
      for (const [o, h] of gseHome) { o.position.copy(h.p); o.visible = h.v; o.rotation.y = h.ry; }
      for (const o of [cargo, CREW.h1, CREW.h2, CREW.h3, tugUnit, ...dollyCarts, gp, belt, fuel, refuelVehicle, APRON_RM]) fadeObj(o, 1); for (const o of cargoBoxes) fadeObj(o, 1, false);
      vis([GSE_X.gpuCable, GSE_X.fuelHose, APRON_RM, CREW.h1, CREW.h2, CREW.h3, tugUnit, ...dollyCarts, ...FUEL_LABEL], true);
      ENG_LABEL.matrix.identity(); ENG_LABEL.matrixWorldNeedsUpdate = true;
      pushTug.visible = false; plane.userData.cargoDoor.set(1); gearPins(true); labelsHide(false);
      if (engineButton) engineButton.disabled = false;
      depBtn.innerHTML = '<i class="ti ti-plane-departure"></i>Khởi hành'; depCap.hidden = true;
    }
    if (depBtn) depBtn.addEventListener('click', () => { if (FLT.busy) return; (DEP.active || FLT.phase) ? flightAbort() : depStart(); });
    /* ═══ flight/20-gear-rig — ĐỘNG HỌC THU / THẢ CÀNG 747-8 (G 14/10: "study and fixing mechanic khi cất cánh và đang bay") ═══
       747: càng CÁNH thu NGANG về tim máy bay (hốc ở bụng phình gốc cánh) · càng THÂN thu về TRƯỚC, lồng sau càng cánh ("nested")
       · càng MŨI thu về trước vào hốc dưới sàn buồng lái, 2 cửa hốc đóng kín sau khi thu, mở trước khi thả.
       Trên không khi càng thả: bogie càng chính NGHIÊNG ngửa mũi (bánh sau thấp, chạm đất trước) — chạm đất thì ép phẳng.
       Trình tự thu: bogie về vị trí thu → trụ quay quanh trunnion, giằng GẬP ở khớp gối (mở khoá: gối bị đẩy qua điểm chết lên
       trên) → càng thân: bogie quay ngược chiều trụ để nằm phẳng trong hốc → đóng cửa. Thả: ngược lại.
       Giằng = cơ cấu 4 khâu phẳng: khâu trên quay quanh điểm treo W (khung máy bay), khâu dưới nối gối K với tai S trên trụ ⇒
       K = (đường tròn tâm W, bán kính |W K0|) ∩ (đường tròn tâm S(θ), bán kính |S0 K0|) — lấy nghiệm phía TRÊN (gập vào trong
       cánh / thân). Thanh khoá K → J → L (tai trên trụ) giải tương tự, giữ J cùng phía với lúc khoá. */
    // swing: góc thu của trụ · tilt: bogie ngửa mũi khi càng thả trên không · beam: [lên, vào trong] (local) — dầm "walking beam" của
    // 707/727/747 đưa trunnion càng cánh trượt vào trong khi thu (thân mô hình hẹp ở đáy ⇒ cần ~1 m mới lọt bụng phình) ·
    // yaw: càng thân chụm vào tim khi thu về trước (rad) — bánh ngoài không lòi khỏi bụng phình
    // fold: phía khớp gối gập — 'in' (càng cánh: gối gập vào phía thân, vào hốc; cánh mô hình mỏng ⇒ gập lên sẽ xuyên mặt trên cánh)
    //       · mặc định gập LÊN (càng thân, càng mũi: vào trong bụng). Càng cánh: điểm treo giằng đi cùng dầm walking beam.
    const GEAR_CFG = { wing: { swing: 1.53, tilt: 0.24, beam: [0.1, 0.45], fold: 'in' }, body: { swing: 1.55, tilt: 0.14, yaw: 0.17 }, nose: { swing: 1.62 } };
    const _gc = (v, ax) => ax === 'x' ? [v.y, v.z] : [v.x, v.y];            // toạ độ trong mặt phẳng quay (cùng chiều dương của rotation[ax])
    const _ga = (a, b, ax) => { const [p1, p2] = _gc(a, ax), [q1, q2] = _gc(b, ax); return Math.atan2(q2 - p2, q1 - p1); };   // góc của (b − a)
    const _from = (c, ref, ax) => ax === 'x' ? new THREE.Vector3(ref.x, c[0], c[1]) : new THREE.Vector3(c[0], c[1], ref.z);
    function _rot(v, c, a, ax) {                                                // quay v quanh tâm c góc a (đúng quy ước rotation[ax] của three)
      const [p1, p2] = _gc(v, ax), [c1, c2] = _gc(c, ax), d1 = p1 - c1, d2 = p2 - c2, co = Math.cos(a), si = Math.sin(a);
      return _from([c1 + d1 * co - d2 * si, c2 + d1 * si + d2 * co], v, ax);
    }
    function _cc(A, ra, B, rb, ax) {                                            // 2 giao điểm đường tròn (A, ra) ∩ (B, rb) — kẹp khi không giao
      const [a1, a2] = _gc(A, ax), [b1, b2] = _gc(B, ax), dx = b1 - a1, dy = b2 - a2, d0 = Math.hypot(dx, dy) || 1e-9;
      const d = Math.min(ra + rb - 1e-6, Math.max(Math.abs(ra - rb) + 1e-6, d0)), ux = dx / d0, uy = dy / d0;
      const l = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - l * l)), m1 = a1 + ux * l, m2 = a2 + uy * l;
      return [[m1 - uy * h, m2 + ux * h], [m1 + uy * h, m2 - ux * h]];
    }
    const _side = (a, b, c, ax) => { const [a1, a2] = _gc(a, ax), [b1, b2] = _gc(b, ax), [c1, c2] = _gc(c, ax); return Math.sign((b1 - a1) * (c2 - a2) - (b2 - a2) * (c1 - a1)); };
    // θ ≥ 0: góc thu của trụ · truckRel: góc nghiêng bogie so với trụ (+ = ngửa mũi) · doorK: 0 mở → 1 đóng (cửa càng mũi)
    function rigPose(R, th, truckRel, doorK, e = 0) {
      const ax = R.axis, p = R.pin, G = R.g, a = ax === 'x' ? R.u * th : th, C = GEAR_CFG[R.kind];
      const off = new THREE.Vector3(0, C.beam ? C.beam[0] * e : 0, C.beam ? -R.u * C.beam[1] * e : 0);
      G.strut.position.copy(p.T).add(off);
      if (C.yaw) { G.strut.rotation.order = 'YZX'; G.strut.rotation.y = R.u * C.yaw * e; }   // quay quanh trục đứng TRƯỚC khi gập (Ry·Rz)
      if (!R.len) R.len = { a: p.K.distanceTo(p.W), b: p.K.distanceTo(p.S), c: p.J.distanceTo(p.K), d: p.J.distanceTo(p.L), sj: _side(p.K, p.L, p.J, ax) };
      G.strut.rotation[ax] = a;
      if (G.truck) G.truck.rotation.z = truckRel;
      for (const d of G.doors) d.g.rotation.x = d.s * 1.98 * doorK;           // từ nghiêng 25° ra mạn → nằm ngang ôm bụng
      const S = _rot(p.S, p.T, a, ax).add(off), L = _rot(p.L, p.T, a, ax).add(off), yi = ax === 'x' ? 0 : 1;
      const Wm = C.beam ? p.W.clone().add(off) : p.W; G.up.position.copy(Wm);
      const ks = _cc(Wm, R.len.a, S, R.len.b, ax);
      let K = _from(C.fold === 'in' ? (Math.abs(ks[0][1]) < Math.abs(ks[1][1]) ? ks[0] : ks[1]) : (ks[0][yi] > ks[1][yi] ? ks[0] : ks[1]), p.K, ax);
      const bl = Math.min(1, Math.abs(a) / 0.07); if (bl < 1) K = p.K.clone().add(off).lerp(K, bl);   // mở khoá: gối đi qua điểm chết
      G.up.rotation[ax] = _ga(Wm, K, ax) - _ga(p.W, p.K, ax);
      G.lo.rotation[ax] = _ga(S, K, ax) - _ga(p.S, p.K, ax) - a;
      const js = _cc(K, R.len.c, L, R.len.d, ax), j0 = _from(js[0], p.J, ax), j1 = _from(js[1], p.J, ax);
      const J = _side(K, L, j0, ax) === R.len.sj ? j0 : j1;
      G.k1.rotation[ax] = _ga(K, J, ax) - _ga(p.K, p.J, ax) - G.up.rotation[ax];
      G.k2.rotation[ax] = _ga(L, J, ax) - _ga(p.L, p.J, ax) - a;
    }
    // k: 0 thả hết → 1 thu hết (thời gian do FLT điều) · tilt: 0 trên đất → 1 trên không (bogie ngửa mũi)
    let _gearLast = '';
    function gearUpdate(k, tilt) {
      const key = k.toFixed(4) + '|' + tilt.toFixed(4); if (key === _gearLast) return; _gearLast = key;
      const sm = (a, b) => { const u = Math.min(1, Math.max(0, (k - a) / (b - a))); return u * u * (3 - 2 * u); };
      const st = sm(0, 0.12);                                                   // bogie về vị trí thu trước khi trụ quay
      for (const R of plane.userData.gear || []) {
        const C = GEAR_CFG[R.kind];
        if (R.kind === 'nose') { rigPose(R, C.swing * sm(0.06, 0.8), 0, sm(0.84, 1)); continue; }
        const e = R.kind === 'wing' ? sm(0.1, 0.86) : sm(0.14, 0.9), th = C.swing * e;
        rigPose(R, th, C.tilt * tilt * (1 - st) - (R.kind === 'body' ? th : 0), 0, e);   // càng thân: bogie quay ngược ⇒ nằm phẳng trong hốc
      }
    }
    window.__gearUpdate = gearUpdate;

    // ── BÁNH LĂN (G 15/10 "bánh xe lăn khi trên đường băng, khi hạ cánh, khi lăn vào đỗ"): góc = quãng lăn / bán kính lốp (không
    // trượt), đo từ dịch chuyển THẬT của máy bay mỗi khung ⇒ đẩy lùi (quay ngược), lăn, chạy đà, chạy đà hạ cánh đều đúng mà không
    // cần mỗi pha tự báo tốc độ; dịch > 15 world / khung = đổi cảnh, bỏ qua. Hiển thị ≤ 0.12 rad / khung: mâm 12 lỗ quay > 15° / khung
    // là mắt thấy quay ngược (hiệu ứng bánh xe ngựa) — như quạt động cơ, tốc độ HIỂN THỊ bão hoà khi chạy nhanh.
    // Trên không: bánh quay trớn; thu càng ⇒ phanh tự động (bánh chính) / má chặn trong hốc (bánh mũi) dừng hẳn.
    // Bánh mũi chỉ lăn khi mũi chạm đất (nâng mũi lúc VR thì nhấc khỏi đất, hạ cánh thì quay khi hạ mũi xong) và KHÔNG lăn lúc
    // đẩy lùi: xe kéo không càng nhấc cặp bánh mũi lên nôi.
    const WHL = { px: 0, pz: 0, init: false, a: { main: 0, nose: 0 }, w: { main: 0, nose: 0 } };
    // GÓC LÁI (G 15/10 "máy bay rẽ thì bánh mũi bẻ trước"): STEER.nose = góc bánh mũi so với trục thân (+ = bẻ trái), do bộ lái
    // của pha đang chạy đặt mỗi khung (lăn: 23-flight taxiPP · đẩy lùi: 19b, xe kéo bẻ) và bật STEER.live; không ai lái ⇒ cam
    // định tâm đưa về 0 (≤ 20°/s). STEER.body: càng THÂN 747 bẻ NGƯỢC chiều bánh mũi khi bánh mũi > 20° và tốc độ < 15 kt,
    // tối đa 13° — tâm quay dời lên đường trục càng cánh, lốp càng thân không bị lết ngang (body gear steering).
    const STEER = { nose: 0, body: 0, live: false, MAX: 70 * Math.PI / 180, RATE: 20 * Math.PI / 180 };
    function wheelSpin(dt) {
      const gear = plane.userData.gear; if (!gear || !(dt > 0)) return;
      const x = plane.position.x, z = plane.position.z, dx = x - WHL.px, dz = z - WHL.pz; WHL.px = x; WHL.pz = z;
      const tele = !WHL.init || dx * dx + dz * dz > 225; WHL.init = true;
      const h = plane.rotation.y, d = tele ? 0 : (dx * Math.cos(h) - dz * Math.sin(h)) / WSC;       // quãng lăn dọc thân (m), + = tiến
      if (!STEER.live) STEER.nose -= Math.max(-STEER.RATE * dt, Math.min(STEER.RATE * dt, STEER.nose));
      STEER.live = false;
      const kt = Math.abs(d) / Math.max(1e-4, dt * FLT.rate) / 0.5144, bn = Math.abs(STEER.nose) * 180 / Math.PI;
      const bT = !FLT.air && kt < 15 && bn > 20 ? -Math.sign(STEER.nose) * Math.min(13, (bn - 20) * 13 / 50) * Math.PI / 180 : 0;
      STEER.body += Math.max(-0.2 * dt, Math.min(0.2 * dt, bT - STEER.body));
      const towed = DEP.active && push.phase >= 1 && push.phase < 4;
      const on = { main: !FLT.air, nose: !FLT.air && !towed && Math.abs(plane.rotation.z) < 0.006 };
      for (const k of ['main', 'nose']) {
        if (on[k]) WHL.w[k] = -d / (k === 'nose' ? 0.622 : 0.66) / dt;                               // tiến (+x) ⇒ quay âm quanh z
        else WHL.w[k] *= Math.exp(-dt / (FLT.gear ? 0.35 : 3));
        WHL.a[k] = (WHL.a[k] + Math.max(-0.12, Math.min(0.12, WHL.w[k] * dt))) % (2 * Math.PI);
      }
      for (const R of gear) {
        const a = WHL.a[R.kind === 'nose' ? 'nose' : 'main']; for (const g of R.g.wheels) g.rotation.z = a;
        if (R.g.steer) R.g.steer.rotation.y = STEER.nose;
        if (R.kind === 'body' && R.g.truck) R.g.truck.rotation.y = STEER.body;
      }
    }
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
    /* ═══ flight/23-flight — ĐIỀU PHỐI CHUYẾN BAY (G 14/10): lăn ra → đường băng → cất cánh → bầu trời → hạ cánh → về cổng ═══
       Số liệu 747-8I: mặt cánh S 554 m² · 4 × GEnx-2B67 296 kN (suy giảm ~0.24 %/m·s⁻¹ theo tốc độ) · khối lượng cất cánh 410 t,
       hạ cánh 300 t · V1 150 / VR 160 kt · FCTM 747: nâng mũi 2,5°/s tới 9°, rời đất ~5 s sau VR, 11–14° ở 35 ft, V2 ~175 kt
       (SKYbrary) · leo 2 500 ft/ph · thu càng sau "positive rate" (~8 s) · tiếp cận Vref30 + 5 ≈ 150 kt, dốc 3°, flare 30 ft,
       về không tải 20 ft · chạm bánh: spoiler mặt đất + đảo chiều + phanh tự động, giảm tốc để thoát nhanh RET ở ~30 kt.
       CẤT CÁNH = mô hình LỰC (lực đẩy − cản − ma sát lăn; trên không: phương trình trục gió dV/dt, dγ/dt với góc chúc giữ
       theo lịch). HẠ CÁNH = bám dốc 3° + luật flare (tốc độ chìm tỉ lệ độ cao) + giảm tốc tính sẵn tới RET. Lăn = bám tim
       đường, tốc độ giới hạn theo bán kính cua (gia tốc ngang ≤ 1 m/s²). Thời gian nén (FLT.rate) ghi rõ trên chú thích. */
    const KT = 0.5144, FT = 0.3048, G0 = 9.81;
    const FLT = { phase: null, t: 0, rate: 1, rateT: 1, zoomT: 0, tgtT: null, camTau: 0.5, play: 1, vol: 1, f30: 0, spoil: 0, gear: 0, gearK: 0, air: false, tilt: 0, beaconOff: false, busy: false, set: 'gate', capT: -1 };
    window.__flt = FLT;
    plane.rotation.order = 'YZX';                                     // lăn (x) → chúc (z) → hướng (y): đúng thứ tự góc Euler máy bay
    const PIV_L = new THREE.Vector3(BG_X, 0.109, 0);                  // điểm tựa = chỗ bánh càng THÂN chạm đất (máy bay xoay quanh đây khi nâng mũi)
    const NOSE_L = new THREE.Vector3(gx(35.91), FY, 0);
    const AC = { S: 554, rho: 1.225, T0: 4 * 296e3, mTO: 410e3, mLD: 300e3 };
    const D2R = Math.PI / 180;
    const btnLand = document.getElementById('btnLand'), wrapEl = document.getElementById('wrap');
    const veil = document.createElement('div'); veil.id = 'veil'; wrapEl.insertBefore(veil, wrapEl.querySelector('.ui-container'));

    // ── tư thế: đặt ĐIỂM TỰA (bánh càng thân) tại (px, py, pz), hướng / chúc / nghiêng (rad)
    const _pv = new THREE.Vector3();
    function planePose(px, py, pz, hdg, pitch = 0, roll = 0) {
      plane.rotation.set(roll, hdg, pitch);
      _pv.copy(PIV_L).multiplyScalar(1.1).applyEuler(plane.rotation);
      plane.position.set(px - _pv.x, py - _pv.y, pz - _pv.z);
    }
    const _tw = new THREE.Vector3();
    const toW = (v, out) => { plane.updateMatrixWorld(); return (out || new THREE.Vector3()).copy(v).applyMatrix4(plane.matrixWorld); };
    const NOSE_OFF = (NOSE_L.x - PIV_L.x) * 1.1;                     // mũi trước điểm tựa (world)
    // ── lực đẩy tổng theo N1 trung bình 4 máy (không tải ~5 %) · suy giảm theo tốc độ
    const n1Avg = () => SPOOL.reduce((a, s) => a + s.n1, 0) / 4;
    const thrustN = (V) => AC.T0 * (0.05 + 0.95 * Math.pow(Math.min(1, Math.max(0, (n1Avg() - 0.22) / 0.76)), 1.6)) * Math.max(0.5, 1 - 0.0024 * V);

    // ── bộ cảnh: gate (sân đỗ) · rwy (đường băng) · sky (bầu trời). Rời sân đỗ: ghi lại trạng thái ẩn/hiện từng vật rồi ẩn hết
    let GATE_OBJS = null;
    const SUN0 = sun.position.clone();
    function setsShow(name) {
      if (!GATE_OBJS) GATE_OBJS = scene.children.filter(o => o !== plane && !o.isLight && o !== labelGroup && o !== RWY.set && o !== SKY.set);
      const others = labelGroup.children.filter(o => o !== ENG_LABEL);
      if (name !== 'gate' && FLT.set === 'gate') for (const o of [...GATE_OBJS, ...others]) { o.userData._gv = o.visible; o.visible = false; }
      if (name === 'gate' && FLT.set !== 'gate') for (const o of [...GATE_OBJS, ...others]) o.visible = o.userData._gv ?? true;
      if (name === 'rwy') buildRunway();
      if (name === 'sky') buildSky();
      if (RWY.set) RWY.set.visible = name === 'rwy';
      if (SKY.set) { SKY.set.visible = name === 'sky'; SKY.trails.visible = name === 'sky'; }
      FLT.set = name;
      wrapEl.style.background = name === 'sky' ? 'linear-gradient(180deg, #b7cddd 0%, #d9e4eb 55%, #eaeee9 100%)' : '';
      // trời: sương khí quyển lam nhạt — máy bay (độ sâu ~420) không mờ, mặt đất 10.7 km bên dưới mờ ~20 %, càng xa càng dày
      scene.fog.color.set(name === 'sky' ? 0xc3d3e2 : 0xE2D6C0); scene.fog.near = name === 'sky' ? 430 : 300; scene.fog.far = name === 'sky' ? 2000 : 1000;   // nhìn ngang: đất xa hơn ⇒ sương dày hơn chút
      if (EARTH.credit) EARTH.credit.hidden = name !== 'sky';
      if (name === 'gate') { sun.position.copy(SUN0); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld(); }
    }
    // ── màn mờ chuyển cảnh (0.7 s vào · đổi cảnh · 0.7 s ra)
    function fadeTo(fn, col = '#E2D6C0') {
      if (FLT.busy) return; FLT.busy = true;
      veil.style.background = col; veil.classList.add('on');
      setTimeout(() => { try { fn(); } catch (e) { console.error(e); } setTimeout(() => { veil.classList.remove('on'); FLT.busy = false; }, 150); }, 720);
    }
    // ── camera
    // soft: không cắt cảnh — góc nhìn trôi tới (vòng lặp làm mượt theta / phi), zoom trượt τ 0.5 s (flightStep)
    function view(o, soft = false) {
      FLT.camTau = 0.5; FLT.tgtT = null;
      if (o.theta !== undefined) { tTheta = o.theta; if (!soft) theta = o.theta; } if (o.phi !== undefined) { tPhi = o.phi; if (!soft) phi = o.phi; }
      if (o.zoom) { if (soft) FLT.zoomT = o.zoom; else { FLT.zoomT = 0; camera.zoom = o.zoom; camera.updateProjectionMatrix(); } }
      if (o.target) target.set(o.target[0], o.target[1], o.target[2]);
      autoRotate = false; syncBtn();
    }
    // camera "RAY" cho đoạn chạy nhanh (chạy đà, leo, tiếp cận, chạy đà hạ cánh): đặt THẲNG theo máy bay (không trễ ⇒ máy bay đứng yên
    // trong khung, mặt đất trôi êm, không rung theo độ dao động thời gian khung) + độ lệch lúc vào pha tắt dần (τ 0.45 s) ·
    // w < 1: camera chỉ theo w phần chuyển động ⇒ chậm lại êm, máy bay rời khung
    function camLock(dtR, x, z, w = 1) {
      if (!F.cam) F.cam = { ox: target.x - x, oz: target.z - z, ax: x, az: z, px: x, pz: z };
      const c = F.cam, e = Math.exp(-dtR / 0.45);
      c.ox *= e; c.oz *= e; c.ax += (x - c.px) * w; c.az += (z - c.pz) * w; c.px = x; c.pz = z;
      target.x = c.ax + c.ox; target.z = c.az + c.oz; target.y *= e;
    }
    // ── KHÓI LỐP LÚC CHẠM BÁNH (G 16/10): bánh chính đang đứng yên chạm mặt đường ở ~140 kt ⇒ lốp trượt vài phần mười giây tới khi quay
    //    kịp ⇒ cao su cháy thành khói trắng NGAY CHỖ CHẠM, ở lại trên đường băng (máy bay lăn tiếp ⇒ khói trôi về sau khung), nở to, bốc
    //    nhẹ và tan sau ~2–3 s. Bogie ngửa mũi ⇒ cặp bánh SAU mỗi bogie chạm trước ⇒ khói bốc từ đó; bánh mũi chạm nhẹ ⇒ làn khói nhỏ.
    const SMOKE = { list: [], free: [], tex: null, emit: 0 }, _sv = new THREE.Vector3();
    function smokePuff(x, y, z, s0, s1, life, op) {
      if (!SMOKE.tex) {                                                               // bông khói mềm: vài vệt tròn mờ chồng lệch nhau
        const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
        for (let i = 0; i < 7; i++) { const a = i * 0.9, r = 10 + (i % 3) * 3, px = 32 + Math.cos(a) * 7, py = 32 + Math.sin(a) * 7, rg = g.createRadialGradient(px, py, 1, px, py, r + 9); rg.addColorStop(0, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); }
        SMOKE.tex = new THREE.CanvasTexture(c); SMOKE.tex.colorSpace = THREE.SRGBColorSpace;
      }
      let p = SMOKE.free.pop();
      if (!p) { if (SMOKE.list.length >= 140) return; p = { sp: new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE.tex, color: 0xe6e3dc, transparent: true, depthWrite: false, fog: true })) }; p.sp.renderOrder = 3; scene.add(p.sp); }
      Object.assign(p, { age: 0, life, s0, s1, op, vx: (Math.random() - 0.5) * 1.4, vy: 0.4 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 1.4 });
      p.sp.position.set(x, y, z); p.sp.material.rotation = Math.random() * 6.28; p.sp.scale.set(s0, s0, 1); p.sp.material.opacity = 0; p.sp.visible = true; SMOKE.list.push(p);
    }
    function smokeStep(dt) {
      for (let i = SMOKE.list.length - 1; i >= 0; i--) {
        const p = SMOKE.list[i]; p.age += dt; const k = p.age / p.life;
        if (k >= 1 || FLT.set !== 'rwy') { p.sp.visible = false; SMOKE.list.splice(i, 1); SMOKE.free.push(p); continue; }
        const e = Math.exp(-dt / 0.9); p.vx *= e; p.vy *= e; p.vz *= e;                // khói hãm dần trong không khí
        p.sp.position.x += p.vx * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt;
        const s = p.s0 + (p.s1 - p.s0) * (1 - (1 - k) ** 2); p.sp.scale.set(s, s, 1);
        p.sp.material.opacity = p.op * Math.min(1, p.age / 0.07) * (1 - k) ** 1.6;
      }
    }
    // mỗi bogie càng chính: 1 bông ở một trong 2 bánh trục SAU (đang chạy theo máy bay) · càng mũi: vài bông nhỏ ở 2 bánh
    function smokeTouch(kind, n, s1, life, op) {
      for (const R of plane.userData.gear || []) {
        if ((kind === 'nose') !== (R.kind === 'nose')) continue;
        const ws = kind === 'nose' ? R.g.wheels : R.g.wheels.slice(0, 2);
        for (let i = 0; i < n; i++) { ws[(Math.random() * ws.length) | 0].getWorldPosition(_sv); smokePuff(_sv.x + (Math.random() - 0.5) * 0.5, 0.32, _sv.z + (Math.random() - 0.5) * 0.3, s1 * 0.22, s1 * (0.8 + Math.random() * 0.4), life * (0.85 + Math.random() * 0.3), op); }
      }
    }
    function follow(dt, x, y, z, k) { const a = Math.min(1, dt * k); target.x += (x - target.x) * a; target.y += (y - target.y) * a; target.z += (z - target.z) * a; }
    const _nd = new THREE.Vector3(), PROBE = [NOSE_L, new THREE.Vector3(-18.5 / 1.1 + PIV_L.x, FY, 0), new THREE.Vector3(-8, FY, 15.5), new THREE.Vector3(-8, FY, -15.5)];
    function offscreen() {                                            // mũi, đuôi, 2 mút cánh đều đã ra ngoài khung
      plane.updateMatrixWorld();
      return PROBE.every(p => { _nd.copy(p).applyMatrix4(plane.matrixWorld).project(camera); return Math.abs(_nd.x) > 1.02 || Math.abs(_nd.y) > 1.02; });
    }
    // ── chú thích + bảng số (HUD) · nhãn ⏩ khi thời gian bị nén
    let hudTxt = '', hudAt = 0;
    function cap(text) { FLT.capText = text; FLT.capT = -1; drawCap(); }
    // chú thích: dựng khung 1 lần, sau đó chỉ đổi chữ (không dựng lại HTML mỗi lần ⇒ không giật bố cục giữa lúc máy bay chạy nhanh)
    let capEls = null;
    function drawCap() {
      depCap.hidden = false;
      if (!capEls || !depCap.contains(capEls.t)) {
        depCap.innerHTML = '<span><span class="ct"></span> <i class="rate"></i></span><small></small>';
        capEls = { t: depCap.querySelector('.ct'), r: depCap.querySelector('.rate'), h: depCap.querySelector('small') };
      }
      const eff = Math.round(FLT.rateT * FLT.play * 10) / 10;                        // tốc độ phát thực so với thời gian thật
      capEls.t.textContent = FLT.capText; capEls.r.style.display = eff === 1 ? 'none' : ''; capEls.r.textContent = (eff > 1 ? '⏩ ' : '') + '×' + String(eff).replace('.', ',');
      capEls.h.style.display = hudTxt ? '' : 'none'; capEls.h.textContent = hudTxt;                 // small có display:block trong CSS ⇒ không dùng [hidden]
    }
    function hud(txt) { const now = performance.now(); if (now - hudAt < 140) return; hudAt = now; if (txt !== hudTxt) { hudTxt = txt; if (capEls && depCap.contains(capEls.h)) { capEls.h.style.display = txt ? '' : 'none'; capEls.h.textContent = txt; } else drawCap(); } }
    const n1Pct = () => Math.round(n1Avg() * 100) + ' %';

    const F = {};                                                     // trạng thái pha hiện tại
    // nhịp phát theo pha (G 14/10): ra đường băng + cất cánh chậm 20 % · bay trên trời chậm 45 % — áp lên CẢ cảnh (vòng lặp nhân dt)
    const PLAY = { gtaxi: 0.8, rtaxi: 0.8, roll: 0.8, climb: 0.8, sky: 0.55, desc: 0.55 };
    function go(name) {
      FLT.phase = name; FLT.t = 0; FLT.play = PLAY[name] || 1; for (const k in F) delete F[k]; hudTxt = ''; hudAt = -1;
      plane.userData.cargoDoor.set(0); for (const R of plane.userData.gear || []) if (R.g.flag) R.g.flag.visible = false;   // cửa hầm đóng, chốt càng đã rút
      labelsHide(true);                                                              // đang di chuyển / bay: không nhãn
      PHASES[name].enter();
      FLT.rate = FLT.rateT;                                                         // đầu pha: nhịp đặt ngay (sau màn mờ) · giữa pha: chuyển mượt
    }
    const ramp = (v, tgt, up, dn, dt) => v + Math.max(-dn * dt, Math.min(up * dt, tgt - v));
    // ── LĂN BẰNG BÁNH MŨI (G 15/10 "máy bay rẽ thì bánh mũi bẻ trước"): mô hình xe 2 trục — trục sau = tâm 4 càng chính M (lốp không
    //    trượt ngang), trục lái = càng mũi cách L ≈ 29.7 m (LW_W) · M' = v·hướng thân · ψ' = v·tan δ / L. Bám đường bằng PURE PURSUIT
    //    đặt ở M: điểm đích trên tim cách Ld phía trước, δ = atan(2 L sin α / Ld) — đúng kỹ thuật "oversteer" của 747 (buồng lái
    //    trước càng chính ~28 m: phi công cho buồng lái vượt qua tim rồi mới bẻ để CÀNG CHÍNH bám tim, mũi quét rộng ra ngoài cua).
    //    Bánh mũi: ≤ 70° (cần lái tay — tiller) và bẻ ≤ 20°/s ⇒ điểm đích vào cua trước ⇒ bánh mũi bẻ TRƯỚC, thân quay theo sau.
    //    Tốc độ ≤ vMax, ≤ √(a_ngang·R) ở cua (a_ngang ≤ 1 m/s², nhìn trước 36 world), phanh đều về điểm dừng sStop.
    const pathProj = (P, M, s0, s1, ds) => { const o = {}; let best = Math.max(0, s0), bd = 1e18; for (let s = Math.max(0, s0); s <= Math.min(P.len, s1); s += ds) { fSample(P, s, o); const d = (o.x - M[0]) ** 2 + (o.z - M[1]) ** 2; if (d < bd) { bd = d; best = s; } } return best; };
    // đặt máy bay lên đường tại độ dài s: tâm càng chính trên tim, thân theo tiếp tuyến, bánh mũi thẳng (đầu pha / nhảy pha)
    function taxiPlace(P, s) {
      const o = fSample(P, s); F.M = [o.x, o.z]; F.psi = Math.atan2(-o.tz, o.tx); F.delta = 0; F.s = s;
      plane.rotation.set(0, F.psi, 0); plane.position.y = 0; setPlanePose(F.M, F.psi);
    }
    function taxiAlong(P, dt, vMax, sStop) {
      if (!F.M) { F.M = mainOf(); F.psi = plane.rotation.y; F.delta = STEER.nose; F.s = pathProj(P, F.M, 0, P.len, 0.25); }
      const o = {}; let vT = vMax;
      for (let d = 0; d <= 36; d += 1.5) {                            // nhìn trước 36 world: giảm tốc kịp trước khi vào cua
        fSample(P, F.s + d, o); const Rm = o.k > 1e-4 ? 1 / o.k / WSC : 1e9;
        vT = Math.min(vT, Math.sqrt(1.0 * Rm + 2 * 0.7 * d / WSC));
      }
      if (sStop !== undefined) vT = Math.min(vT, Math.sqrt(Math.max(0, 2 * 0.7 * (sStop - F.s) / WSC)));
      F.v = ramp(F.v, vT, 0.6, 1.2, dt);
      if (sStop !== undefined && sStop - F.s < 0.3 && F.v < 0.15) F.v = 0;
      const n = Math.max(1, Math.ceil(dt / 0.04)), h = dt / n;
      for (let i = 0; i < n; i++) {
        const v = F.v * WSC, Ld = Math.max(5, Math.min(16, 4 + v * 1.5));   // world
        fSample(P, Math.min(P.len, F.s + Ld), o);
        const dx = o.x - F.M[0], dz = o.z - F.M[1], c = Math.cos(F.psi), sn = Math.sin(F.psi);
        const al = Math.atan2(-dx * sn - dz * c, dx * c - dz * sn);                    // góc tới điểm đích (+ = bên trái)
        const dDes = Math.max(-STEER.MAX, Math.min(STEER.MAX, Math.atan2(2 * LW_W * Math.sin(al), Ld)));
        F.delta += Math.max(-STEER.RATE * h, Math.min(STEER.RATE * h, dDes - F.delta));
        F.M[0] += c * v * h; F.M[1] -= sn * v * h; F.psi += v * Math.tan(F.delta) / LW_W * h;
        F.s = pathProj(P, F.M, F.s - 0.5, F.s + 1 + v * h * 2, 0.05);
      }
      plane.rotation.set(0, F.psi, 0); plane.position.y = 0; setPlanePose(F.M, F.psi);
      STEER.nose = F.delta; STEER.live = true;
      return o;
    }

    const PHASES = {
      // ── 7 · lăn ra khỏi vị trí đỗ (sau khi xe kéo tách) tới khi máy bay ra khỏi khung / mép sân
      gtaxi: {
        // G 14/10: sau khi xe kéo tách, máy bay KHÔNG lăn thẳng ra mép sân mà rẽ TRÁI (bán kính 24 m ≈ bánh mũi 51°) vào đúng tim vạch
        // dẫn A1 rồi lăn ra theo vạch về phía đường lăn (mép sân trên-trái) — đường: tia hướng mũi ∩ tim A1, bo cung tại giao điểm
        enter() {
          FLT.rateT = 2; const M0 = mainOf(), p = { x: M0[0], z: M0[1] }, h = plane.rotation.y, d = [Math.cos(h), -Math.sin(h)];
          const L0 = [PPOS.x + PDIR.x * PIV_L.x * 1.1, PPOS.z + PDIR.z * PIV_L.x * 1.1], PD = [PDIR.x, PDIR.z];
          const det = d[0] * -PD[1] + d[1] * PD[0], rx = L0[0] - p.x, rz = L0[1] - p.z, tt = (rx * -PD[1] + rz * PD[0]) / det;
          const C = [p.x + d[0] * tt, p.z + d[1] * tt], turn = Math.acos(Math.max(-1, Math.min(1, -(d[0] * PD[0] + d[1] * PD[1]))));
          const R = Math.max(6, Math.min(12, (tt - 0.4) / Math.tan(turn / 2)));
          F.P = fPath([[p.x, p.z], C, [C[0] - PD[0] * 140, C[1] - PD[1] * 140]], [R]); F.s = 0; F.v = 0;
          ENG_MODE.n2 = n2For(0.32);
          cap('7 · Lăn ra — đẩy ga nhẹ cho máy chuyển bánh, rẽ trái vào tim vạch A1 rồi theo vạch ra đường lăn');
        },
        step(dt) {
          if (FLT.t > 3) ENG_MODE.n2 = null;
          taxiAlong(F.P, dt, 7);
          hud('GS ' + Math.round(F.v / KT) + ' kt · N1 ' + n1Pct(), FLT.t);
          const n = toW(NOSE_L);
          if (!F.out && (offscreen() || n.z < -44 || n.x < -58)) { F.out = true; fadeTo(() => go('rtaxi')); }
        }
      },
      // ── 8–10 · đường lăn A → điểm chờ A1 → lên đường băng 09, thẳng hàng
      rtaxi: {
        enter() {
          setsShow('rwy'); FLT.rateT = 3; FLT.air = false;
          const P = RWY.taxiPath; F.s = 0; F.v = 9; F.stop = 0;
          let sHold = 0, sLine = P.len; const o = {};
          const NOSE_M = NOSE_OFF - (MX_W - PIV_L.x * 1.1);                            // mũi trước tâm càng chính (world)
          for (let s = 0; s < P.len; s += 0.4) { fSample(P, s, o); if (!sHold && Math.abs(o.x - RWY.cx) < 0.6 && o.z <= RWY.hold + 2 + NOSE_M) sHold = s; if (o.z < 0.05 && o.x >= RWY.cx + 18 - 0.3) { sLine = s; break; } }
          sLine = Math.min(P.len, sLine + 14);                                         // lăn thẳng thêm ~28 m sau cua ⇒ bánh mũi về thẳng, thân đúng tim
          Object.assign(F, { sHold, sLine });
          taxiPlace(P, 0);
          view({ theta: 0.42, phi: 0.92, zoom: 0.95, target: [RWY.cx - 20, 0, 52] });
          cap('8 · Đường lăn A → điểm chờ A1 — thẳng ≤ 20 kt, vào cua ~10 kt');
        },
        step(dt, dtR) {
          const P = RWY.taxiPath;
          if (F.stage === undefined) F.stage = 0;
          if (F.stage === 0) { taxiAlong(P, dt, 10, F.sHold); if (F.s >= F.sHold - 0.3 && F.v < 0.05) { F.stage = 1; F.w = 0; FLT.rateT = 1; cap('9 · Dừng trước vạch chờ — tổ lái đọc danh mục trước cất cánh, chờ lệnh đài'); } }
          else if (F.stage === 1) { F.w += dt; STEER.nose = F.delta; STEER.live = true; if (F.w > 2.5) { F.stage = 2; FLT.rateT = 3; cap('10 · "Lên đường băng 09 và chờ" — rẽ vào tim đường băng, thẳng hàng'); } }
          else if (F.stage === 2) { taxiAlong(P, dt, 7, F.sLine); if (F.s >= F.sLine - 0.3 && F.v < 0.05) { F.stage = 3; F.w = 0; FLT.rateT = 1; } }
          else { F.w += dt; STEER.nose = F.delta; STEER.live = true; if (F.w > 1.5) go('roll'); }   // đứng yên: bánh mũi giữ nguyên góc
          const p = toW(PIV_L, _tw); follow(dtR, p.x + 6, 0, p.z - 10, 0.9);
          hud('GS ' + Math.round(F.v / KT) + ' kt · N1 ' + n1Pct(), FLT.t);
        }
      },
      // ── 11 · chạy đà: lực đẩy − cản − ma sát lăn · VR ⇒ nâng mũi · L ≥ W ⇒ rời đất
      roll: {
        enter() {
          const p = toW(PIV_L); Object.assign(F, { x: p.x, xs: p.x, z0: p.z, h0: Math.atan2(Math.sin(plane.rotation.y), Math.cos(plane.rotation.y)), V: 0, th: 0, stage: 0, m: AC.mTO });
          ENG_MODE.n2 = n2For(0.40); FLT.rateT = 1; FLT.air = false;                   // bánh lăn: trên mặt đất
          cap('11 · "Được phép cất cánh 09" — đẩy ga ~40 % chờ 4 máy ổn định, rồi TO/GA (N1 ≈ 98 %)');
          view({ theta: 0.5, phi: 0.95, zoom: 1.05 }, true);                         // cùng cảnh với lúc thẳng hàng ⇒ chuyển góc êm, không cắt
        },
        step(dt, dtR) {
          if (F.stage === 0 && FLT.t > 2.5) { F.stage = 1; ENG_MODE.n2 = n2For(0.98); FLT.rateT = 3; cap('11 · Cất cánh — lực đẩy cất cánh, giữ tim đường băng · 80 kt kiểm tra đồng hồ'); }
          const W = F.m * G0, n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
          for (let i = 0; i < n; i++) {
            const q = 0.5 * AC.rho * F.V * F.V, CL = 0.55 + 0.105 * F.th / D2R, L = q * AC.S * CL, D = q * AC.S * (0.07 + 0.045 * CL * CL);
            const a = (thrustN(F.V) * Math.cos(F.th) - D - 0.016 * Math.max(0, W - L)) / F.m;
            F.V = Math.max(0, F.V + a * h); F.x += F.V * h * WSC;
            if (F.V >= 160 * KT) F.th = Math.min(14 * D2R, F.th + (F.th < 9 * D2R ? 2.5 : 1.5) * D2R * h);
            if (L >= W && F.th > 5 * D2R) { F.lift = true; break; }
          }
          if (F.stage === 1 && F.V >= 150 * KT) { F.stage = 2; cap('"V1" 150 kt — từ đây không còn huỷ cất cánh'); }
          if (F.stage === 2 && F.V >= 160 * KT) { F.stage = 3; FLT.rateT = 1; cap('"Rotate" — VR 160 kt: nâng mũi đều 2,5°/s, càng thân là điểm tựa'); }
          const ez = Math.exp(-(F.x - F.xs) / 25);                                       // lệch còn lại sau thẳng hàng tắt dần (bánh lái hướng)
          planePose(F.x, 0.12, F.z0 * ez, F.h0 * ez, F.th);
          camLock(dtR, F.x + 26, -4);
          hud('GS ' + Math.round(F.V / KT) + ' kt · N1 ' + n1Pct() + ' · θ ' + (F.th / D2R).toFixed(1) + '°', FLT.t);
          if (F.lift) { const s = { x: F.x, V: F.V, th: F.th, m: F.m, cam: F.cam }; go('climb'); Object.assign(F, s); }   // giữ nguyên ray camera qua lúc rời đất
        }
      },
      // ── 12 · leo đầu: phương trình trục gió · thu càng sau 3 s · camera thôi bám ⇒ máy bay ra khỏi khung
      climb: {
        enter() { FLT.air = true; Object.assign(F, { g: 0, hm: 0 }); cap('12 · Rời đất ~170 kt — "Positive rate, gear up": thu càng (~8 s), giữ V2 + 10'); },
        step(dt, dtR) {
          const W = F.m * G0, n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
          for (let i = 0; i < n; i++) {
            F.th = Math.min(14 * D2R, F.th + 1.5 * D2R * h);
            const al = F.th - F.g, q = 0.5 * AC.rho * F.V * F.V, CL = 0.55 + 0.105 * al / D2R;
            const L = q * AC.S * CL, D = q * AC.S * (0.07 + 0.045 * CL * CL - 0.015 * FLT.gearK), T = thrustN(F.V);
            F.V += (T * Math.cos(al) - D - W * Math.sin(F.g)) / F.m * h;
            F.g += (L + T * Math.sin(al) - W * Math.cos(F.g)) / (F.m * F.V) * h;
            F.g = Math.max(0, F.g); F.hm += F.V * Math.sin(F.g) * h; F.x += F.V * Math.cos(F.g) * h * WSC;
          }
          if (FLT.t > 2.5) FLT.gear = 1;
          planePose(F.x, 0.12 + F.hm * WSC, 0, 0, F.th);
          camLock(dtR, F.x + 26, -4, 1 - win(FLT.t, 7.5, 10));                  // bám tới khi càng gần thu xong rồi nhả êm ⇒ bay ra khỏi khung
          hud('IAS ' + Math.round(F.V / KT) + ' kt · ALT ' + Math.round(F.hm / FT) + ' ft · V/S ' + Math.round(F.V * Math.sin(F.g) / FT * 60 / 50) * 50 + ' ft/ph', FLT.t);
          if (!F.out && (offscreen() || FLT.t > 18)) { F.out = true; fadeTo(() => go('sky'), '#d9e4eb'); }
        }
      },
      // ── 13–14 · bầu trời: lên độ cao → bay bằng FL350, vệt ngưng tụ · chờ bấm "Hạ cánh"
      sky: {
        enter() {
          setsShow('sky'); EARTH.d = 0; FLT.rateT = 1; FLT.vol = 0.45; FLT.gear = 1; FLT.gearK = 1; FLT.air = true; DEP.flaps = false;   // mỗi chuyến bắt đầu ở đầu đông Grand Canyon
          ENG_MODE.n2 = n2For(0.92); SKY.trailMat.opacity = 0;
          view({ theta: SKY_CAM.theta, phi: SKY_CAM.phi, zoom: 1.3, target: [0, 0, 0] });
          cap('13 · Lên độ cao — thu tà về 0°, càng đã thu · lực đẩy leo (N1 ≈ 92 %)');
        },
        step(dt) {
          const t = FLT.t, k = win(t, 0, 9);
          const x = -130 * (1 - k), y = -55 * (1 - k) + 0.4 * Math.sin(t * 0.5), z = 0;      // leo vào từ trái-dưới khung (nhìn ngang)
          const th = (9 * (1 - k) + 2.5 * k + 0.15 * Math.sin(t * 0.5 + 1)) * D2R, ro = 0.6 * Math.sin(t * 0.37) * D2R * k;
          planePose(x, y, z, 0, th, ro);
          skyScroll(dt, SKY.speed, 0);
          SKY.trailMat.opacity = 0.75 * win(t, 7, 13);
          if (t > 9 && !F.cruise) { F.cruise = true; FLT.phase = 'sky'; ENG_MODE.n2 = n2For(0.86); cap('14 · Bay bằng FL350 trên Grand Canyon (Arizona) — mặt đất là ảnh vệ tinh thật, trôi đúng tốc độ bay · vệt ngưng tụ sau 4 động cơ — bấm "Hạ cánh" để về'); if (btnLand) btnLand.hidden = false; }
          const [la, lo] = earthLatLon(), pos = la.toFixed(3) + '°N ' + (-lo).toFixed(3) + '°W';
          hud(F.cruise ? 'FL350 · M 0.855 · GS 490 kt · hướng ' + EARTH.brg + '° · ' + pos : 'ALT ' + Math.round(4000 + 31000 * k) + ' ft · IAS ' + Math.round(250 + 60 * k) + ' kt · ' + pos, t);
        }
      },
      // ── 15 · bắt đầu hạ độ cao: không tải, phanh khí nhẹ, chúc mũi ⇒ bay THẲNG ra mép phải khung (G 16/10: nhìn ngang, trái → phải)
      desc: {
        enter() { if (btnLand) btnLand.hidden = true; ENG_MODE.n2 = null; FLT.spoil = 0.4; F.x = 0; F.y = 0; F.z = 0; F.h = 0;
          cap('15 · Bắt đầu hạ độ cao (top of descent) — cần ga về không tải, mở phanh khí (spoiler bay) một phần, chúc mũi rời độ cao bay bằng'); },
        step(dt) {
          const t = FLT.t, v = 6 + 30 * win(t, 0, 3.5);                                  // tốc độ so với khung (camera bay kèm tụt lại)
          F.x += v * dt; F.y -= (1.2 + 3.5 * win(t, 0.5, 3)) * dt;
          planePose(F.x, F.y, 0, 0, (2.5 - 3.5 * win(t, 0, 2.5)) * D2R, 0);             // 2.5° → −1° chúc mũi
          skyScroll(dt, SKY.speed, 0);
          SKY.trailMat.opacity = 0.75 * (1 - win(t, 0, 3));
          hud('ALT ' + Math.round(35000 - 900 * t) + ' ft · V/S −2 500 ft/ph · N1 ' + n1Pct(), t);
          if (!F.out && (offscreen() || t > 8)) { F.out = true; FLT.spoil = 0; fadeTo(() => go('appr')); }
        }
      },
      // ── 16–17 · tiếp cận chót + flare
      appr: {
        enter() {
          setsShow('rwy'); FLT.rateT = 1; FLT.vol = 1; FLT.gear = 0; FLT.gearK = 0; FLT.air = true; FLT.tilt = 1; FLT.spoil = 0; FLT.f30 = 1;   // càng đã thả từ trước, bogie ngửa mũi
          DEP.flaps = true; wingK.kr = 1; wingK.flap = 1; wingK.f30 = 1; wingK.sp = 0;
          ENG_MODE.n2 = n2For(0.60);
          const xg = RWY.td; Object.assign(F, { xg, x: xg - 520, V: 150 * KT, th: 2.5 * D2R, Vy: 0, stage: 0 });
          F.hm = (F.xg - F.x) / WSC * Math.tan(3 * D2R); F.Vy = -F.V * Math.tan(3 * D2R);
          planePose(F.x, 0.12 + F.hm * WSC, 0, 0, F.th);
          view({ theta: 0.5, phi: 0.95, zoom: 1.05, target: [F.x + 18, 0, -4] });
          cap('16 · Tiếp cận chót đường băng 09 — càng thả, tà 30°, Vref + 5 ≈ 150 kt, dốc 3° (PAPI: 2 trắng 2 đỏ)');
        },
        step(dt, dtR) {
          const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
          for (let i = 0; i < n; i++) {
            if (F.stage === 0) { F.hm = Math.max(0, (F.xg - F.x) / WSC * Math.tan(3 * D2R)); if (F.hm <= 30 * FT) { F.stage = 1; cap('17 · 30 ft: nâng mũi (flare) lên ~5° · 20 ft: "Retard" — cần ga về không tải'); } }
            else {
              F.Vy += (-(0.5 + 3.5 * F.hm / (30 * FT)) - F.Vy) * Math.min(1, h * 2.5);
              F.hm += F.Vy * h; F.th = Math.min(5.5 * D2R, F.th + 1.2 * D2R * h); F.V -= 0.7 * h;
              if (F.hm < 20 * FT) ENG_MODE.n2 = null;
            }
            F.x += F.V * h * WSC;
            if (F.hm <= 0) { F.hm = 0; F.td = true; break; }
          }
          planePose(F.x, 0.12 + F.hm * WSC, 0, 0, F.th);
          camLock(dtR, F.x + 18, -4);
          hud('IAS ' + Math.round(F.V / KT) + ' kt · RA ' + Math.round(F.hm / FT) + ' ft · V/S ' + Math.round((F.stage ? F.Vy : -F.V * Math.tan(3 * D2R)) / FT * 60 / 10) * 10 + ' ft/ph', FLT.t);
          if (F.td) { const s = { x: F.x, V: F.V, th: F.th }; go('rollout'); Object.assign(F, s); }
        }
      },
      // ── 18–19 · chạy đà hạ cánh: spoiler mặt đất, đảo chiều, phanh tự động tính tới RET (brake-to-vacate)
      rollout: {
        enter() {
          FLT.air = false; FLT.spoil = 1; ENG_MODE.n2 = n2For(0.70); F.stage = 0; SMOKE.emit = 0.35;   // chạm đất: bánh sau chạm trước, bogie ép phẳng · khói lốp
          cap('18 · Chạm bánh chính — spoiler mặt đất bung, đảo chiều lực đẩy, phanh tự động · hạ mũi');
        },
        step(dt, dtR) {
          const xRet = RWY.retPath.pts[0][0] + 200;                       // điểm bắt đầu cua RET (~ tiếp tuyến cung 275 m)
          if (F.a === undefined) F.a = Math.min(3, Math.max(1.2, (F.V * F.V - 15 * 15) / (2 * Math.max(50, (xRet - F.x) / WSC))));
          F.th = Math.max(0, F.th - 2 * D2R * dt);
          if (F.th <= 0 && F.stage === 0) { F.stage = 1; F.noseSmoke = true; FLT.rateT = 2; cap('19 · Giảm tốc để vào đường lăn thoát nhanh (RET) ở ~30 kt — 60 kt thôi đảo chiều'); }
          if (F.V < 60 * KT) ENG_MODE.n2 = null;
          F.V = Math.max(15, F.V - F.a * dt); F.x += F.V * dt * WSC;
          planePose(F.x, 0.12, 0, 0, F.th);
          if (SMOKE.emit > 0) { SMOKE.emit -= dt; smokeTouch('main', 1, 5.2, 2.6, 0.8); }      // lốp chính trượt lúc quay kịp tốc độ
          if (F.noseSmoke) { F.noseSmoke = false; smokeTouch('nose', 4, 2.6, 1.6, 0.5); }
          camLock(dtR, F.x + 14, 4);
          hud('GS ' + Math.round(F.V / KT) + ' kt · phanh ' + F.a.toFixed(1) + ' m/s² · N1 ' + n1Pct(), FLT.t);
          if (F.x >= xRet - 40) { const s = { V: F.V, s: F.x - RWY.retPath.pts[0][0] }; go('exit'); Object.assign(F, s); }
        }
      },
      // ── 20 · rẽ vào RET, thu spoiler + tà, ra khỏi khung
      exit: {
        enter() { FLT.spoil = 0; FLT.f30 = 0; DEP.flaps = false; cap('20 · Rẽ vào đường lăn thoát nhanh — thu spoiler, thu tà, lăn về cổng'); },
        step(dt, dtR) {
          const P = RWY.retPath; if (F.v === undefined) F.v = F.V;                     // tốc độ nối từ chạy đà hạ cánh
          taxiAlong(P, dt, 12);
          camLock(dtR, F.M[0] + 10, F.M[1], 1 - win(FLT.t, 0.5, 3.5));
          hud('GS ' + Math.round(F.v / KT) + ' kt · N1 ' + n1Pct(), FLT.t);
          if (!F.out && (offscreen() || FLT.t > 16)) { F.out = true; fadeTo(() => go('arr')); }
        }
      },
      // ── 21–25 · về cổng: lăn theo vạch dẫn vào A1 (sân TRỐNG) → dừng, tắt máy → đèn chớp tắt ⇒ người tiến ra: tai nghe ở mũi,
      //    chèn bánh, cọc tiêu, cắm chốt càng → ống lồng áp cửa L1 · GPU vào cắm điện · PCA → xe nâng hàng tiến vào (sàn trước),
      //    mở cửa hầm, nâng sàn → container + đoàn xe hành lý → xe tra nạp & xe bồn lùi vào dưới cánh.
      //    G 15/10: người & xe chỉ xuất hiện SAU khi máy bay đỗ hẳn (IATA IGOM: chỉ tiếp cận khi đèn chớp đã tắt) — bản trước GPU
      //    đứng sẵn lúc lăn vào, mọi xe / người / hàng hiện ra cùng lúc khi kết thúc.
      arr: {
        enter() {
          setsShow('gate'); FLT.rateT = 2; FLT.gear = 0; FLT.gearK = 0; FLT.air = false; FLT.tilt = 0; FLT.f30 = 0; FLT.spoil = 0; wingK.f30 = 0; wingK.sp = 0; wingK.flap = 0; wingK.kr = 0;
          DEP.flaps = false; DEP.beacon = true; FLT.beaconOff = false;
          if (!GSE_RUN.length) { for (const o of [belt, fuel, refuelVehicle, gp]) remember(o); gseRoutes(); }   // nhảy thẳng tới pha này (debug)
          vis([gp, belt, fuel, refuelVehicle, APRON_RM, GSE_X.gpuCable, GSE_X.fuelHose, cargo, CREW.h1, CREW.h2, CREW.h3, tugUnit, ...dollyCarts, ...cargoBoxes, pushTug, ...FUEL_LABEL, ...BRIDGE.pca], false);
          DEP.hideTrain = true; DEP.loader = 1; ARR.clear();
          Object.assign(F, { d: 46, v: 4.5, stage: 0 });
          const ox = PPOS.x - PDIR.x * F.d, oz = PPOS.z - PDIR.z * F.d; plane.rotation.set(0, PROT, 0); plane.position.set(ox, 0, oz);
          view({ theta: 0.42, phi: 0.9, zoom: 1.35, target: [PPOS.x - PDIR.x * 8, 0, PPOS.z - PDIR.z * 8] });
          cap('21 · Lăn vào vị trí A1 theo vạch dẫn — màn hình dẫn đỗ (VDGS) báo khoảng cách còn lại');
        },
        step(dt) {
          if (F.stage === 0) {
            F.v = Math.min(F.v, Math.sqrt(Math.max(0, 2 * 0.45 * F.d / WSC)) + 0.05); F.d = Math.max(0, F.d - F.v * WSC * dt);
            plane.position.set(PPOS.x - PDIR.x * F.d, 0, PPOS.z - PDIR.z * F.d);
            hud('Còn ' + (F.d / WSC).toFixed(0) + ' m · GS ' + Math.round(F.v / KT) + ' kt', FLT.t);
            if (F.d <= 0.01) { F.stage = 1; F.w = 0; FLT.rateT = 1; setIgnite(false); ENG_MODE.n2 = null; hudTxt = '';
              cap('22 · Dừng đúng vạch — phanh đỗ, tắt 4 máy (cắt nhiên liệu), rô-to quay chậm dần'); }
          } else {
            F.w += dt; const t = F.w;
            if (t > 5 && !FLT.beaconOff) { FLT.beaconOff = true; DEP.beacon = false; FLT.rateT = 2; cap('23 · Đèn chớp tắt ⇒ nhân viên mặt đất tiếp cận: chèn bánh, đặt cọc tiêu, cắm chốt càng · ống lồng tiến vào cửa L1'); }
            if (t > 5) { fadeObj(CREW.h1, win(t, 5.2, 6.6)); for (const h of [CREW.h2, CREW.h3]) fadeObj(h, win(t, 5.8, 7.2)); fadeObj(APRON_RM, win(t, 6.5, 8.5)); gearPins(t > 8.5); }
            if (t > 6 && !F.wide) { F.wide = true; FLT.camTau = 1.6; FLT.zoomT = 0.58; FLT.tgtT = new THREE.Vector3(12, 0, 6); }   // lùi khung êm ra toàn sân (đúng khung mặc định ⇒ kết thúc không giật)
            if (t > 6) BRIDGE.set(BRIDGE.R_MAX * (1 - win(t, 6, 13)), 0.35 * (1 - win(t, 6, 10)));
            if (t > 13) vis(BRIDGE.pca, true);
            // xe vào theo SỰ KIỆN (không theo giờ cố định — tốc độ / thử phanh quyết định lúc tới). G 16/10: cửa hầm hàng MỞ TRƯỚC
            // (cửa hất lên-ra ngoài — xe nâng kê sát ngưỡng thì cửa không mở được; khởi hành thì ngược lại: xe rút rồi mới đóng) →
            // xe nâng hàng tiến vào → nâng sàn tới ngưỡng → container + đoàn xe hành lý · GPU → cắm điện · xe tra nạp & xe bồn → nối vòi
            plane.userData.cargoDoor.set(win(t, 9.5, 12.5));
            if (t > 9.5 && !F.c24) { F.c24 = true; cap('24 · Mở cửa hầm hàng trước (cửa hất lên-ra ngoài) — mở xong mới cho xe nâng hàng vào: dừng thử phanh trước vùng an toàn, bò vào bằng tốc độ đi bộ'); }
            const gpuIn = arrDrive(gp, t, 8, 1e9, dt);
            if (gpuIn && F.gpuT === undefined) { F.gpuT = t; vis([GSE_X.gpuCable], true); cap('25 · Cắm điện mặt đất (GPU) + điều hoà (PCA), tắt APU'); }
            const beltIn = arrDrive(belt, t, 13, 16, dt);                                       // khởi hành khi cửa đã mở hẳn
            if (beltIn && F.beltT === undefined) F.beltT = t;
            const bt = F.beltT ?? 1e9;
            DEP.loader = 1 - win(t, bt + 0.3, bt + 3.3);                                          // ghé sát ngưỡng → nâng sàn
            if (t > bt + 3) { fadeObj(cargo, win(t, bt + 3, bt + 6)); DEP.hideTrain = false; const k = win(t, bt + 3.5, bt + 6.5); for (const o of [tugUnit, ...dollyCarts]) fadeObj(o, k); for (const o of cargoBoxes) fadeObj(o, k, false); }
            if (t > bt + 0.3 && !F.c26) { F.c26 = true; cap('26 · Xe nâng hàng ghé sát ngưỡng cửa, nâng sàn — dỡ container lên đoàn xe hành lý · xe tra nạp & xe bồn lùi chậm vào dưới cánh (có người chỉ dẫn)'); }
            const refIn = arrDrive(refuelVehicle, t, bt + 1, 7, dt), fuelIn = arrDrive(fuel, t, bt + 2.5, 7, dt);
            if (fuelIn && refIn && F.fuelT === undefined) F.fuelT = t;
            vis([GSE_X.fuelHose], t > (F.fuelT ?? 1e9) + 0.8);
            if (t > Math.max(F.fuelT ?? 1e9, bt + 6, F.gpuT ?? 1e9) + 2.5 && !F.done) { F.done = true; fadeTo(() => { flightEnd(); cap('✓ Đã về cổng A1 — sẵn sàng quay vòng cho chuyến sau'); FLT.capT = 4; }); }
          }
        }
      },
    };

    // xe phục vụ VÀO vị trí lúc đến cổng — quy trình mặt đất (IATA AHM 913 / IGOM): tiếp cận ≤ 15 km/h (2.1 world/s) → DỪNG THỬ
    // PHANH trước vùng an toàn quanh tàu bay (6 world ≈ 12 m) 1 s → bò vào bằng tốc độ đi bộ ≤ 5 km/h (0.7 world/s) → dừng hẳn.
    // Đường = chiếu ngược đường rời đi lúc khởi hành (GSE_RUN, 19b), đoạn cuối dài L; trục sau bám tim, đầu xe theo tiếp tuyến như lúc
    // rời đi tại cùng điểm ⇒ xe nâng hàng / GPU tiến vào bằng đầu quay về tàu bay; xe bồn + xe tra nạp (đỗ đầu quay về đuôi để rời đi
    // bằng số tiến) LÙI vào — chỉ lùi chậm có người chỉ dẫn. Mờ → rõ 1.2 s đầu. Trả về true khi đã đỗ đúng chỗ.
    const ARR = new Map();
    function arrDrive(o, t, t0, L, dt) {
      const r = GSE_RUN.find((q) => q.o === o), hm = gseHome.get(o); if (!r || !hm) return true;
      let A = ARR.get(o); if (!A) { A = { s: Math.min(r.P.len, L), v: 0, ph: 0, tw: 0, f: 0 }; ARR.set(o, A); }
      if (t < t0) { o.visible = false; return false; }
      const rev = r.sgn > 0, SC = 6;                                                      // lùi vào: cả quãng tốc độ đi bộ
      if (A.ph === 0) {                                                                   // tiếp cận → dừng thử phanh ở mép vùng an toàn
        const d = A.s - SC, vT = d > 0 ? Math.min(rev ? 0.7 : 2.1, Math.sqrt(2 * 1.0 * d)) : 0;
        A.v += Math.max(-1.0 * dt, Math.min(0.5 * dt, vT - A.v));
        if (d <= 0.02 && A.v < 0.06) { A.v = 0; A.ph = 1; A.tw = 0; }
      } else if (A.ph === 1) { A.v = 0; if ((A.tw += dt) > 1) A.ph = 2; }                 // thử phanh 1 s
      else if (A.ph === 2) {                                                              // bò vào, dừng đúng chỗ
        const vT = Math.min(0.7, Math.sqrt(2 * 1.0 * Math.max(0, A.s)));
        A.v += Math.max(-1.0 * dt, Math.min(0.5 * dt, vT - A.v));
        if (A.s <= 0.005) { A.s = 0; A.v = 0; A.ph = 3; }
      }
      A.s = Math.max(0, A.s - A.v * dt);
      const q = fSample(r.P, A.s), a = Math.atan2(-q.tz, q.tx) + (r.sgn < 0 ? Math.PI : 0), e = win(A.s, 0.5, 0);
      if (A.ph === 3) { o.position.copy(hm.p); o.rotation.y = hm.ry; }
      else { o.position.set(q.x, hm.p.y, q.z); o.rotation.y = a + Math.atan2(Math.sin(hm.ry - a), Math.cos(hm.ry - a)) * e; }
      A.f = Math.min(1, A.f + dt / 1.2); fadeObj(o, A.f);
      return A.ph === 3;
    }

    function flightStep(dtR) {
      const ce = 1 - Math.exp(-dtR / FLT.camTau);                                       // zoom / điểm nhìn trượt êm (wheel / kéo pan huỷ)
      if (FLT.zoomT) { camera.zoom += (FLT.zoomT - camera.zoom) * ce; camera.updateProjectionMatrix(); if (Math.abs(FLT.zoomT - camera.zoom) < 1e-3) FLT.zoomT = 0; }
      if (FLT.tgtT) { target.lerp(FLT.tgtT, ce); if (target.distanceToSquared(FLT.tgtT) < 1e-4) FLT.tgtT = null; }
      FLT.gearK = ramp(FLT.gearK, FLT.gear, 1 / 8, 1 / 10, dtR);                     // thu ~8 s · thả ~10 s (747: thu trong ~8–10 s)
      FLT.tilt = ramp(FLT.tilt, FLT.air ? 1 : 0, 1 / 1.4, 1 / 0.3, dtR);               // rời đất: bogie ngửa dần · chạm đất: ép phẳng nhanh
      gearUpdate(FLT.gearK, FLT.tilt);
      if (FLT.capT > 0 && (FLT.capT -= dtR) <= 0) { FLT.capT = -1; if (!FLT.phase && !DEP.active) depCap.hidden = true; }
      if (!FLT.phase) return;
      FLT.rate += (FLT.rateT - FLT.rate) * (1 - Math.exp(-dtR / 0.6));              // đổi nhịp nén thời gian MƯỢT (bản trước nhảy bậc ×2.4 ↔ ×0.8 ⇒ khựng)
      const dt = dtR * FLT.rate; FLT.t += dt;
      PHASES[FLT.phase].step(dt, dtR); smokeStep(dt);
      plane.updateMatrix(); ENG_LABEL.matrix.multiplyMatrices(plane.matrix, home.inv); ENG_LABEL.matrixWorldNeedsUpdate = true;
      // camera bóng bám LIÊN TỤC điểm nhìn trên mặt đất (y = 0). ĐỪNG khoá theo bước texel: điểm khoá lệch khỏi mặt đất ⇒ độ sâu
      // mặt đất trong bản đồ bóng đổi mỗi khung ⇒ cả mặt đất sáng / tối nhảy 3–8 mức (G 15/10 "hạ cánh đường băng flashing")
      if (FLT.set !== 'gate') { sun.position.set(target.x + SUN0.x, target.y + SUN0.y, target.z + SUN0.z); sun.target.position.copy(target); sun.target.updateMatrixWorld(); }
    }
    function flightBegin() { go('gtaxi'); }
    // kết thúc / huỷ: mọi thứ về trạng thái cổng ban đầu (camera về khung mặc định)
    function flightEnd() {
      FLT.phase = null; depReset();
      Object.assign(FLT, { rate: 1, rateT: 1, zoomT: 0, tgtT: null, camTau: 0.5, play: 1, vol: 1, f30: 0, spoil: 0, gear: 0, gearK: 0, air: false, tilt: 0, beaconOff: false });
      gearUpdate(0, 0); wingK.f30 = 0; wingK.sp = 0; ENG_MODE.n2 = null; if (btnLand) btnLand.hidden = true;
      setsShow('gate'); plane.rotation.set(0, home.rot, 0); plane.position.copy(home.pos);
      view({ theta: 0.42, phi: 0.9, zoom: 0.58, target: [12, 0, 6] });
    }
    function flightAbort() { fadeTo(flightEnd); }
    if (btnLand) btnLand.addEventListener('click', () => { if (FLT.phase === 'sky' && !FLT.busy) go('desc'); });
    // debug: __fltJump('rtaxi' | 'roll' | 'sky' | 'appr' | 'arr') — nhảy thẳng tới 1 pha (bỏ qua chuỗi ở cổng)
    window.__fltJump = (name) => {
      DEP.active = false; DEP.hideTrain = true; DEP.beacon = true; DEP.flaps = name !== 'sky' && name !== 'arr';
      ENG_MODE.idle = true; if (!isEngineIgnited) setIgnite(true); SPOOL.forEach(s => Object.assign(s, { lit: true, n2: 0.68, n1: 0.22, t: 99, dwell: 9 }));
      depBtn.innerHTML = '<i class="ti ti-arrow-back-up"></i>Về cổng';
      if (name === 'roll') { go('rtaxi'); F.stage = 3; F.w = 0; taxiPlace(RWY.taxiPath, F.sLine); }
      else go(name);
    };
    /* ═══ animation-loop — đoàn hành lý chạy vòng · xe tải đường trên · nhịp thở ═══ */
    // 🧳 ĐOÀN XE KÉO HÀNH LÝ ĐỘNG THÔNG MINH (Smart Cargo Tow Train Cycle)
    function cartBase() { const b = Bag(); dolly(b, 0, 0, 0); return b.build(); }            // dolly con lăn + càng kéo
    function cargoBox() { const b = Bag(); ld3(b, 0, DOLLY_TOP, 0, 0, LD3_K); return b.build(); }   // container LD3 cỡ thật trên sàn con lăn

    // Tạo 1 đầu kéo (Tug) + 3 xe rơ-moóc dolly rỗng + 3 thùng hàng (Khởi tạo 1 lần duy nhất ngoài loop)
    // CỠ THẬT: xe kéo 2.9 × 1.7 × 2.05 m (scale 0.364, bản trước 4.4 × 2.7 × 3.2 m) · dolly & LD3 cùng scale CL_S
    const tugUnit = tug(); tugUnit.scale.set(0.364, 0.364, 0.364); scene.add(tugUnit);
    const dollyCarts = [cartBase(), cartBase(), cartBase()];
    const cargoBoxes = [cargoBox(), cargoBox(), cargoBox()];
    dollyCarts.forEach(c => { c.scale.set(CL_S, CL_S, CL_S); scene.add(c); });
    cargoBoxes.forEach(b => { b.scale.set(CL_S, CL_S, CL_S); scene.add(b); });

    // ── Đường chạy STADIUM: 2 làn thẳng song song nối bằng 2 cung U-turn cong (không quay đầu tức thì).
    //    Đầu xe (tug) dẫn, 3 toa dolly bám theo CÙNG quỹ đạo bằng offset arc-length → uốn lượn kiểu xe lửa.
    const LOOP_PTS = (function () {
      const xNear = 2, xFar = 68, zA = 19.4, zB = 23.8, zc = (zA + zB) / 2, r = (zB - zA) / 2, pts = [];
      for (let x = xNear; x <= xFar; x += 0.8) pts.push([x, zA]);                                          // làn ĐI (hướng +x, về nhà ga)
      for (let a = -Math.PI / 2; a <= Math.PI / 2 + 0.001; a += 0.1) pts.push([xFar + r * Math.cos(a), zc + r * Math.sin(a)]); // U-turn đầu nhà ga
      for (let x = xFar; x >= xNear; x -= 0.8) pts.push([x, zB]);                                          // làn VỀ (hướng -x)
      for (let a = Math.PI / 2; a <= 3 * Math.PI / 2 + 0.001; a += 0.1) pts.push([xNear + r * Math.cos(a), zc + r * Math.sin(a)]); // U-turn đầu máy bay
      return pts;
    })();
    const LOOP_CUM = [0];                                            // độ dài tích luỹ dọc đường
    for (let i = 1; i < LOOP_PTS.length; i++) { const p = LOOP_PTS[i - 1], q = LOOP_PTS[i]; LOOP_CUM.push(LOOP_CUM[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    const LOOP_LEN = LOOP_CUM[LOOP_CUM.length - 1];
    function sampleLoop(s, out) {                                    // arc-length s → reusable {x, z, ang}
      s = ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
      let lo = 0, hi = LOOP_CUM.length - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (LOOP_CUM[mid] <= s) lo = mid; else hi = mid; }
      const p = LOOP_PTS[lo], q = LOOP_PTS[hi], seg = (LOOP_CUM[hi] - LOOP_CUM[lo]) || 1, t = (s - LOOP_CUM[lo]) / seg;
      out.x = p[0] + (q[0] - p[0]) * t;
      out.z = p[1] + (q[1] - p[1]) * t;
      out.ang = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
      return out;
    }
    // ĐOÀN XE HÀNH LÝ (G 15/10 "vehicle physics"): đầu kéo bám đường (trục sau trên tim, đầu xe theo tiếp tuyến); mỗi dolly là RƠ-MOÓC
    // kéo bằng càng: mắt càng móc vào móc sau của xe phía trước, thân dolly đi theo vết kéo (tractrix) ⇒ toa sau cắt góc vào trong cua
    // ("off-tracking" thật của đoàn rơ-moóc) thay vì chạy trùng một vệt như bản trước. Tốc độ ≤ 25 km/h trên đường sân đỗ (3.4 world/s),
    // vòng chữ U bán kính 2.2 world (4.4 m) qua ở gia tốc ngang ≤ 1 m/s² (≈ 1 world/s), tăng tốc ≤ 1 m/s², phanh đều ≤ 2 m/s² về chỗ dừng.
    const CARGO_VMAX = 3.4, CARGO_ACC = 0.5, CARGO_DEC = 1.0;
    const HITCH_R = 1.92 * 0.364, EYE_F = 2.08 * CL_S + 0.06;                       // móc sau (sau gốc xe) · mắt càng dolly (trước gốc dolly)
    const TRAIN_Y = 0.13;                                            // mặt đường chạy: sân đỗ 0.12 · dải lề 0.13 · dải đi bộ 0.14
    const trainAll = [tugUnit, ...dollyCarts];                       // 4 toa: đầu kéo + 3 dolly
    // độ cong tại mỗi đỉnh đường vòng (1/world) — giảm tốc trước vòng chữ U
    const LOOP_K = LOOP_PTS.map((q, i) => {
      const n = LOOP_PTS.length, a = LOOP_PTS[(i - 1 + n) % n], b = LOOP_PTS[(i + 1) % n];
      const t1 = Math.atan2(q[1] - a[1], q[0] - a[0]), t2 = Math.atan2(b[1] - q[1], b[0] - q[0]), da = Math.abs(Math.atan2(Math.sin(t2 - t1), Math.cos(t2 - t1)));
      return da / Math.max(1e-3, (Math.hypot(q[0] - a[0], q[1] - a[1]) + Math.hypot(b[0] - q[0], b[1] - q[1])) / 2);
    });
    const loopK = (s) => { s = ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN; let lo = 0, hi = LOOP_CUM.length - 1; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (LOOP_CUM[m] <= s) lo = m; else hi = m; } return Math.max(LOOP_K[lo], LOOP_K[hi]); };
    // Chu trình: DỪNG load gần cargo (bốc 3 thùng 1-by-1) → chạy tới nhà ga → DỪNG unload → vòng về load lại.
    const S_LOAD = 8;                                                // arc-length điểm dừng bốc hàng (gần cargo, x≈10)
    const S_UNLOAD = 60;                                             // arc-length điểm dừng dỡ hàng (gần nhà ga, x≈62)
    const T_LOAD = 5.4, T_UNLOAD = 3.4;                              // thời gian dừng bốc / dỡ
    let cargoS = S_LOAD, cargoState = 0, stTimer = 0, cargoV = 0;    // state: 0 load · 1 đi tới ga · 2 unload · 3 vòng về
    const cargoSample = { x: 0, z: 0, ang: 0 };
    const trainPose = trainAll.map(() => ({ x: 0, z: 0, ang: 0 })); let trainInit = false;
    function updateCargoTrain(dt) {
      stTimer += dt;
      if (cargoState === 0 || cargoState === 2) {                    // DỪNG bốc / dỡ hàng
        cargoV = 0;
        if (stTimer >= (cargoState === 0 ? T_LOAD : T_UNLOAD)) { cargoState++; stTimer = 0; }
      } else {                                                       // chạy: 1 tới ga (chở hàng) · 3 vòng về điểm bốc (rỗng, qua U-turn)
        const sStop = cargoState === 1 ? S_UNLOAD : S_LOAD + LOOP_LEN, left = sStop - cargoS;
        let vT = Math.min(CARGO_VMAX, Math.sqrt(2 * CARGO_DEC * Math.max(0, left)));
        for (let d = 0; d <= 4; d += 0.5) { const k = loopK(cargoS + d); if (k > 0.05) vT = Math.min(vT, Math.sqrt(0.5 / k + 2 * CARGO_DEC * d)); }
        cargoV += Math.max(-CARGO_DEC * dt, Math.min(CARGO_ACC * dt, vT - cargoV));
        cargoS = Math.min(sStop, cargoS + cargoV * dt);
        if (left < 0.02 && cargoV < 0.05) { cargoS = cargoState === 1 ? S_UNLOAD : S_LOAD; cargoV = 0; cargoState = (cargoState + 1) % 4; stTimer = 0; }
      }
      // đầu kéo: trục sau trên tim, đầu xe theo tiếp tuyến
      const sm = sampleLoop(cargoS, cargoSample), T0 = trainPose[0];
      T0.x = sm.x; T0.z = sm.z; T0.ang = sm.ang;
      if (!trainInit) {                                              // lần đầu: xếp các dolly nối đuôi dọc đường
        for (let i = 1; i < trainAll.length; i++) { const q = sampleLoop(cargoS - i * (HITCH_R + EYE_F), cargoSample); Object.assign(trainPose[i], { x: q.x, z: q.z, ang: q.ang }); }
        trainInit = true;
      }
      for (let i = 1; i < trainAll.length; i++) {                    // rơ-moóc: mắt càng theo móc sau xe trước, thân theo vết kéo
        const P = trainPose[i - 1], C = trainPose[i];
        const hx = P.x - Math.cos(P.ang) * HITCH_R, hz = P.z + Math.sin(P.ang) * HITCH_R;   // móc sau xe trước (trục +x local = hướng chạy)
        let dx = hx - C.x, dz = hz - C.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        C.x = hx - dx * EYE_F; C.z = hz - dz * EYE_F; C.ang = Math.atan2(-dz, dx);
      }
      for (let i = 0; i < trainAll.length; i++) {
        const q = trainPose[i]; trainAll[i].position.set(q.x, TRAIN_Y, q.z); trainAll[i].rotation.y = q.ang;
        if (i > 0) { const bx = cargoBoxes[i - 1]; bx.position.set(q.x, TRAIN_Y, q.z); bx.rotation.y = q.ang; }
      }
      for (let i = 0; i < 3; i++) {                                  // thùng hàng: bốc 1-by-1 · chở · dỡ 1-by-1 · rỗng
        if (cargoState === 0) cargoBoxes[i].visible = stTimer >= (i + 1) * 1.4;        // hiện lần lượt
        else if (cargoState === 1) cargoBoxes[i].visible = true;                       // đã chở hàng
        else if (cargoState === 2) cargoBoxes[i].visible = stTimer < (3 - i) * 0.95;   // biến mất lần lượt
        else cargoBoxes[i].visible = false;                                            // rỗng, vòng về
      }
    }

    let started = false, rafLast = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      // dt theo MỐC rAF (đầu khung, khớp nhịp màn hình) thay vì lúc hàm chạy — lệch vài ms mỗi khung ⇒ vật chạy nhanh (máy bay chạy đà,
      // cất cánh) bước không đều, "rung"; gọi tay (không mốc) thì dùng đồng hồ như cũ
      // FLT.play: nhịp phát của cả cảnh theo pha bay (G 14/10: ra đường băng + cất cánh chậm 20 % ⇒ 0.8 · trên trời chậm 45 % ⇒ 0.55)
      const dc = clock.getDelta(), dr = now !== undefined && rafLast ? (now - rafLast) / 1000 : dc; if (now !== undefined) rafLast = now;
      const dt = Math.min(dr > 0 ? dr : dc, 0.05) * FLT.play, t = clock.elapsedTime;
      if (autoRotate) tTheta += dt * 0.12;
      theta += (tTheta - theta) * 0.08; phi += (tPhi - phi) * 0.08;
      const pan = 34 * dt / camera.zoom;
      if (FLT.set !== 'sky') {                                                         // trên trời: khung khoá (G 15/10)
        if (keys.w) { target.x -= Math.sin(theta) * pan; target.z -= Math.cos(theta) * pan; }
        if (keys.s) { target.x += Math.sin(theta) * pan; target.z += Math.cos(theta) * pan; }
        if (keys.a) { target.x -= Math.cos(theta) * pan; target.z += Math.sin(theta) * pan; }
        if (keys.d) { target.x += Math.cos(theta) * pan; target.z -= Math.sin(theta) * pan; }
      }

      if (!DEP.hideTrain) updateCargoTrain(dt);
      departureStep(dt * FLT.rate);
      flightStep(dt);
      wheelSpin(dt);
      // đặt camera SAU khi máy bay + điểm nhìn đã cập nhật (bản trước đặt trước ⇒ camera trễ 1 khung so với máy bay: chạy nhanh là rung)
      camera.position.set(target.x + radius * Math.sin(phi) * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(target);

      // ══ QUY TRÌNH CARGO UNLOADING & ELEVATOR LIFT LOOP (5 Phase Cyclic Timeline) ══
      if (belt && belt.userData.lift) {
        const Lf = belt.userData.lift, S = Lf.SC, uld = Lf.uld;
        const hMax = LOADER_DECK - S.yB, hMin = 0.20;                    // (5/5) Cao nhất (= ngưỡng cửa hầm hàng) -> Thấp nhất (chạm gầm)

        const cycleT = 44.0;                                              // Chu kỳ loop tổng = 44.0 giây (chậm lại thêm 50% cho nhịp điệu từ tốn, siêu mượt)
        const cp = (t / cycleT) % 1.0;                                     // Tiến độ chu kỳ 0.0 -> 1.0

        let h = hMax;
        if (cp < 0.15) {
          // Phase 1 (0-15%): Xe nâng đứng áp sát khoang máy bay, chưa có cargo
          h = hMax;
          uld.visible = false;
        } else if (cp < 0.40) {
          /* Phase 2 (15-40%): Cargo trượt TỪ TRONG KHOANG MÁY BAY RA.
             ⚠ ĐÃ ĐẢO CHIỀU: sau khi xe nâng xoay 180°, đầu quay vào máy bay là +x (không phải −x nữa).
             Bản cũ chạy −8.5 → −3.0, tức ULD hiện ra từ khoảng không ở đầu XA máy bay rồi bò lại gần —
             ngược hoàn toàn. Nay chạy +8.5 (sâu trong khoang, khuất sau da thân) → −3.0 (giữa băng 1),
             đi qua đúng tuyến: miệng khoang → băng trượt 2 → khe 0.13 → băng trượt 1. */
          h = hMax;
          uld.visible = true;
          const slideP = Math.sin(((cp - 0.15) / 0.25) * Math.PI * 0.5); // Trượt mượt 0->1
          uld.position.x = 8.5 - slideP * 11.5;                          // +8.5 (trong khoang) → −3.0 (sàn xe nâng)
        } else if (cp < 0.72) {
          // Phase 3 (40-72%): Xe nâng chở cargo từ từ hạ xuống
          uld.visible = true;
          uld.position.x = -3.0;
          const lowerP = Math.sin(((cp - 0.40) / 0.32) * Math.PI * 0.5); // Hạ mượt 0->1
          h = hMax - lowerP * (hMax - hMin);                             // Hạ từ hMax -> hMin
        } else if (cp < 0.84) {
          // Phase 4 (72-84%): Hạ chạm kết cấu phía dưới -> cargo biến mất
          h = hMin;
          uld.visible = false;
        } else {
          // Phase 5 (84-100%): Xe nâng rỗng từ từ dâng lên lại khoang máy bay
          uld.visible = false;
          const riseP = Math.sin(((cp - 0.84) / 0.16) * Math.PI * 0.5);  // Dâng mượt 0->1
          h = hMin + riseP * (hMax - hMin);                              // Dâng từ hMin -> hMax
        }

        if (DEP.loader !== null) { h = hMax - DEP.loader * (hMax - hMin); uld.visible = false; }   // khởi hành: hạ sàn rồi rời đi
        // Động học Scissor X thực tế (chiều dài dầm hằng số, góc & chân bè rộng 2 đầu)
        const r = Math.sqrt(Math.max(0.02, S.L * S.L - h * h)) / 2;
        const cy = S.yB + h / 2, yT = S.yB + h, angA = Math.atan2(h, 2 * r);
        for (const b of Lf.beams) { b.m.position.set(S.xC, cy, b.z); b.m.rotation.z = b.sgn > 0 ? angA : Math.PI - angA; }
        Lf.center.position.set(S.xC, cy, 0);
        Lf.base[0].position.set(S.xC - r, S.yB, 0); Lf.base[1].position.set(S.xC + r, S.yB, 0);
        Lf.top[0].position.set(S.xC + r, yT, 0); Lf.top[1].position.set(S.xC - r, yT, 0);
        Lf.feet[0].position.set(S.xC - r, S.yB - 0.06, 0); Lf.feet[1].position.set(S.xC + r, S.yB - 0.06, 0);
        Lf.deck.position.y = yT - Lf.dYHome;                              // Sàn nâng bám chuẩn theo đỉnh scissor
      }

      // ══ QUY TRÌNH KÍCH HOẠT CẢ 4 ĐỘNG CƠ (x50 Speed Supercharged + Glowing Light Bulb + Dynamic Wind Particle Streams) ══
      spoolStep(dt);
      if (plane.userData.lights) {                                       // chớp đỏ: bật khi bấm Engine (trước khi máy quay) tới khi N2 về ~0
        let n2m = 0; for (const s of SPOOL) n2m = Math.max(n2m, s.n2);
        const bOn = (isEngineIgnited || n2m > 0.06 || DEP.beacon) && !FLT.beaconOff;
        plane.userData.lights.beacons.forEach((b, i) => { const ph = (t * 0.85 + i * 0.5) % 1, f = bOn && ph < 0.13 ? 1 : 0; b.sp.material.opacity = f; b.m.material.color.copy(b.col).multiplyScalar(f ? 1 : 0.3); });
      }
      // cấu hình cất cánh: nổ máy ⇒ Krueger bung trước (~2 s), flap chạy ray ra 20° (~7 s); tắt máy ⇒ thu về
      if (window.__wingMov) {
        const on = window.__wingCfg ?? (((isEngineIgnited && !DEP.active && !FLT.phase) || DEP.flaps) ? 1 : 0);   // khởi hành: đặt tà sau khi xe kéo tách          // __wingCfg: ép cấu hình từ console để xem (0 / 1)
        wingK.kr += Math.max(-dt / 2.2, Math.min(dt / 2.2, on - wingK.kr));
        wingK.flap += Math.max(-dt / 7, Math.min(dt / 7, (on ? Math.min(1, wingK.kr * 1.5) : 0) - wingK.flap));
        wingK.f30 += Math.max(-dt / 5, Math.min(dt / 5, FLT.f30 - wingK.f30));          // tà 20° → 30° (hạ cánh)
        wingK.sp += Math.max(-dt / 2.5, Math.min(dt / 1.2, FLT.spoil - wingK.sp));       // spoiler bung ~1.2 s khi chạm đất
        const e30 = 0.5 * wingK.f30 * wingK.f30 * (3 - 2 * wingK.f30);
        for (const m of window.__wingMov) {
          const k = m.kind === 'kr' ? wingK.kr : m.kind === 'sp' ? wingK.sp : wingK.flap, e = k * k * (3 - 2 * k) * (m.kind === 'flap' ? 1 + e30 : 1);
          m.g.position.set(m.H.x + m.dx * e, m.H.y + m.dy * e, m.H.z);
          m.g.quaternion.setFromAxisAngle(m.axis, m.ang * e * Math.PI / 180);
        }
      }
      let n1A = 0, litA = 0; for (const s of SPOOL) { n1A += s.n1 / 4; litA += s.lit ? 0.25 : 0; }
      const pw = Math.min(1, n1A / 0.98);                                 // công suất theo N1 thật (khởi động → không tải → cất cánh)
      const targetSpeed = 1.0 + 49.0 * pw;
      const targetGlow = litA > 0 ? 0.7 + 0.28 * litA : 0.7;
      const targetWindOpacity = ENG_MODE.idle ? 0 : 0.92 * pw;          // hầm gió chỉ ở chế độ thử Engine
      const targetLightIntensity = litA > 0 ? litA * (1.5 + 3.0 * pw) + Math.sin(t * 24.0) * 0.8 * litA : 0.0;
      if (engAudio) {
        camera.getWorldDirection(_aV).negate();                          // hướng từ cảnh tới người xem
        plane.getWorldQuaternion(_aQ); _aF.set(1, 0, 0).applyQuaternion(_aQ);   // trục miệng hút (mũi máy bay)
        plane.getWorldPosition(_aP).project(camera);
        engAudio.update({ n1: SPOOL.map(s => s.n1), n2: SPOOL.map(s => s.n2), lit: SPOOL.map(s => s.lit), starter: SPOOL.map(s => s.starter), whumps: SPOOL.map(s => s.whumps), cosA: _aV.dot(_aF), zoom: camera.zoom, pan: _aP.x, vol: FLT.vol });
      }

      engineSpeedMult += (targetSpeed - engineSpeedMult) * dt * 4.0;
      combGlowVal += (targetGlow - combGlowVal) * dt * 4.0;
      windGlowVal += (targetWindOpacity - windGlowVal) * dt * 4.0;

      // 💡 1. BÓNG ĐÈN ĐỘNG CƠ PHÁT SÁNG RỰC RỠ NHƯ BÓNG ĐÈN (PointLight Bulb Intensity & Emissive Glow)
      for (const light of enginePointLights) {
        light.intensity += (targetLightIntensity - light.intensity) * dt * 5.0;
      }
      for (const mat of allCombMats) {
        mat.opacity = combGlowVal;
      }

      // 🌪️ 2. LUỒNG GIÓ KIỂU MÔ PHỎNG: đường dòng có vệt đuôi — xanh dương hút vào, đỏ phụt ra, mờ dần khi tắt máy
      if (windFlow) windFlow(dt, windGlowVal);

      // 3. Xoay CẢ 4 ĐỘNG CƠ x6 TỐC ĐỘ đồng nhất:
      //    trục THẤP ÁP (quạt + booster + LPT) chung 1 tốc độ · trục CAO ÁP (HPC + HPT) quay ngược, nhanh hơn (GEnx: 2 trục ngược chiều)
      if (ENG_MODE.idle) {
        // chuỗi khởi hành / bay: TỪNG máy quay theo N1 / N2 của chính nó (khởi động lần lượt 4-3-2-1). Tốc độ HIỂN THỊ bão hoà ~9.5 rad/s:
        // quạt thật ~40 vòng/s, khung hình 60/s chỉ thấy đứng hình / quay ngược (hiệu ứng bánh xe ngựa) ⇒ quay chậm đọc được chiều +
        // đĩa mờ chuyển động đục dần theo N1 (cảm giác quạt đang quay rất nhanh)
        for (const g of fans) {
          const s = SPOOL[g.userData.eng] || SPOOL[0], n1 = s.n1;
          g.rotation.x += dt * 9.5 * (1 - Math.exp(-n1 / 0.22));
          if (g.userData.blur) g.userData.blur.material.opacity = 0.62 * Math.min(1, Math.max(0, (n1 - 0.1) / 0.45));
        }
        for (const g of hpcs) { const s = SPOOL[g.userData.eng] || SPOOL[0]; g.rotation.x -= dt * 13 * (1 - Math.exp(-s.n2 / 0.3)); }
      } else {
        for (let i = 0; i < fans.length; i++) { fans[i].rotation.x += dt * 0.8 * engineSpeedMult; if (fans[i].userData.blur) fans[i].userData.blur.material.opacity = 0; }
        for (let i = 0; i < compressors.length; i++) compressors[i].rotation.x += dt * 0.8 * engineSpeedMult;
        for (let i = 0; i < hpcs.length; i++) hpcs[i].rotation.x -= dt * 1.4 * engineSpeedMult;
      }

      renderer.render(scene, camera);
      if (!started) { started = true; const l = document.getElementById('loading'); if (l) l.style.display = 'none'; }
    }
    renderer.init().then(() => loop()).catch(e => { console.error(e); fail('WebGPU init: ' + e.message); });
  }
})();
