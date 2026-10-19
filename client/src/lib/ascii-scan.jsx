// <AsciiScan>: a SPECIMEN PAN card that a neon band sweeps across, turning it into ASCII characters the way the
// automatic check "reads" a document. Fields light up as the band passes them, then "All checks passed".
// Hover (or drag) over the card to scan it yourself. Plain 2D canvas, no WebGL; paused off screen and in hidden
// tabs; a still frame for people who prefer reduced motion. Inspired by the shaders.com "ASCII sweep" preset.
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const SRC = '/demo-docs/PAN-card.png';
const IW = 1012, IH = 638; // the image's own size; FIELDS are in these pixels
const FIELDS = [
  [60, 170, 260, 420, 'PHOTO'],
  [512, 222, 772, 258, 'NAME'],
  [512, 378, 718, 414, 'PAN FORMAT ✓'],
  [322, 518, 692, 578, 'NUMBER MATCH ✓'],
];
const CHARS = '@%#*+=-:.'; // dense (dark ink) -> sparse (paper)
const SWEEP = 3.5, HOLD = 1.8, CYCLE = SWEEP + HOLD; // seconds
const BAND = 0.3; // band width, share of the card

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rgb = (h) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (p, q, k) => p.map((v, i) => Math.round(v + (q[i] - v) * k));
const tokens = () => {
  const css = getComputedStyle(document.documentElement);
  const get = (n, d) => css.getPropertyValue(n).trim() || d;
  return { a: rgb(get('--primary', '#19e6ff')), b: rgb(get('--violet', '#b56bff')), c: rgb(get('--pink', '#ff4fd8')), ok: rgb(get('--success', '#39ff9c')), muted: rgb(get('--muted-foreground', '#8a90a2')),
    mono: get('--font-mono', 'monospace'), dark: document.documentElement.classList.contains('dark') };
};

