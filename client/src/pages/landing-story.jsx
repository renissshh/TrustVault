// Scroll-driven story: one card goes from upload to proof while the visitor scrolls (the section is pinned).
// 0-25% upload + encrypt, 25-50% automatic checks, 50-75% verified + sealed, 75-100% QR proof on a phone.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { BadgeCheck, Check, Lock, QrCode, ScanLine, ShieldCheck, UploadCloud, User } from 'lucide-react';
import { burst } from '@/lib/burst';
import { sfx } from '@/lib/sound';

const STORY = [
  [UploadCloud, 'Upload', 'Drop a photo or PDF. It is locked with AES-256 before it ever touches the disk.'],
  [ScanLine, 'Checked', 'Number format, checksum, the text on the card, your name and signs of editing, in seconds.'],
  [BadgeCheck, 'Verified', 'A verifier approves it and the decision is sealed in the tamper-evident ledger.'],
  [QrCode, 'Proven', 'Anyone scans the QR code and sees it is genuine. No account, no phone calls.'],
];
const CHECKS = ['Text read (OCR)', 'PAN format valid', 'Name matches', 'No editing traces', 'Sealed in ledger'];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const HEX = '0123456789abcdef';

function useQrCells() {
  return useMemo(() => {
    const out = []; let seed = 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const finder = (x, y) => (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      if (finder(x, y)) { const fx = x > 13 ? x - 14 : x, fy = y > 13 ? y - 14 : y; if (fx === 0 || fy === 0 || fx === 6 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5)) out.push([x, y]); }
      else if (rnd() > 0.5) out.push([x, y]);
    }
    return out;
  }, []);
}

export function StoryScroll() {
  const ref = useRef(null);
  const stamp = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setP(Math.round(v * 500) / 500));
  const k = (i) => clamp(p * 4 - i); // progress inside chapter i
  const step = Math.min(3, Math.floor(p * 4));
  const cells = useQrCells();
  const cipher = useMemo(() => Array.from({ length: 220 }, (_, i) => HEX[(i * 7 + (i >> 3) * 5) % 16]).join(''), []);

  // the stamp lands once per pass: burst + sound
  const landed = k(2) > 0.25;
  const prev = useRef(false);
  useEffect(() => {
    if (landed && !prev.current) { burst(stamp.current, { size: 1.5 }); sfx('success'); }
    prev.current = landed;
  }, [landed]);

  const k0 = k(0), k1 = k(1), k2 = k(2), k3 = k(3);
  const encrypted = k0 > 0.62;
  const cardY = (1 - easeOut(k0 * 1.6)) * -70; // falls in from above
  const cardRot = (1 - easeOut(k0 * 1.6)) * -12;
  const toQr = easeOut(k3 * 1.4); // the card shrinks into the corner while the QR builds
  const aside = easeOut(k1 * 3); // during the checks the card slides left, out of the list's way
  const lerp = (a, b, t) => a + (b - a) * t;
  const cardX = lerp(-30 * aside, -62, toQr), cardS = lerp(1 - 0.18 * aside, 0.38, toQr);
  const score = Math.round(100 * easeOut(k2 * 1.8));

  return (
    <section ref={ref} className="lp-story" aria-label="How a document becomes proof">
      <div className="lp-story-pin">
        <div className="lp-story-copy">
          <span className="lp-eyebrow">From upload to proof</span>
          <h2 className="lp-h2">Scroll. Watch it <span className="lp-neon">happen.</span></h2>
          <ol>
            {STORY.map(([Icon, title, text], i) => (
              <li key={title} className={i === step ? 'on' : i < step ? 'done' : ''} style={{ '--k': i < step ? 1 : i === step ? k(i) : 0 }}>
                <span className="ico"><Icon className="size-5" /></span>
                <div><b>{title}</b><p>{text}</p></div>
                <i className="bar" />
              </li>
            ))}
          </ol>
        </div>

        <div className="lp-story-stage" aria-hidden="true">
          <div className="st-grid" />
          {/* the vault slot the card drops into */}
          <div className="st-vault" style={{ opacity: (1 - clamp(k2 * 4)) * (1 - toQr), transform: 'translate(-50%, 0)' }}>
            <Lock className="size-4" /> <span>{encrypted ? 'AES-256-GCM · locked' : 'Encrypting…'}</span>
          </div>

          {/* the card */}
          <div className="st-card" style={{
            transform: `translate(-50%, -50%) translate(${cardX}%, ${cardY - toQr * 48}%) rotate(${cardRot}deg) scale(${cardS})`,
            opacity: clamp(k0 * 4),
          }}>
            <div className="face" style={{ opacity: encrypted && k1 === 0 && k2 === 0 ? 0.08 : 1 }}>
              <div className="top"><span>Income Tax Department</span><ShieldCheck className="size-5" /></div>
              <div className="mid"><span className="ph"><User className="size-1/2" /></span><div><b>ABCPS1234F</b><small>Rahul Sharma · demo sample</small></div></div>
            </div>
            <div className="hex" style={{ opacity: encrypted && k1 === 0 ? 1 : 0 }}>{cipher}</div>
            <i className="beam" style={{ top: `${k1 * 100}%`, opacity: k1 > 0 && k1 < 1 ? 1 : 0 }} />
            <span ref={stamp} className="st-stamp" style={{ opacity: landed ? 1 : 0, transform: `translate(-50%,-50%) rotate(-10deg) scale(${landed ? 1 : 2.2})` }}>VERIFIED</span>
          </div>

          {/* automatic checks */}
          <ul className="st-checks" style={{ opacity: clamp(k1 * 5) * (1 - clamp((k2 - 0.55) * 4)) }}>
            {CHECKS.map((c, i) => {
              const done = k1 > (i + 1) / 6;
              return <li key={c} className={done ? 'done' : ''} style={{ transform: `translateX(${(1 - clamp(k1 * 6 - i * 0.6)) * 30}px)`, opacity: clamp(k1 * 6 - i * 0.6) }}><span>{done ? <Check className="size-3.5" /> : null}</span>{c}</li>;
            })}
          </ul>

          {/* score */}
          <div className="st-score" style={{ opacity: clamp(k2 * 5) * (1 - toQr) }}><b>{score}</b><span>/ 100 · sealed in block #45</span></div>

          {/* QR + phone */}
          <div className="st-qr" style={{ opacity: clamp(k3 * 6) }}>
            <svg viewBox="0 0 21 21" shapeRendering="crispEdges">
              {cells.map(([x, y], i) => {
                const s = clamp(k3 * 2.2 - ((x + y) / 40));
                return <rect key={i} x={x + (1 - s) * 0.5} y={y + (1 - s) * 0.5} width={s} height={s} />;
              })}
            </svg>
          </div>
          <div className="st-phone" style={{ transform: `translate(${(1 - easeOut(k3 * 1.5 - 0.3)) * 140}%, -50%)`, opacity: clamp(k3 * 3 - 0.5) }}>
            <div className={k3 > 0.72 ? 'scr ok' : 'scr'}>
              {k3 > 0.72
                ? <><BadgeCheck className="size-9" /><b>Verified document</b><small>PAN card · Rahul Sharma</small><small>Unchanged since upload</small></>
                : <><i className="scan" /><small>Scanning…</small></>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
