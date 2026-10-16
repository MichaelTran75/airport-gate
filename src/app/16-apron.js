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

