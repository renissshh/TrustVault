// App-wide extras: the scanner cursor, click sounds and the sound on/off button.
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setSound, sfx, soundOn } from '@/lib/sound';

const CLICKABLE = 'a, button, [role="button"], summary, label, select, input[type="checkbox"], input[type="radio"], input[type="range"], [data-spot]';
// the normal cursor stays for text fields (caret) and embedded documents (the frame draws its own)
const NATIVE = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"], iframe, object, embed';
const SIZE = 28; // the idle reticle
const PAD = 6; // gap between a framed control and the brackets
const LOCK_MAX = [440, 140]; // frame buttons, links and chips; bigger clickable areas (cards) only widen the reticle

// The vault's cursor is a scanner reticle: a dot sits exactly on the pointer and four corner brackets trail it.
// Over a button or link the brackets snap around it like a scanner framing a document, and one scan line sweeps
// across; on press they squeeze in. Mouse only; the normal cursor stays for text fields, embedded documents
// and with reduced motion.
export function ScanCursor() {
  const dot = useRef(null);
  const ret = useRef(null);
  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const html = document.documentElement;
    const el = ret.current;
    const line = el.querySelector('b');
    let x = -100, y = -100, raf = 0, seen = false, hot = false, target = null, lockedAt = 0;
    const box = { x: -100, y: -100, w: SIZE, h: SIZE };
    const goal = () => {
      if (target?.isConnected) {
        const r = target.getBoundingClientRect();
        // a small pull toward the pointer keeps the frame alive
        const px = (x - r.left - r.width / 2) * 0.06, py = (y - r.top - r.height / 2) * 0.06;
        return { x: r.left - PAD + px, y: r.top - PAD + py, w: r.width + PAD * 2, h: r.height + PAD * 2 };
      }
      const s = hot ? SIZE * 1.5 : SIZE;
      return { x: x - s / 2, y: y - s / 2, w: s, h: s };
    };
    const frame = (now) => {
      const g = goal();
      let moving = false;
      for (const k of ['x', 'y', 'w', 'h']) { box[k] += (g[k] - box[k]) * 0.25; if (Math.abs(g[k] - box[k]) > 0.15) moving = true; }
      el.style.transform = `translate3d(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px, 0)`;
      el.style.width = `${box.w.toFixed(1)}px`; el.style.height = `${box.h.toFixed(1)}px`;
      // keep following a framed control for a moment: buttons lift on hover
      raf = moving || (target && now - lockedAt < 600) ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => { raf ||= requestAnimationFrame(frame); };
    const onMove = (e) => {
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; box.x = x - SIZE / 2; box.y = y - SIZE / 2; html.classList.add('glow-cursor'); }
      dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const native = Boolean(e.target.closest?.(NATIVE));
      const c = native ? null : e.target.closest?.(CLICKABLE);
      hot = Boolean(c);
      html.classList.toggle('gc-hot', hot);
      html.classList.toggle('gc-text', native);
      const r = c?.getBoundingClientRect();
      const next = r && r.width <= LOCK_MAX[0] && r.height <= LOCK_MAX[1] ? c : null;
      if (next !== target) {
        target = next;
        lockedAt = performance.now();
        html.classList.toggle('gc-lock', Boolean(target));
        if (target) line.animate([{ top: '0%', opacity: 1 }, { top: '100%', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
      kick();
    };
    const down = () => html.classList.add('gc-down');
    const up = () => html.classList.remove('gc-down');
    const leave = () => html.classList.remove('glow-cursor');
    const enter = () => seen && html.classList.add('glow-cursor');
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', down); addEventListener('pointerup', up);
    addEventListener('scroll', kick, { passive: true, capture: true }); // a framed control moves with the page
    html.addEventListener('pointerleave', leave); html.addEventListener('pointerenter', enter);
    return () => {
      removeEventListener('pointermove', onMove); removeEventListener('pointerdown', down); removeEventListener('pointerup', up);
      removeEventListener('scroll', kick, { capture: true });
      html.removeEventListener('pointerleave', leave); html.removeEventListener('pointerenter', enter);
      cancelAnimationFrame(raf); html.classList.remove('glow-cursor', 'gc-hot', 'gc-text', 'gc-down', 'gc-lock');
    };
  }, []);
  return (
    <>
      <div ref={ret} className="gc-ret" aria-hidden="true"><i /><i /><i /><i /><b /></div>
      <div ref={dot} className="gc-dot" aria-hidden="true" />
    </>
  );
}

// One listener: a soft blip on every button or link press (only when sound is on).
export function ClickSounds() {
  useEffect(() => {
    const onDown = (e) => { if (e.target.closest?.('a, button, [role="button"], summary')) sfx('tap'); };
    addEventListener('pointerdown', onDown, { passive: true });
    return () => removeEventListener('pointerdown', onDown);
  }, []);
  return null;
}

export function SoundToggle({ className }) {
  const [on, setOn] = useState(soundOn);
  useEffect(() => {
    const sync = () => setOn(soundOn());
    window.addEventListener('tv-sound', sync);
    return () => window.removeEventListener('tv-sound', sync);
  }, []);
  return (
    <Button type="button" variant="outline" size="icon-sm" className={className} onClick={() => setSound(!on)} aria-pressed={on} aria-label={on ? 'Turn sound off' : 'Turn sound on'}>
      <span key={String(on)} className="grid animate-pop place-items-center">{on ? <Volume2 /> : <VolumeX />}</span>
    </Button>
  );
}
