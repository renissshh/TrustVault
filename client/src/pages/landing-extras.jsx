// Landing extras: vault-door intro, try-it demo, product preview. Styles in ../landing-extras.css.
import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Check, FolderLock, History, LayoutDashboard, Link2, Play, RotateCcw, ShieldCheck, User } from 'lucide-react';
import { sfx } from '@/lib/sound';
import { burst } from '@/lib/burst';
import '../landing-extras.css';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Vault-door intro: once per tab, click to skip, never shown with reduced motion ----------
export function VaultIntro() {
  const [show, setShow] = useState(() => {
    try { return !reduced() && !sessionStorage.getItem('tv-intro'); } catch { return false; }
  });
  useEffect(() => {
    if (!show) return undefined;
    try { sessionStorage.setItem('tv-intro', '1'); } catch { /* private mode: fine */ }
    const t = setTimeout(() => setShow(false), 2750); // doors are fully open by then
    return () => clearTimeout(t);
  }, [show]);
  if (!show) return null;
  return (
    <div className="vd" onClick={() => setShow(false)} role="presentation" aria-hidden="true">
      <div className="door l" /><div className="door r" />
      <div className="dial">
        <svg viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1.5" />
          <circle className="arc" cx="50" cy="50" r="46" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" pathLength="100" transform="rotate(-90 50 50)" />
          <g className="ticks" stroke="var(--violet)" strokeWidth="1.6" strokeLinecap="round">
            {Array.from({ length: 24 }, (_, i) => <line key={i} x1="50" y1="9" x2="50" y2={i % 6 === 0 ? 17 : 13} transform={`rotate(${i * 15} 50 50)`} />)}
          </g>
        </svg>
        <span className="core"><ShieldCheck className="size-1/2" /></span>
      </div>
      <p className="msg"><b>Unlocking vault</b><b>Access granted</b></p>
    </div>
  );
}

// ---------- Try-it demo: a sample card gets scanned, checked and stamped ----------
const STEPS = [
  ['Reading the text (OCR)', '93 characters', null],
  ['Checking the PAN format', 'valid', 'pan'],
  ['Finding official keywords', 'found', null],
  ['Looking for editing traces', 'none found', null],
  ['Sealing it in the ledger', 'block #45', null],
];
const SPARKS = ['var(--primary)', 'var(--violet)', 'var(--pink)', 'var(--success)'];

