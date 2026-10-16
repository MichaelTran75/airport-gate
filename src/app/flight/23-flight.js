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
