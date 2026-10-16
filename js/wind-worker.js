/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Gate A1 · LUỒNG GIÓ ĐỘNG CƠ GEnx-2B — chạy trong Web Worker (không chiếm luồng vẽ)
   Navier–Stokes KHÔNG NÉN, ĐỐI XỨNG TRỤC trong mặt kinh tuyến (x, r) của động cơ:
     ∂u/∂t + (u·∇)u = −∇p + ∇·[(ν + ν_t)∇u] + f ,   ∂u/∂x + (1/r)·∂(r·v)/∂r = 0
   • lưới SO LE (MAC): u trên mặt dọc trục, v trên mặt hướng kính, p / nhiệt T / tỉ lệ khí phản lực C ở tâm ô
   • đối lưu MacCormack (truy ngược + truy xuôi sửa sai số, kẹp theo 4 điểm nội suy) — ít khuếch tán số hơn bán-Lagrange thường
   • rối: CHIỀU DÀI TRỘN Prandtl ν_t = ℓ²|S|, ℓ² = 0.0125·δω² (lớp trượt ngoài nở 0.117/D ≈ Brown & Roshko 1974 có đồng lưu: 0.118)
     → sau lõi thế chuyển dần sang tia xa ν_t = 0.028·Um·r½ (Hussein, Capp & George 1994 — Pope 2000), Pr_t 0.9 cho T và C;
     khuếch tán ẨN kiểu ADI (ổn định với ν_t lớn).
     (Đã thử LES Smagorinsky: 2D đối xứng trục chỉ sinh vòng xoáy đều, lớp trượt nở 0.05–0.10 — thấp và nhiễu.)
   • HẦM GIÓ THỔI (G 11/10): cửa hầm phía trước đặt gió vào U∞ = 0.25 × luồng quạt (máy bay cất cánh ~80 m/s / luồng quạt
     ~300 m/s ≈ 0.27), vách hầm r = R1 trơn (v = 0), cuối hầm mở (p = 0). Rối tính theo VẬN TỐC VƯỢT trên gió hầm ⇒ lớp trượt
     nở theo (1 − λ)/(1 + λ) (Brown & Roshko) và lõi thế (tam giác nóng) dài ra đúng vật lý
   • chiếu áp suất: Poisson có trọng r, SOR đỏ-đen ω 1.9, khởi động ấm; vật rắn & vách hầm = Neumann; cửa vào đặt vận tốc; cuối hầm p = 0; trục: v = 0
   • nguồn theo số liệu GEnx-2B67 (GE datasheet: BPR 8.0, 1 042 kg/s, 66 500 lbf): đĩa quạt (actuator disk) tạo dòng; CỬA HÚT LÕI
     ở mép chia dòng hút đúng 1/9 lưu lượng qua quạt (đo mỗi bước ⇒ BPR mô phỏng = 8.00); CỬA PHUN LÕI phụt khí nóng (T = 1),
     tia lõi ≈ 1.1× đỉnh luồng quạt (đích suy từ lực đẩy ≈ 1.3; giới hạn vì miệng xả lõi lấy từ lưới GLB rộng ~2× thật)
   • điều kiện vách gán TRƯỚC khi tính phân kỳ (lỗi cũ: đối lưu ghi rác lên mặt vách ⇒ áp suất giải sai, phân kỳ dư tới 44–94)
   • Ô MA nhiệt quanh miệng lõi (G 11/10): bước truy ngược dài tới 18 ô rơi vào thân rắn — trước đây thân rắn T = 0 nên khí lõi
     vừa ra đã "nguội" (T 0.03) và chóp làm lạnh lớp sát vách ⇒ tam giác nóng chỉ còn T ≈ 0.55. Nay ống lõi (rắn) = bể T = 1,
     vách chóp = đoạn nhiệt (gradient 0) ⇒ lõi thế nhiệt T ≥ 0.9 dài ≈ 5.5 D khi có gió hầm, ≈ 3.5 D khi không gió
   HẠT: đi theo trường đã giải + dao động rối Langevin (Thomson 1987): rối cân bằng σ = 1.49·√(ν_t·|S|) ≤ 0.2·Um, T_L = 1/|S|;
   |S| trần theo thang lớp trượt Um/δω (vách đặc không sinh rối giả); khí hút trước động cơ không rối ⇒ khói
   tản ra quanh trục như 3D dù trường giải 2D. Vệt = các vị trí ĐÃ ĐI QUA (2 bước con / bước giải). Dải vệt quay mặt về camera
   dựng sẵn ở đây ⇒ luồng chính chỉ chép mảng.
   Đơn vị: "lathe" (1 lathe = 2.61 m thật), thời gian chiếu chậm (vận tốc phụt quạt 3 lathe/s ≈ 7.8 m/s).
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
let G = null;                                                     // hình học + lưới + trạng thái

function lerpT(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let k = 0; k < t.length - 1; k++) if (x <= t[k + 1][0]) return t[k][1] + (t[k + 1][1] - t[k][1]) * (x - t[k][0]) / (t[k + 1][0] - t[k][0] || 1e-9);
  return t[t.length - 1][1];
}

