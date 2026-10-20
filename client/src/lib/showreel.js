// TrustVault 24-second showreel as live motion graphics: the website draws it on a canvas in real time
// (components/app/live-showreel.jsx), and docs/video/showreel.src.html imports the same code to render the MP4.

// TrustVault 24-second showreel: everything the product does, cut to a 120 BPM track (one beat = 0.5 s).
// 0 ignite · 1.5 shield · 3 "one vault, three locks" · 5 sign-in (password, email code, Authenticator, hold to enter)
// 8 upload + ENCRYPT · 10 checks + VERIFIED stamp · 12 "verified automatically" · 14 faculty ask a batch
// 16 the student decides · 17 opened once, then locked · 19 tamper-evident ledger · 21 home · 22 logo
// Colours: Electric Night (#06031a, #4cc9f0, #4361ee, #ff007f), green only for "verified". Every frame is a pure
// function of t (seek), so render.mjs can film it. Format after the "showreel" prompts on prompt-motion.com. 
export function createShowreel(canvas) {
  const VIDEO = { w: 1920, h: 1080, duration: 24 };
  const W = 1920, H = 1080, CX = 960, CY = 540;
  const x = canvas.getContext('2d');
  const K = canvas.width / W; // the scene is laid out at 1920 x 1080 and scaled to the canvas

  // ---------- helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const outExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
  const outCubic = (k) => 1 - Math.pow(1 - k, 3);
  const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const outBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const C = { cyan: [76, 201, 240], blue: [67, 97, 238], pink: [255, 0, 127], green: [57, 255, 156], red: [255, 77, 109], white: [245, 245, 247], muted: [179, 174, 214], amber: [255, 190, 60] };
  const INK = '#06031a', CARD = '#100830', LINE = '#2a1f5c', FIELD = '#0a0624';
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mixc = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const BEAT = 0.5;
  const HEX = '0123456789ABCDEF';
  const F = { black: (s) => `900 ${s}px 'Inter Tight'`, bold: (s) => `800 ${s}px 'Inter Tight'`, ui: (s, w = 600) => `${w} ${s}px Inter`, mono: (s, w = 500) => `${w} ${s}px 'JetBrains Mono'` };

  // ---------- shapes sampled once ----------
  const SHIELD = 'M32 5c7 3.4 14 5.4 21 6v18c0 13.6-8.6 24.2-21 30-12.4-5.8-21-16.4-21-30V11c7-.6 14-2.6 21-6z';
  const TICK = 'M22 31l7.5 7.5L43 24';
  function samplePath(d, n) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d);
    const len = p.getTotalLength();
    return Array.from({ length: n }, (_, i) => { const q = p.getPointAtLength((i / n) * len); return [q.x, q.y]; });
  }
  const N = 420;
  const R = rng(7);
  const P = Array.from({ length: N }, () => ({
    a: R() * Math.PI * 2, r: 140 + R() * 330, spin: 0.6 + R() * 1.4, size: 1.2 + R() * 2.6,
    col: R() < 0.5 ? C.cyan : R() < 0.6 ? C.blue : C.pink, d: R(), ox: (R() - 0.5) * 2, oy: (R() - 0.5) * 2,
  }));
  const SH = [...samplePath(SHIELD, 340), ...samplePath(TICK, 80)]; // outline + tick, in a 64-unit box
  const shieldPt = (i, cx, cy, size) => { const [u, v] = SH[i % SH.length]; return [cx + (u - 32) * size / 64, cy + (v - 32) * size / 64]; };
  // 58 students of batch 26MX in a sunflower pattern; most share, a few decline
  const NODES = Array.from({ length: 58 }, (_, i) => { const a = i * 2.39996, r = 70 * Math.sqrt(i + 1.4); return { x: Math.cos(a) * r, y: Math.sin(a) * r, r, ok: hash(i + 3) < 0.8, at: 0.12 + hash(i + 11) * 0.78 }; });
  const CHECKS = ['Text read (OCR)', 'Number format', 'Checksum', 'No editing traces', 'Matches your other documents'];
  const SPARKS = Array.from({ length: 90 }, (_, i) => { const r = rng(100 + i); return { a: r() * 6.283, v: 500 + r() * 1300, s: 2 + r() * 4, col: [C.green, C.cyan, C.white, C.blue][i % 4] }; });

  // ---------- drawing primitives ----------
  function glowDot(px, py, r, col, a) {
    x.fillStyle = rgba(col, a * 0.18); x.beginPath(); x.arc(px, py, r * 3.2, 0, 6.283); x.fill();
    x.fillStyle = rgba(mixc(col, C.white, 0.35), a); x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill();
  }
  function rrect(px, py, w, h, r) { x.beginPath(); x.roundRect(px, py, w, h, r); }
  function text(s, px, py, font, fill, align = 'center', base = 'middle', spacing = '0px') {
    x.font = font; x.textAlign = align; x.textBaseline = base; x.letterSpacing = spacing; x.fillStyle = fill; x.fillText(s, px, py); x.letterSpacing = '0px';
  }
  function gradFill(x0, y0, x1, y1, a = 1) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(C.cyan, a)); g.addColorStop(0.55, rgba(C.blue, a)); g.addColorStop(1, rgba(C.pink, a)); return g;
  }
  function gradText(s, px, py, font, align = 'center', spacing = '0px') {
    x.font = font; x.letterSpacing = spacing; const w = x.measureText(s).width; x.letterSpacing = '0px';
    const x0 = align === 'center' ? px - w / 2 : align === 'right' ? px - w : px;
    text(s, px, py, font, gradFill(x0, py - 60, x0 + w, py + 60), align, 'middle', spacing);
  }
  function drawShield(cx, cy, size, fillA, tickK, strokeA = 1) {
    x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 64, size / 64);
    const sp = new Path2D(SHIELD);
    if (fillA > 0) {
      const g = x.createLinearGradient(10, 5, 54, 60); g.addColorStop(0, rgba(C.cyan, fillA)); g.addColorStop(0.55, rgba(C.blue, fillA)); g.addColorStop(1, rgba(C.pink, fillA));
      x.fillStyle = g; x.fill(sp);
    }
    if (strokeA > 0) { x.lineWidth = 1.6; x.strokeStyle = rgba(C.cyan, strokeA); x.shadowColor = rgba(C.cyan, 0.9); x.shadowBlur = 18; x.stroke(sp); x.shadowBlur = 0; }
    if (tickK > 0) {
      const tp = new Path2D(TICK); x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round';
      x.setLineDash([40, 40]); x.lineDashOffset = 40 - 40 * tickK;
      x.strokeStyle = fillA > 0.5 ? INK : rgba(C.green, 1); x.shadowColor = rgba(C.green, 0.9); x.shadowBlur = fillA > 0.5 ? 0 : 20;
      x.stroke(tp); x.setLineDash([]); x.shadowBlur = 0;
    }
    x.restore();
  }
  function background(t, tint = C.blue, k = 1) {
    const pulse = 1 - seg(t % BEAT, 0, 0.22); // a soft lift on every beat
    const g = x.createRadialGradient(CX, CY, 0, CX, CY, 1150);
    g.addColorStop(0, rgba(mixc([18, 10, 52], tint, 0.16 + 0.06 * pulse * k), 1)); g.addColorStop(1, '#03010f');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  function grid(a) {
    x.strokeStyle = rgba(C.blue, a); x.lineWidth = 1; x.beginPath();
    for (let gx = 0; gx <= W; gx += 80) { x.moveTo(gx, 0); x.lineTo(gx, H); }
    for (let gy = 0; gy <= H; gy += 80) { x.moveTo(0, gy); x.lineTo(W, gy); }
    x.stroke();
  }
  function dots(a) { x.fillStyle = rgba(C.cyan, a * 0.35); for (let gy = 13; gy < H; gy += 26) for (let gx = 13; gx < W; gx += 26) x.fillRect(gx, gy, 2.5, 2.5); }
  function vignette() {
    const g = x.createRadialGradient(CX, CY, 520, CX, CY, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  function hud(t, label, n) {
    text(`${String(n).padStart(2, '0')} / ${label}`, 70, 62, F.mono(20), rgba(C.white, 0.75), 'left', 'middle', '4px');
    text('TRUSTVAULT · SHOWREEL 2026', W - 70, 62, F.mono(20), rgba(C.cyan, 0.8), 'right', 'middle', '4px');
    x.fillStyle = rgba(C.white, 0.16); x.fillRect(70, H - 60, W - 140, 2);
    x.fillStyle = gradFill(70, 0, W - 70, 0); x.fillRect(70, H - 60, (W - 140) * (t / VIDEO.duration), 2);
  }
  function cursor(px, py, down = 0) {
    x.save(); x.translate(px, py);
    if (down > 0) { x.strokeStyle = rgba(C.cyan, 0.8); x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 26, 0, 6.283); x.stroke(); }
    x.scale(1.7 - 0.2 * down, 1.7 - 0.2 * down);
    const p = new Path2D('M0 0 L0 22 L6 17 L10 26 L14 24 L10 15 L17 15 Z');
    x.fillStyle = '#fff'; x.strokeStyle = INK; x.lineWidth = 1.4; x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 12; x.fill(p); x.shadowBlur = 0; x.stroke(p);
    x.restore();
  }
  function padlock(cx, cy, s, closed, col) { // closed 0..1: the shackle drops into the body
    x.save(); x.translate(cx, cy);
    const lift = (1 - closed) * s * 0.26;
    x.lineWidth = s * 0.12; x.strokeStyle = rgba(col, 1); x.lineCap = 'round';
    x.beginPath(); x.moveTo(-s * 0.28, -s * 0.02 - lift); x.lineTo(-s * 0.28, -s * 0.2 - lift); x.arc(0, -s * 0.2 - lift, s * 0.28, Math.PI, 0); x.lineTo(s * 0.28, -s * 0.02 - (closed > 0.98 ? 0 : lift * 0.4)); x.stroke();
    rrect(-s * 0.45, -s * 0.06, s * 0.9, s * 0.68, s * 0.14); x.fillStyle = rgba(col, 1); x.shadowColor = rgba(col, 0.9); x.shadowBlur = 30; x.fill(); x.shadowBlur = 0;
    x.fillStyle = INK; x.beginPath(); x.arc(0, s * 0.2, s * 0.08, 0, 6.283); x.fill(); x.fillRect(-s * 0.03, s * 0.2, s * 0.06, s * 0.16);
    x.restore();
  }
  function tick(cx, cy, r, col = C.green, k = 1) {
    if (k <= 0) return;
    const s = outBack(k);
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.fillStyle = rgba(col, 1); x.shadowColor = rgba(col, 0.8); x.shadowBlur = 16; x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); x.shadowBlur = 0;
    x.strokeStyle = INK; x.lineWidth = r * 0.28; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-r * 0.42, 0); x.lineTo(-r * 0.1, r * 0.32); x.lineTo(r * 0.45, -r * 0.32); x.stroke();
    x.restore();
  }
  function windowPanel(px, py, w, h, title) {
    rrect(px, py, w, h, 28); x.fillStyle = CARD; x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 60; x.fill(); x.shadowBlur = 0;
    x.lineWidth = 1.5; x.strokeStyle = LINE; x.stroke();
    [[255, 95, 87], [254, 188, 46], [40, 200, 64]].forEach((c, i) => { x.fillStyle = rgba(c, 1); x.beginPath(); x.arc(px + 32 + i * 22, py + 31, 7, 0, 6.283); x.fill(); });
    text(title, px + 112, py + 32, F.mono(17), rgba(C.muted, 1), 'left');
    x.fillStyle = LINE; x.fillRect(px, py + 62, w, 1.5);
  }
  function pill(px, py, w, h, label, { fill = 'grad', textCol = INK, font = F.ui(24, 700), press = 0, a = 1 } = {}) {
    if (a <= 0) return;
    x.save(); x.globalAlpha *= a; x.translate(px + w / 2, py + h / 2); const s = 1 - 0.05 * press; x.scale(s, s);
    rrect(-w / 2, -h / 2, w, h, h / 2);
    x.fillStyle = fill === 'grad' ? gradFill(-w / 2, 0, w / 2, 0) : fill; x.shadowColor = fill === 'grad' ? rgba(C.cyan, 0.7) : fill; x.shadowBlur = 26 + 20 * press; x.fill(); x.shadowBlur = 0;
    text(label, 0, 2, font, textCol);
    x.restore();
  }
  function field(px, py, w, label, value, focus, caret) {
    text(label, px, py - 22, F.ui(19, 600), rgba(C.white, 0.9), 'left');
    rrect(px, py, w, 64, 16); x.fillStyle = FIELD; x.fill();
    x.lineWidth = focus ? 2.5 : 1.5; x.strokeStyle = focus ? rgba(C.cyan, 1) : LINE; if (focus) { x.shadowColor = rgba(C.cyan, 0.5); x.shadowBlur = 14; } x.stroke(); x.shadowBlur = 0;
    text(value + (caret ? '|' : ''), px + 22, py + 33, F.ui(24, 500), rgba(C.white, 1), 'left');
  }
  function digits(px, py, vals, n, col) { // six boxes, the first n filled
    for (let i = 0; i < 6; i++) {
      const bx = px + i * 80; rrect(bx, py, 66, 80, 16); x.fillStyle = FIELD; x.fill();
      const filled = i < n; x.lineWidth = filled ? 2.5 : 1.5; x.strokeStyle = filled ? rgba(col, 1) : i === n ? rgba(C.cyan, 0.9) : LINE; x.stroke();
      if (filled) text(vals[i], bx + 33, py + 42, F.mono(36, 600), rgba(C.white, 1));
    }
  }
  function chip(px, py, w, h, label, on) {
    rrect(px, py, w, h, h / 2); x.fillStyle = on ? rgba(C.blue, 0.22) : 'rgba(255,255,255,0.03)'; x.fill();
    x.lineWidth = 2; x.strokeStyle = on ? rgba(C.blue, 1) : LINE; x.stroke();
    const bx = px + 34; rrect(bx - 13, py + h / 2 - 13, 26, 26, 7);
    if (on) { x.fillStyle = rgba(C.blue, 1); x.fill(); text('✓', bx, py + h / 2 + 1, F.ui(18, 800), '#fff'); } else { x.strokeStyle = rgba(C.muted, 0.6); x.lineWidth = 2; x.stroke(); }
    text(label, bx + 28, py + h / 2 + 1, F.ui(22, 700), rgba(on ? C.white : C.muted, 1), 'left');
  }
  function ticker(s, lt, y, col = C.muted) {
    x.save(); x.font = F.mono(24); x.letterSpacing = '6px'; const w = x.measureText(s).width;
    x.fillStyle = rgba(col, 0.8); x.textBaseline = 'middle'; x.textAlign = 'left';
    const off = -((lt * 700) % w); for (let k = -1; k < 4; k++) x.fillText(s, off + k * w, y);
    x.letterSpacing = '0px'; x.restore();
  }
  function rays(lt, col = C.blue) {
    x.save(); x.translate(CX, CY); x.rotate(lt * 0.35); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { x.rotate(6.283 / 14); const g = x.createLinearGradient(0, 0, 1200, 0); g.addColorStop(0, rgba(col, 0.1)); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(1300, -70); x.lineTo(1300, 70); x.fill(); }
    x.restore();
  }
  // the gradient ID card, laid out at 900 x 568 and scaled by s
  function drawCard(cx, cy, s, verified, scan) {
    const w = 900, h = 568;
    x.save(); x.translate(cx, cy); x.scale(s, s);
    rrect(-w / 2, -h / 2, w, h, 34);
    x.fillStyle = gradFill(-w / 2, -h / 2, w / 2, h / 2); x.shadowColor = rgba(verified ? C.green : C.blue, 0.8); x.shadowBlur = 60; x.fill(); x.shadowBlur = 0;
    x.save(); x.clip();
    x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1;
    for (let i = -20; i < 40; i++) { x.beginPath(); x.moveTo(-w / 2 + i * 26, -h / 2); x.lineTo(-w / 2 + i * 26 - 200, h / 2); x.stroke(); }
    if (scan > 0 && scan < 1) { const sx = -w / 2 + scan * w; const sg = x.createLinearGradient(sx - 120, 0, sx, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,0.85)'); x.fillStyle = sg; x.fillRect(sx - 120, -h / 2, 122, h); }
    x.restore();
    text('TrustVault', -w / 2 + 60, -h / 2 + 64, F.bold(40), '#fff', 'left');
    rrect(w / 2 - 230, -h / 2 + 40, 170, 48, 24); x.fillStyle = verified ? rgba(C.green, 1) : 'rgba(6,3,26,0.45)'; x.fill();
    text(verified ? 'VERIFIED' : 'CHECKING', w / 2 - 145, -h / 2 + 65, F.mono(20, 700), verified ? INK : '#fff', 'center', 'middle', '3px');
    rrect(-w / 2 + 60, -h / 2 + 130, 150, 190, 22); x.fillStyle = 'rgba(255,255,255,0.22)'; x.fill();
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.arc(-w / 2 + 135, -h / 2 + 200, 34, 0, 6.283); x.fill(); rrect(-w / 2 + 85, -h / 2 + 248, 100, 60, 30); x.fill();
    [['NAME', 'XXXXX XXXXX'], ['ID NUMBER', 'XXXX XXXX 4F'], ['DATE OF BIRTH', 'XX / XX / XXXX']].forEach(([k, v], i) => {
      text(k, -w / 2 + 250, -h / 2 + 150 + i * 70, F.mono(17, 600), 'rgba(255,255,255,0.75)', 'left', 'middle', '3px');
      text(v, -w / 2 + 250, -h / 2 + 180 + i * 70, F.mono(32, 700), '#fff', 'left', 'middle', '3px');
      if (scan > 0.35 + i * 0.15 || verified) tick(-w / 2 + 610, -h / 2 + 180 + i * 70, 15, C.green, 1);
    });
    const chipG = x.createLinearGradient(w / 2 - 170, 0, w / 2 - 70, 70); chipG.addColorStop(0, '#ffe7a3'); chipG.addColorStop(0.5, '#d4a73c'); chipG.addColorStop(1, '#fff1c7');
    rrect(w / 2 - 170, -20, 100, 76, 14); x.fillStyle = chipG; x.fill();
    text('P<IND<XXXXX<<XXXXX<<<<<<<<<<<<<<<<<<<<<', -w / 2 + 60, h / 2 - 70, F.mono(20, 500), 'rgba(255,255,255,0.7)', 'left', 'middle', '2px');
    x.restore();
  }
  function stamp(cx, cy, k, s = 1) {
    if (k <= 0) return;
    const sc = s * (1 + 2.2 * (1 - outBack(k)));
    x.save(); x.translate(cx, cy); x.rotate(-0.17); x.scale(sc, sc);
    rrect(-250, -62, 500, 124, 22); x.fillStyle = 'rgba(6,3,26,0.88)'; x.fill();
    x.lineWidth = 9; x.strokeStyle = rgba(C.green, 1); x.shadowColor = rgba(C.green, 1); x.shadowBlur = 40; x.stroke(); x.shadowBlur = 0;
    text('✓ VERIFIED', 0, 4, F.black(76), rgba(C.green, 1), 'center', 'middle', '6px');
    x.restore();
  }
  function sparks(cx, cy, e) {
    if (e <= 0 || e >= 1) return;
    x.globalCompositeOperation = 'lighter';
    for (const p of SPARKS) { const d = p.v * e * (1 - e * 0.45); glowDot(cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d + 400 * e * e, p.s * (1 - e), p.col, 1 - e); }
    x.lineWidth = 10 * (1 - e); x.strokeStyle = rgba(C.green, 1 - e); x.beginPath(); x.arc(cx, cy, 120 + 900 * outCubic(e), 0, 6.283); x.stroke();
    x.globalCompositeOperation = 'source-over';
  }
  const shake = (t, amount) => [(hash(Math.floor(t * 60)) - 0.5) * amount, (hash(Math.floor(t * 60) + 5) - 0.5) * amount];

  // ---------- 1. ignite (0 - 1.5) ----------
  function ringPos(p, t) {
    const grow = outExpo(seg(t, 0.12 + p.d * 0.25, 1.05));
    const ang = p.a + t * p.spin * 1.8 + (1 - grow) * 4;
    const r = p.r * grow * (1 + 0.04 * Math.sin(t * 9 + p.a * 5));
    return [CX + Math.cos(ang) * r, CY + Math.sin(ang) * r * 0.86];
  }
  function ignite(t) {
    background(t, C.cyan, 0.5);
    x.globalCompositeOperation = 'lighter';
    const core = seg(t, 0.02, 0.12) * (1 - seg(t, 0.9, 1.3));
    if (core > 0) {
      const g = x.createRadialGradient(CX, CY, 0, CX, CY, 40 + 160 * core); g.addColorStop(0, `rgba(255,255,255,${core})`); g.addColorStop(0.25, rgba(C.cyan, 0.5 * core)); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(CX - 220, CY - 220, 440, 440);
    }
    for (const p of P) {
      for (let k = 4; k >= 0; k--) { const [px, py] = ringPos(p, t - k * 0.018); glowDot(px, py, p.size * (1 - k * 0.15), p.col, (k ? 0.12 : 0.9) * seg(t, 0.1, 0.3)); }
    }
    const sw = seg(t, 1.0, 1.5);
    if (sw > 0 && sw < 1) { x.lineWidth = 6 * (1 - sw); x.strokeStyle = rgba(C.cyan, 1 - sw); x.beginPath(); x.arc(CX, CY, 80 + 1100 * outCubic(sw), 0, 6.283); x.stroke(); }
    x.globalCompositeOperation = 'source-over';
    const flick = hash(Math.floor(t * 30)) > 0.25 ? 1 : 0.3;
    text('TRUSTVAULT', CX, CY + 430, F.mono(24, 600), rgba(C.white, 0.7 * seg(t, 0.4, 0.6) * flick), 'center', 'middle', '14px');
    hud(t, 'IGNITE', 1);
  }

  // ---------- 2. shield (1.5 - 3) ----------
  function shield(t) {
    const lt = t - 1.5;
    const zoom = 1 + 5 * Math.pow(seg(lt, 1.2, 1.5), 3); // punch through into the drop
    background(t, C.blue);
    x.save(); x.translate(CX, CY); x.scale(zoom, zoom); x.translate(-CX, -CY);
    x.globalCompositeOperation = 'lighter';
    P.forEach((p, i) => {
      const [sx, sy] = ringPos(p, 1.5);
      const [tx, ty] = shieldPt(i, CX, CY, 560);
      const k = inOut(seg(lt, p.d * 0.35, p.d * 0.35 + 0.55));
      const bend = Math.sin(k * Math.PI) * 140;
      const nx = -(ty - sy), ny = tx - sx, nl = Math.hypot(nx, ny) || 1;
      glowDot(lerp(sx, tx, k) + (nx / nl) * bend * p.ox, lerp(sy, ty, k) + (ny / nl) * bend * p.ox, p.size * (0.8 + 0.4 * k), i >= 340 ? mixc(p.col, C.green, k) : p.col, 0.9);
    });
    x.globalCompositeOperation = 'source-over';
    drawShield(CX, CY, 560, seg(lt, 0.85, 1.05) * 0.95, seg(lt, 0.65, 0.9), seg(lt, 0.55, 0.8));
    x.restore();
    text('PROTECTED', CX, CY + 380, F.bold(34), rgba(C.white, seg(lt, 0.95, 1.05) * (1 - seg(lt, 1.25, 1.35))), 'center', 'middle', '18px');
    const white = seg(lt, 1.32, 1.5);
    if (white > 0) { x.fillStyle = `rgba(255,255,255,${white})`; x.fillRect(0, 0, W, H); }
    hud(t, 'SHIELD', 2);
  }

  // ---------- 3. kinetic: one vault, three locks (3 - 5) ----------
  function kin1(t) {
    const lt = t - 3, b = Math.min(3, Math.floor(lt / BEAT)), bt = lt - b * BEAT;
    x.fillStyle = INK; x.fillRect(0, 0, W, H); grid(0.06);
    if (b === 0) {
      const k = outExpo(seg(bt, 0, 0.18));
      const f = 1 - seg(bt, 0, 0.14); if (f > 0) { x.fillStyle = rgba(C.cyan, 0.3 * f); x.fillRect(0, 0, W, H); }
      x.save(); x.translate(CX, CY + 10); x.scale(lerp(2.2, 1, k), lerp(2.2, 1, k));
      for (let s = 3; s >= 1; s--) text('ONE', -s * 50 * (1 - k), 0, F.black(470), rgba(C.cyan, 0.14 * (1 - k)), 'center', 'middle', '-14px');
      text('ONE', 0, 0, F.black(470), rgba(C.white, k), 'center', 'middle', '-14px');
      x.restore();
      const bar = outExpo(seg(bt, 0.08, 0.35)); x.fillStyle = gradFill(CX - 520, 0, CX + 520, 0); x.fillRect(CX - 520 * bar, CY + 250, 1040 * bar, 14);
    } else if (b === 1) {
      const k = outExpo(seg(bt, 0, 0.22));
      x.save(); x.translate(CX + (1 - k) * 900, CY); x.transform(1, 0, -0.18 * (1 - k), 1, 0, 0);
      gradText('VAULT.', 0, 0, F.black(420), 'center', '-12px');
      x.restore();
      ticker('AES-256-GCM · SHA-256 LEDGER · GOOGLE AUTHENTICATOR · AUTOMATIC CHECKS · ', bt, CY + 300);
    } else if (b === 2) {
      const wipe = outExpo(seg(bt, 0, 0.2));
      x.fillStyle = rgba(C.pink, 1); x.fillRect(0, 0, CX * wipe, H);
      x.save(); x.beginPath(); x.rect(0, 0, CX * wipe, H); x.clip(); text('THREE', CX - 40, CY, F.black(250), INK, 'right', 'middle', '-8px'); x.restore();
      const k2 = outExpo(seg(bt, 0.1, 0.3));
      x.save(); x.font = F.black(250); x.letterSpacing = '-8px'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.lineWidth = 6; x.strokeStyle = rgba(C.cyan, k2); x.shadowColor = rgba(C.cyan, 0.8); x.shadowBlur = 20; x.strokeText('LOCKS.', CX + 40 + (1 - k2) * 200, CY); x.letterSpacing = '0px'; x.restore();
    } else {
      [['PASSWORD', C.cyan], ['EMAIL CODE', C.blue], ['AUTHENTICATOR', C.pink]].forEach(([label, col], i) => {
        const at = i * 0.09, k = seg(bt, at, at + 0.13);
        if (k <= 0) return;
        const px = CX + (i - 1) * 480;
        x.save(); x.translate(px, CY - 40); x.scale(outBack(k), outBack(k)); padlock(0, 0, 200, seg(bt, at + 0.06, at + 0.18), col); x.restore();
        text(label, px, CY + 170, F.mono(28, 700), rgba(col, k), 'center', 'middle', '6px');
      });
    }
    hud(t, 'ONE VAULT · THREE LOCKS', 3);
  }

  // ---------- 4. sign-in: password, email code, Authenticator, hold to enter (5 - 8) ----------
  const EMAIL = 'rahul.23mx301@psgtech';
  function signin(t) {
    const lt = t - 5;
    background(t, C.blue); grid(0.05);
    const starts = [0, 1.0, 1.5, 2.0];
    const phase = lt < 1.0 ? 0 : lt < 1.5 ? 1 : lt < 2.0 ? 2 : 3;
    // left: the step in big type
    const words = ['PASSWORD.', 'EMAIL CODE.', 'AUTHENTICATOR.', 'HOLD TO ENTER.'];
    const kw = outExpo(seg(lt, starts[phase], starts[phase] + 0.18));
    text(phase < 3 ? `LOCK ${phase + 1} OF 3` : 'ALL THREE PASSED', 170, 380, F.mono(26, 700), rgba(phase < 3 ? C.cyan : C.green, 1), 'left', 'middle', '8px');
    x.save(); x.translate((1 - kw) * -60, 0); x.globalAlpha = kw;
    text(words[phase], 165, 485, F.black(phase === 2 ? 96 : 112), rgba(phase === 3 ? C.green : C.white, 1), 'left', 'middle', '-3px');
    x.restore();
    text('Something you know, your inbox, your phone.', 170, 585, F.ui(28, 500), rgba(C.muted, 1), 'left');
    // right: the product
    const px = 1090, py = 180, w = 640, h = 720;
    const z = 1 + 0.025 * Math.sin(lt * 1.3);
    x.save(); x.translate(px + w / 2, py + h / 2); x.scale(z, z); x.translate(-(px + w / 2), -(py + h / 2));
    rrect(px, py, w, h, 34); x.fillStyle = CARD; x.shadowColor = rgba(C.blue, 0.5); x.shadowBlur = 80; x.fill(); x.shadowBlur = 0; x.lineWidth = 2; x.strokeStyle = gradFill(px, py, px + w, py + h, 0.9); x.stroke();
    const nodes = [px + 130, px + 320, px + 510], ny = py + 80;
    nodes.forEach((nx, i) => {
      if (i < 2) { x.fillStyle = LINE; x.fillRect(nx + 24, ny - 1.5, 142, 3); x.fillStyle = rgba(C.green, 1); x.fillRect(nx + 24, ny - 1.5, 142 * seg(lt, starts[i + 1] - 0.05, starts[i + 1] + 0.15), 3); }
      const done = phase > i, now = phase === i;
      if (done) tick(nx, ny, 22, C.green, seg(lt, starts[i + 1], starts[i + 1] + 0.15));
      else {
        x.beginPath(); x.arc(nx, ny, 22, 0, 6.283); x.fillStyle = now ? rgba(C.cyan, 1) : FIELD; x.shadowColor = rgba(C.cyan, 0.9); x.shadowBlur = now ? 24 : 0; x.fill(); x.shadowBlur = 0;
        x.lineWidth = 2; x.strokeStyle = now ? rgba(C.cyan, 1) : LINE; x.stroke(); text(String(i + 1), nx, ny + 1, F.mono(20, 700), now ? INK : rgba(C.muted, 1));
      }
      text(['PASSWORD', 'EMAIL CODE', 'AUTHENTICATOR'][i], nx, ny + 46, F.mono(14, 700), rgba(done || now ? C.white : C.muted, 0.9), 'center', 'middle', '2px');
    });
    const titles = ['Student sign-in', 'Check your email', 'Google Authenticator', "You're verified"];
    text(titles[phase], px + 50, py + 200, F.bold(46), rgba(C.white, 1), 'left', 'middle', '-1px');
    const caretOn = (t * 2) % 1 < 0.55;
    if (phase === 0) {
      const n = Math.floor(seg(lt, 0.05, 0.45) * EMAIL.length);
      field(px + 50, py + 300, w - 100, 'Email', EMAIL.slice(0, n), lt < 0.47, lt < 0.47 && caretOn);
      field(px + 50, py + 430, w - 100, 'Password', '•'.repeat(Math.floor(seg(lt, 0.5, 0.78) * 12)), lt >= 0.47, lt >= 0.47 && lt < 0.8 && caretOn);
      pill(px + 50, py + 560, w - 100, 72, 'Continue', { press: lt > 0.85 && lt < 0.97 ? 1 : 0 });
    } else if (phase === 1) {
      text('We sent a 6-digit code to r******@psgtech.', px + 50, py + 262, F.ui(21, 500), rgba(C.muted, 1), 'left');
      digits(px + 80, py + 320, '730214', Math.floor(seg(lt, 1.05, 1.38) * 6.99), lt > 1.42 ? C.green : C.cyan);
    } else if (phase === 2) {
      text('Enter the code from your phone.', px + 50, py + 262, F.ui(21, 500), rgba(C.muted, 1), 'left');
      digits(px + 80, py + 320, '916402', Math.floor(seg(lt, 1.55, 1.88) * 6.99), lt > 1.92 ? C.green : C.cyan);
    } else {
      text('Password, email code and Authenticator all passed.', px + 50, py + 262, F.ui(21, 500), rgba(C.muted, 1), 'left');
      holdButton(px + 50, py + 330, w - 100, 88, seg(lt, 2.08, 2.55), lt > 2.55);
    }
    // the pointer: Continue, then hold
    const btn = [px + w / 2 + 70, py + 600], hold = [px + 100, py + 374];
    let cxp, cyp, down = 0;
    if (lt < 1.9) {
      const k = inOut(seg(lt, 0.55, 0.85)), k2 = inOut(seg(lt, 1.0, 1.4));
      cxp = lerp(lerp(1640, btn[0], k), 1600, k2); cyp = lerp(lerp(1000, btn[1], k), 1010, k2);
      down = lt > 0.85 && lt < 0.97 ? 1 : 0;
    } else { const k = inOut(seg(lt, 1.9, 2.06)); cxp = lerp(1600, hold[0], k); cyp = lerp(1010, hold[1], k); down = lt > 2.06 && lt < 2.56 ? 1 : 0; }
    if (lt < 2.6) cursor(cxp, cyp, down);
    x.restore();
    // iris from the button: Access granted
    const ir = seg(lt, 2.58, 2.9);
    if (ir > 0) {
      x.save(); x.beginPath(); x.arc(hold[0], hold[1], outExpo(ir) * 2400, 0, 6.283); x.clip();
      x.fillStyle = INK; x.fillRect(0, 0, W, H); dots(0.6);
      const at = lt - 2.62;
      for (let i = 0; i < 3; i++) { const e = clamp((at - i * 0.07) / 0.45); if (e > 0 && e < 1) { x.lineWidth = 4; x.strokeStyle = rgba([C.green, C.cyan, C.blue][i], 1 - e); x.beginPath(); x.arc(CX, CY - 20, 80 + 640 * outCubic(e), 0, 6.283); x.stroke(); } }
      const word = 'ACCESS GRANTED';
      x.font = F.black(118); const widths = [...word].map((ch) => x.measureText(ch).width + 12);
      let wx = CX - widths.reduce((a, b) => a + b, 0) / 2;
      [...word].forEach((ch, i) => { const k = outExpo(seg(at, 0.02 + i * 0.012, 0.2 + i * 0.012)); text(ch, wx + widths[i] / 2, CY - 20 + (1 - k) * 40, F.black(118), rgba(C.green, k)); wx += widths[i]; });
      text('WELCOME BACK, RAHUL', CX, CY + 90, F.mono(28, 600), rgba(C.white, seg(at, 0.15, 0.27)), 'center', 'middle', '8px');
      x.restore();
    }
    hud(t, 'SIGN IN', 4);
  }
  function holdButton(px, py, w, h, p, done) {
    rrect(px, py, w, h, h / 2); x.fillStyle = done ? rgba(C.green, 1) : FIELD; x.shadowColor = rgba(done ? C.green : C.cyan, 0.4 + p * 0.5); x.shadowBlur = 20 + p * 40; x.fill(); x.shadowBlur = 0;
    x.lineWidth = 2; x.strokeStyle = done ? rgba(C.green, 1) : rgba(C.cyan, 0.8); x.stroke();
    if (!done && p > 0) { x.save(); rrect(px, py, w, h, h / 2); x.clip(); x.fillStyle = gradFill(px, 0, px + w, 0, 0.75); x.fillRect(px, py, w * p, h); x.restore(); }
    const ix = px + h / 2 + 4, iy = py + h / 2;
    x.fillStyle = INK; x.beginPath(); x.arc(ix, iy, h / 2 - 10, 0, 6.283); x.fill();
    x.lineWidth = 4; x.strokeStyle = rgba(done ? C.green : C.cyan, 1); x.beginPath(); x.arc(ix, iy, h / 2 - 12, -Math.PI / 2, -Math.PI / 2 + 6.283 * (done ? 1 : p)); x.stroke();
    padlock(ix, iy + 2, 32, done ? 0 : 1, done ? C.green : C.cyan);
    text(done ? 'Access granted' : 'Hold to enter vault', px + w / 2 + 24, py + h / 2 + 2, F.ui(26, 700), done ? INK : rgba(C.white, 1));
  }

  // ---------- 5. upload, then ENCRYPT (8 - 10) ----------
  function upload(t) {
    const lt = t - 8;
    if (lt < 0.9) {
      background(t, C.cyan, 0.6); grid(0.05);
      text('UPLOAD ONCE.', CX, 150, F.black(92), rgba(C.white, outExpo(seg(lt, 0, 0.15))), 'center', 'middle', '4px');
      rrect(CX - 430, CY - 250, 860, 520, 40); x.fillStyle = rgba(C.cyan, 0.05); x.fill();
      x.setLineDash([18, 14]); x.lineWidth = 3; x.strokeStyle = rgba(C.cyan, 0.7 - 0.4 * seg(lt, 0.4, 0.6)); x.stroke(); x.setLineDash([]);
      if (lt < 0.1) text('Drop a photo or PDF', CX, CY, F.mono(30, 600), rgba(C.cyan, 1));
      const k = outBack(seg(lt, 0.05, 0.42));
      x.save(); x.translate(CX, CY - 10 - (1 - k) * 760); x.rotate((1 - k) * -0.3); drawCard(0, 0, 0.72, false, 0); x.restore();
      const pr = seg(lt, 0.45, 0.8);
      rrect(CX - 320, CY + 230, 640, 12, 6); x.fillStyle = LINE; x.fill();
      rrect(CX - 320, CY + 230, Math.max(12, 640 * pr), 12, 6); x.fillStyle = gradFill(CX - 320, 0, CX + 320, 0); x.fill();
      text(pr < 1 ? `ENCRYPTING ${Math.round(pr * 100)}%` : '✓ ENCRYPTED · AES-256-GCM', CX, CY + 290, F.mono(26, 700), rgba(pr < 1 ? C.cyan : C.green, seg(lt, 0.45, 0.5)), 'center', 'middle', '6px');
    } else encrypt(t, lt - 0.9);
    hud(t, 'UPLOAD', 5);
  }
  const WORD = 'ENCRYPT';
  function encrypt(t, lt) {
    background(t, C.cyan, 0.6);
    x.font = F.mono(22); x.textAlign = 'center'; x.textBaseline = 'middle';
    const fade = 1 - seg(lt, 0.8, 1.1);
    for (let c = 0; c < 48; c++) {
      const speed = 160 + hash(c) * 220, off = (lt * speed * 2 + hash(c + 9) * H) % (H + 200);
      for (let r = 0; r < 26; r++) {
        const y = ((r * 44 + off) % (H + 200)) - 100, ch = HEX[Math.floor(hash(c * 31 + r + Math.floor(t * 12)) * 16)];
        const head = r === 25 ? 1 : 0.1 + 0.5 * hash(c + r * 7);
        x.fillStyle = rgba(r === 25 ? C.white : C.cyan, 0.32 * head * fade);
        x.fillText(ch, 20 + c * 40, y);
      }
    }
    const slice = seg(lt, 0.85, 1.1);
    const size = 250, letterW = 190, x0 = CX - (WORD.length - 1) * letterW / 2, bands = 8;
    for (let b = 0; b < bands; b++) { // exit: horizontal slices slide apart
      const by = CY - size * 0.6 + (b * size * 1.2) / bands, bh = (size * 1.2) / bands;
      const dx = (b % 2 ? 1 : -1) * Math.pow(slice, 2) * 1400 * (0.6 + hash(b) * 0.8);
      x.save(); x.beginPath(); x.rect(0, by, W, bh + 1); x.clip(); x.translate(dx, 0);
      [...WORD].forEach((ch, i) => {
        const lock = 0.05 + i * 0.06, locked = lt >= lock;
        const glyph = locked ? ch : HEX[Math.floor(hash(i * 13 + Math.floor(lt / 0.04)) * 16)];
        const pop = locked ? outBack(seg(lt, lock, lock + 0.15)) : 0.85;
        const px = x0 + i * letterW, a = seg(lt, i * 0.03, i * 0.03 + 0.08);
        x.save(); x.translate(px, CY); x.scale(pop, pop);
        x.globalCompositeOperation = 'lighter';
        const split = locked ? 10 * (1 - seg(lt, lock, lock + 0.25)) + 3 : 14;
        text(glyph, -split, 0, F.bold(size), rgba(C.pink, 0.7 * a));
        text(glyph, split, 0, F.bold(size), rgba(C.cyan, 0.7 * a));
        x.globalCompositeOperation = 'source-over';
        text(glyph, 0, 0, F.bold(size), rgba(locked ? C.white : C.cyan, a));
        x.restore();
      });
      x.restore();
    }
    const sub = 'AES-256-GCM · BEFORE IT TOUCHES THE DISK';
    const n = Math.floor(seg(lt, 0.3, 0.65) * sub.length);
    text(sub.slice(0, n) + (n < sub.length && n > 0 ? '▌' : ''), CX, CY + 230, F.mono(26), rgba(C.cyan, 1 - slice), 'center', 'middle', '6px');
  }

  // ---------- 6. checks + VERIFIED stamp (10 - 12) ----------
  function checks(t) {
    const lt = t - 10, stampT = 1.5;
    background(t, C.blue); rays(lt);
    const [sx, sy] = shake(t, 34 * (lt > stampT ? Math.max(0, 1 - (lt - stampT) / 0.35) : 0));
    x.save(); x.translate(sx, sy);
    const k = outExpo(seg(lt, 0, 0.4)), rotY = (1 - k) * 1.25, ccx = 640, ccy = CY + 20;
    x.save(); x.translate(ccx, ccy + (1 - k) * 220); x.rotate((1 - k) * -0.35); x.scale(Math.cos(rotY) * (0.3 + 0.7 * k), 0.3 + 0.7 * k);
    x.globalAlpha = seg(lt, 0, 0.1); drawCard(0, 0, 0.82, lt > stampT, seg(lt, 0.3, 0.95)); x.globalAlpha = 1;
    x.restore();
    const lx = 1220, ly = 290;
    text('AUTOMATIC CHECKS', lx, ly - 20, F.mono(24, 700), rgba(C.cyan, seg(lt, 0.2, 0.3)), 'left', 'middle', '6px');
    CHECKS.forEach((c, i) => {
      const at = 0.4 + i * 0.2, on = lt > at, y = ly + 50 + i * 74;
      x.globalAlpha = seg(lt, 0.22 + i * 0.04, 0.36 + i * 0.04);
      rrect(lx, y - 28, 560, 56, 16); x.fillStyle = on ? rgba(C.green, 0.08) : 'rgba(255,255,255,0.03)'; x.fill(); x.lineWidth = 1.5; x.strokeStyle = on ? rgba(C.green, 0.5) : LINE; x.stroke();
      if (on) tick(lx + 32, y, 15, C.green, seg(lt, at, at + 0.12)); else { x.lineWidth = 2; x.strokeStyle = rgba(C.muted, 0.5); x.beginPath(); x.arc(lx + 32, y, 14, 0, 6.283); x.stroke(); }
      text(c, lx + 62, y + 1, F.ui(24, 600), rgba(on ? C.white : C.muted, 1), 'left');
      x.globalAlpha = 1;
    });
    const sc = String(Math.round(100 * seg(lt, 0.4, 1.3)));
    x.font = F.black(110); const scw = x.measureText(sc).width;
    text(sc, lx, ly + 470, F.black(110), rgba(C.white, seg(lt, 0.35, 0.45)), 'left', 'middle');
    text('/ 100', lx + scw + 16, ly + 492, F.mono(30, 600), rgba(C.muted, seg(lt, 0.35, 0.45)), 'left');
    stamp(ccx + 30, ccy + 30, seg(lt, stampT - 0.02, stampT + 0.13), 0.85);
    sparks(ccx + 30, ccy + 30, lt - stampT);
    x.restore();
    const flash = Math.max(0, 1 - Math.abs(lt - stampT) / 0.08) * 0.55;
    if (flash > 0) { x.fillStyle = `rgba(255,255,255,${flash})`; x.fillRect(0, 0, W, H); }
    hud(t, 'VERIFY', 6);
  }

  // ---------- 7. kinetic: verified automatically (12 - 14) ----------
  function kin2(t) {
    const lt = t - 12, b = Math.min(3, Math.floor(lt / BEAT)), bt = lt - b * BEAT;
    x.fillStyle = INK; x.fillRect(0, 0, W, H); grid(0.06);
    if (b === 0) {
      const f = 1 - seg(bt, 0, 0.15); if (f > 0) { x.fillStyle = rgba(C.green, 0.28 * f); x.fillRect(0, 0, W, H); }
      const s = 1 + 1.4 * (1 - outBack(seg(bt, 0, 0.16)));
      const [sx, sy] = shake(t, 30 * Math.max(0, 1 - bt / 0.3));
      x.save(); x.translate(CX + sx, CY + sy); x.rotate(-0.07); x.scale(s, s);
      rrect(-660, -150, 1320, 300, 40); x.lineWidth = 16; x.strokeStyle = rgba(C.green, 1); x.shadowColor = rgba(C.green, 1); x.shadowBlur = 50; x.stroke(); x.shadowBlur = 0;
      text('VERIFIED', 0, 10, F.black(230), rgba(C.green, 1), 'center', 'middle', '8px');
      x.restore();
    } else if (b === 1) {
      const word = 'AUTOMATICALLY.', n = Math.ceil(seg(bt, 0, 0.22) * word.length);
      const sweep = outExpo(seg(bt, 0, 0.3)); x.fillStyle = rgba(C.blue, 0.22); x.fillRect(0, CY - 120, W * sweep, 240);
      gradText(word.slice(0, n), CX, CY, F.black(168), 'center', '-6px');
    } else if (b === 2) {
      const k = seg(bt, 0.03, 0.17);
      text('WAITING', CX, CY - 125, F.black(170), rgba(C.muted, 0.5), 'center', 'middle', '4px');
      x.strokeStyle = rgba(C.pink, 1); x.lineWidth = 18; x.lineCap = 'round'; x.shadowColor = rgba(C.pink, 1); x.shadowBlur = 24;
      x.beginPath(); x.moveTo(CX - 440, CY - 125); x.lineTo(CX - 440 + 880 * outExpo(k), CY - 125); x.stroke(); x.shadowBlur = 0;
      const k2 = outBack(seg(bt, 0.18, 0.32));
      if (k2 > 0) { x.save(); x.translate(CX, CY + 115); x.scale(k2, k2); text('NO QUEUE.', 0, 0, F.black(200), rgba(C.white, 1), 'center', 'middle', '-4px'); x.restore(); }
    } else {
      for (let i = 0; i < 40; i++) {
        const y = hash(i) * H, len = 200 + hash(i + 3) * 600, sp = 3000 + hash(i + 7) * 3000;
        const px = W - ((bt * sp + hash(i + 9) * W * 2) % (W * 2)); x.fillStyle = rgba(i % 3 ? C.cyan : C.blue, 0.25); x.fillRect(px, y, len, 3);
      }
      const k = outExpo(seg(bt, 0, 0.14));
      x.save(); x.translate(CX + (1 - k) * 600, CY - 20); x.transform(1, 0, -0.2, 1, 0, 0); text('IN SECONDS.', 0, 0, F.black(205), rgba(C.white, 1), 'center', 'middle', '-6px'); x.restore();
      text(`${(seg(bt, 0, 0.4) * 0.84).toFixed(2)} s`, CX, CY + 160, F.mono(42, 700), rgba(C.cyan, 1), 'center', 'middle', '6px');
    }
    hud(t, 'NO HUMAN QUEUE', 7);
  }

  // ---------- 8. faculty ask a whole batch (14 - 16) ----------
  function batch(t) {
    const lt = t - 14;
    background(t, C.blue); grid(0.05);
    if (lt < 1.0) {
      const k = outExpo(seg(lt, 0, 0.2));
      const px = CX - 540, py = 200 + (1 - k) * 60, w = 1080, h = 660;
      x.save(); x.globalAlpha = k; windowPanel(px, py, w, h, 'Student records · Dr. Priya Raman');
      text('ASK A WHOLE BATCH', px + 60, py + 120, F.mono(22, 700), rgba(C.muted, 1), 'left', 'middle', '5px');
      const typed = '26MX'.slice(0, Math.floor(seg(lt, 0.05, 0.37) * 4.99));
      rrect(px + 60, py + 160, 380, 112, 24); x.fillStyle = FIELD; x.fill(); x.lineWidth = 3; x.strokeStyle = rgba(C.blue, 1); x.shadowColor = rgba(C.blue, 0.8); x.shadowBlur = 24; x.stroke(); x.shadowBlur = 0;
      text(typed + ((t * 2) % 1 < 0.5 && typed.length < 4 ? '|' : ''), px + 96, py + 218, F.mono(72, 800), rgba(C.cyan, 1), 'left', 'middle', '10px');
      text(typed.length === 4 ? '58 students in 26MX' : 'The joining year, then MX', px + 60, py + 316, F.mono(24, 500), rgba(typed.length === 4 ? C.white : C.muted, 1), 'left');
      ['PAN Card', '10th Marksheet', '12th Marksheet'].forEach((c, i) => chip(px + 60 + i * 320, py + 372, 300, 66, c, lt > 0.45 + i * 0.1));
      const sent = lt > 0.86;
      pill(px + 60, py + 486, 560, 80, sent ? '✓  Sent to 58 students' : 'Send to all 58 students', { fill: sent ? rgba(C.green, 1) : 'grad', press: lt > 0.78 && lt < 0.86 ? 1 : 0 });
      x.restore();
      const target = [px + 340, py + 526], k2 = inOut(seg(lt, 0.55, 0.76));
      cursor(lerp(1500, target[0], k2), lerp(980, target[1], k2), lt > 0.78 && lt < 0.86 ? 1 : 0);
    } else {
      const st = lt - 1.0;
      text('26MX', CX, CY + 20, F.black(520), rgba(C.blue, 0.09 + 0.03 * Math.sin(st * 4)), 'center', 'middle', '-10px');
      x.save(); x.translate(CX, CY + 20); x.rotate(st * 0.15); const zz = 0.74 + 0.1 * outCubic(st); x.scale(zz, zz);
      x.globalCompositeOperation = 'lighter';
      NODES.forEach((n) => {
        const start = n.r / 600 * 0.5, kk = outCubic(seg(st, start, start + 0.25));
        if (kk <= 0) return;
        x.strokeStyle = rgba(C.blue, 0.55); x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(n.x * kk, n.y * kk); x.stroke();
        if (kk < 1) glowDot(n.x * kk, n.y * kk, 4, C.white, 1);
      });
      x.globalCompositeOperation = 'source-over';
      NODES.forEach((n) => {
        const reached = st > n.r / 600 * 0.5 + 0.25, col = reached ? C.blue : [60, 54, 110];
        x.fillStyle = rgba(col, 1); x.shadowColor = rgba(col, 0.9); x.shadowBlur = reached ? 22 : 0; x.beginPath(); x.arc(n.x, n.y, 15, 0, 6.283); x.fill(); x.shadowBlur = 0;
      });
      x.fillStyle = gradFill(-40, -40, 40, 40); x.shadowColor = rgba(C.cyan, 1); x.shadowBlur = 40; x.beginPath(); x.arc(0, 0, 34 * (1 + 0.15 * Math.sin(st * 10)), 0, 6.283); x.fill(); x.shadowBlur = 0;
      x.restore();
      text('ASK A WHOLE BATCH', CX, 120, F.black(64), rgba(C.white, seg(st, 0, 0.15)), 'center', 'middle', '10px');
      text('ONE REQUEST · 58 STUDENTS', CX, H - 125, F.mono(26, 600), rgba(C.cyan, seg(st, 0.2, 0.35)), 'center', 'middle', '6px');
    }
    hud(t, 'FACULTY', 8);
  }

  // ---------- 9. the student decides (16 - 17) ----------
  function phone(t) {
    const lt = t - 16;
    background(t, C.pink, 0.6);
    // the batch behind, each student deciding
    x.save(); x.globalAlpha = 0.3; x.translate(CX + 420, CY); x.scale(0.8, 0.8);
    NODES.forEach((n) => { const d = lt > n.at, col = !d ? C.blue : n.ok ? C.green : C.pink; x.fillStyle = rgba(col, 1); x.beginPath(); x.arc(n.x, n.y, 15, 0, 6.283); x.fill(); });
    x.restore();
    const tk = outExpo(seg(lt, 0, 0.15));
    text('YOU', 250 + (1 - tk) * -100, CY - 95, F.black(200), rgba(C.white, tk), 'left', 'middle', '-6px');
    x.save(); x.globalAlpha = outExpo(seg(lt, 0.06, 0.22)); gradText('DECIDE.', 250, CY + 95, F.black(200), 'left', '-6px'); x.restore();
    text('Tick what to share. Leave the rest.', 262, CY + 240, F.ui(30, 500), rgba(C.muted, tk), 'left');
    const pw = 410, ph = 800, px = 1180, py = 140, k = outExpo(seg(lt, 0, 0.18));
    x.save(); x.translate(0, (1 - k) * 220); x.globalAlpha = k;
    rrect(px, py, pw, ph, 58); x.fillStyle = '#0c0628'; x.shadowColor = rgba(C.pink, 0.5); x.shadowBlur = 80; x.fill(); x.shadowBlur = 0; x.lineWidth = 5; x.strokeStyle = '#2f2468'; x.stroke();
    rrect(px + pw / 2 - 60, py + 18, 120, 30, 15); x.fillStyle = '#000'; x.fill();
    const nk = outBack(seg(lt, 0.05, 0.2));
    x.save(); x.translate(0, (1 - nk) * -40);
    rrect(px + 24, py + 76, pw - 48, 112, 24); x.fillStyle = rgba(C.blue, 0.2); x.fill(); x.lineWidth = 1.5; x.strokeStyle = rgba(C.blue, 0.6); x.stroke();
    x.beginPath(); x.arc(px + 72, py + 132, 27, 0, 6.283); x.fillStyle = gradFill(px + 45, py + 105, px + 99, py + 159); x.fill(); text('PR', px + 72, py + 133, F.ui(18, 800), INK);
    text('Dr. Priya Raman', px + 112, py + 116, F.ui(23, 700), rgba(C.white, 1), 'left'); text('asks for 3 documents · 26MX', px + 112, py + 150, F.ui(18, 500), rgba(C.muted, 1), 'left');
    x.restore();
    const tickAt = [0.28, 0.4];
    ['PAN Card', '10th Marksheet', '12th Marksheet'].forEach((c, i) => {
      const on = i < 2 && lt > tickAt[i], ry = py + 226 + i * 94;
      rrect(px + 24, ry, pw - 48, 78, 20); x.fillStyle = on ? rgba(C.green, 0.1) : 'rgba(255,255,255,0.03)'; x.fill(); x.lineWidth = 2; x.strokeStyle = on ? rgba(C.green, 0.7) : LINE; x.stroke();
      if (on) tick(px + 64, ry + 39, 16, C.green, seg(lt, tickAt[i], tickAt[i] + 0.1)); else { rrect(px + 50, ry + 25, 28, 28, 7); x.lineWidth = 2; x.strokeStyle = rgba(C.muted, 0.6); x.stroke(); }
      text(c, px + 98, ry + 40, F.ui(25, 700), rgba(on ? C.white : C.muted, 1), 'left');
    });
    const shared = lt > 0.62;
    pill(px + 24, py + 524, pw - 48, 78, shared ? '✓  Shared · opens once' : 'Share 2 of 3', { fill: shared ? rgba(C.green, 1) : 'grad', press: lt > 0.52 && lt <= 0.62 ? 1 : 0, font: F.ui(25, 800) });
    text('12th marksheet not shared', px + pw / 2, py + 636, F.mono(18, 500), rgba(C.muted, 1));
    if (lt < 0.62) { const fk = inOut(seg(lt, 0.2, 0.5)); const fx = lerp(px + pw + 60, px + pw / 2, fk), fy = lerp(py + ph - 60, py + 563, fk); x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(fx, fy, lt > 0.52 ? 22 : 26, 0, 6.283); x.fill(); x.strokeStyle = rgba(C.cyan, 0.9); x.lineWidth = 3; x.stroke(); }
    x.restore();
    hud(t, 'CONSENT', 9);
  }

  // ---------- 10. opened once, then locked (17 - 19) ----------
  function opened(t) {
    const lt = t - 17, locked = lt > 1.0;
    background(t, locked ? C.pink : C.green, 0.4); grid(0.05);
    const s0 = locked ? 1.0 : 0.05, tk = outExpo(seg(lt, s0, s0 + 0.18));
    text(locked ? 'THEN IT LOCKS.' : 'OPENS ONCE.', CX, 140, F.black(112), rgba(locked ? C.pink : C.white, tk), 'center', 'middle', '-2px');
    const k = outExpo(seg(lt, 0, 0.25)), px = CX - 580, py = 240 + (1 - k) * 80, w = 1160, h = 700;
    x.save(); x.globalAlpha = k;
    windowPanel(px, py, w, h, 'PAN Card · shared by Rahul Sharma · 23MX301');
    x.save(); x.translate(CX, py + 360);
    drawCard(0, 0, 0.82, true, 0);
    x.save(); rrect(-369, -233, 738, 466, 28); x.clip(); x.rotate(-0.32); x.font = F.mono(20, 600); x.fillStyle = 'rgba(255,255,255,0.42)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let r = -7; r <= 7; r++) for (let c = -1; c <= 1; c++) x.fillText('priya.raman@psgtech · 20 Oct 14:02 · TrustVault', c * 640 + (r % 2) * 160, r * 58);
    x.restore();
    if (locked) {
      const lk = seg(lt, 1.0, 1.2);
      rrect(-369, -233, 738, 466, 28); x.fillStyle = `rgba(6,3,26,${0.78 * lk})`; x.fill();
      const s = outBack(lk); x.save(); x.scale(s, s); padlock(0, -10, 170, seg(lt, 1.08, 1.28), C.pink); x.restore();
    }
    x.restore();
    pill(px + w - 680, py + h - 92, 640, 62, locked ? 'ALREADY OPENED · LOCKED' : 'OPENED ONCE · LOGGED · EMAILED TO RAHUL', { fill: rgba(locked ? C.pink : C.green, 1), font: F.mono(19, 700), a: seg(lt, 0.2, 0.3) });
    x.restore();
    hud(t, 'OPENED ONCE', 10);
  }

  // ---------- 11. tamper-evident ledger (19 - 21) ----------
  function ledger(t) {
    const lt = t - 19;
    background(t, C.cyan, 0.5);
    const cam = inOut(seg(lt, 0, 1.9)) * 2300;
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) { const depth = 0.2 + hash(i) * 0.6, px = ((hash(i + 40) * 3200 - cam * depth) % 3200 + 3200) % 3200 - 600; glowDot(px, hash(i + 80) * H, 1 + depth * 2, C.cyan, 0.35 * depth); }
    x.globalCompositeOperation = 'source-over';
    const glitchOn = lt > 0.85 && lt < 1.3;
    x.save(); x.translate(CX, CY); x.rotate(Math.sin(lt * 1.6) * 0.05); x.translate(-CX, -CY);
    for (let i = 0; i < 12; i++) {
      const bx = 260 + i * 330 - cam, by = CY;
      if (bx < -400 || bx > W + 400) continue;
      const glitch = i === 7 && glitchOn, col = glitch ? C.red : C.cyan;
      if (i < 11) { x.strokeStyle = rgba(glitch ? C.red : C.blue, 0.9); x.lineWidth = 5; x.shadowColor = rgba(C.blue, 1); x.shadowBlur = 16; x.beginPath(); x.moveTo(bx + 110, by); x.lineTo(bx + 220, by); x.stroke(); x.shadowBlur = 0; }
      const jx = glitch ? (hash(Math.floor(t * 40) + i) - 0.5) * 40 : 0;
      x.save(); x.translate(bx + jx, by);
      rrect(-110, -110, 220, 220, 30); x.fillStyle = 'rgba(16,8,48,0.96)'; x.fill();
      x.lineWidth = 3; x.strokeStyle = rgba(col, 1); x.shadowColor = rgba(col, 1); x.shadowBlur = glitch ? 50 : 24; x.stroke(); x.shadowBlur = 0;
      text(`#${480 + i}`, 0, -40, F.bold(48), '#fff');
      const h1 = Array.from({ length: 8 }, (_, k) => HEX[Math.floor(hash(i * 50 + k + (glitch ? Math.floor(t * 30) : 0)) * 16)]).join('');
      text(h1, 0, 20, F.mono(24), rgba(col, 0.9), 'center', 'middle', '3px');
      text(glitch ? 'TAMPERED' : 'SHA-256', 0, 62, F.mono(16, 700), rgba(col, 0.75), 'center', 'middle', '4px');
      x.restore();
    }
    x.restore();
    const label = lt < 0.85 ? 'EVERY STEP, CHAINED' : glitchOn ? 'CHANGE ONE BYTE...' : 'THE CHAIN TELLS YOU.';
    text(label, CX, 190, F.black(56), rgba(glitchOn ? C.red : C.white, seg(lt, 0.05, 0.25)), 'center', 'middle', '8px');
    if (glitchOn) for (let b = 0; b < 6; b++) { const gy = hash(Math.floor(t * 25) + b) * H; x.fillStyle = rgba(b % 2 ? C.red : C.cyan, 0.12); x.fillRect(0, gy, W, 8 + hash(b) * 30); }
    hud(t, 'LEDGER', 11);
  }

  // ---------- 12. home (21 - 22) ----------
  function home(t) {
    const lt = t - 21, out = seg(lt, 0.78, 1.0), s = 1 - 0.3 * inOut(out);
    background(t, C.cyan, 0.5);
    x.save(); x.translate(CX, CY); x.scale(s, s); x.translate(-CX, -CY); x.globalAlpha = 1 - out * 0.9;
    rrect(140, 70, 1640, 84, 42); x.fillStyle = CARD; x.fill(); x.lineWidth = 1.5; x.strokeStyle = LINE; x.stroke();
    drawShield(198, 112, 46, 1, 1, 0.8); text('TrustVault', 236, 113, F.bold(30), rgba(C.white, 1), 'left');
    pill(760, 88, 130, 48, 'Home', { font: F.ui(20, 700) }); text('Vault', 930, 113, F.ui(21, 600), rgba(C.muted, 1), 'left'); text('Privacy', 1030, 113, F.ui(21, 600), rgba(C.muted, 1), 'left');
    rrect(140, 186, 1640, 340, 44); const hg = x.createLinearGradient(140, 186, 1780, 526); hg.addColorStop(0, 'rgba(76,201,240,0.2)'); hg.addColorStop(1, 'rgba(255,0,127,0.12)'); x.fillStyle = hg; x.fill(); x.strokeStyle = rgba(C.cyan, 0.4); x.lineWidth = 2; x.stroke();
    text('TUESDAY, OCTOBER 20', 200, 246, F.mono(20, 600), rgba(C.cyan, 1), 'left', 'middle', '4px');
    const w1 = outExpo(seg(lt, 0.02, 0.2)), w2 = outExpo(seg(lt, 0.1, 0.28));
    text('Good morning,', 196, 330 + (1 - w1) * 30, F.black(96), rgba(C.white, w1), 'left', 'middle', '-3px');
    x.save(); x.globalAlpha *= w2; gradText('Sneha.', 196, 432 + (1 - w2) * 30, F.black(96), 'left', '-3px'); x.restore();
    [0, 1, 2].forEach((i) => { x.save(); x.translate(1380 + i * 26, 360 - i * 22); x.rotate(-0.06 + i * 0.03); x.globalAlpha *= 0.55 + i * 0.22; rrect(-190, -110, 380, 220, 26); x.fillStyle = [gradFill(-190, -110, 190, 110), 'rgba(255,120,60,0.9)', gradFill(190, -110, -190, 110)][i]; x.fill(); x.restore(); });
    rrect(140, 560, 800, 380, 36); x.fillStyle = CARD; x.fill(); x.lineWidth = 1.5; x.strokeStyle = LINE; x.stroke();
    text('Needs you', 190, 616, F.bold(36), rgba(C.white, 1), 'left');
    [['Answer 1 faculty request', 'Tick what to share.', C.amber], ['Replace "Aadhaar Card"', 'It did not pass the checks.', C.red]].forEach(([a, b, col], i) => {
      const rk = outExpo(seg(lt, 0.22 + i * 0.12, 0.42 + i * 0.12)), ry = 670 + i * 120;
      x.save(); x.globalAlpha *= rk; x.translate((1 - rk) * 60, 0);
      rrect(180, ry, 720, 100, 22); x.fillStyle = rgba(col, 0.1); x.fill(); x.strokeStyle = rgba(col, 0.6); x.stroke();
      rrect(204, ry + 24, 52, 52, 14); x.fillStyle = rgba(col, 1); x.fill();
      text(a, 280, ry + 38, F.ui(26, 700), rgba(C.white, 1), 'left'); text(b, 280, ry + 70, F.ui(19, 500), rgba(C.muted, 1), 'left');
      x.restore();
    });
    rrect(980, 560, 800, 380, 36); x.fillStyle = CARD; x.fill(); x.strokeStyle = LINE; x.stroke();
    text('Your documents', 1030, 616, F.bold(36), rgba(C.white, 1), 'left');
    const rp = 0.78 * outCubic(seg(lt, 0.15, 0.6)), rcx = 1160, rcy = 780;
    x.lineWidth = 22; x.strokeStyle = LINE; x.beginPath(); x.arc(rcx, rcy, 105, 0, 6.283); x.stroke();
    x.strokeStyle = gradFill(rcx - 105, rcy - 105, rcx + 105, rcy + 105); x.lineCap = 'round'; x.beginPath(); x.arc(rcx, rcy, 105, -Math.PI / 2, -Math.PI / 2 + 6.283 * rp); x.stroke(); x.lineCap = 'butt';
    text(`${Math.round(rp * 100)}%`, rcx, rcy, F.black(62), rgba(C.white, 1));
    [['PAN card', 'VERIFIED', true], ['Aadhaar card', 'NOT VERIFIED', false], ['10th marksheet', 'STORED', true], ['12th marksheet', 'STORED', true]].forEach(([a, b, ok], i) => {
      const ry = 670 + i * 62; tick(1340, ry, 14, ok ? C.green : C.red, seg(lt, 0.3 + i * 0.06, 0.4 + i * 0.06));
      text(a, 1368, ry + 1, F.ui(22, 700), rgba(C.white, 1), 'left'); text(b, 1740, ry + 1, F.mono(15, 700), rgba(C.muted, 1), 'right', 'middle', '2px');
    });
    x.restore();
    hud(t, 'HOME', 12);
  }

  // ---------- 13. logo (22 - 24) ----------
  function logo(t) {
    const lt = t - 22;
    background(t, C.blue, 0.4);
    const sx = 640, sy = CY - 20, size = 300;
    x.globalCompositeOperation = 'lighter';
    P.forEach((p, i) => {
      const [tx, ty] = shieldPt(i, sx, sy, size), k = outExpo(seg(lt, p.d * 0.25, p.d * 0.25 + 0.4));
      glowDot(lerp(CX + p.ox * 1500, tx, k), lerp(CY + p.oy * 900, ty, k), p.size * 0.8, i >= 340 ? C.green : p.col, (1 - seg(lt, 0.55, 0.75)) * 0.9);
    });
    x.globalCompositeOperation = 'source-over';
    drawShield(sx, sy, size, seg(lt, 0.5, 0.7), seg(lt, 0.6, 0.85), seg(lt, 0.35, 0.5));
    x.font = F.bold(170); x.letterSpacing = '-4px';
    let wx = 830;
    [...'TrustVault'].forEach((ch, i) => {
      const k = outCubic(seg(lt, 0.55 + i * 0.04, 0.9 + i * 0.04)), w = x.measureText(ch).width;
      x.save(); x.translate(wx, sy + (1 - k) * 60); x.globalAlpha = k;
      x.fillStyle = i < 5 ? '#f5f5f7' : gradFill(0, -80, w, 80);
      x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(ch, 0, 0); x.restore();
      wx += w - 4;
    });
    x.letterSpacing = '0px';
    const sw = seg(lt, 1.05, 1.5);
    if (sw > 0 && sw < 1) {
      x.save(); x.globalCompositeOperation = 'lighter'; x.translate(800 + sw * 1000, sy); x.scale(0.6, 1.3);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 160); g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(-160, -160, 320, 320); x.restore();
    }
    text('Your identity. Verified. Vaulted.', 836, sy + 140, F.ui(40, 500), rgba(C.white, 0.88 * seg(lt, 0.95, 1.15)), 'left');
    text('ENCRYPTED · VERIFIED · SHARED ONCE', 836, sy + 200, F.mono(22, 600), rgba(C.cyan, seg(lt, 1.1, 1.3)), 'left', 'middle', '6px');
    const flash = Math.max(0, 1 - Math.abs(lt - 0.62) / 0.06) * 0.22;
    if (flash > 0) { x.fillStyle = `rgba(255,255,255,${flash})`; x.fillRect(0, 0, W, H); }
    hud(t, 'TRUSTVAULT', 13);
  }

  // ---------- seek ----------
  const SCENES = [[0, ignite], [1.5, shield], [3, kin1], [5, signin], [8, upload], [10, checks], [12, kin2], [14, batch], [16, phone], [17, opened], [19, ledger], [21, home], [22, logo]];
  const DROPS = [3, 12, 22];
  function seek(t) {
    t = clamp(t, 0, VIDEO.duration - 1e-4);
    x.setTransform(K, 0, 0, K, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    let fn = SCENES[0][1]; for (const [s, f] of SCENES) if (t >= s) fn = f;
    fn(t);
    vignette();
    // a flash on every cut, a bigger one on the drops; fade out at the end
    for (const [s] of SCENES.slice(1)) {
      const d = Math.abs(t - s);
      if (d < 0.06) { x.fillStyle = `rgba(255,255,255,${(DROPS.includes(s) ? 0.38 : 0.12) * (1 - d / 0.06)})`; x.fillRect(0, 0, W, H); }
    }
    const end = seg(t, 23.55, 24);
    if (end > 0) { x.fillStyle = `rgba(0,0,0,${end})`; x.fillRect(0, 0, W, H); }
  }

  // ---------- soundtrack: 120 BPM, synthesised on the same timeline ----------
  const buildAudio = async function (ctx) {
    const out = ctx.createGain(); out.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    out.connect(comp); comp.connect(ctx.destination);
    const r = rng(9), nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const tone = (f, t, d, type, peak, a = 0.004, dest = out, f2) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      env(g, t, a, peak, d); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + d + 0.05);
    };
    const noise = (t, d, peak, type, freq, q = 1, f2) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nb; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
      env(g, t, 0.004, peak, d); s.connect(f); f.connect(g); g.connect(out); s.start(t, r() * 0.5); s.stop(t + d + 0.05);
    };
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const click = (tt) => { tone(1900, tt, 0.03, 'square', 0.03); noise(tt, 0.025, 0.05, 'highpass', 3000); };
    const hit = (tt) => { tone(70, tt, 0.35, 'sine', 0.35, 0.002, out, 35); noise(tt, 0.12, 0.08, 'lowpass', 1500); };
    // intro (0 - 3): swell, sparkle, riser into the drop
    tone(55, 0, 3, 'sawtooth', 0.045, 1.6, out, 110);
    for (let i = 0; i < 12; i++) tone(mtof(84 + [0, 3, 7, 10, 12, 15][i % 6]), 0.12 + i * 0.1, 0.25, 'sine', 0.028);
    noise(2.45, 0.55, 0.07, 'highpass', 600, 1, 9000);
    // drums + bass, 3 - 22 (Am F G Em, one chord per bar)
    const roots = [45, 41, 43, 40];
    for (let b = 0; ; b++) {
      const tb = 3 + b * BEAT; if (tb >= 22) break;
      tone(150, tb, 0.3, 'sine', 0.45, 0.002, out, 42);
      if (b % 2 === 1) noise(tb, 0.15, 0.075, 'bandpass', 1900, 0.7);
      if (tb >= 5) { noise(tb + BEAT / 2, 0.045, 0.045, 'highpass', 8000); noise(tb + BEAT / 4, 0.03, 0.018, 'highpass', 9000); noise(tb + 3 * BEAT / 4, 0.03, 0.018, 'highpass', 9000); }
      const root = roots[Math.floor((tb - 3) / 2) % 4];
      tone(mtof(root), tb, 0.4, 'sawtooth', 0.07, 0.01);
      tone(mtof(root), tb + BEAT / 2, 0.2, 'sawtooth', 0.045, 0.01);
      if (tb >= 8) for (let s = 0; s < 2; s++) tone(mtof(root + 24 + [0, 7, 12, 15][(b * 2 + s) % 4]), tb + s * BEAT / 2, 0.18, 'triangle', 0.026);
    }
    // kinetic type hits, lock clicks
    [3, 3.5, 4, 4.5, 12, 12.5, 13, 13.5].forEach(hit);
    [4.5, 4.62, 4.74].forEach((tt, i) => { tone(1800 + i * 300, tt + 0.08, 0.06, 'square', 0.03); noise(tt + 0.08, 0.03, 0.06, 'highpass', 3500); });
    // sign-in: typing, Continue, digits, three step ticks, the hold, Access granted
    for (let i = 0; i < 21; i++) noise(5.05 + i * 0.019, 0.015, 0.035, 'highpass', 2500);
    for (let i = 0; i < 12; i++) noise(5.5 + i * 0.023, 0.015, 0.03, 'highpass', 2800);
    click(5.85);
    for (let i = 0; i < 6; i++) { noise(6.05 + i * 0.055, 0.02, 0.04, 'highpass', 2600); noise(6.55 + i * 0.055, 0.02, 0.04, 'highpass', 2600); }
    [6.0, 6.5, 7.0].forEach((tt) => tone(1320, tt, 0.12, 'sine', 0.07));
    click(7.06); tone(300, 7.08, 0.47, 'sine', 0.05, 0.4, out, 1100);
    tone(60, 7.6, 0.6, 'sine', 0.5, 0.002, out, 30); noise(7.6, 0.3, 0.12, 'lowpass', 1200);
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 7.62 + i * 0.04, 0.7, 'sine', 0.05));
    // upload + decode
    noise(8.3, 0.12, 0.08, 'lowpass', 800); tone(90, 8.38, 0.25, 'sine', 0.25, 0.002, out, 45);
    tone(300, 8.45, 0.35, 'sine', 0.035, 0.2, out, 900); tone(1760, 8.82, 0.25, 'sine', 0.04);
    for (let i = 0; i < 7; i++) { noise(8.95 + i * 0.06, 0.02, 0.06, 'highpass', 4000); tone(1100 + i * 110, 8.95 + i * 0.06, 0.05, 'square', 0.014); }
    noise(9.7, 0.35, 0.08, 'bandpass', 400, 0.8, 3500);
    // checks + stamp
    [10.4, 10.6, 10.8, 11.0, 11.2].forEach((tt, i) => tone(1046 + i * 130, tt, 0.1, 'sine', 0.06));
    tone(65, 11.5, 0.7, 'sine', 0.6, 0.002, out, 28); noise(11.5, 0.35, 0.16, 'lowpass', 1400); tone(1568, 11.58, 0.6, 'sine', 0.05); tone(2093, 11.62, 0.6, 'sine', 0.04);
    // kinetic 2: strike, speed
    noise(13.05, 0.18, 0.07, 'bandpass', 2500, 1, 600); noise(13.5, 0.4, 0.07, 'bandpass', 500, 0.8, 5000);
    // faculty: typing, chips, send, requests fan out
    for (let i = 0; i < 4; i++) noise(14.06 + i * 0.08, 0.02, 0.05, 'highpass', 2500);
    [14.45, 14.55, 14.65, 14.8].forEach(click); tone(1568, 14.88, 0.25, 'sine', 0.04);
    for (let i = 0; i < 12; i++) tone(mtof(72 + i * 2), 15.0 + i * 0.05, 0.1, 'triangle', 0.02);
    // the student decides
    [16.28, 16.4].forEach((tt) => tone(1320, tt, 0.1, 'sine', 0.06)); click(16.52);
    [784, 1046, 1318].forEach((f, i) => tone(f, 16.62 + i * 0.05, 0.4, 'sine', 0.045));
    NODES.forEach((n, i) => { if (n.ok) tone(mtof(84 + (i % 5) * 2), 16 + n.at, 0.08, 'sine', 0.01); });
    // opened once, then the lock clunks
    tone(660, 17.12, 0.3, 'sine', 0.04); tone(990, 17.18, 0.3, 'sine', 0.03);
    tone(110, 18.0, 0.35, 'square', 0.06, 0.002, out, 55); noise(18.0, 0.2, 0.12, 'lowpass', 900);
    // ledger glitch
    noise(18.75, 0.4, 0.08, 'bandpass', 300, 0.8, 4000);
    for (let i = 0; i < 6; i++) noise(19.85 + i * 0.07, 0.05, 0.08, 'bandpass', 600 + i * 400, 4);
    tone(880, 20.3, 0.3, 'sine', 0.05);
    // home, riser, the final chord
    noise(20.75, 0.35, 0.07, 'bandpass', 400, 0.8, 4000); tone(1320, 21.35, 0.12, 'sine', 0.05);
    noise(21.0, 1.0, 0.06, 'highpass', 700, 1, 10000);
    tone(60, 22.0, 1.4, 'sine', 0.45, 0.005, out, 40); noise(22.0, 0.3, 0.1, 'lowpass', 1600);
    [57, 64, 69, 72, 76].forEach((m, i) => tone(mtof(m), 22.0 + i * 0.03, 1.9, i < 2 ? 'sawtooth' : 'sine', i < 2 ? 0.025 : 0.04, 0.02));
    [1568, 2093, 2637].forEach((f, i) => tone(f, 22.65 + i * 0.07, 0.6, 'sine', 0.03));
  };

  return { seek, buildAudio, duration: VIDEO.duration };
}
