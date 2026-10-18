// Neon burst (mo.js) for success moments: a ring, spark lines and dots fly out from an element.
// mo.js is loaded on first use, so it costs nothing until something succeeds. Skipped for reduced motion.
let mojs;

const tokens = () => {
  const css = getComputedStyle(document.documentElement);
  return ['--primary', '--violet', '--pink', '--success'].map((n) => css.getPropertyValue(n).trim()).filter(Boolean);
};

// target: an element, a selector, or a DOMRect captured earlier; size scales the whole effect; colors: override the theme's neon set
export async function burst(target, { size = 1, colors } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const box = el instanceof DOMRect ? el : el?.getBoundingClientRect();
  if (!box?.width) return;
  mojs ??= (await import('@mojs/core')).default;
  const palette = colors ?? tokens();
  const at = { left: box.left + box.width / 2 + scrollX, top: box.top + box.height / 2 + scrollY, isForce3d: true };
  const r = 64 * size;

  const parts = [
    new mojs.Shape({ ...at, shape: 'circle', fill: 'none', stroke: palette[0], strokeWidth: { [6 * size]: 0 }, radius: { [r * 0.2]: r * 0.95 }, opacity: { 0.9: 0 }, duration: 650, easing: 'cubic.out' }),
    new mojs.Burst({ ...at, count: 12, radius: { [r * 0.35]: r * 1.15 }, degree: 360,
      children: { shape: 'line', stroke: palette, strokeWidth: { [3 * size]: 0 }, radius: { [9 * size]: 2 }, strokeLinecap: 'round', duration: 700, easing: 'quad.out' } }),
    new mojs.Burst({ ...at, count: 8, angle: 22, radius: { [r * 0.2]: r * 1.45 },
      children: { shape: 'circle', fill: palette, radius: { [4 * size]: 0 }, duration: 900, delay: 'stagger(40, 25)', easing: 'cubic.out' } }),
  ];
  for (const p of parts) Object.assign(p.el.style, { zIndex: '160', pointerEvents: 'none' });
  new mojs.Timeline({ onComplete: () => parts.forEach((p) => p.el.remove()) }).add(...parts).play();
}

// Rings that keep growing out of an element until stop() is called (for "checking..." moments).
// The rings are placed inside `target`, which needs position: relative.
export function pulse(target, { colors } = {}) {
  let stopped = false;
  let parts = [];
  if (target && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    (async () => {
      mojs ??= (await import('@mojs/core')).default;
      if (stopped) return;
      const palette = colors ?? tokens();
      parts = [0, 1, 2].map((i) => new mojs.Shape({
        parent: target, left: '50%', top: '50%', shape: 'circle', fill: 'none', stroke: palette[i % palette.length],
        strokeWidth: { 4: 1 }, radius: { 10: 90 }, opacity: { 1: 0 }, duration: 1500, delay: i * 500, repeat: 999, easing: 'cubic.out', isForce3d: true,
      }));
      for (const p of parts) { p.el.style.pointerEvents = 'none'; p.play(); }
    })();
  }
  return () => { stopped = true; for (const p of parts) { p.stop(); p.el.remove(); } };
}