function init(m) {
  const FG = m.fg, D = m.dom, H = D.H, X0 = D.X0, X1 = D.X1, R1 = D.R1;
  const NX = Math.round((X1 - X0) / H), NR = Math.round(R1 / H), NC = NX * NR;
  const NU = (NX + 1) * NR, NVF = NX * (NR + 1);
  const g = G = {
    FG, H, X0, X1, R1, NX, NR, NC, NU, NVF, kMix: m.kMix ?? 0.0068, kML: m.kML ?? 0.0125, kJet: m.kJet ?? 0.028, jetD0: m.jetD0 ?? 2, jetD1: m.jetD1 ?? 5.2, win: m.win ?? 0.1, nu0: 2e-4, ES: m.ES, ENG: m.eng, TOPA: 0.42,
    U: new Float32Array(NU), V: new Float32Array(NVF), T: new Float32Array(NC), C: new Float32Array(NC), P: new Float32Array(NC),
    U1: new Float32Array(NU), V1: new Float32Array(NVF), T1: new Float32Array(NC), C1: new Float32Array(NC),
    U2: new Float32Array(NU), V2: new Float32Array(NVF), T2: new Float32Array(NC), C2: new Float32Array(NC),
    UL: new Float32Array(NU), UH: new Float32Array(NU), VL: new Float32Array(NVF), VH: new Float32Array(NVF),
    TL: new Float32Array(NC), TH: new Float32Array(NC), CL: new Float32Array(NC), CH: new Float32Array(NC),
    DIV: new Float32Array(NC), NUT: new Float32Array(NC), SS: new Float32Array(NC),
    SOL: new Uint8Array(NC), FAN: new Uint8Array(NC), CORE: new Uint8Array(NC),
    SU: new Uint8Array(NU), SV: new Uint8Array(NVF), FU: new Uint8Array(NU), INF: new Uint8Array(NU), Uinf: 0, CIN: new Uint8Array(NU), COUT: new Uint8Array(NU), UP: new Float32Array(NU),
    BXu: new Float32Array(NU), BRu: new Float32Array(NU), BXv: new Float32Array(NVF), BRv: new Float32Array(NVF),
    BXc: new Float32Array(NC), BRc: new Float32Array(NC)
  };
  const xc = (i) => X0 + (i + 0.5) * H, rc = (j) => (j + 0.5) * H;
  for (let j = 0; j < NR; j++) for (let i = 0; i < NX; i++) {
    const x = xc(i), r = rc(j), k = j * NX + i;
    if (x >= FG.xTE && x <= FG.xLip) { const ri = lerpT(FG.wallIn, x) - 0.5 * H; if (r >= ri && r <= Math.max(lerpT(FG.wallOut, x), ri + 1.1 * H)) g.SOL[k] = 1; }
    if (x >= FG.xPlug && x <= FG.xSpin && r <= lerpT(FG.body, x)) g.SOL[k] = 1;
    if (g.SOL[k]) continue;
    if (x >= FG.fan[0] && x <= FG.fan[1] && r >= FG.fan[2] && r <= FG.fan[3]) g.FAN[k] = 1;
    if (x <= FG.xCore && x >= FG.xCore - 3 * H && r >= FG.rPlugC - 0.5 * H && r <= FG.rCowlC + 0.25 * H) g.CORE[k] = 1;
  }
  // mặt u (i = 0…NX) giữa ô i−1 và i · mặt v (j = 0…NR) giữa ô j−1 và j
  for (let j = 0; j < NR; j++) for (let i = 0; i <= NX; i++) {
    const f = j * (NX + 1) + i, a = i > 0 ? j * NX + i - 1 : -1, b = i < NX ? j * NX + i : -1;
    if ((a >= 0 && g.SOL[a]) || (b >= 0 && g.SOL[b])) g.SU[f] = 1;
    if ((a >= 0 && g.FAN[a]) || (b >= 0 && g.FAN[b])) g.FU[f] = 1;
    // CỬA HÚT LÕI (mặt trước khối lõi ở mép chia dòng): ô trước là khí, ô sau là vật rắn · CỬA PHUN LÕI (mặt sau khối lõi): ngược lại
    const xf = X0 + i * H, rf = (j + 0.5) * H;
    if (a >= 0 && b >= 0 && g.SOL[a] && !g.SOL[b] && Math.abs(xf - FG.xSplit) < 2.5 * H && rf > FG.rHub && rf < FG.rSplit) g.CIN[f] = 1;
    if (a >= 0 && b >= 0 && !g.SOL[a] && g.SOL[b] && Math.abs(xf - FG.xCore) < 2.5 * H && rf > FG.rPlugC && rf < FG.rCowlC) g.COUT[f] = 1;
  }
  for (let j = 0; j <= NR; j++) for (let i = 0; i < NX; i++) {
    const f = j * NX + i, a = j > 0 ? (j - 1) * NX + i : -1, b = j < NR ? j * NX + i : -1;
    if (j === 0 || j === NR || (a >= 0 && g.SOL[a]) || (b >= 0 && g.SOL[b])) g.SV[f] = 1;     // j = 0 trục · j = NR vách hầm: v = 0
  }
  for (let j = 0; j < NR; j++) g.INF[j * (NX + 1) + NX] = 1;                    // cửa hầm (x = X1): vận tốc đặt −U∞
  // Ô MA cho T/C quanh miệng phun lõi: bước truy ngược dài tới u·dt ≈ 0.45 lathe (18 ô) nên rơi vào thân rắn — nếu thân rắn mang T = 0
  // thì khí lõi vừa ra đã "nguội" và lớp sát chóp bị làm lạnh. ⇒ (a) ống lõi (rắn, sau mặt phun, giữa chóp & vỏ lõi) = bể khí nóng T = 1;
  // (b) thân chóp & vỏ quanh đó = vách đoạn nhiệt (gradient 0): lấy trung bình ô khí kề, 2 lớp
  g.GHOT = []; g.GH1 = []; g.GH2 = [];
  for (let j = 0; j < NR; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x = xc(i), r = rc(j); if (!g.SOL[k] || x < FG.xPlug - 2 * H || x > FG.xCore + 0.6 || r > FG.rCowlC + 2 * H) continue;
    if (x > FG.xCore && r >= FG.rPlugC - H && r <= FG.rCowlC) { g.GHOT.push(k); continue; }
    const nb = [i > 0 ? k - 1 : -1, i < NX - 1 ? k + 1 : -1, j > 0 ? k - NX : -1, j < NR - 1 ? k + NX : -1];
    if (nb.some(q => q >= 0 && !g.SOL[q])) g.GH1.push(k);
  }
  const in1 = g.GMK = new Uint8Array(NC); for (const k of g.GH1) in1[k] = 1; for (const k of g.GHOT) in1[k] = 2;
  for (let j = 0; j < NR; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x = xc(i), r = rc(j); if (!g.SOL[k] || in1[k] || x < FG.xPlug - 2 * H || x > FG.xCore + 0.6 || r > FG.rCowlC + 2 * H) continue;
    if ([k - 1, k + 1, k - NX, k + NX].some(q => q >= 0 && q < NC && in1[q] === 1)) g.GH2.push(k);
  }
  g.aIn = 0; g.aOut = 0; for (let f = 0; f < NU; f++) { const r = ((f / (NX + 1) | 0) + 0.5) * H; if (g.CIN[f]) g.aIn += r * H; if (g.COUT[f]) g.aOut += r * H; }
  g.iFan = Math.round((0.5 * (FG.fan[0] + FG.fan[1]) - X0) / H); g.iBx = Math.round((FG.xTE - X0) / H) - 1;   // mặt cắt đo lưu lượng: giữa đĩa quạt · ngay sau miệng xả quạt
  g.vBx = 0; g.qFan = 0; g.qByp = 0;
  g.iA = Math.max(0, Math.floor((FG.xPlug - 0.1 - X0) / H)); g.iB = Math.min(NX, Math.ceil((FG.xLip + 0.1 - X0) / H)); g.jB = Math.min(NR, Math.ceil((lerpT(FG.wallOut, 0) + 0.15) / H));
  initParticles(m);
  return g;
}

