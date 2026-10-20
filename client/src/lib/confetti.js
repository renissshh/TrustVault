// Confetti burst (canvas, ~2 s, removes itself) and the "a document just got verified" celebration.
import { useEffect } from 'react';
import { sfx } from './sound';
import { store } from './theme';

const COLORS = ['#4cc9f0', '#4361ee', '#ff007f', '#39ff9c', '#ffffff', '#ffd166'];

export function confetti(x = innerWidth / 2, y = innerHeight / 3, count = 170) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = Object.assign(document.createElement('canvas'), { width: innerWidth, height: innerHeight });
  Object.assign(c.style, { position: 'fixed', inset: '0', zIndex: '150', pointerEvents: 'none' });
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const parts = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 6 + Math.random() * 13;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 7, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, color: COLORS[(Math.random() * COLORS.length) | 0] };
  });
  const t0 = performance.now();
  const frame = (t) => {
    const age = (t - t0) / 2100;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age ** 2); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (age < 1) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

// Fires once for each document that became verified since this browser last looked.
// The first visit only records what is already verified, so old documents don't trigger it.
export function useVerifiedCelebration(docs, userId, onNew) {
  useEffect(() => {
    if (!docs || !userId) return;
    const key = `tv-verified:${userId}`;
    const now = docs.filter((d) => d.status === 'verified').map((d) => d.id);
    const before = store.get(key);
    store.set(key, JSON.stringify(now));
    if (before == null) return;
    const seen = new Set(JSON.parse(before));
    const fresh = docs.filter((d) => d.status === 'verified' && !seen.has(d.id));
    if (!fresh.length) return;
    confetti();
    sfx('success');
    onNew?.(fresh);
  }, [docs, userId]); // eslint-disable-line react-hooks/exhaustive-deps
}
