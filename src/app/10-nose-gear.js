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


