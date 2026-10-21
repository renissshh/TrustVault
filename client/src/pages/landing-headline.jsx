// "Every check, one by one." as kinetic type, after the prompt-motion "develop." film by @twoclipping:
// wide heavy type rises out of a mask line; "one by one" squeezes like an accordion into its full stop,
// the stop grows into a pill that shows each check in turn (OCR, Checksum, Number match, Score, Verified),
// then shrinks back into the stop and the letters spring back out. Every style is a pure function of the
// clock (closed-form springs, no CSS transitions or timers), so the loop never drifts. It pauses off screen.
// Reduced motion: the still heading. Screen readers get the plain sentence.
import { useEffect, useRef } from 'react';
import { Check, ShieldCheck } from 'lucide-react';

const PERIOD = 12; // seconds per loop; the heading rests from 9.2 s to 15 s (= 3 s into the next loop)
const SQUEEZE = 3; // letters fold into the stop
const GROW = 3.45; // the stop becomes a pill
const SHRINK = 8.1; // the pill becomes the stop again
const BACK = 8.5; // letters spring back out
const LABELS = [
  { at: 3.7, text: 'OCR', icon: 'check' },
  { at: 4.45, text: 'Checksum', icon: 'check' },
  { at: 5.2, text: 'Number match', icon: 'check' },
  { at: 5.95, text: 'Score', icon: 'score' },
  { at: 6.95, text: 'Verified', icon: 'shield' },
];
const OUT = SHRINK - 0.1; // the last label leaves just before the pill shrinks

// Closed-form step response of a damped spring, 0 -> 1 (w: stiffness as angular frequency, z: damping ratio).
function spring(t, w = 20, z = 0.7) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
const ease = (x) => Math.min(1, Math.max(0, x));
// Width of the letters, 1 = full: an accelerating fold into the stop, then a bouncy spring back.
const fold = (t) => (t < BACK ? 1 - ease((t - SQUEEZE) / 0.42) ** 3 : spring(t - BACK, 17, 0.66)); // ~6% overshoot: a bounce that stays inside the margin