/* ── nội suy song tuyến (kẹp biên = gradient 0) + ghi min/max 4 điểm cho MacCormack ── */
let sMin = 0, sMax = 0;
function sampleGrid(F, W, NH, fi, fj, mm) {
  if (fi < 0) fi = 0; else if (fi > W - 1.0001) fi = W - 1.0001;
  if (fj < 0) fj = 0; else if (fj > NH - 1.0001) fj = NH - 1.0001;
  const i = fi | 0, j = fj | 0, a = fi - i, b = fj - j, k = j * W + i;
  const f00 = F[k], f10 = F[k + 1], f01 = F[k + W], f11 = F[k + W + 1];
  if (mm) { sMin = Math.min(f00, f10, f01, f11); sMax = Math.max(f00, f10, f01, f11); }
  return (f00 * (1 - a) + f10 * a) * (1 - b) + (f01 * (1 - a) + f11 * a) * b;
}
const sU = (F, x, r, mm) => sampleGrid(F, G.NX + 1, G.NR, (x - G.X0) / G.H, Math.abs(r) / G.H - 0.5, mm);
function sV(F, x, r, mm) {                                        // v lẻ qua trục: v(−r) = −v(r)
  const s = r < 0 ? -1 : 1, v = sampleGrid(F, G.NX, G.NR + 1, (x - G.X0) / G.H - 0.5, Math.abs(r) / G.H, mm);
  if (s < 0 && mm) { const t = sMin; sMin = -sMax; sMax = -t; }
  return s * v;
}
const sC = (F, x, r, mm) => sampleGrid(F, G.NX, G.NR, (x - G.X0) / G.H - 0.5, Math.abs(r) / G.H - 0.5, mm);

/* ── tính sẵn điểm truy ngược (dt > 0) cho 3 loại nút; MacCormack dùng lại cho cả chiều xuôi (−dt) ── */
function trace(dt) {
  const g = G, { NX, NR, H, X0, U, V } = g;
  for (let j = 0; j < NR; j++) for (let i = 0; i <= NX; i++) {
    const f = j * (NX + 1) + i, x = X0 + i * H, r = (j + 0.5) * H, u = U[f], v = sV(V, x, r);
    g.BXu[f] = x - u * dt; g.BRu[f] = r - v * dt;
  }
  for (let j = 0; j <= NR; j++) for (let i = 0; i < NX; i++) {
    const f = j * NX + i, x = X0 + (i + 0.5) * H, r = j * H, u = sU(U, x, r), v = V[f];
    g.BXv[f] = x - u * dt; g.BRv[f] = r - v * dt;
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x = X0 + (i + 0.5) * H, r = (j + 0.5) * H, u = sU(U, x, r), v = sV(V, x, r);
    g.BXc[k] = x - u * dt; g.BRc[k] = r - v * dt;
  }
}
// MacCormack: φ̂ = SL(φ) (lấy cả min/max) · φ̌ = SL⁻¹(φ̂) theo điểm xuôi đối xứng · φ = φ̂ + ½(φ − φ̌), kẹp vào [min, max]
function maccormack(src, out, tmp, lo, hi, samp, BX, BR, N, nodeX, nodeR) {
  for (let k = 0; k < N; k++) { out[k] = samp(src, BX[k], BR[k], true); lo[k] = sMin; hi[k] = sMax; }
  for (let k = 0; k < N; k++) {                                   // truy xuôi: điểm đối xứng qua nút
    const x = nodeX(k), r = nodeR(k);
    tmp[k] = samp(out, 2 * x - BX[k], 2 * r - BR[k], false);
  }
  for (let k = 0; k < N; k++) { let v = out[k] + 0.5 * (src[k] - tmp[k]); if (v < lo[k]) v = lo[k]; else if (v > hi[k]) v = hi[k]; out[k] = v; }
}

/* ── ĐỘ NHỚT RỐI hiệu chỉnh theo thực nghiệm (mô hình đại số cho dòng tự do, Pope "Turbulent Flows" 2000 §5.4–5.5):
      mỗi trạm x sau miệng xả quạt: Um = |u| lớn nhất, δω = Um / max|∂u/∂r| (lớp trượt ngoài), r½ = bán kính nửa vận tốc
      • gần miệng xả — lớp trượt:  ν_t = 0.0068·Um·δω  ⇒ dδω/dx = 8π·0.0068 ≈ 0.17 (Brown & Roshko 1974, khí ngoài đứng yên)
      • xa (> 2 → 6 D) — tia tròn:  ν_t = 0.028·Um·r½   ⇒ dr½/dx ≈ 0.094 (Hussein, Capp & George 1994)
      ν_t phủ đều mặt cắt tia (cửa sổ |u|/Um), ngoài tia ≈ 0 ⇒ dòng hút trước động cơ gần như không rối. |S| giữ cho hạt. ── */
