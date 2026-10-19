// Scroll-driven story: one card goes from upload to proof while the visitor scrolls (the section is pinned).
// 0-25% upload + encrypt, 25-50% automatic checks, 50-75% verified + sealed, 75-100% shared once with faculty.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { BadgeCheck, Check, Eye, KeyRound, Lock, ScanLine, ShieldCheck, UploadCloud, User } from 'lucide-react';
import { burst } from '@/lib/burst';
import { sfx } from '@/lib/sound';

const STORY = [
  [UploadCloud, 'Upload', 'Drop a photo or PDF. It is locked with AES-256 before it ever touches the disk.'],
  [ScanLine, 'Checked', 'Number format, checksum, the text on the card, official keywords and signs of editing, in seconds.'],
  [BadgeCheck, 'Verified', 'Every check passes, so it is verified automatically and sealed in the tamper-evident ledger.'],
  [KeyRound, 'Shared', 'A faculty member asks. You tick what to share, and they can open it one time.'],
];
const CHECKS = ['Text read (OCR)', 'PAN format valid', 'Number on card', 'No editing traces', 'Sealed in ledger'];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const HEX = '0123456789abcdef';


export function StoryScroll() {
  const ref = useRef(null);
  const stamp = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setP(Math.round(v * 500) / 500));
  const k = (i) => clamp(p * 4 - i); // progress inside chapter i
  const step = Math.min(3, Math.floor(p * 4));
  const cipher = useMemo(() => Array.from({ length: 220 }, (_, i) => HEX[(i * 7 + (i >> 3) * 5) % 16]).join(''), []);

  // the stamp lands once per pass: burst + sound
  const landed = k(2) > 0.25;
  const prev = useRef(false);
  const heard = useRef(false);
  useEffect(() => {
    if (landed && !prev.current) {
      burst(stamp.current, { size: 1.5 });
      if (!heard.current) { sfx('success'); heard.current = true; }
    }
    prev.current = landed;
  }, [landed]);

  const k0 = k(0), k1 = k(1), k2 = k(2), k3 = k(3);
  const encrypted = k0 > 0.62;
  const cardY = (1 - easeOut(k0 * 1.6)) * -34; // drops into place from just above
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
            opacity: 1,
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

          {/* a faculty request: the student ticks what to share, then faculty open it once */}
          <div className="st-req" style={{ opacity: clamp(k3 * 6), transform: `translate(-50%, -50%) translateY(${(1 - easeOut(k3 * 3)) * 30}px)` }}>
            <span className="st-req-head"><b>PR</b><span><b>Dr. Priya Raman</b><small>asks for your documents</small></span></span>
            {[['PAN Card', 0.25], ['10th Marksheet', 0.38], ['12th Marksheet', 0.51]].map(([t, at]) => (
              <span key={t} className={k3 > at ? 'st-req-row on' : 'st-req-row'}><i>{k3 > at && <Check className="size-3" />}</i>{t}</span>
            ))}
            <span className={k3 > 0.66 ? 'st-req-btn done' : 'st-req-btn'}>{k3 > 0.66 ? 'Shared · opens once' : 'Share 3 of 3'}</span>
          </div>
          <div className="st-phone" style={{ transform: `translate(${(1 - easeOut(k3 * 1.5 - 0.3)) * 140}%, -50%)`, opacity: clamp(k3 * 3 - 0.5) }}>
            <div className={k3 > 0.8 ? 'scr ok' : 'scr'}>
              {k3 > 0.8
                ? <><Eye className="size-9" /><b>Opened once</b><small>PAN Card · Rahul Sharma</small><small>Watermarked · logged</small></>
                : <><i className="scan" /><small>Waiting for the student…</small></>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