export function AsciiScan({ className }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = reduced();
    const img = new Image();
    let W = 0, H = 0, card = null, grid = null, cols = 0, rows = 0, cell = 0, raf = 0, on = true, frame = 0, c = tokens();
    let hover = null; // pointer x over the card (0..1) while hovering or dragging
    const t0 = performance.now();

    function build() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 40px around the card for its glow; it lines up with the text column on the left
      const cw = Math.max(0, Math.min(W - 80, (H - 96) * (IW / IH))), ch = cw * (IH / IW);
      card = { x: 40, y: (H - ch) / 2 - 10, w: cw, h: ch };
      grid = null;
      if (!img.complete || !img.naturalWidth || cw < 60) return; // hidden (phones) or too small: draw nothing
      // brightness of every character cell, read once from a tiny copy of the card
      cell = Math.max(6, cw / 58);
      cols = Math.ceil(cw / cell); rows = Math.ceil(ch / (cell * 1.25));
      const probe = document.createElement('canvas');
      probe.width = cols; probe.height = rows;
      const p = probe.getContext('2d', { willReadFrequently: true });
      p.imageSmoothingQuality = 'high';
      p.drawImage(img, 0, 0, cols, rows);
      const d = p.getImageData(0, 0, cols, rows).data;
      grid = new Float32Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
    }

    const rounded = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

    function draw() {
      if (frame++ % 60 === 0) c = tokens();
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (!grid) { if (on && !still) raf = requestAnimationFrame(draw); return; }
      const { x: cx, y: cy, w: cw, h: ch } = card;
      const loop = still ? SWEEP * 0.62 : t % CYCLE;
      const auto = clamp(loop / SWEEP);
      const center = hover ?? (-BAND / 2 + auto * (1 + BAND)); // band centre, share of the card width
      const lead = center + BAND / 2; // the scan line
      const done = hover == null && loop >= SWEEP; // whole card read: show the result
      const fadeOut = hover == null ? clamp((CYCLE - loop) / 0.35) : 1;

      // the card itself, with a soft neon glow behind it
      ctx.save();
      ctx.shadowColor = `rgba(${c.a},0.45)`; ctx.shadowBlur = 40;
      rounded(cx, cy, cw, ch, cw * 0.03); ctx.fillStyle = '#fcfcf6'; ctx.fill();
      ctx.restore();
      ctx.save();
      rounded(cx, cy, cw, ch, cw * 0.03); ctx.clip();
      ctx.drawImage(img, cx, cy, cw, ch);

      // the band: dark glass over the card, then the card re-drawn as characters
      const bx0 = cx + (center - BAND / 2) * cw, bx1 = cx + (center + BAND / 2) * cw;
      const g = ctx.createLinearGradient(bx0, 0, bx1, 0);
      const glass = c.dark ? '5,6,10' : '255,255,255';
      g.addColorStop(0, `rgba(${glass},0)`); g.addColorStop(0.3, `rgba(${glass},0.94)`); g.addColorStop(0.85, `rgba(${glass},0.96)`); g.addColorStop(1, `rgba(${glass},0)`);
      ctx.fillStyle = g; ctx.fillRect(bx0, cy, bx1 - bx0, ch);
      ctx.font = `700 ${cell * 1.05}px ${c.mono}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (c.dark) ctx.globalCompositeOperation = 'lighter';
      const rowH = ch / rows, colW = cw / cols;
      const first = Math.max(0, Math.floor((center - BAND / 2) * cols)), last = Math.min(cols - 1, Math.ceil((center + BAND / 2) * cols));
      for (let i = first; i <= last; i++) {
        const u = (i + 0.5) / cols;
        const local = 1 - Math.abs(u - center) / (BAND / 2); // 1 in the middle of the band, 0 at its edges
        if (local <= 0) continue;
        const w = clamp(local / 0.35);
        const edge = 1 - w; // chromatic split and jitter only near the edges
        const col = u < 0.5 ? mix(c.a, c.b, u * 2) : mix(c.b, c.c, (u - 0.5) * 2);
        for (let j = 0; j < rows; j++) {
          const lum = grid[j * cols + i];
          const k = Math.min(CHARS.length - 2, Math.floor(Math.pow(lum, 2.2) * (CHARS.length - 1)));
          const ch1 = CHARS[k];
          const ink = 1 - k / (CHARS.length - 2); // 1 for dense characters, 0 for the paper's dots
          const jx = edge > 0.2 && !still ? Math.sin(j * 12.9 + i * 3.1 + t * 9) * edge * cell * 0.6 : 0;
          const px = cx + (i + 0.5) * colW + jx, py = cy + (j + 0.5) * rowH;
          const a = w * (0.3 + ink * 0.7);
          if (edge > 0.25) {
            ctx.fillStyle = `rgba(${c.c},${a * edge * 0.7})`; ctx.fillText(ch1, px - edge * 2.2, py);
            ctx.fillStyle = `rgba(${c.a},${a * edge * 0.7})`; ctx.fillText(ch1, px + edge * 2.2, py);
          }
          ctx.fillStyle = `rgba(${col},${a})`; ctx.fillText(ch1, px, py);
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // the scan line at the front of the band
      if (lead > 0 && lead < 1.02) {
        const lx = cx + lead * cw;
        const sg = ctx.createLinearGradient(lx - 14, 0, lx + 2, 0);
        sg.addColorStop(0, `rgba(${c.a},0)`); sg.addColorStop(1, `rgba(${c.a},0.9)`);
        ctx.fillStyle = sg; ctx.fillRect(lx - 14, cy, 16, ch);
        ctx.fillStyle = `rgba(${mix(c.a, [255, 255, 255], 0.5)},1)`; ctx.fillRect(lx, cy, 2, ch);
      }
      ctx.restore();

      // fields the band has passed get a box and a label
      const sx = cw / IW, sy = ch / IH, roomy = cw >= 320; // small cards: boxes only, no labels
      ctx.font = `700 ${Math.max(9, cw / 46)}px ${c.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      for (const [x0, y0, x1, y1, label] of FIELDS) {
        const seen = clamp(((lead * IW) - x1) / 120) * fadeOut;
        if (seen <= 0) continue;
        const ok = label.endsWith('✓');
        const col = ok ? c.ok : c.a;
        ctx.strokeStyle = `rgba(${col},${seen})`; ctx.lineWidth = 1.5;
        rounded(cx + x0 * sx - 4, cy + y0 * sy - 3, (x1 - x0) * sx + 8, (y1 - y0) * sy + 6, 4); ctx.stroke();
        if (!roomy) continue;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = `rgba(${col},${seen})`;
        rounded(cx + x0 * sx - 4, cy + y0 * sy - 5 - cw / 30, tw + 10, cw / 32, 3); ctx.fill();
        ctx.fillStyle = `rgba(5,6,10,${seen})`; ctx.fillText(label, cx + x0 * sx + 1, cy + y0 * sy - 6);
      }

      // the two captions, in the corners above the card
      if (roomy) {
        ctx.font = `500 11px ${c.mono}`; ctx.textBaseline = 'bottom'; ctx.letterSpacing = '2px';
        ctx.textAlign = 'left'; ctx.fillStyle = `rgba(${c.muted},0.95)`; ctx.fillText('AUTOMATIC CHECKS', cx + 2, cy - 12);
        ctx.textAlign = 'right'; ctx.fillStyle = `rgba(${c.a},0.95)`; ctx.fillText(hover == null ? 'HOVER TO SCAN' : 'SCANNING…', cx + cw - 2, cy - 12);
        ctx.letterSpacing = '0px';
      }

      // the result once the whole card is read
      if (done || still) {
        const k = still ? 1 : clamp((loop - SWEEP) / 0.3) * fadeOut;
        const text = roomy ? '✓  ALL CHECKS PASSED · VERIFIED' : '✓  VERIFIED';
        ctx.font = `800 ${Math.max(10, cw / 34)}px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(text).width + 30, th = cw / 15, tx = cx + cw / 2, ty = cy + ch + th * 0.9;
        ctx.save();
        ctx.shadowColor = `rgba(${c.ok},${0.8 * k})`; ctx.shadowBlur = 24;
        rounded(tx - tw / 2, ty - th / 2 + (1 - k) * 10, tw, th, th / 2); ctx.fillStyle = `rgba(${c.ok},${k})`; ctx.fill();
        ctx.restore();
        ctx.fillStyle = `rgba(5,6,10,${k})`; ctx.fillText(text, tx, ty + (1 - k) * 10);
      }
      if (on && !still) raf = requestAnimationFrame(draw);
    }

    const at = (e) => { const r = canvas.getBoundingClientRect(); const u = (e.clientX - r.left - card.x) / card.w; const v = (e.clientY - r.top - card.y) / card.h; return u >= -0.05 && u <= 1.05 && v >= -0.1 && v <= 1.1 ? clamp(u, -BAND / 2, 1 + BAND / 2) : null; };
    const onMove = (e) => { if (card) hover = at(e); };
    const onLeave = () => { hover = null; };
    const start = () => { cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(draw); };
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (!still) start(); });
    const ro = new ResizeObserver(() => { build(); if (still) draw(); });
    img.onload = () => { build(); draw(); };
    img.src = SRC;
    build(); io.observe(canvas); ro.observe(canvas);
    if (!still) { canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onMove); canvas.addEventListener('pointerleave', onLeave); }
    const onVis = () => { on = !document.hidden; if (!still) start(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); img.onload = null;
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onMove); canvas.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return <canvas ref={ref} className={cn('block h-full w-full touch-pan-y', className)} aria-hidden="true" />;
}