function eddyViscosity() {
  const g = G, { NX, NR, H, X0, U, V, SOL, NUT, SS, FG } = g, W = NX + 1, Dn = 2 * FG.lips[0][1];
  // vùng tia xa tiếp quản (rối lớp ngoài đã ăn tới trục): 2 → 5.2 D khi đứng yên; gió hầm U∞ làm lớp trượt ngoài lớn chậm theo
  // (1−λ)/(1+λ) (Brown & Roshko) ⇒ lõi thế dài ra (1+λ)/(1−λ) lần — λ = U∞ / vận tốc luồng quạt ≈ 0.23 ⇒ 3.2 → 8.3 D
  const lam = g.vBx > 0.2 ? Math.min(0.8, g.Uinf / g.vBx) : 0, Fl = (1 + lam) / (1 - lam), jd0 = g.jetD0 * Fl, jd1 = g.jetD1 * Fl;
  const col = g.colNu || (g.colNu = new Float32Array(NX)), cs = g.colS || (g.colS = new Float32Array(NX)), cw = g.colW || (g.colW = new Float32Array(NX)), au = g.au || (g.au = new Float32Array(NR));
  for (let i = 0; i < NX; i++) {
    const x = X0 + (i + 0.5) * H; col[i] = 0; cs[i] = 0; cw[i] = 0;
    if (x > FG.xTE + 0.02) continue;                                 // trước / trong động cơ: không rối
    let um = 0, jm = 0;
    for (let j = 0; j < NR; j++) { const k = j * NX + i; au[j] = SOL[k] ? 0 : Math.max(0, Math.abs(0.5 * (U[j * W + i] + U[j * W + i + 1])) - g.Uinf); if (au[j] > um) { um = au[j]; jm = j; } }   // vận tốc VƯỢT gió hầm
    if (um < 0.05) continue;
    let gm = 0, rh = (jm + 0.5) * H;
    for (let j = jm; j < NR - 1; j++) { const s = (au[j] - au[j + 1]) / H; if (s > gm) gm = s; }
    for (let j = jm; j < NR - 1; j++) if (au[j] >= um / 2 && au[j + 1] < um / 2) { rh = (j + 0.5) * H + H * (au[j] - um / 2) / (au[j] - au[j + 1]); break; }
    const dw = gm > 0 ? um / gm : H, d = (FG.xTE - x) / Dn, t = Math.min(1, Math.max(0, (d - jd0) / (jd1 - jd0))), w = t * t * (3 - 2 * t);   // tia xa tiếp quản sau lõi thế
    col[i] = g.kJet * um * rh * w;                                   // phần tia xa (đều trên mặt cắt), 0 ở gần miệng xả
    cs[i] = um; cw[i] = dw;
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i; if (SOL[k]) { NUT[k] = 0; SS[k] = 0; continue; }
    const r = (j + 0.5) * H, fu = j * W + i, fv = j * NX + i;
    const uc = Math.max(0, Math.abs(0.5 * (U[fu] + U[fu + 1])) - g.Uinf), wr = cs[i] > 0 ? (g.win > 0 ? Math.min(1, uc / (g.win * cs[i])) : 1) : 0;
    const nb = (col[Math.max(0, i - 1)] + 2 * col[i] + col[Math.min(NX - 1, i + 1)]) / 4;
    const ux = (U[fu + 1] - U[fu]) / H, vr = (V[fv + NX] - V[fv]) / H, vor = 0.5 * (V[fv + NX] + V[fv]) / r;
    const jn = Math.min(NR - 1, j + 1), js = Math.max(0, j - 1), ie = Math.min(NX - 1, i + 1), iw = Math.max(0, i - 1);
    const ur = (0.5 * (U[jn * W + i] + U[jn * W + i + 1]) - 0.5 * (U[js * W + i] + U[js * W + i + 1])) / ((jn - js) * H || H);
    const vx = (0.5 * (V[j * NX + ie] + V[(j + 1) * NX + ie]) - 0.5 * (V[j * NX + iw] + V[(j + 1) * NX + iw])) / ((ie - iw) * H || H);
    const sraw = Math.sqrt(2 * (ux * ux + vr * vr + vor * vor) + (ur + vx) * (ur + vx));
    const sc = cs[i] > 0 ? Math.min(sraw, 1.5 * cs[i] / Math.max(cw[i], 2 * H)) : sraw;   // trần = thang biến dạng lớp trượt Um/δω
    SS[k] = sc;
    // CHIỀU DÀI TRỘN Prandtl: ν_t = ℓ²·|S|, ℓ² = kML·δω² (lớp ngoài: ν ≈ kML·ΔU·δω như mô hình lớp trượt) — lớp trong lõi nóng / luồng
    // quạt chênh vận tốc ít ⇒ |S| nhỏ ⇒ trộn chậm ⇒ lõi thế (tam giác nóng) dài đúng như tia đồng trục thật; tia xa: ν đều 0.028·Um·r½
    NUT[k] = g.nu0 + (cs[i] > 0 ? Math.max(g.kML * Math.pow(Math.max(cw[i], 2 * H), 2) * sc, nb * wr) : 0);
  }
}
/* ── khuếch tán ẨN kiểu ADI (quét x rồi quét r, mỗi đường giải 3 đường chéo Thomas) — ổn định vô điều kiện với ν_t lớn ── */
const TA = new Float64Array(1024), TB = new Float64Array(1024), TCc = new Float64Array(1024), TD = new Float64Array(1024), TCp = new Float64Array(1024), TDp = new Float64Array(1024);
function thomas(n, out, idx) {                                    // a·x[i−1] + b·x[i] + c·x[i+1] = d
  TCp[0] = TCc[0] / TB[0]; TDp[0] = TD[0] / TB[0];
  for (let i = 1; i < n; i++) { const m = TB[i] - TA[i] * TCp[i - 1]; TCp[i] = TCc[i] / m; TDp[i] = (TD[i] - TA[i] * TDp[i - 1]) / m; }
  let x = TDp[n - 1]; out[idx(n - 1)] = x;
  for (let i = n - 2; i >= 0; i--) { x = TDp[i] - TCp[i] * x; out[idx(i)] = x; }
}
// ν tại nút bất kỳ (trung bình ô kề); Pr_t chia cho vô hướng
function diffuse(dt) {
  const g = G, { NX, NR, H, U, V, T, C, NUT, SU, SV, SOL } = g, W = NX + 1, h2 = H * H;
  const nuC = (i, j) => (i < 0 || i >= NX || j < 0 || j >= NR) ? 0 : NUT[j * NX + i];
  // ─ vô hướng T, C (tâm ô), thông lượng 0 qua vật rắn & biên ─
  for (const F of [T, C]) {
    for (let j = 0; j < NR; j++) {                                  // quét x
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        if (SOL[k]) { TA[i] = 0; TB[i] = 1; TCc[i] = 0; TD[i] = 0; continue; }
        const e = i < NX - 1 && !SOL[k + 1] ? dt * 0.5 * (NUT[k] + NUT[k + 1]) / 0.9 / h2 : 0, w = i > 0 && !SOL[k - 1] ? dt * 0.5 * (NUT[k] + NUT[k - 1]) / 0.9 / h2 : 0;
        TA[i] = -w; TB[i] = 1 + e + w; TCc[i] = -e; TD[i] = F[k];
      }
      thomas(NX, F, (i) => j * NX + i);
    }
    for (let i = 0; i < NX; i++) {                                  // quét r (trọng r)
      for (let j = 0; j < NR; j++) {
        const k = j * NX + i, rc = (j + 0.5) * H;
        if (SOL[k]) { TA[j] = 0; TB[j] = 1; TCc[j] = 0; TD[j] = 0; continue; }
        const n = j < NR - 1 && !SOL[k + NX] ? dt * (j + 1) * H * 0.5 * (NUT[k] + NUT[k + NX]) / 0.9 / (rc * h2) : 0;
        const s = j > 0 && !SOL[k - NX] ? dt * j * H * 0.5 * (NUT[k] + NUT[k - NX]) / 0.9 / (rc * h2) : 0;
        TA[j] = -s; TB[j] = 1 + n + s; TCc[j] = -n; TD[j] = F[k];
      }
      thomas(NR, F, (j) => j * NX + i);
    }
  }
  // ─ u (mặt dọc trục): quét x giữa mặt i, i+1 dùng ν ô i; quét r dùng ν góc; mặt rắn & 2 mặt biên x giữ nguyên ─
  for (let j = 0; j < NR; j++) {
    for (let i = 0; i <= NX; i++) {
      const f = j * W + i;
      if (SU[f] || i === 0 || i === NX) { TA[i] = 0; TB[i] = 1; TCc[i] = 0; TD[i] = (SU[f] || g.INF[f]) ? g.UP[f] : U[f]; continue; }
      const e = dt * nuC(i, j) / h2, w = dt * nuC(i - 1, j) / h2;
      TA[i] = -w; TB[i] = 1 + e + w; TCc[i] = -e; TD[i] = U[f];
    }
    thomas(NX + 1, U, (i) => j * W + i);
  }
  for (let i = 1; i < NX; i++) {
    for (let j = 0; j < NR; j++) {
      const f = j * W + i, rc = (j + 0.5) * H;
      if (SU[f]) { TA[j] = 0; TB[j] = 1; TCc[j] = 0; TD[j] = g.UP[f]; continue; }
      const nn = j < NR - 1 ? 0.25 * (nuC(i - 1, j) + nuC(i, j) + nuC(i - 1, j + 1) + nuC(i, j + 1)) : 0, ns = j > 0 ? 0.25 * (nuC(i - 1, j) + nuC(i, j) + nuC(i - 1, j - 1) + nuC(i, j - 1)) : 0;
      const n = j < NR - 1 && !SU[f + W] ? dt * (j + 1) * H * nn / (rc * h2) : 0, s = j > 0 && !SU[f - W] ? dt * j * H * ns / (rc * h2) : 0;
      TA[j] = -s; TB[j] = 1 + n + s; TCc[j] = -n; TD[j] = U[f];
    }
    thomas(NR, U, (j) => j * W + i);
  }
  // ─ v (mặt hướng kính): thêm số hạng −v/r² (ẩn); trục j = 0 và biên ngoài j = NR giữ nguyên ─
  for (let j = 1; j < NR; j++) {
    for (let i = 0; i < NX; i++) {
      const f = j * NX + i;
      if (SV[f]) { TA[i] = 0; TB[i] = 1; TCc[i] = 0; TD[i] = 0; continue; }
      const nE = i < NX - 1 && !SV[f + 1] ? dt * 0.25 * (nuC(i, j - 1) + nuC(i, j) + nuC(i + 1, j - 1) + nuC(i + 1, j)) / h2 : 0;
      const nW = i > 0 && !SV[f - 1] ? dt * 0.25 * (nuC(i, j - 1) + nuC(i, j) + nuC(i - 1, j - 1) + nuC(i - 1, j)) / h2 : 0;
      TA[i] = -nW; TB[i] = 1 + nE + nW; TCc[i] = -nE; TD[i] = V[f];
    }
    thomas(NX, V, (i) => j * NX + i);
  }
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j <= NR; j++) {
      const f = j * NX + i;
      if (j === 0 || j === NR || SV[f]) { TA[j] = 0; TB[j] = 1; TCc[j] = 0; TD[j] = SV[f] ? 0 : V[f]; continue; }
      const rj = j * H, nuj = 0.5 * (nuC(i, j - 1) + nuC(i, j));
      const n = !SV[f + NX] ? dt * (j + 0.5) * H * nuC(i, j) / (rj * h2) : 0, s = !SV[f - NX] ? dt * (j - 0.5) * H * nuC(i, j - 1) / (rj * h2) : 0;
      TA[j] = -s; TB[j] = 1 + n + s + dt * nuj / (rj * rj); TCc[j] = -n; TD[j] = V[f];
    }
    thomas(NR + 1, V, (j) => j * NX + i);
  }
}