export function CheckHeadline({ id }) {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const word = el.querySelector('.kt-word');
    const slot = el.querySelector('.kt-slot');
    const pill = el.querySelector('.kt-pill');
    const paint = el.querySelector('.kt-paint');
    const bar = el.querySelector('.kt-bar');
    const blur = el.querySelector('feGaussianBlur');
    const labels = [...el.querySelectorAll('.kt-label')];
    const icons = labels.map((l) => l.querySelector('.kt-ico'));
    const num = el.querySelector('.kt-num');
    let m = null; // measurements in px, taken when the font is in and on every resize

    const measure = () => {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const d = slot.offsetWidth;
      const h = fs * 0.82;
      const pad = fs * 0.32;
      m = {
        d, h, pad,
        dotX: slot.offsetLeft, dotY: slot.offsetTop + slot.offsetHeight - d, // the stop sits on the baseline
        midY: word.offsetTop + word.offsetHeight * 0.52 - h / 2, // pill centred on the line
        widths: labels.map((l) => l.scrollWidth + pad * 2),
      };
    };

    const seek = (t) => {
      if (!m) return;
      const { d, h, pad, dotX, dotY, midY, widths } = m;
      // letters: accordion fold toward the stop, horizontal motion blur from the speed
      const k = fold(t);
      const speed = Math.abs(k - fold(t - 1 / 60)) * 60;
      word.style.transform = `scaleX(${Math.max(0.001, k).toFixed(4)})`;
      word.style.opacity = k < 0.02 ? '0' : '1';
      const b = Math.min(10, speed * 2.2);
      blur.setAttribute('stdDeviation', `${b.toFixed(2)} 0`);
      word.style.filter = b > 0.15 ? 'url(#kt-mb)' : 'none';

      // the stop -> pill -> stop: one spring per change of size and place
      const grow = spring(t - GROW, 16, 0.62);
      const shrink = spring(t - SHRINK, 18, 0.72);
      const open = grow - shrink;
      let w = d + (widths[0] - d) * grow;
      LABELS.forEach((_, i) => { if (i) w += (widths[i] - widths[i - 1]) * spring(t - LABELS[i].at, 18, 0.7); });
      w += (d - widths[widths.length - 1]) * shrink;
      const ph = d + (h - d) * open;
      const x = dotX * (1 - spring(t - GROW, 14, 0.78) + spring(t - SHRINK, 15, 0.8));
      const y = dotY + (midY - dotY) * open;
      pill.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      pill.style.width = `${Math.max(d, w).toFixed(2)}px`;
      pill.style.height = `${Math.max(d, ph).toFixed(2)}px`;

      // labels rise out of the pill's mask line and leave through the top; icons pop on a spring
      labels.forEach((l, i) => {
        const inT = LABELS[i].at;
        const outT = LABELS[i + 1]?.at ?? OUT;
        const p = spring(t - inT, 22, 0.8) - spring(t - outT, 22, 0.8);
        const yy = (1 - spring(t - inT, 22, 0.8)) * h - spring(t - outT, 22, 0.8) * h;
        l.style.transform = `translate(${pad}px, ${yy.toFixed(2)}px)`;
        l.style.visibility = p > 0.001 ? 'inherit' : 'hidden';
        if (icons[i]) icons[i].style.transform = `scale(${Math.max(0, spring(t - inT - 0.12, 26, 0.45)).toFixed(3)})`;
      });
      // the score counts up while a bar draws across the bottom of the pill
      const s = LABELS[3].at;
      const sc = ease((t - s - 0.1) / 0.75);
      num.textContent = `${Math.round(96 * (1 - (1 - sc) ** 3))}%`;
      bar.style.transform = `scaleX(${sc.toFixed(3)})`;
      bar.style.opacity = t > s && t < LABELS[4].at + 0.15 ? '1' : '0';
      // Verified paints the pill green from the left
      paint.style.transform = `scaleX(${Math.max(0, spring(t - LABELS[4].at, 14, 0.85) - spring(t - SHRINK, 22, 0.9)).toFixed(3)})`;
    };

    let clock = 0;
    let last = performance.now();
    let raf = 0;
    let onScreen = true;
    let frozen = false;
    // For screenshots and browser tests: show the heading at time t (seconds into the loop) and hold it there.
    el.seekForTest = (t) => { frozen = true; clock = t % PERIOD; seek(clock); };
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!onScreen || frozen) return;
      clock = (clock + dt) % PERIOD;
      seek(clock);
    };
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; });
    io.observe(el);
    const ro = new ResizeObserver(() => { measure(); seek(clock); });
    let alive = true; // the font can arrive after this effect was cleaned up (and React StrictMode mounts twice)
    document.fonts.load('800 expanded 1em Archivo').catch(() => {}).then(() => { // expanded = the 125% width
      if (!alive) return;
      measure();
      ro.observe(el);
      ro.observe(word); // the word changes size when the web font swaps in
      el.classList.add('kt-live');
      raf = requestAnimationFrame(frame);
    });
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); el.classList.remove('kt-live'); };
  }, []);

  return (
    <h2 id={id} className="kt" ref={root}>
      <span className="sr-only">Every check, one by one.</span>
      <span className="kt-line" aria-hidden="true"><span>Every check,</span></span>
      <span className="kt-line kt-l2" aria-hidden="true">
        <span className="kt-rise">
          <span className="kt-word">one by one</span><span className="kt-slot" />
          <span className="kt-pill">
            <span className="kt-paint" />
            {LABELS.map((l) => (
              <span key={l.text} className={`kt-label ${l.icon === 'shield' ? 'kt-ok' : ''}`}>
                {l.icon === 'check' && <span className="kt-ico"><Check /></span>}
                {l.icon === 'shield' && <span className="kt-ico"><ShieldCheck /></span>}
                {l.text}{l.icon === 'score' && <b className="kt-num">96%</b>}
              </span>
            ))}
            <span className="kt-bar" />
          </span>
        </span>
      </span>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <filter id="kt-mb" x="-30%" y="0" width="160%" height="100%"><feGaussianBlur stdDeviation="0 0" /></filter>
      </svg>
    </h2>
  );
}
