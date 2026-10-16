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