function sor(iters, ia, ib, jb) {                                  // SOR đỏ-đen ω 1.9 trên vùng [ia, ib) × [0, jb)
  const g = G, { NX, NR, H, P, DIV, SOL } = g, h2 = H * H;
  for (let it = 0; it < iters; it++) for (let col = 0; col < 2; col++) for (let j = 0; j < jb; j++) {
    const rc = (j + 0.5) * H, aN0 = (j + 1) * H / rc, aS0 = j * H / rc;
    for (let i = ia + ((j + col + ia) & 1); i < ib; i += 2) {
      const k = j * NX + i; if (SOL[k]) continue;
      let s = 0, a = 0;
      if (i < NX - 1) { if (!SOL[k + 1]) { s += P[k + 1]; a += 1; } }                         // cửa hầm (i = NX−1): đặt vận tốc ⇒ Neumann
      if (i > 0) { if (!SOL[k - 1]) { s += P[k - 1]; a += 1; } } else a += 1;                // cuối hầm: p = 0 (khí ra)
      if (j < NR - 1) { if (!SOL[k + NX]) { s += aN0 * P[k + NX]; a += aN0; } }                // vách hầm r = R1: Neumann
      if (j > 0 && !SOL[k - NX]) { s += aS0 * P[k - NX]; a += aS0; }
      P[k] += 1.9 * ((s - h2 * DIV[k]) / a - P[k]);
    }
  }
}
/* ── chiếu áp suất: ∇²p (trọng r) = ∇·u* ; u = u* − ∇p ── */
function project(iters) {
  const g = G, { NX, NR, H, U, V, P, DIV, SOL } = g, W = NX + 1;
  // điều kiện vách GÁN TRƯỚC khi tính phân kỳ (đối lưu ghi đè cả mặt vách bằng giá trị nội suy) — mặt vách = 0, cửa lõi = lưu lượng đặt
  for (let f = 0; f < g.NU; f++) if (g.SU[f] || g.INF[f]) U[f] = g.UP[f];
  for (let f = 0; f < g.NVF; f++) if (g.SV[f]) V[f] = 0;
  for (let j = 0; j < NR; j++) {
    const rc = (j + 0.5) * H, rn = (j + 1) * H, rs = j * H;
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i; if (SOL[k]) { DIV[k] = 0; continue; }
      DIV[k] = (U[j * W + i + 1] - U[j * W + i]) / H + (rn * V[(j + 1) * NX + i] - rs * V[j * NX + i]) / (rc * H);
    }
  }
  sor(iters, 0, NX, NR);
  sor(60, g.iA, g.iB, g.jB);                                       // thêm lượt cục bộ cho ống bypass hẹp (SOR hội tụ chậm trong khe)
  for (let j = 0; j < NR; j++) for (let i = 0; i <= NX; i++) {
    const f = j * W + i; if (g.SU[f] || g.INF[f]) { U[f] = g.UP[f]; continue; }
    const pe = i < NX ? P[j * NX + i] : 0, pw = i > 0 ? P[j * NX + i - 1] : 0;
    U[f] -= (pe - pw) / H;
  }
  for (let j = 0; j <= NR; j++) for (let i = 0; i < NX; i++) {
    const f = j * NX + i; if (g.SV[f]) { V[f] = 0; continue; }
    const pn = j < NR ? P[j * NX + i] : 0, ps = P[(j - 1) * NX + i];
    V[f] -= (pn - ps) / H;
  }
}

