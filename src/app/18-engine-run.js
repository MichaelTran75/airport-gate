    /* ═══ KÍCH HOẠT 4 ĐỘNG CƠ (x6 Speed, Fiery Combustion Glow & Wind Intake/Out Simulation) ═══ */
    let isEngineIgnited = false;
    window.isEngineIgnited = isEngineIgnited;
    let engineSpeedMult = 1.0;
    const wingK = { kr: 0, flap: 0, f30: 0, sp: 0 };               // độ mở Krueger / flap (0 thu · 1 cất cánh 20°) · f30: thêm tới 30° (hạ cánh) · spoiler
    let combGlowVal = 0.7;
    let windGlowVal = 0.0;
    const engineButton = document.getElementById('btnIgnite');

    // ── TRỤC QUAY từng máy (G 11/10 khuya): khởi động như thật, nén thời gian — máy khởi động khí nén quay N2 → bắt lửa ở
    // ~20 % N2 (phụt) → tự tăng tốc lên chạy không tải (N2 68 % · N1 22 %) → giữ 1.5 s → tăng ga cất cánh (N1 ~98 %, ~4 s).
    // 4 máy bắt đầu lệch nhau 0.45 s và N1 lệch vài phần nghìn (tone quạt "đập" như máy bay 4 động cơ thật).
    // Tắt máy: cắt nhiên liệu, rô-to quay chậm dần (N2 τ 5 s, quạt quán tính lớn τ 6 s). Quạt, gió, âm thanh đều theo N1 này.
    const SPOOL = [0, 1, 2, 3].map(e => ({ n1: 0, n2: 0, lit: false, starter: false, t: 0, dwell: 0, whumps: 0, delay: e * 0.45, dN: [-0.0042, -0.0013, 0.0016, 0.004][e] }));
    // idle true: chuỗi khởi hành/bay — không hầm gió, máy dừng ở KHÔNG TẢI trừ khi n2 (mục tiêu N2, 21-flight đặt theo cần ga) khác null
    const ENG_MODE = { idle: false, n2: null };
    const n2For = (n1) => n1 <= 0.22 ? 0.68 : 0.68 + (n1 - 0.22) * (0.285 / 0.76);   // nghịch đảo n1Of (từ không tải trở lên)
    const n1Of = (n2) => n2 < 0.68 ? 0.22 * Math.pow(Math.max(0, n2) / 0.68, 2.2) : 0.22 + (n2 - 0.68) * (0.76 / 0.285);
    function spoolStep(dt) {
      for (const s of SPOOL) {
        if (isEngineIgnited) {
          s.t += dt;
          if (s.t >= s.delay) {
            if (!s.lit) { if (s.n2 < 0.2) { s.starter = true; s.n2 += 0.075 * dt; } else { s.lit = true; s.whumps++; } }
            if (s.lit) {
              const tgt = ENG_MODE.n2 !== null ? ENG_MODE.n2 + s.dN * 0.5 : (s.dwell < 1.5 || ENG_MODE.idle) ? 0.68 : 0.965 + s.dN;
              s.n2 += (tgt - s.n2) * (1 - Math.exp(-dt / 1.45));
              if (s.n2 > 0.5) s.starter = false;                           // máy khởi động ngắt ở ~50 % N2
              if (s.n2 > 0.655) s.dwell += dt;
            }
          }
        } else { s.t = 0; s.dwell = 0; s.lit = false; s.starter = false; s.n2 *= Math.exp(-dt / 5); }
        s.n1 += (n1Of(s.n2) - s.n1) * (1 - Math.exp(-dt / (isEngineIgnited ? 0.8 : 6)));
      }
    }
    window.__spool = SPOOL;
    // ── ÂM THANH (js/engine-audio.js, tải khi bấm Engine lần đầu; AudioContext tạo ngay trong cú bấm để Safari/iOS cho phát) ──
    let engAudio = null, audioCtx = null, soundMuted = false;
    try { soundMuted = localStorage.getItem('gateA1.mute') === '1'; } catch (e) { }
    const soundButton = document.getElementById('btnSound');
    const syncSound = () => { if (soundButton) { soundButton.innerHTML = '<i class="ti ti-volume' + (soundMuted ? '-off' : '') + '"></i>'; soundButton.setAttribute('aria-pressed', String(!soundMuted)); } };
    function ensureAudio() {
      if (audioCtx) { if (audioCtx.state === 'suspended' && !document.hidden) audioCtx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      audioCtx = new AC(); audioCtx.resume();
      const sc = document.createElement('script'); sc.src = 'js/engine-audio.js?v=' + APP_V;
      sc.onload = () => { try { engAudio = window.createEngineAudio(audioCtx); engAudio.setMuted(soundMuted); } catch (e) { console.warn('âm thanh động cơ:', e); } };
      document.head.appendChild(sc);
    }
    if (soundButton) soundButton.addEventListener('click', () => { soundMuted = !soundMuted; try { localStorage.setItem('gateA1.mute', soundMuted ? '1' : '0'); } catch (e) { } syncSound(); ensureAudio(); if (engAudio) engAudio.setMuted(soundMuted); });
    syncSound();
    document.addEventListener('visibilitychange', () => { if (!audioCtx) return; if (document.hidden) audioCtx.suspend(); else audioCtx.resume(); });
    const _aV = new THREE.Vector3(), _aF = new THREE.Vector3(), _aQ = new THREE.Quaternion(), _aP = new THREE.Vector3();

    function toggleEngineIgnition() {
      ensureAudio();
      isEngineIgnited = !isEngineIgnited;
      window.isEngineIgnited = isEngineIgnited;
      for (const mat of allCombMats) mat.color.setHex(isEngineIgnited ? 0xff3300 : 0x757676);
      for (const mat of allFuelRingMats) mat.color.setHex(isEngineIgnited ? 0xff1100 : 0x606060);
      if (engineButton) {
        engineButton.innerHTML = isEngineIgnited ? "<i class='ti ti-bolt'></i> Engine (On)" : "<i class='ti ti-flame'></i> Engine";
        engineButton.style.background = isEngineIgnited ? "linear-gradient(135deg, #ff0000, #ff5500)" : "linear-gradient(135deg, #ff4500, #ff8c00)";
        engineButton.setAttribute('aria-pressed', String(isEngineIgnited));
      }
    }
    window.toggleEngineIgnition = toggleEngineIgnition;
    if (engineButton) engineButton.addEventListener('click', toggleEngineIgnition);

