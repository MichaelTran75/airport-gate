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