// LỰC & NGUỒN — số liệu GEnx-2B67 (GE datasheet): tỉ số bypass 8.0 khi cất cánh ⇒ lõi nhận 1/9 lưu lượng qua quạt.
// • đĩa quạt (actuator disk): kéo u về −UF trong lớp ô quạt
// • CỬA HÚT LÕI: hút đúng 1/9 lưu lượng đo được qua đĩa quạt (khí vào máy nén cao áp — lõi không giải bên trong)
// • CỬA PHUN LÕI: phụt sao cho tia lõi ≈ 1.3 × vận tốc đỉnh luồng quạt ở miệng xả (suy từ lực đẩy 66 500 lbf · 1 042 kg/s · BPR 8, chia năng
//   lượng tối ưu V_c/V_f ≈ 1.25–1.35) — thể tích ra > vào là phần khí giãn nở vì cháy; miền tính mở nên không cần cân bằng; mang T = 1
function forces(dt, spool) {
  const g = G, { NU, NC, NX, NR, H, X0, U, V, T, C, FU, CORE, FAN, UP } = g, W = NX + 1;
  const UF = (g.UFan ?? 5.9) * spool, kr = Math.min(1, 10 * dt);
  g.Uinf = (g.uInfK ?? 0.75) * spool;                              // gió hầm (0.75 lathe/s ≈ 0.25 × luồng quạt)
  for (let f = 0; f < g.NU; f++) if (g.INF[f]) g.UP[f] = -g.Uinf;
  for (let j = 0; j < NR; j++) { T[j * NX + NX - 1] = 0; C[j * NX + NX - 1] = 0; }   // khí vào hầm sạch, nguội
  for (let f = 0; f < NU; f++) if (FU[f]) U[f] += (-UF - U[f]) * kr;
  let qf = 0, qb = 0, ab = 0, vmx = 0;                              // lưu lượng thể tích (÷2π) qua đĩa quạt & miệng xả quạt · vận tốc đỉnh luồng quạt
  for (let j = 0; j < NR; j++) {
    const r = (j + 0.5) * H, ff = j * W + g.iFan, fb = j * W + g.iBx;
    if (!g.SU[ff] && FAN[j * NX + Math.min(NX - 1, g.iFan)]) qf += -U[ff] * r * H;
    if (!g.SU[fb] && r > g.FG.rCowlC && r < g.FG.lips[0][1]) { qb += -U[fb] * r * H; ab += r * H; vmx = Math.max(vmx, -U[fb]); }
  }
  g.qFan = qf; g.qByp = qb;
  g.vBx += (vmx - g.vBx) * Math.min(1, 3 * dt);                   // vận tốc đỉnh luồng quạt ở miệng xả (làm trơn 0.3 s)
  // tia lõi giãn ngay khi rời miệng (côn thu nhỏ, mất vách ngoài) ⇒ đặt 1.65× tại mặt phun để cách miệng 0.1 lathe còn ≈ 1.3× luồng quạt
  const uIn = g.aIn > 0 ? Math.max(0, qf) / 9 / g.aIn : 0, uOut = 1.65 * Math.max(0, g.vBx);
  for (let f = 0; f < NU; f++) { if (g.CIN[f]) UP[f] = -uIn; else if (g.COUT[f]) UP[f] = -uOut; }
  for (let k = 0; k < NC; k++) {
    if (CORE[k]) { T[k] = spool; C[k] = 1; }
    else if (FAN[k] && spool > 0.05) C[k] = 1;
  }
}

function ghostTC(spool) {
  const g = G, { T, C, SOL, NX, NC, GMK } = g;
  for (const k of g.GHOT) { T[k] = spool; C[k] = 1; }
  for (const L of [g.GH1, g.GH2]) for (const k of L) {             // lớp 1 lấy từ ô khí kề · lớp 2 lấy từ lớp 1
    let t = 0, c = 0, n = 0;
    for (const q of [k - 1, k + 1, k - NX, k + NX]) if (q >= 0 && q < NC && (L === g.GH1 ? !SOL[q] : GMK[q] === 1)) { t += T[q]; c += C[q]; n++; }
    if (n) { T[k] = t / n; C[k] = c / n; }
  }
}

function step(dt, spool) {
  const g = G;
  forces(dt, spool);
  eddyViscosity();
  diffuse(dt);
  trace(dt);
  ghostTC(spool);                                                   // sau khuếch tán (vốn xoá ô rắn về 0), ngay trước đối lưu
  const { NX, NR, H, X0 } = g, W = NX + 1;
  maccormack(g.U, g.U2, g.U1, g.UL, g.UH, sU, g.BXu, g.BRu, g.NU, f => X0 + (f % W) * H, f => ((f / W | 0) + 0.5) * H);
  maccormack(g.V, g.V2, g.V1, g.VL, g.VH, sV, g.BXv, g.BRv, g.NVF, f => X0 + (f % NX + 0.5) * H, f => (f / NX | 0) * H);
  maccormack(g.T, g.T2, g.T1, g.TL, g.TH, sC, g.BXc, g.BRc, g.NC, k => X0 + (k % NX + 0.5) * H, k => ((k / NX | 0) + 0.5) * H);
  maccormack(g.C, g.C2, g.C1, g.CL, g.CH, sC, g.BXc, g.BRc, g.NC, k => X0 + (k % NX + 0.5) * H, k => ((k / NX | 0) + 0.5) * H);
  g.U.set(g.U2); g.V.set(g.V2); g.T.set(g.T2); g.C.set(g.C2);
  for (let k = 0; k < g.NC; k++) if (g.SOL[k]) { g.T[k] = 0; g.C[k] = 0; }
  ghostTC(spool);                                                   // ô ma giữ giá trị cho bước sau & cho hạt lấy màu sát vách
  project(36);
}

function reset() { const g = G; for (const F of [g.U, g.V, g.T, g.C, g.P]) F.fill(0); for (let n = 0; n < g.NP; n++) spawn(n, true); }

/* ════════════════════ HẠT ════════════════════ */
let gSpare = null;
function gauss() { if (gSpare !== null) { const v = gSpare; gSpare = null; return v; } let u = 0, v = 0; while (u < 1e-12) u = Math.random(); v = Math.random(); const m = Math.sqrt(-2 * Math.log(u)); gSpare = m * Math.sin(6.283185307 * v); return m * Math.cos(6.283185307 * v); }

