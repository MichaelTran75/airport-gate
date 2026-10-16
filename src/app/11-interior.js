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
