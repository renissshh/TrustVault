// The hero card's show, played once when the card comes into view (straight away on tall screens):
//   fly in from the left -> the PAN number spins like slot-machine reels and locks left to right while the score
//   flickers -> the checks tick on and the score counts to 96% -> VERIFIED slams down -> one full 360° turn.
// Scrolling on past it slides the card away to the left, and back on the way up (Landing's scroll handler sets --exit).
// It waits for the first-visit "Access granted" intro. Reduced motion: the finished card, no motion.
import { useEffect, useRef, useState } from 'react';
import { Check, ShieldCheck, User } from 'lucide-react';
import { burst } from '@/lib/burst';
import { sfx } from '@/lib/sound';
import { GRANTED_MS } from '@/components/app/access-granted';

const PAN = 'ABCPS1234F';
const CHECKS = ['OCR', 'Checksum', 'Number match'];
const POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
// ms from the start: fly-in, first reel locks, gap between locks, checks, stamp, spin (the turn takes 1.1s)
const T = { fly: 0, lock0: 950, lockGap: 95, checks: 2050, checkGap: 230, stamp: 2850, spin: 3500, done: 4600 };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// One character as a reel: a strip of random characters that rolls until it locks on the real one.
function Reel({ ch, locked, i }) {
  const strip = useRef(Array.from({ length: 14 }, (_, k) => POOL[(i * 7 + k * 11) % POOL.length])).current;
  return (
    <span className={`lp-reel ${locked ? 'locked' : ''}`} style={{ '--i': i }}>
      {locked
        ? <span className="lp-reel-final">{ch}</span>
        : <span className="lp-reel-strip">{[...strip, ...strip].map((c, k) => <span key={k}>{c}</span>)}</span>}
    </span>
  );
}

export function HeroCard() {
  const still = useRef(reduced()).current;
  // when "Access granted" plays first (once per tab), start after it
  const delay = useRef(still ? 0 : (() => { try { return sessionStorage.getItem('tv-intro') ? 650 : GRANTED_MS + 250; } catch { return 650; } })()).current;
  const [t, setT] = useState(still ? T.done : -1); // ms since the show started; -1 = not started
  const [score, setScore] = useState(still ? 96 : 0);
  const stamp = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    if (still) return undefined;
    const readyAt = performance.now() + delay;
    const timers = [];
    let flicker;
    const play = () => {
      const wait = Math.max(0, readyAt - performance.now());
      const at = (ms, fn) => timers.push(setTimeout(fn, wait + ms));
      at(T.fly, () => setT(T.fly));
      for (let i = 0; i < PAN.length; i++) at(T.lock0 + i * T.lockGap, () => { setT(T.lock0 + i * T.lockGap); sfx('tick'); });
      CHECKS.forEach((_, i) => at(T.checks + i * T.checkGap, () => setT(T.checks + i * T.checkGap)));
      at(T.stamp, () => { setT(T.stamp); sfx('success'); if (stamp.current) burst(stamp.current, { size: 1.3 }); });
      at(T.spin, () => setT(T.spin));
      // the score flickers while the reels spin, then counts up to 96
      at(T.fly + 300, () => { flicker = setInterval(() => setScore(10 + Math.floor(Math.random() * 89)), 55); });
      at(T.checks, () => {
        clearInterval(flicker);
        const start = performance.now();
        const up = () => { const k = Math.min(1, (performance.now() - start) / 700); setScore(Math.round(96 * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(up); };
        requestAnimationFrame(up);
      });
    };
    // play once the card's place is on screen: at once on tall screens, on the first scroll down on short ones
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.35 });
    io.observe(box.current);
    return () => { io.disconnect(); timers.forEach(clearTimeout); clearInterval(flicker); };
  }, [still, delay]);

  const started = t >= 0;
  const lockedCount = still ? PAN.length : PAN.split('').filter((_, i) => t >= T.lock0 + i * T.lockGap).length;
  const checksOn = still ? CHECKS.length : CHECKS.filter((_, i) => t >= T.checks + i * T.checkGap).length;
  const stamped = still || t >= T.stamp;
  const spinning = !still && t >= T.spin; // the turn runs once; the class just stays

  return (
    <div className="lp-stack" ref={box}>
      <div className={`lp-fly ${started ? 'go' : ''} ${still ? 'still' : ''}`}>
        <span className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <div className="lp-card back2" />
        <div className="lp-card back" />
        <div className={`lp-flip ${spinning ? 'spin' : ''}`}>
          <div className={`lp-card lp-face ${stamped ? 'is-stamped' : ''}`}>
            <span className="sheen" /><span className="beam" />
            <div className="flex items-center justify-between">
              <span className="lp-mono text-[clamp(10px,1.3vw,13px)] font-semibold">Income Tax Department</span>
              <ShieldCheck className="size-7" />
            </div>
            <div className="flex items-end gap-5">
              <span className="lp-photo"><User className="size-1/2 text-black/70" /></span>
              <div>
                <div className="lp-number font-mono text-[clamp(20px,3.6vw,38px)] leading-none font-semibold tracking-wider">
                  {PAN.split('').map((ch, i) => <Reel key={i} ch={ch} i={i} locked={i < lockedCount} />)}
                </div>
                <div className="mt-2 text-[clamp(11px,1.4vw,15px)] opacity-80">Permanent Account Number · Rahul Sharma</div>
              </div>
            </div>
            <div className="lp-mono flex items-center justify-between border-t border-white/25 pt-3 text-[clamp(9px,1.2vw,12px)]">
              <span className="lp-checks">
                {CHECKS.map((c, i) => <span key={c} className={i < checksOn ? 'on' : ''}><i><Check className="size-3" /></i>{c}</span>)}
              </span>
              <span className={`lp-score font-bold ${checksOn ? 'counted' : ''}`}>{String(score).padStart(2, '0')}%</span>
            </div>
            <span ref={stamp} className="lp-stamp">VERIFIED</span>
          </div>
          <div className="lp-card lp-rear" aria-hidden="true">
            <ShieldCheck className="lp-rear-shield" />
            <b>TrustVault</b>
            <span className="lp-mono text-[clamp(9px,1.2vw,12px)]">Verified · sealed in the ledger · block #45</span>
          </div>
        </div>
      </div>
    </div>
  );
}