function initParticles(m) {
  const g = G, NP = m.NP, NT = m.NT;
  Object.assign(g, {
    NP, NT, px: new Float32Array(NP), pr: new Float32Array(NP), pth: new Float32Array(NP), pu: new Float32Array(NP), pv: new Float32Array(NP), pw: new Float32Array(NP),
    page: new Float32Array(NP), pe: new Uint8Array(NP), hist: new Float32Array(NP * NT * 3), psp: new Float32Array(NP), pwid: new Float32Array(NP), pk: new Float32Array(NP)
  });
  for (let n = 0; n < NP; n++) { g.pe[n] = n % g.ENG.length; spawn(n, true); }
}
const solidAt = (x, r) => { const g = G, i = Math.floor((x - g.X0) / g.H), j = Math.floor(r / g.H); return i >= 0 && i < g.NX && j >= 0 && j < g.NR && g.SOL[j * g.NX + i] === 1; };
function rmaxOf(n) { const g = G, ca = Math.cos(g.pth[n]); return -ca > 0.05 ? (g.ENG[g.pe[n]].axisH - 0.05) / -ca : 99; }
function spawn(n, fresh) {
  const g = G, FG = g.FG;
  let a = 0; do { a = Math.random() * Math.PI * 2; } while (Math.cos(a) > Math.cos(g.TOPA));       // né pylon & cánh phía trên
  g.pth[n] = a;
  const z = Math.random(); let x, r;
  if (fresh) { x = g.X0 + 0.2 + Math.random() * (g.X1 - g.X0 - 0.4); r = 1.9 * Math.sqrt(Math.random()); }
  else if (z < 0.15) { x = FG.xLip + 0.1 + Math.random() * 1.8; r = Math.sqrt(Math.random()) * (0.45 + 0.35 * (x - FG.xLip)); }   // bơm khói trước môi hút
  else if (z < 0.30) { x = FG.xTE - 0.03; const rb = lerpT(FG.body, x), rw = lerpT(FG.wallIn, x); r = rb + (0.08 + 0.84 * Math.random()) * (rw - rb); }   // miệng xả quạt
  else if (z < 0.84) { x = FG.xCore - 0.04; r = FG.rPlugC + 0.02 + Math.random() * (FG.rCowlC - FG.rPlugC - 0.04); }   // miệng xả lõi (tam giác nóng)
  else { x = g.X1 - 0.15 - 0.6 * Math.random(); r = Math.sqrt(0.5 + (Math.pow(g.R1 - 0.12, 2) - 0.5) * Math.random()); }   // gió hầm: thả ở cửa hầm, đều theo diện tích
  const rm = rmaxOf(n); if (r > rm) r = rm * Math.random();
  if (solidAt(x, r)) r = Math.min(g.R1 - 0.1, lerpT(FG.wallOut, x) + 0.05);
  g.px[n] = x; g.pr[n] = r; g.pu[n] = g.pv[n] = g.pw[n] = 0; g.page[n] = 0;
  g.pwid[n] = 0.7 + 0.6 * Math.random(); g.pk[n] = 0.64 + 0.42 * Math.random();     // mỗi sợi khói dày / đậm khác nhau một chút
  const o = n * g.NT * 3, w = g.ENG[g.pe[n]], ES = g.ES, X = w.ex + x * ES, Y = w.ey + r * ES * Math.cos(a), Zz = w.ez + r * ES * Math.sin(a);
  for (let j = 0; j < g.NT; j++) { g.hist[o + j * 3] = X; g.hist[o + j * 3 + 1] = Y; g.hist[o + j * 3 + 2] = Zz; }
}

// 1 bước con: trung bình (từ trường) + dao động rối OU: σ = max(c1·Cs·h·|S|, 0.2·|u|·√C) , thời gian Lagrange T_L = 0.3 / (|S| + 1)
function moveParticles(dt) {
  const g = G, FG = g.FG, { NP, NT, ES } = g;
  for (let n = 0; n < NP; n++) {
    const x = g.px[n], r = g.pr[n];
    const u = sU(g.U, x, r), v = sV(g.V, x, r), S = sC(g.SS, x, r);
    const sp = Math.hypot(u, v);
    // rối cân bằng (sinh = tiêu tán): k = ν_t·|S|/√Cμ (Cμ 0.09) ⇒ σ = √(2k/3) = 1.49·√(ν_t·|S|); T_L = 0.3·k/ε = 1/|S| (Thomson 1987, C0 ≈ 4.4)
    // trần σ ≤ 0.2·Um của trạm (đỉnh cường độ rối lớp trượt gần miệng xả đo được 15–20 % vận tốc phụt)
    const ic = Math.min(g.NX - 1, Math.max(0, Math.floor((x - g.X0) / g.H))), umc = g.colS ? g.colS[ic] : 0;
    const nt = sC(g.NUT, x, r), sig = Math.min(0.2 * umc, 1.49 * Math.sqrt(Math.max(0, nt - g.nu0) * S)), TLi = S + 0.5, a = Math.exp(-dt * TLi), b = sig * Math.sqrt(1 - a * a);
    g.pu[n] = g.pu[n] * a + b * gauss(); g.pv[n] = g.pv[n] * a + b * gauss(); g.pw[n] = g.pw[n] * a + b * gauss();
    let nx = x + (u + g.pu[n]) * dt, nr = r + (v + g.pv[n]) * dt, th = g.pth[n] + g.pw[n] * dt / Math.max(r, 0.06);
    if (nr < 0) { nr = -nr; th += Math.PI; }
    const ct = Math.cos(th);                                          // giữ ngoài góc pylon/cánh phía trên
    if (ct > Math.cos(g.TOPA)) { const s = Math.sin(th) >= 0 ? 1 : -1; th = s * g.TOPA; g.pw[n] = -g.pw[n]; }
    g.pth[n] = th;
    if (solidAt(nx, nr)) { if (!solidAt(nx, r)) nr = r; else if (!solidAt(x, nr)) nx = x; else { nx = x; nr = r; } g.pu[n] *= -0.3; g.pv[n] *= -0.3; }
    let jump = false;
    if (x > FG.xSplit && nx <= FG.xSplit + 0.02 && nr < FG.rSplit && nr > FG.rHub - 0.03) {       // vào cửa lõi → miệng xả lõi
      const f = Math.min(1, Math.max(0, (nr - FG.rHub) / (FG.rSplit - FG.rHub)));
      nx = FG.xCore - 0.05; nr = FG.rPlugC + 0.02 + f * (FG.rCowlC - FG.rPlugC - 0.04); jump = true;
    }
    const rm = rmaxOf(n); if (nr > rm) { nr = rm; g.pv[n] = -Math.abs(g.pv[n]) * 0.3; }
    g.px[n] = nx; g.pr[n] = nr; g.page[n] += dt;
    if (nx < g.X0 + 0.1 || nx > g.X1 - 0.02 || nr > g.R1 - 0.05 || g.page[n] > 9 || (g.page[n] > 1.2 && sp < 0.06)) { spawn(n, false); continue; }
    const o = n * NT * 3, w = g.ENG[g.pe[n]], X = w.ex + nx * ES, Y = w.ey + nr * ES * Math.cos(th), Zz = w.ez + nr * ES * Math.sin(th);
    if (jump) { for (let j = 0; j < NT; j++) { g.hist[o + j * 3] = X; g.hist[o + j * 3 + 1] = Y; g.hist[o + j * 3 + 2] = Zz; } }
    else { g.hist.copyWithin(o + 3, o, o + (NT - 1) * 3); g.hist[o] = X; g.hist[o + 1] = Y; g.hist[o + 2] = Zz; }
    g.psp[n] = sp;
  }
}

