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
