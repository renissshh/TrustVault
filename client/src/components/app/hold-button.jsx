// Hold-to-confirm: press and hold; a fill sweeps across and a ring closes around the lock. Let go early and it drains
// back. When full: sparks, the label flips, then onConfirm({ x, y }) with the button's centre (where the next
// animation starts). Works with a mouse, a finger, or by holding Space / Enter. After the 21st.dev "hold to confirm".
import { useEffect, useRef, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { burst } from '@/lib/burst';
import { sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';
import '@/enter.css';

export function HoldButton({ label = 'Hold to enter', doneLabel = 'Access granted', duration = 900, onConfirm, className }) {
  const ref = useRef(null);
  const state = useRef({ p: 0, holding: false, raf: 0, last: 0, done: false });
  const [done, setDone] = useState(false);

  useEffect(() => () => cancelAnimationFrame(state.current.raf), []);

  const tick = (now) => {
    const s = state.current, el = ref.current;
    const dt = Math.min(64, now - (s.last || now));
    s.last = now;
    s.p = Math.min(1, Math.max(0, s.p + (s.holding ? dt / duration : -dt / (duration * 0.45))));
    el?.style.setProperty('--p', s.p.toFixed(4));
    if (s.p >= 1 && !s.done) {
      s.done = true;
      setDone(true);
      sfx('tap');
      burst(el, { size: 1.2 });
      const r = el.getBoundingClientRect();
      setTimeout(() => onConfirm?.({ x: r.left + r.width / 2, y: r.top + r.height / 2 }), 280);
      return;
    }
    if (s.holding || s.p > 0) s.raf = requestAnimationFrame(tick);
  };
  const press = () => {
    const s = state.current;
    if (s.done || s.holding) return;
    s.holding = true; s.last = 0;
    cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(tick);
  };
  const release = () => { state.current.holding = false; };

  return (
    <button
      ref={ref}
      type="button"
      className={cn('hb', done && 'is-done', className)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); press(); }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') release(); }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={done ? doneLabel : `${label}: press and hold`}
    >
      <span className="hb-fill" aria-hidden="true" />
      <span className="hb-icon" aria-hidden="true">
        <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" className="hb-track" /><circle cx="20" cy="20" r="17" className="hb-ring" pathLength="1" /></svg>
        {done ? <LockOpen /> : <Lock />}
      </span>
      <span className="hb-labels">
        <span className="hb-label">{label}</span>
        <span className="hb-label hb-done">{doneLabel}</span>
      </span>
    </button>
  );
}
