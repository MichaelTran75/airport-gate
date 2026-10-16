/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Gate A1 · Sân bay 3D (Boeing 747-8) — mã cảnh. three.js r171 WebGPU (esm.sh).
   Tệp đi kèm: css/app.css · js/wind-worker.js (bộ giải gió Navier–Stokes, chạy luồng riêng) · assets/cfm56.bin (lưới CFM56-7B).
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  const fail = (m) => { const e = document.getElementById('err'); if (e) { e.textContent = 'Không tải được Three.js (cần mạng). ' + m; e.style.display = 'block'; } const l = document.getElementById('loading'); if (l) l.style.display = 'none'; };
  const _V = 'https://esm.sh/three@0.171.0';
  // phiên bản file (?v= trên thẻ <script>, publish.sh tự đóng dấu) — dùng cho worker & lưới động cơ để trình duyệt không lẫn bản cũ
  const APP_V = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || '0'; } catch (e) { return '0'; } })();
  // lưới CFM56-7B (assets/cfm56.bin: zlib) — tải + giải nén song song lúc tải three.js; lỗi ⇒ máy chỉ còn nacelle/pylon
  const _cfm = fetch('assets/cfm56.bin?v=' + APP_V).then(r => r.ok ? new Response(r.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer() : null).catch(() => null);
  Promise.all([import(_V + '/webgpu'), import(_V + '/examples/jsm/utils/BufferGeometryUtils.js?external=three'), _cfm])
    .then(([m, u, cfm]) => { try { build(m, u.mergeGeometries, u.toCreasedNormals, cfm); } catch (e) { console.error(e); fail(e.message); } }).catch(e => { console.error(e); fail(e.message); });

  function build(THREE, mergeGeometries, toCreasedNormals, CFM_BUF) {

