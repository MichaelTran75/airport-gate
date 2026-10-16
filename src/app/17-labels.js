    /* ═══ 07-labels — tái dùng addLabel World Kit (mặc định ẩn cho khung hình sạch) ═══ */
    const labelGroup = new THREE.Group(); labelGroup.visible = true; scene.add(labelGroup);
    function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function addLabel(text, dot, pos, to, url, scaleMult = 1.0) {
      const lines = text.split('\n');
      const c = document.createElement('canvas'), mm = c.getContext('2d'), f = '600 46px Inter, system-ui, Arial'; mm.font = f;
      const tw = Math.max(...lines.map(l => mm.measureText(l).width)), pad = 92;
      const h = lines.length > 1 ? 148 : 108; c.width = Math.ceil(tw + pad + 40); c.height = h; const x = c.getContext('2d'); x.font = f;
      rr(x, 3, 3, c.width - 6, h - 6, 40); x.fillStyle = 'rgba(250,248,242,0.5)'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(75,74,70,0.5)'; x.stroke();
      x.beginPath(); x.arc(54, h / 2, 16, 0, 7); x.fillStyle = dot; x.fill(); x.fillStyle = '#000'; x.textBaseline = 'middle';
      if (lines.length > 1) {
        x.fillText(lines[0], pad, h / 2 - 22);
        x.fillText(lines[1], pad, h / 2 + 28);
      } else {
        x.fillText(text, pad, h / 2 + 2);
      }
      const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
      sp.renderOrder = 20; const k = 0.052 * scaleMult; sp.scale.set(c.width * k, h * k, 1); sp.position.copy(pos);
      if (url) sp.userData = { url };
      labelGroup.add(sp);
      const lg = new THREE.BufferGeometry().setFromPoints([pos.clone().add(new THREE.Vector3(0, -h * k * 0.5, 0)), to]);
      const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x3a3530, transparent: true, opacity: 0.5, depthTest: false })); ln.renderOrder = 19; labelGroup.add(ln);
      return [sp, ln];
    }
    addLabel('Nhà ga hành khách', '#5a8f7b', new THREE.Vector3(70, 52, -6), new THREE.Vector3(70, 10.6, -6));
    const FUEL_LABEL = addLabel('Jet Fuel 60,000 - 200,000 lít/lần', '#0099ff', new THREE.Vector3(-5, 22.25, -16), new THREE.Vector3(-5, 1.75, -16), null, 0.5);
    // nhãn động cơ bám máy bay khi đẩy lùi: nhóm riêng, ma trận = máy bay hiện tại × nghịch đảo lúc đỗ (19b-departure)
    const ENG_LABEL = new THREE.Group(); ENG_LABEL.matrixAutoUpdate = false; labelGroup.add(ENG_LABEL);
    ENG_LABEL.add(...addLabel('Jet Engine (YouTube)', '#ff5500', lw(engX(ENG_SPANS[1]), 16.5, ENG_SPANS[1]), lw(engX(ENG_SPANS[1]), engY(ENG_SPANS[1]) + 0.35, ENG_SPANS[1]), 'https://www.youtube.com/watch?v=QtxVdC7pBQM', 0.45));

