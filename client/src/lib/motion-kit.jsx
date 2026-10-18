// Motion-graphics layer shared by every page:
//  - useMotionKit(): one pointer listener for the whole app. Elements with data-tilt lean toward the cursor in 3D,
//    elements with data-magnetic (and every .lp-btn) are pulled toward it.
//  - <ParticleShield>: the TrustVault shield drawn by ~900 glowing particles that fly in, breathe, scatter away
//    from the cursor and explode on click, then reassemble.
// Everything is skipped for people who prefer reduced motion and on touch screens (except the shield, which then
// simply appears assembled).
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const SHIELD = 'M32 5c7 3.4 14 5.4 21 6v18c0 13.6-8.6 24.2-21 30-12.4-5.8-21-16.4-21-30V11c7-.6 14-2.6 21-6z';
const TICK = 'M22 31l7.5 7.5L43 24';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useMotionKit() {
  useEffect(() => {
    if (reduced() || matchMedia('(pointer: coarse)').matches) return undefined;
    let tilted = null;
    const magnets = new Set();
    const onMove = (e) => {
      // 3D tilt: strength shrinks for big cards so wide panels only lean slightly
      // data-tilt="..." may carry the element's own hover transform (e.g. "translateY(-10px)") so both apply.
      const el = e.target.closest?.('[data-tilt]');
      if (tilted && tilted !== el) { tilted.style.transition = 'transform 0.6s cubic-bezier(.2,.8,.2,1)'; tilted.style.transform = ''; }
      tilted = el;
      if (el) {
        const r = el.getBoundingClientRect();
        const max = Math.min(9, 2600 / Math.max(r.width, 1));
        const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        el.style.transition = 'transform 0.18s ease-out';
        el.style.transform = `perspective(1000px) rotateX(${(-ny * max).toFixed(2)}deg) rotateY(${(nx * max).toFixed(2)}deg) ${el.dataset.tilt}`;
      }
      // magnetic buttons: pulled toward the pointer when it is close
      for (const m of document.querySelectorAll('[data-magnetic], main .lp-btn')) {
        const r = m.getBoundingClientRect();
        if (!r.width) continue;
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const reach = Math.max(r.width, r.height) * 0.75 + 40;
        if (Math.abs(dx) < reach && Math.abs(dy) < reach) {
          m.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
          magnets.add(m);
        } else if (magnets.has(m)) { m.style.translate = ''; magnets.delete(m); }
      }
    };
    const onLeave = () => { magnets.forEach((m) => { m.style.translate = ''; }); magnets.clear(); if (tilted) { tilted.style.transform = ''; tilted = null; } };
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => { removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); onLeave(); };
  }, []);
}

// Colours come from the theme tokens, so the shield matches dark and light mode.
const tokens = () => {
  const css = getComputedStyle(document.documentElement);
  const hex = (n) => css.getPropertyValue(n).trim() || '#19e6ff';
  return { a: hex('--primary'), b: hex('--violet'), c: hex('--pink'), ok: hex('--success'), dark: document.documentElement.classList.contains('dark') };
};
const rgb = (h) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (p, q, k) => p.map((v, i) => Math.round(v + (q[i] - v) * k));

export function ParticleShield({ className, scale = 0.8 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = reduced();
    let parts = [], W = 0, H = 0, raf = 0, on = true, frame = 0, colors = tokens();
    const mouse = { x: -1e4, y: -1e4 };

    function build() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const size = Math.min(W, H) * scale, k = size / 64, ox = (W - size) / 2, oy = (H - size) / 2 + size * 0.02;
      const probe = document.createElement('canvas').getContext('2d');
      const shield = new Path2D(SHIELD), tick = new Path2D(TICK);
      const step = Math.max(1.15, 64 / Math.min(46, size / 7));
      const old = parts;
      parts = [];
      for (let y = 4; y < 61; y += step) {
        for (let x = 10; x < 54; x += step) {
          const jx = x + (Math.random() - 0.5) * step * 0.5, jy = y + (Math.random() - 0.5) * step * 0.5;
          if (!probe.isPointInPath(shield, jx, jy)) continue;
          probe.lineWidth = 6; const isTick = probe.isPointInStroke(tick, jx, jy);
          probe.lineWidth = 2.2; const isEdge = probe.isPointInStroke(shield, jx, jy);
          const prev = old[parts.length];
          parts.push({
            tx: ox + jx * k, ty: oy + jy * k, kind: isTick ? 2 : isEdge ? 1 : 0, seed: Math.random() * 6.28,
            x: still ? ox + jx * k : prev?.x ?? Math.random() * W, y: still ? oy + jy * k : prev?.y ?? (Math.random() < 0.5 ? -20 : H + 20) + (Math.random() - 0.5) * 80,
            vx: 0, vy: 0, gx: jx / 64,
          });
        }
      }
    }

    function draw() {
      const t = performance.now() / 1000;
      if (frame++ % 45 === 0) colors = tokens();
      const A = rgb(colors.a), B = rgb(colors.b), C = rgb(colors.c), OK = rgb(colors.ok);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = colors.dark ? 'lighter' : 'source-over';
      const scanY = ((t * 0.35) % 1.4 - 0.2) * H;
      for (const p of parts) {
        if (!still) {
          const bx = p.tx + Math.sin(t * 1.3 + p.seed) * 1.1, by = p.ty + Math.cos(t * 1.1 + p.seed) * 1.1;
          p.vx += (bx - p.x) * 0.035; p.vy += (by - p.y) * 0.035;
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 7000) { const f = (7000 - d2) / 7000 * 2.4; const d = Math.sqrt(d2) || 1; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
          p.vx *= 0.86; p.vy *= 0.86; p.x += p.vx; p.y += p.vy;
        }
        const col = p.kind === 2 ? OK : p.gx < 0.5 ? mix(A, B, p.gx * 2) : mix(B, C, (p.gx - 0.5) * 2);
        const near = Math.max(0, 1 - Math.abs(p.y - scanY) / 26);
        const alpha = (p.kind === 2 ? 0.95 : p.kind === 1 ? 0.85 : 0.42) + near * 0.5;
        const rad = (p.kind === 2 ? 1.9 : p.kind === 1 ? 1.5 : 1.15) + near * 0.8;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, alpha)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (on && !still) raf = requestAnimationFrame(draw);
    }

    const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const onDown = (e) => { // click near the shield: it explodes and pulls itself back together
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (mx < 0 || my < 0 || mx > W || my > H) return;
      for (const p of parts) { const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy) || 1; const f = 26 * Math.random() + 8; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
    };
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(draw); });
    const ro = new ResizeObserver(() => { build(); if (still) draw(); });
    build(); draw(); io.observe(canvas); ro.observe(canvas);
    if (!still) { addEventListener('pointermove', onMove, { passive: true }); addEventListener('pointerdown', onDown, { passive: true }); }
    const onVis = () => { on = !document.hidden; cancelAnimationFrame(raf); if (on && !still) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown); document.removeEventListener('visibilitychange', onVis); };
  }, [scale]);
  return <canvas ref={ref} className={cn('pointer-events-none block h-full w-full', className)} aria-hidden="true" />;
}
