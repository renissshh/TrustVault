// <DotMatrix>: a full-bleed grid of glowing dots that switch on outward from the centre, then twinkle. A 2D-canvas take
// on the "Canvas Reveal Effect" (Aceternity UI, MIT, after Clerk's site) without three.js. The parent may set
// `view.current.color` ([r, g, b]) at any time; the dots ease to it. Cheap on purpose: dot positions are computed
// once per resize, and after the reveal the grid is redrawn ~5 times a second (the twinkle is stepped anyway) or
// while the colour is changing. Move or scale it with a CSS transform on a wrapper.
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const LEVELS = [0.18, 0.18, 0.18, 0.3, 0.3, 0.3, 0.55, 0.55, 0.8, 1];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const REVEAL = 2.4; // seconds until every dot is on

export function DotMatrix({ view, className, gap = 20, size = 3 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = reduced();
    let W = 0, H = 0, raf = 0, on = false, start = 0, last = 0, dots = null;
    let color = [76, 201, 240];
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = Math.min(1.25, devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1, n = cols * rows;
      dots = { n, x: new Float32Array(n), y: new Float32Array(n), seed: new Float32Array(n), appear: new Float32Array(n) };
      for (let j = 0, d = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++, d++) {
          const seed = hash(i * 7919 + j * 104729);
          dots.x[d] = i * gap; dots.y[d] = j * gap; dots.seed[d] = seed;
          dots.appear[d] = (Math.hypot(i - cols / 2, j - rows / 2) / Math.hypot(cols / 2, rows / 2)) * (REVEAL - 0.5) + seed * 0.5;
        }
      }
      last = 0;
    };
    const draw = (now) => {
      const t = still ? 99 : (now - start) / 1000;
      const target = view?.current?.color ?? color;
      const moving = target.some((c, i) => Math.abs(c - color[i]) > 1);
      if (moving) color = color.map((c, i) => c + (target[i] - c) * 0.12);
      // after the reveal, only redraw for the twinkle (~5 per second) or a colour change
      if (still || moving || t < REVEAL + 0.1 || now - last > 200) {
        last = now;
        const step = Math.floor(now / 1100);
        const paths = LEVELS.map(() => new Path2D());
        for (let d = 0; d < dots.n; d++) {
          if (t < dots.appear[d]) continue;
          const level = Math.floor(hash(d + Math.floor(step + dots.seed[d] * 4) * 13.7) * LEVELS.length);
          paths[level].rect(dots.x[d], dots.y[d], size, size);
        }
        ctx.clearRect(0, 0, W, H);
        const rgb = color.map(Math.round).join(',');
        LEVELS.forEach((a, i) => { ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fill(paths[i]); });
      }
      if (on && !still) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      const was = on; on = e.isIntersecting;
      if (on && !was) { if (!start) start = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
      if (!on) cancelAnimationFrame(raf);
    });
    const ro = new ResizeObserver(() => { resize(); if (still) draw(performance.now()); });
    resize(); io.observe(canvas); ro.observe(canvas);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && on && !still) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [view, gap, size]);
  return <canvas ref={ref} className={cn('pointer-events-none block h-full w-full', className)} aria-hidden="true" />;
}