/* ── màu: lạnh theo tốc độ · nóng theo nhiệt ── */
const CC = [[0.0, 0xa9cfff], [0.6, 0x5a9bff], [1.4, 0x2f6fe8], [2.1, 0x45b0ff], [2.8, 0x5fe3ff]].map(([v, c]) => [v, (c >> 16) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]);
const CHT = [[0.05, 0xffe7a6], [0.3, 0xffcf63], [0.55, 0xffa63c], [0.75, 0xff7a2c], [0.88, 0xe0261a], [0.97, 0xa80e0c]].map(([v, c]) => [v, (c >> 16) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]);   // thang kiểu CFD: nóng nhất = ĐỎ thẫm (nền sáng nổi rõ), nguội dần → cam → vàng nhạt
function ramp(R, v, out) { let k = 0; while (k < R.length - 2 && v > R[k + 1][0]) k++; const A = R[k], B = R[k + 1], t = Math.min(1, Math.max(0, (v - A[0]) / (B[0] - A[0]))); out[0] = A[1] + (B[1] - A[1]) * t; out[2] = A[3] + (B[3] - A[3]) * t; out[1] = A[2] + (B[2] - A[2]) * t; }

// DẢI KHÓI quay mặt về camera (2 đỉnh / điểm vệt): mép mềm (độ mờ ngang dải = 1 − e², tính ở shader theo thuộc tính 'edge'),
// nở rộng ~4× về đuôi và tan dần như khói khuếch tán; độ rộng = phần thật (theo tốc độ) + phần điểm ảnh (≥ ~2 px khi nhìn xa).
// Khí gần như đứng yên (< 0.15 lathe/s) gần như trong suốt ⇒ không thành màn sương phủ cả hầm.
function buildRibbons(cam, lpp, pos, col, alp) {
  const g = G, { NP, NT } = g, cold = [0, 0, 0], hotc = [0, 0, 0];
  let vi = 0;
  for (let n = 0; n < NP; n++) {
    const x = g.px[n], r = g.pr[n], sp = g.psp[n], tmp = Math.max(0, sC(g.T, x, r)), cj = Math.min(1, Math.max(0, sC(g.C, x, r)));
    ramp(CC, sp, cold);
    if (tmp > 0.05) { ramp(CHT, tmp, hotc); const m = Math.min(1, (tmp - 0.05) / 0.25); for (let c = 0; c < 3; c++) cold[c] += (hotc[c] - cold[c]) * m; }
    // độ đậm: khí hầm (chưa qua máy) mờ · khí phản lực (C) vừa · khí nóng đậm dần theo T, đỏ thẫm chỉ ở T ≥ ~0.85
    // ⇒ LÕI THẾ NHIỆT (T ≥ 0.9, mũi ở ~5.5 D) nổi thành tam giác đỏ nhọn giữa vệt cam/vàng nhạt đang loe ra của lớp trộn
    const warm = Math.min(1, Math.max(0, (tmp - 0.1) / 0.75)), hs = warm * warm * (3 - 2 * warm);
    const core = Math.min(1, Math.max(0, (tmp - 0.78) / 0.14)), hc = core * core * (3 - 2 * core);   // trong lõi thế nhiệt
    const as = sp < 0.15 ? 0.8 * sp : 0.1 + 0.05 * Math.min(1, sp / 1.5);
    const a0 = Math.min(0.95, as + 0.14 * cj * Math.min(1, sp / 1.2) + 0.32 * hs + 0.45 * hc) * Math.min(1, g.page[n] / 0.3) * g.pk[n];
    const w0 = ((0.005 + 0.003 * Math.min(1, sp / 3)) + 2.0 * lpp) * g.pwid[n] * (1 + 1.0 * hc), o = n * NT * 3, H3 = g.hist;
    for (let j = 0; j < NT; j++) {
      const j0 = j > 0 ? j - 1 : 0, j1 = j < NT - 1 ? j + 1 : NT - 1;
      let tx = H3[o + j0 * 3] - H3[o + j1 * 3], ty = H3[o + j0 * 3 + 1] - H3[o + j1 * 3 + 1], tz = H3[o + j0 * 3 + 2] - H3[o + j1 * 3 + 2];
      if (tx * tx + ty * ty + tz * tz < 1e-14) { tx = 1; ty = 0; tz = 0; }
      let sx = ty * cam[2] - tz * cam[1], sy = tz * cam[0] - tx * cam[2], sz = tx * cam[1] - ty * cam[0];
      const sl = Math.hypot(sx, sy, sz) || 1, uu = j / (NT - 1), k = w0 * (0.8 + 2.4 * uu) / sl;
      sx *= k; sy *= k; sz *= k;
      const q = vi * 3, X = H3[o + j * 3], Y = H3[o + j * 3 + 1], Z = H3[o + j * 3 + 2];
      pos[q] = X + sx; pos[q + 1] = Y + sy; pos[q + 2] = Z + sz; pos[q + 3] = X - sx; pos[q + 4] = Y - sy; pos[q + 5] = Z - sz;
      const hb = 0.18 * Math.pow(1 - uu, 6);                          // đầu sợi khói sáng hơn chút
      const cr = cold[0] + (1 - cold[0]) * hb, cg = cold[1] + (1 - cold[1]) * hb, cb = cold[2] + (1 - cold[2]) * hb;
      col[q] = col[q + 3] = cr; col[q + 1] = col[q + 4] = cg; col[q + 2] = col[q + 5] = cb;
      const al = a0 * Math.pow(1 - uu, 1.3) * Math.min(1, j / 1.5 + 0.35);
      alp[vi] = al; alp[vi + 1] = al;
      vi += 2;
    }
  }
}

// máy yếu: bước giải trường tốn > 25 ms thì giãn nhịp giải (gộp dt, tối đa 1/12 s) — hạt vẫn đi & vẽ mỗi khung ⇒ không khựng
let solveAcc = 0, solveEvery = 0;
function frame(m) {
  const t0 = Date.now(), dt = Math.min(m.dt, 1 / 24), sub = 2;
  solveAcc += dt;
  if (solveAcc >= solveEvery) { const ts = Date.now(); step(Math.min(solveAcc, 1 / 12), m.spool); solveAcc = 0; solveEvery = Math.min(0.1, Math.max(0, (Date.now() - ts - 25) / 1000)); }
  for (let s = 0; s < sub; s++) moveParticles(dt * 1.25 / sub);
  buildRibbons(m.cam, m.lpp, m.pos, m.col, m.alp);
  return Date.now() - t0;
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof module === 'undefined') {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'init') { init(m); self.postMessage({ type: 'ready', NX: G.NX, NR: G.NR }); }
    else if (m.type === 'reset') reset();
    else if (m.type === 'step') {
      const pos = new Float32Array(m.pos), col = new Float32Array(m.col), alp = new Float32Array(m.alp);
      const ms = frame({ dt: m.dt, spool: m.spool, cam: m.cam, lpp: m.lpp, pos, col, alp });
      self.postMessage({ type: 'frame', pos: pos.buffer, col: col.buffer, alp: alp.buffer, ms }, [pos.buffer, col.buffer, alp.buffer]);
    }
  };
}
if (typeof module !== 'undefined') module.exports = { init, step, reset, frame, moveParticles, get G() { return G; }, sU, sV, sC };
