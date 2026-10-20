// Behind the signed-in app: a slow constellation - points of light drifting and linking up when they come close,
// leaning a little toward the pointer. 2D canvas at 30 fps, ~55 points (about 1,500 distance checks a frame), device
// pixel ratio capped at 1, paused in hidden tabs, a single still frame for people who prefer reduced motion.
import { useEffect, useRef } from 'react';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rgb = (hex) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export function Constellation() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = reduced();
    let W = 0, H = 0, raf = 0, last = 0, pts = [];
    const mouse = { x: -1e4, y: -1e4 };
    let colors = [];
    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      const dark = document.documentElement.classList.contains('dark');
      colors = ['--primary', '--violet', '--pink'].map((v) => rgb(css.getPropertyValue(v).trim() || '#4cc9f0'));
      return dark;
    };
    let dark = readColors();
    const resize = () => {
      W = innerWidth; H = innerHeight;
      canvas.width = W; canvas.height = H;
      const n = Math.round(Math.min(70, Math.max(28, (W * H) / 26000)));
      pts = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: 0.8 + Math.random() * 1.6, c: i % 3 }));
    };
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; // 30 fps is plenty for slow drift
      last = now;
      ctx.clearRect(0, 0, W, H);
      const a = dark ? 1 : 0.55, link = 150;
      for (const p of pts) {
        if (!still) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 40000) { p.vx += dx * 0.00002; p.vy += dy * 0.00002; } // a gentle pull toward the pointer
          p.vx = Math.max(-0.4, Math.min(0.4, p.vx)); p.vy = Math.max(-0.4, Math.min(0.4, p.vy));
          p.x += p.vx; p.y += p.vy;
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const p = pts[i], q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d > link) continue;
          const [r, g, b] = colors[p.c];
          ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - d / link) * 0.22 * a})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
      for (const p of pts) {
        const [r, g, b] = colors[p.c];
        ctx.fillStyle = `rgba(${r},${g},${b},${0.75 * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      if (still) cancelAnimationFrame(raf);
    };
    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(draw); };
    const theme = new MutationObserver(() => { dark = readColors(); if (still) { last = 0; raf = requestAnimationFrame(draw); } });
    resize(); raf = requestAnimationFrame(draw);
    addEventListener('resize', resize);
    if (!still) addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); theme.disconnect(); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}
