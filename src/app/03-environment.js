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