export function TryDemo() {
  const [state, setState] = useState('idle'); // idle | scanning | done
  const [step, setStep] = useState(-1);
  const [score, setScore] = useState(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setState('scanning'); setStep(0); setScore(0);
    sfx('tap');
    const gap = reduced() ? 120 : 820;
    STEPS.forEach((_, i) => timers.current.push(setTimeout(() => { setStep(i + 1); sfx('tick'); }, gap * (i + 1))));
    timers.current.push(setTimeout(() => {
      setState('done'); sfx('success');
      setTimeout(() => burst('.demo-stamp', { size: 1.3 }), 250); // after the stamp lands
      const t0 = performance.now();
      const tick = () => { const p = Math.min(1, (performance.now() - t0) / 900); setScore(Math.round(96 * (1 - (1 - p) ** 3))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, gap * (STEPS.length + 0.4)));
  };
  const focus = state === 'scanning' ? STEPS[step]?.[2] : null;

  return (
    <div className="demo rv" data-state={state}>
      <div className="demo-stage">
        <div className="demo-card" aria-hidden="true">
          <span className="scan" />
          <div className="flex items-center justify-between">
            <span className="lp-mono text-[clamp(9px,1.1vw,12px)] font-semibold">Income Tax Department · sample</span>
            <ShieldCheck className="size-6" />
          </div>
          <div className="flex items-end gap-4">
            <span className="lp-photo"><User className="size-1/2 text-black/70" /></span>
            <div className="grid gap-2">
              <span className={`hl font-mono text-[clamp(18px,2.8vw,30px)] leading-none font-semibold tracking-wider ${focus === 'pan' ? 'on' : ''}`}>ABCPS1234F</span>
              <span className={`hl w-fit text-[clamp(11px,1.3vw,14px)] ${focus === 'name' ? 'on' : ''}`}>RAHUL SHARMA</span>
            </div>
          </div>
          <div className="lp-mono border-t border-white/20 pt-3 text-[clamp(8px,1vw,11px)] opacity-80">Demo sample · not a real card</div>
          {state === 'done' && <span className="demo-stamp">VERIFIED</span>}
        </div>
        {state === 'done' && !reduced() && Array.from({ length: 26 }, (_, i) => {
          const a = (i / 26) * Math.PI * 2;
          const d = 150 + (i % 5) * 34;
          return <i key={i} className="demo-spark" style={{ background: SPARKS[i % 4], '--x': `${Math.cos(a) * d}px`, '--y': `${Math.sin(a) * d}px`, '--r': `${i * 47}deg`, animationDelay: `${(i % 6) * 18}ms` }} />;
        })}
      </div>

      <div className="grid gap-5">
        <div>
          <span className="lp-eyebrow">Try it</span>
          <h3 className="mt-3 text-[clamp(1.8rem,3.4vw,3rem)] leading-none font-extrabold">Watch a document get verified.</h3>
          <p className="mt-3 text-muted-foreground">This runs on a sample card, right here in the page. Nothing is uploaded.</p>
        </div>
        <ol className="demo-steps" aria-live="polite">
          {STEPS.map(([label, result], i) => (
            <li key={label} className={state !== 'idle' && i < step ? 'ok' : state === 'scanning' && i === step ? 'now' : undefined}>
              <span className="dot">{state !== 'idle' && i < step && <Check className="size-4" />}</span>{label}<small>{result}</small>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-5">
          <button type="button" className="lp-btn" onClick={run} disabled={state === 'scanning'} style={state === 'scanning' ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
            {state === 'done' ? <><RotateCcw className="size-5" /> Run it again</> : state === 'scanning' ? 'Scanning…' : <><Play className="size-5" /> Scan the sample card</>}
          </button>
          {state === 'done' && <div className="demo-score" aria-label={`Score ${score} out of 100`}>{score}<span>SCORE · VERIFIED</span></div>}
        </div>
      </div>
    </div>
  );
}

// ---------- Product preview: a laptop that rises as you scroll, with a phone beside it ----------
const DOCS = [['PAN Card', 'Verified', 'var(--success)'], ['Semester 6 marksheet', 'Pending', '#fbbf24'], ['Hostel receipt', 'Stored', 'var(--info)']];
const NAV = [[LayoutDashboard, 'Dashboard', true], [FolderLock, 'My Documents'], [Link2, 'Shared Links'], [History, 'Activity Log'], [ShieldCheck, 'Security']];

export function ProductPreview() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return undefined;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75)));
      el.style.setProperty('--p', p.toFixed(3));
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="pv rv" ref={ref} aria-hidden="true">
      <div className="pv-laptop">
        <div className="pv-screen">
          <div className="pv-app">
            <div className="pv-side">
              <b className="mb-2 px-2 text-[1.25em] font-extrabold">Trust<span className="lp-neon" style={{ animation: 'none' }}>Vault</span></b>
              {NAV.map(([Icon, label, on]) => <span key={label} className={on ? 'on' : undefined}><Icon className="size-[1.2em]" />{label}</span>)}
            </div>
            <div className="pv-main">
              <div className="pv-hero">
                <span className="lp-mono text-[0.8em] text-primary">Saturday, 10 October</span>
                <b>Good evening,<br /><span className="lp-neon" style={{ animation: 'none' }}>Rahul.</span></b>
                <span className="mt-2 block opacity-75">3 documents in your vault · 1 verified · secure session 58 min left</span>
              </div>
              <div className="pv-tiles">
                {[['1', 'Verified', 'var(--success)'], ['1', 'Pending', '#fbbf24'], ['0', 'Rejected', 'var(--destructive)'], ['3', 'In vault', 'var(--violet)']].map(([n, l, c]) => (
                  <div key={l} className="pv-tile" style={{ '--c': c }}><b>{n}</b><span className="opacity-70">{l}</span></div>
                ))}
              </div>
              <div className="pv-rows">
                <div className="pv-box">
                  <b>Recent documents</b>
                  {DOCS.map(([t, s, c]) => <div key={t} className="pv-line"><span>{t}</span><span className="pv-pill" style={{ '--c': c }}>{s}</span></div>)}
                </div>
                <div className="pv-box">
                  <b>Activity this week</b>
                  <div className="pv-bars">{[30, 55, 20, 70, 45, 85, 100].map((h, i) => <i key={i} style={{ height: `${h}%`, '--i': i }} />)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="pv-base" />
      </div>
      <div className="pv-phone">
        <div className="scr">
          <b className="text-[1.3em]">My Documents</b>
          {DOCS.map(([t, s, c]) => (
            <div key={t} className="pv-doc" style={{ '--c': c }}>
              <i />
              <div><b>{t}</b><span className="flex items-center gap-1" style={{ color: c }}><BadgeCheck className="size-[1.2em]" />{s}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
