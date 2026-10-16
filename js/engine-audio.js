/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Gate A1 · ÂM THANH 4 ĐỘNG CƠ GEnx-2B — tổng hợp bằng Web Audio, không dùng file thu sẵn
   Nguồn âm (theo cơ chế phát âm thật của động cơ phản lực cánh quạt đẩy):
   • TONE QUẠT: tần số qua cánh BPF = 18 cánh × vòng quay N1 (100 % N1 ≈ 2 560 v/ph = 42.7 Hz ⇒ BPF ≈ 768 Hz) + bội 2, 3
   • "CƯA XẺ" (buzz-saw): khi đầu cánh quạt vượt âm (N1 ≳ 80 %), sóng xung kích lệch nhẹ giữa các cánh ⇒ chuỗi tone ở MỌI
     bội của tần số trục (42.7 Hz × k), biên độ lộn xộn — chỉ nghe rõ phía TRƯỚC miệng hút
   • RÍT LÕI: tầng đầu máy nén cao áp (N2 100 % ≈ 11 400 v/ph; số cánh ước lượng) ≈ 5–9 kHz · tone tuabin thấp áp phía sau
   • GẦM LUỒNG XẢ: ồn trộn rối dải rộng, công suất ∝ V⁸ (Lighthill) ⇒ biên độ ∝ N1⁴; mạnh nhất ở góc ~140° tính từ trục
     miệng hút (phía sau chếch); cuộn trầm chậm theo xoáy lớn; "lốp bốp" (crackle) ở lực đẩy cao
   • ỒN DẢI RỘNG QUẠT · rền buồng đốt · tiếng xì khí khởi động · tiếng "phụt" lúc bắt lửa
   • 4 máy lệch N1 vài phần nghìn ⇒ tone quạt "đập" chậm vào nhau (wow-wow) như nghe máy bay 4 động cơ thật
   Không gian: hướng phát theo góc camera so với trục máy · xa (thu nhỏ) ⇒ nhỏ đi & mất cao tần (hấp thụ không khí) &
   nhiều tiếng vọng mặt sân hơn · lệch trái/phải theo vị trí máy bay trên màn hình.
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
window.createEngineAudio = function (ctx) {
  const SR = ctx.sampleRate, NE = 4, now = () => ctx.currentTime;
  const rnd = (() => { let a = 0x9e3779b9; return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();

  /* ── bộ đệm nhiễu (4 s, lặp) ── */
  const LEN = SR * 4;
  const mk = (fill, ch = 1) => { const b = ctx.createBuffer(ch, LEN, SR); for (let c = 0; c < ch; c++) fill(b.getChannelData(c)); return b; };
  const white = mk(d => { for (let i = 0; i < LEN; i++) d[i] = rnd() * 2 - 1; });
  const pink = mk(d => {                                            // Paul Kellet
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < LEN; i++) { const w = rnd() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
  });
  const brown = mk(d => { let y = 0; for (let i = 0; i < LEN; i++) { y = (y + 0.02 * (rnd() * 2 - 1)) / 1.02; d[i] = y * 3.5; } });
  const crackle = mk(d => {                                         // xung nhọn dương thưa, lệch (sóng N) — tiếng lốp bốp luồng xả
    for (let i = 0; i < LEN; i++) d[i] = 0;
    for (let i = 0; i < LEN; i++) if (rnd() < 0.0009) { const A = 0.3 + 0.7 * Math.pow(rnd(), 0.5), L = 20 + (rnd() * 60 | 0);
      for (let k = 0; k < L && i + k < LEN; k++) d[i + k] += k < 2 ? A : -A * 0.9 * Math.exp(-k / (L * 0.35)) / 2.2; }
  });
  const src = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(0, rnd() * 3.9); return s; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, Q = 0.7, gdb = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; b.gain.value = gdb; return b; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

  /* ── đường ra: [trước | sau | mọi hướng] → hấp thụ không khí → lệch kênh → khô + vọng → nén → tổng ── */
  const front = gain(1), aft = gain(1), omni = gain(1), sum = gain(1);
  front.connect(sum); aft.connect(sum); omni.connect(sum);
  const air = filt('lowpass', 12000, 0.5), panN = ctx.createStereoPanner();
  const dry = gain(1), wet = gain(0.15), verb = ctx.createConvolver();
  verb.buffer = (() => {                                            // vọng mặt sân + nhà ga: phản xạ đất 12 ms + đuôi 1.6 s tối dần
    const L = Math.floor(SR * 1.6), b = ctx.createBuffer(2, L, SR);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < L; i++) { const t = i / SR; lp += (rnd() * 2 - 1 - lp) * Math.max(0.05, 0.6 * Math.exp(-t / 0.5)); d[i] = lp * Math.exp(-t / 0.38) * (t < 0.03 ? t / 0.03 : 1); }
      d[Math.floor(SR * (0.012 + c * 0.002))] += 0.6; }
    return b;
  })();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -9; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.008; comp.release.value = 0.3;
  const master = gain(0);
  chain(sum, air, panN, dry, comp); panN.connect(verb); chain(verb, wet, comp); chain(comp, master, ctx.destination);

  /* ── nguồn chung ── */
  // gầm luồng xả (sau) + cuộn chậm theo xoáy lớn
  const jetLP = filt('lowpass', 400, 0.6), jetPk = filt('peaking', 220, 0.9, 5), jetG = gain(0);
  chain(src(pink), jetLP, jetPk, jetG, aft);
  const jetHi = filt('bandpass', 1400, 0.5), jetHiG = gain(0); chain(src(pink, 0.97), jetHi, jetHiG, aft);   // phần "xé" cao của tia
  const roll = gain(0); chain(src(brown, 0.5), filt('lowpass', 1.6, 0.5), roll); roll.connect(jetG.gain); roll.connect(jetHiG.gain);
  // rền trầm (buồng đốt + tia xa) — gần như mọi hướng
  const rumbleG = gain(0); chain(src(brown), filt('lowpass', 110, 0.7), rumbleG, omni);
  // lốp bốp
  const crG = gain(0); chain(src(crackle), filt('highpass', 500, 0.7), crG, aft);
  // ồn dải rộng quạt (trước nhiều, sau ít)
  const fbBP = filt('bandpass', 1500, 0.7), fbG = gain(0), fbA = gain(0);
  chain(src(white), fbBP, fbG, front); fbG.connect(fbA); fbA.connect(aft);
  // xì khí khởi động (van khí nén từ APU qua máy khởi động)
  const hissG = gain(0); chain(src(white, 1.1), filt('highpass', 2600, 0.6), filt('peaking', 5200, 1.2, 4), hissG, omni);
  // phụt bắt lửa
  const whumpG = gain(0); chain(src(brown, 0.8), filt('lowpass', 180, 0.8), whumpG, omni);
  // rung biên độ tone (dòng vào rối ⇒ tone "chập chờn")
  const flut = gain(1); chain(src(white, 0.25), filt('lowpass', 7, 0.5), flut);

  /* ── nguồn riêng từng máy ── */
  const waveFan = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.34, 0.13, 0.05]));
  const E = [];
  for (let e = 0; e < NE; e++) {
    const im = new Float32Array(49), re = new Float32Array(49);      // phổ cưa xẻ: mọi bội 1–48 của tần số trục, biên độ lộn xộn, đỉnh ~8–24
    for (let k = 1; k <= 48; k++) im[k] = (0.25 + rnd()) * Math.exp(-Math.pow((k - 15) / 11, 2)) * (k === 18 ? 0.3 : 1);
    const o = {
      fan: ctx.createOscillator(), fanG: gain(0), fanA: gain(0),
      bz: ctx.createOscillator(), bzG: gain(0),
      hpc: ctx.createOscillator(), hpcG: gain(0), hpc2: ctx.createOscillator(), hpc2G: gain(0),
      lpt: ctx.createOscillator(), lptG: gain(0)
    };
    o.fan.setPeriodicWave(waveFan); o.bz.setPeriodicWave(ctx.createPeriodicWave(re, im)); o.hpc.type = o.hpc2.type = o.lpt.type = 'sine';
    o.fan.frequency.value = o.bz.frequency.value = o.hpc.frequency.value = o.hpc2.frequency.value = o.lpt.frequency.value = 1;
    chain(o.fan, o.fanG, front); o.fanG.connect(o.fanA); o.fanA.connect(aft);
    o.fl = gain(0); flut.connect(o.fl); o.fl.connect(o.fanG.gain);          // chập chờn tỉ lệ theo mức tone
    chain(o.bz, filt('highpass', 160, 0.7), o.bzG, front);
    chain(o.hpc, o.hpcG, front); chain(o.hpc2, o.hpc2G, front); chain(o.lpt, o.lptG, aft);
    for (const k of ['fan', 'bz', 'hpc', 'hpc2', 'lpt']) o[k].start();
    o.whumps = 0; E.push(o);
  }

  const T = (p, v, tc = 0.06) => p.setTargetAtTime(v, now(), tc);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let muted = false, whumpEnv = 0, lastT = 0;
  const N1HZ = 2560 / 60, N2HZ = 11400 / 60;                        // tần số trục ở 100 %

  /* st: { n1[4], n2[4], lit[4], starter[4], whumps[4], cosA, zoom, pan } */
  function update(st) {
    const t = now(), dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    let n1s = 0, n2s = 0, lit = 0, st0 = 0;
    for (let e = 0; e < NE; e++) {
      const o = E[e], n1 = Math.max(0, st.n1[e]), n2 = Math.max(0, st.n2[e]), sh = n1 * N1HZ;
      n1s += n1; n2s += n2; lit += st.lit[e] ? 1 : 0; st0 += st.starter[e] ? 1 : 0;
      if (st.whumps[e] !== o.whumps) { o.whumps = st.whumps[e]; whumpEnv = Math.min(1.6, whumpEnv + 1); }
      T(o.fan.frequency, Math.max(1, 18 * sh)); T(o.bz.frequency, Math.max(1, sh)); T(o.lpt.frequency, Math.max(1, 120 * sh));
      T(o.hpc.frequency, Math.max(1, 28 * n2 * N2HZ)); T(o.hpc2.frequency, Math.max(1, 46 * n2 * N2HZ));
      const on = n1 > 0.02 ? 1 : 0;
      const fa = on * 0.05 * Math.pow(n1, 1.3); T(o.fanG.gain, fa); T(o.fl.gain, 6 * fa); T(o.fanA.gain, 0.35);
      T(o.bzG.gain, 0.075 * ss(0.78, 0.95, n1));
      T(o.hpcG.gain, 0.011 * n2 * n2 * (1 - 0.5 * ss(0.8, 1, n1))); T(o.hpc2G.gain, 0.007 * n2 * n2);
      T(o.lptG.gain, 0.008 * n1 * n1);
    }
    const n1 = n1s / NE, n2 = n2s / NE, n4 = n1 * n1 * n1 * n1;
    T(jetG.gain, 0.7 * n4 + 0.012 * lit / NE); T(roll.gain, 0.18 * n4);
    T(jetHiG.gain, 0.14 * n4 * n1); T(jetLP.frequency, 180 + 700 * n1); T(jetPk.frequency, 120 + 180 * n1);
    T(crG.gain, 0.22 * ss(0.86, 0.98, n1));
    T(rumbleG.gain, (lit / NE) * (0.03 + 0.1 * n2 * n2) + 0.12 * n4);
    T(fbG.gain, 0.13 * n1 * n1); T(fbA.gain, 0.4); T(fbBP.frequency, 400 + 2200 * n1);
    T(hissG.gain, 0.035 * st0 / NE + 0.008 * (st0 ? 1 : 0), 0.15);
    whumpEnv *= Math.exp(-dt / 0.45); T(whumpG.gain, 0.3 * whumpEnv, 0.02);
    // hướng: cosA = cos(góc giữa hướng tới người nghe và trục miệng hút)
    const c = Math.max(-1, Math.min(1, st.cosA)), a = Math.acos(c);
    T(front.gain, 0.22 + 0.78 * Math.pow(Math.max(0, (c + 0.3) / 1.3), 1.6), 0.1);
    T(aft.gain, 0.32 + 0.68 * Math.exp(-Math.pow((a - 2.44) / 0.72, 2)), 0.1);
    // khoảng cách theo mức thu phóng camera ortho
    const z = Math.max(0.3, st.zoom || 1), near = Math.min(1, Math.max(0, (z - 0.5) / 8));
    T(air.frequency, 5000 + 12000 * Math.pow(near, 0.8), 0.15);
    T(wet.gain, 0.32 - 0.2 * near, 0.2);
    T(panN.pan, Math.max(-0.75, Math.min(0.75, st.pan || 0)), 0.1);
    // diorama: nhìn toàn cảnh (zoom ~0.6) vẫn phải nghe rõ — giảm theo khoảng cách nhẹ (bản trước −17 dB ở toàn cảnh ⇒ gần như câm)
    T(master.gain, muted ? 0 : 1.1 * (st.vol ?? 1) * Math.max(0.5, Math.min(1, Math.pow(z / 5, 0.3))), 0.4);   // vol: cảnh bầu trời nghe xa hơn
  }
  return { ctx, update, setMuted(m) { muted = !!m; T(master.gain, muted ? 0 : master.gain.value, 0.05); }, get muted() { return muted; } };
};
