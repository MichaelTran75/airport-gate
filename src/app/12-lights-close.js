      // ═══ ĐÈN NGOÀI (G 13/10): CHỚP ĐỎ CHỐNG VA CHẠM (beacon) trên lưng + dưới bụng — bật NGAY TRƯỚC khi nổ máy, chớp suốt lúc máy
      // còn quay (IATA, CAA UK: người & xe phải tránh miệng hút / luồng xả khi đèn này bật · FAR 25.1401: 40–100 chớp/phút ⇒ 51,
      // 2 đèn so le) · ĐÈN HÀNG HẢI luôn sáng khi máy bay có điện: ĐỎ mút cánh TRÁI (−z) · XANH mút cánh PHẢI · TRẮNG hướng sau ở 2 mút ═══
      {
        const glowTex = (() => {
          const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
          const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
        })();
        const lamp = (x, y, z, col, r, glow, on) => {
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); m.userData.noFade = true;
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: on ? 0.9 : 0 }));
          sp.scale.setScalar(glow); sp.position.set(x, y, z); sp.userData.noFade = true; sp.renderOrder = 6;
          plane.add(m, sp); return { m, sp, col: new THREE.Color(col) };
        };
        const beacons = [lamp(gx(0.0), FY + topY(gx(0.0)) + 0.045, 0, 0xff1a10, 0.05, 1.3, false),        // lưng (trên hộp cánh)
          lamp(gx(16.0), gy(-2.084) - 0.045, 0, 0xff1a10, 0.05, 1.3, false)];                              // bụng (trước bụng cánh)
        const sT = S747 * 34.37, yT = sT - WROOT, xL = wingAt(WING_LE, yT), xR = wingAt(WING_TE, yT), yW = wingMidY(sT);
        for (const sg of [-1, 1]) {
          lamp(xL - 0.06, yW, sg * (sT + 0.02), sg < 0 ? 0xff2a1a : 0x1aff5a, 0.035, 0.75, true);           // đỏ trái · xanh phải
          lamp(xR + 0.03, yW, sg * (sT - 0.02), 0xfff6e0, 0.03, 0.55, true);                                // trắng hướng sau
        }
        plane.userData.lights = { beacons };
        for (const b of beacons) b.m.material.color.copy(b.col).multiplyScalar(0.3);
      }
      plane.add(pb.build());
      plane.add(eb.build({ cast: false }));
      // càng đặc (lốp không nhìn xuyên lốp) · mỗi rig: nhóm TRỤ quay ở trunnion T; BOGIE con của trụ (chốt TP); khâu trên giằng
      // quay ở điểm treo W (con của máy bay); khâu dưới + thanh khoá đoạn 2 con của trụ; thanh khoá đoạn 1 con của khâu trên (gối K).
      // Mỗi nhóm đặt ở chốt của nó, lưới lùi về −chốt ⇒ lúc nghỉ trùng khít hình dựng ban đầu. Động học: flight/20-gear-rig.
      plane.userData.gear = GEAR_RIG.map((r) => {
        const mk = (name, piv, parent) => {
          const g = new THREE.Group(); g.userData.piv = piv.clone(); g.position.copy(piv); if (parent) g.position.sub(parent.userData.piv);
          const b = r.part[name];
          if (b) { const m = b.build(); m.traverse(o => { o.userData.noFade = true; }); m.position.copy(piv).negate(); g.add(m); }
          (parent || plane).add(g); return g;
        };
        const p = r.pin, strut = mk('strut', p.T), up = mk('up', p.W);
        const G = { strut, up, truck: r.part.truck ? mk('truck', p.TP, strut) : null, lo: mk('lo', p.S, strut), k1: mk('k1', p.K, up), k2: mk('k2', p.L, strut) };
        G.flag = r.part.flag ? mk('flag', p.K, up) : null;
        G.steer = r.part.steer ? mk('steer', p.SG, strut) : null;                              // càng mũi: phần bẻ lái quay quanh trục đứng của trụ
        G.wheels = r.wheels.map((w) => mk(w.name, w.c, G.steer || G.truck || strut));          // bánh lăn: quay quanh trục z của nhóm
        if (r.kind === 'body' && G.truck) G.truck.rotation.order = 'YZX';                      // bogie càng thân: bẻ lái (y) rồi mới nghiêng (z)
        G.doors = (r.doors || []).map((d) => { const g = new THREE.Group(); g.position.copy(d.H); const m = d.bag.build(); m.position.copy(d.H).negate(); g.add(m); plane.add(g); return { g, s: d.s }; });
        return { kind: r.kind, u: r.u, axis: r.axis, pin: p, g: G, J: p.J.clone() };
      });
      makeTransparent(plane, 0.75);
    })();
    plane.updateMatrixWorld(true);
    const lw = (x, y, z) => plane.localToWorld(new THREE.Vector3(x, y, z));           // helper local→world
    // ỐNG / CÁP NẰM SÂN: spline qua các điểm neo cách xa nhau VÕNG XUỐNG DƯỚI mặt sân (y 0.12) giữa 2 điểm neo (ống PCA
    // chìm 0.3, cáp GPU chìm 0.08 — hiện thành ống đứt khúc, đầu nhọn cắm xuống đất) ⇒ lấy mẫu đều theo cung, kẹp tâm ống
    // ≥ mặt sân + bán kính, dựng lại spline từ mẫu đã kẹp: đoạn chạm đất nằm SÁT mặt sân, liền một mạch.
    function onGround(pts, r, n = 240) {
      const yMin = 0.12 + r + 0.002;
      const sp = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getSpacedPoints(n);
      for (const p of sp) if (p.y < yMin) p.y = yMin;
      return new THREE.CatmullRomCurve3(sp, false, 'centripetal');
    }

