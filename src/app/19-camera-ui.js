    /* ═══ 00-engine/camera — orbit + wheel zoom + WASD pan (Default Full Land Size View) · trên trời: khoá khung, chỉ xoay ═══ */
    let theta = 0.42, phi = 0.9, tTheta = theta, tPhi = phi, radius = 420, autoRotate = false;
    const target = new THREE.Vector3(12, 0, 6); camera.zoom = 0.58;
    const keys = {};
    // G 15/10 "fix screen" — CHỈ khi máy bay đang TRÊN TRỜI (cảnh sky): khoá khung — không zoom (lăn chuột để trang nhúng Wix cuộn
    // bình thường), không kéo chuột phải, không WASD; chỉ CHUỘT TRÁI (một ngón trên cảm ứng) để xoay. Sân đỗ / đường băng: như cũ.
    const skyLock = () => FLT.set === 'sky';
    window.addEventListener('keydown', e => { if (!skyLock() && ['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) { keys[e.key.toLowerCase()] = true; FLT.tgtT = null; } });
    window.addEventListener('keyup', e => { if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
    const dom = renderer.domElement; let drag = false, panDrag = false, lx = 0, ly = 0; dom.style.touchAction = 'none';
    dom.addEventListener('contextmenu', e => e.preventDefault());                     // chuột phải dành cho kéo pan

    // Raycaster cho nhãn liên kết click & tính tọa độ 3D mặt đất
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();

    // Tạo thẻ HUD hiển thị Tọa độ 3D & Footer "Michael Tran" dạng ĐƠN GIẢN (Middle Footer Position)
    const coordHud = document.createElement('div');
    coordHud.id = 'coordHud';
    coordHud.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:999;background:none;color:#222222;font-family:"SF Mono",ui-monospace,monospace;font-size:14px;font-weight:600;pointer-events:none;letter-spacing:0.5px;text-shadow:0 1px 2px rgba(255,255,255,0.8);white-space:nowrap;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;';
    coordHud.innerHTML = '<span id="coordVal">X: 0.00, Y: 0.00, Z: 0.00</span><span style="font-size:12px;font-weight:700;color:#5a4738;letter-spacing:1.2px;text-transform:uppercase;">Michael Tran</span>';
    document.body.appendChild(coordHud);

    dom.addEventListener('pointerdown', e => { if (skyLock() && e.button !== 0) return; panDrag = e.button === 2; drag = !panDrag; if (panDrag) FLT.tgtT = null; autoRotate = false; syncBtn(); lx = e.clientX; ly = e.clientY; dom.setPointerCapture && dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => {
      if (drag) {
        tTheta -= (e.clientX - lx) * 0.005; tPhi -= (e.clientY - ly) * 0.005; tPhi = Math.max(0.2, Math.min(1.4, tPhi)); lx = e.clientX; ly = e.clientY;
      } else if (panDrag) {
        // pan: k = đơn vị world / 1 px màn hình (camera ortho). Ngang → dọc trục "phải" của camera trên mặt sân;
        // dọc → dọc hướng nhìn chiếu xuống mặt sân, chia cos φ vì mặt sân bị nhìn xiên (co ngắn theo chiều dọc màn hình)
        const k = (camera.right - camera.left) / camera.zoom / Math.max(1, W());
        const dx = (e.clientX - lx) * k, dy = (e.clientY - ly) * k / Math.cos(phi);
        target.x -= Math.cos(theta) * dx + Math.sin(theta) * dy;
        target.z -= -Math.sin(theta) * dx + Math.cos(theta) * dy;
        lx = e.clientX; ly = e.clientY;
      }
      const rect = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Rò tọa độ 3D chạm mặt sàn y=0 (Raycast onto ground plane)
      if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
        const el = document.getElementById('coordVal');
        if (el) el.innerHTML = `X: ${intersectPoint.x.toFixed(2)}, Y: ${intersectPoint.y.toFixed(2)}, Z: ${intersectPoint.z.toFixed(2)}`;
      }

      if (labelGroup.visible) {
        const intersects = raycaster.intersectObjects(labelGroup.children);
        let hoverLink = false;
        for (let i = 0; i < intersects.length; i++) {
          if (intersects[i].object.isSprite && intersects[i].object.userData.url) { hoverLink = true; break; }
        }
        dom.style.cursor = hoverLink ? 'pointer' : (drag || panDrag ? 'grabbing' : 'default');
      } else {
        dom.style.cursor = drag || panDrag ? 'grabbing' : 'default';
      }
    });
    dom.addEventListener('click', e => {
      if (!labelGroup.visible) return;
      const rect = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(labelGroup.children);
      for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.isSprite && intersects[i].object.userData.url) {
          window.open(intersects[i].object.userData.url, '_blank');
          break;
        }
      }
    });

    window.addEventListener('pointerup', () => { drag = false; panDrag = false; });
    dom.addEventListener('wheel', e => { if (skyLock()) return; e.preventDefault(); FLT.zoomT = 0; camera.zoom *= (e.deltaY > 0 ? 0.92 : 1.08); camera.zoom = Math.max(0.1, Math.min(10, camera.zoom)); camera.updateProjectionMatrix(); }, { passive: false });
    const bR = document.getElementById('btnRotate'), bL = document.getElementById('btnLabels'), bRe = document.getElementById('btnReset');
    function syncBtn() { if (bR) bR.innerHTML = '<i class="ti ti-player-' + (autoRotate ? 'pause' : 'play') + '"></i>Tự xoay'; }
    if (bR) bR.addEventListener('click', () => { autoRotate = !autoRotate; syncBtn(); });
    if (bL) bL.addEventListener('click', () => {
      labelGroup.visible = !labelGroup.visible;
      bL.innerHTML = '<i class="ti ti-' + (labelGroup.visible ? 'tag' : 'tag-off') + '"></i>Nhãn';
    });
    if (bRe) bRe.addEventListener('click', () => { tTheta = 0.42; tPhi = 0.9; camera.zoom = 0.58; target.set(12, 0, 6); camera.updateProjectionMatrix(); autoRotate = false; syncBtn(); });

    // ĐỘ PHÂN GIẢI VẼ (G 16/10 "giảm độ phân giải cho nhẹ"): bộ đệm khung hình của WebGPU tốn ~88 B / điểm ảnh (khung HDR 16-bit
    // MSAA 4× + độ sâu MSAA + bản giải + khung canvas MSAA — đo bằng footprint tiến trình GPU: thu khung 13.3 → 1.9 triệu điểm ảnh
    // giải phóng ~1 GB). Vẽ đủ Retina 2097×1583 × 2 = 13.3 triệu điểm ảnh ⇒ ~1.15 GB RAM. Giới hạn ~4 triệu điểm ảnh ⇒ ~350 MB;
    // tỉ lệ điểm ảnh trong [0.75, 2] (khung nhỏ vẫn đủ Retina), khử răng cưa 4× giữ cạnh mịn.
    const MAX_PX = 4.0e6;
    function resize() {
      const w = W(), h = Hv();
      if (!w || !h) return;
      const pr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PX / (w * h))));
      if (Math.abs(renderer.getPixelRatio() - pr) > 1e-3) renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      const a = w / h, d = 46;
      camera.left = -d * a; camera.right = d * a; camera.top = d; camera.bottom = -d;
      camera.updateProjectionMatrix();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    window.__info = () => ({ calls: renderer.info.render.drawCalls, tris: renderer.info.render.triangles });
    // debug: đặt góc nhìn từ console — __view({theta, phi, zoom, target:[x,y,z]})
    window.__view = (o = {}) => { if (o.theta !== undefined) tTheta = theta = o.theta; if (o.phi !== undefined) tPhi = phi = o.phi; if (o.zoom) { camera.zoom = o.zoom; camera.updateProjectionMatrix(); } if (o.target) target.set(o.target[0], o.target[1], o.target[2]); autoRotate = false; syncBtn(); };
