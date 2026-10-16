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
