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
