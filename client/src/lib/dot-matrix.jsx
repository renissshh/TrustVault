// <DotMatrix>: a full-bleed grid of glowing dots that switch on outward from the centre, then twinkle. A 2D-canvas take
// on the "Canvas Reveal Effect" (Aceternity UI, MIT, after Clerk's site) without three.js. The parent updates
// `view.current` ({ color: [r,g,b], zoom, x, y }) on every render; the canvas reads it each frame, so the dots follow
// the camera with a little parallax and change colour per chapter without re-rendering React.
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const LEVELS = [0.18, 0.18, 0.18, 0.3, 0.3, 0.3, 0.55, 0.55, 0.8, 1];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function DotMatrix({ view, className, gap = 20, size = 3 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = reduced();
    let W = 0, H = 0, raf = 0, on = false, start = 0;
    let color = [25, 230, 255];
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      const now = performance.now() / 1000, t = still ? 99 : now - start;
      const v = view.current ?? {};
      if (v.color) color = color.map((c, i) => c + (v.color[i] - c) * 0.08); // ease between chapter colours
      const g = gap * (0.8 + 0.2 * (v.zoom ?? 1));
      const ox = ((v.x ?? 0) * 0.12) % g, oy = ((v.y ?? 0) * 0.12) % g;
      const cols = Math.ceil(W / g) + 2, rows = Math.ceil(H / g) + 2, ccx = cols / 2, ccy = rows / 2;
      const paths = LEVELS.map(() => new Path2D());
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const id = i * 7919 + j * 104729;
          const seed = hash(id);
          const appear = Math.hypot(i - ccx, j - ccy) * 0.035 + seed * 0.45; // outward from the centre
          if (t * 1.6 < appear) continue;
          const level = Math.floor(hash(id + Math.floor(now / 4 + seed * 4) * 13.7) * LEVELS.length);
          paths[level].rect(i * g + ox - g, j * g + oy - g, size, size);
        }
      }
      ctx.clearRect(0, 0, W, H);
      const rgb = color.map(Math.round).join(',');
      LEVELS.forEach((a, i) => { ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fill(paths[i]); });
      if (on && !still) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      const was = on; on = e.isIntersecting;
      if (on && !was) { if (!start) start = performance.now() / 1000; cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
      if (!on) cancelAnimationFrame(raf);
    });
    const ro = new ResizeObserver(() => { resize(); if (still) draw(); });
    resize(); io.observe(canvas); ro.observe(canvas);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && on && !still) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [view, gap, size]);
  return <canvas ref={ref} className={cn('pointer-events-none block h-full w-full', className)} aria-hidden="true" />;
}
