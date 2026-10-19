// Landing page: Apple-clean layout on a dark neon stage. Styles live in ../landing.css.
// The page is fully visible without scripts; the effect below only adds motion (scroll reveals,
// cursor light, card tilt, the sentence that lights up as you scroll).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, Fingerprint, Lock, QrCode, ScanLine, ShieldCheck, UploadCloud, User } from 'lucide-react';
import { api } from '@/lib/api';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/account';
import { useAsync, CountUp } from '@/components/app/kit';
import { SoundToggle } from '@/components/app/fx-global';
import { VaultIntro, TryDemo, ProductPreview } from './landing-extras';
import { TourVideo } from '@/components/app/tour-video';
import { ParticleShield } from '@/lib/motion-kit';
import { StoryScroll } from './landing-story';
import '../landing-story.css';
import '../landing.css';

const STANDARDS = ['AES-256-GCM', 'SHA-256 ledger', 'TOTP · RFC 6238', 'Verhoeff checksum', 'Tesseract OCR', 'Have I Been Pwned', 'DPDP Act 2023', 'WCAG accessible'];
const SAY = 'Encrypted before it is saved. Checked in seconds. Proven with one scan.'.split(' ');
const HI = ['Encrypted', 'Checked', 'Proven'];
const CHECKS = ['PAN format and checksum', 'Number matches the card', 'Text readable by OCR', 'No editing traces'];
const BLOCKS = [['#41', 'a3f7…9c'], ['#42', '0b9e…41'], ['#43', '44d2…e7'], ['#44', 'c6a1…0f']];
const STEPS = [
  [UploadCloud, 'Upload', 'Add your PAN, Aadhaar, licence, marksheets or any document - photo or PDF. It is encrypted before it touches the disk.', 'c-cyan'],
  [BadgeCheck, 'Get verified', 'Format, checksum, OCR and originality checks run in seconds, then an authorized verifier approves it.', 'c-purple'],
  [ScanLine, 'Share proof', 'Show a QR code or send a time-limited link instead of handing over photocopies.', 'c-hot'],
];
const HEX = '0123456789abcdef';
const scramble = (n) => Array.from({ length: n }, (_, i) => (i % 5 === 4 ? ' ' : HEX[(Math.random() * 16) | 0])).join('');

// Side chips that fill the wide-screen margins beside the headline.
const SIDES = [
  [BadgeCheck, 'PAN Card', 'verified · 96%', 'c-green'], [Lock, 'Aadhaar', 'masked · encrypted', 'c-cyan'], [ScanLine, 'Marksheet', 'OCR passed', 'c-purple'],
  [QrCode, 'QR scanned', 'by an employer', 'c-hot'], [ShieldCheck, 'Access approved', 'for 24 hours', 'c-green'], [Fingerprint, '2FA code', 'accepted', 'c-cyan'],
];

// Headline: the first line rolls in letter by letter; the second line keeps changing, each letter
// rolling out and the next phrase rolling in (after the 21st.dev "Text Cycle" / "Text Roll" patterns).
const PHRASES = ['Verified once.', 'Trusted always.', 'Shared safely.', 'Proven by QR.', 'Yours alone.'];
const FIRST = 'Your documents.';

function Letters({ text, className, neon }) {
  const n = text.length;
  return [...text].map((ch, i) => {
    // neon letters run cyan -> purple -> pink across the phrase
    const t = n > 1 ? i / (n - 1) : 0;
    const color = neon ? (t < 0.5 ? `color-mix(in oklab, var(--violet) ${t * 200}%, var(--primary))` : `color-mix(in oklab, var(--pink) ${(t - 0.5) * 200}%, var(--violet))`) : undefined;
    return <span key={i} className={className} style={{ '--i': i, color }}>{ch === ' ' ? '\u00a0' : ch}</span>;
  });
}

function HeroTitle() {
  const [at, setAt] = useState(0);
  const [prev, setPrev] = useState(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setAt((n) => { setPrev(n); return (n + 1) % PHRASES.length; }), 3200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (prev == null) return undefined;
    const t = setTimeout(() => setPrev(null), 700);
    return () => clearTimeout(t);
  }, [prev]);
  return (
    <h1 className="lp-title" aria-label={`${FIRST} ${PHRASES[0]}`}>
      <span className="line roll" aria-hidden="true"><Letters text={FIRST} className="ch in" /></span>
      <span className="line roll cycle" aria-hidden="true">
        {prev != null && <span className="phrase out" key={`o${prev}`}><Letters text={PHRASES[prev]} className="ch out" neon /></span>}
        <span className="phrase" key={`i${at}`}><Letters text={PHRASES[at]} className="ch in" neon /></span>
      </span>
    </h1>
  );
}

function useLandingMotion(root) {
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.classList.add('js');

    // reveal on scroll
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    el.querySelectorAll('.rv').forEach((n) => io.observe(n));
    // content that renders later (live numbers, lazy sections) gets the same reveal
    const mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.matches('.rv:not(.in)')) io.observe(n);
      n.querySelectorAll?.('.rv:not(.in)').forEach((c) => io.observe(c));
    })));
    mo.observe(el, { childList: true, subtree: true });
    // safety net: never leave content hidden
    const safety = setTimeout(() => el.querySelectorAll('.rv:not(.in)').forEach((n) => { if (n.getBoundingClientRect().top < innerHeight) n.classList.add('in'); }), 1500);

    // the sentence lights up word by word as it crosses the screen
    const say = el.querySelector('.lp-say');
    const words = say ? [...say.children] : [];
    const onScroll = () => {
      if (!say) return;
      const r = say.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.82 - r.top) / (innerHeight * 0.5 + r.height)));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < lit));
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });

    // cursor light, card tilt, panel spotlight
    const stack = el.querySelector('.lp-stack');
    const onMove = (e) => {
      el.style.setProperty('--cx', `${e.clientX}px`);
      el.style.setProperty('--cy', `${e.clientY}px`);
      if (stack) {
        stack.style.setProperty('--tx', `${((e.clientX / innerWidth) - 0.5) * 26}deg`);
        stack.style.setProperty('--ty', `${((e.clientY / innerHeight) - 0.5) * -18}deg`);
      }
      const panel = e.target.closest?.('.lp-panel');
      if (panel) {
        const r = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', `${e.clientX - r.left}px`);
        panel.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    };
    if (!reduce && !matchMedia('(pointer: coarse)').matches) addEventListener('pointermove', onMove, { passive: true });

    return () => { io.disconnect(); mo.disconnect(); clearTimeout(safety); removeEventListener('scroll', onScroll); removeEventListener('pointermove', onMove); el.classList.remove('js'); };
  }, [root]);
}

// Ticks every `ms` unless the visitor prefers reduced motion.
function useTick(ms) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

function CipherViz() {
  const tick = useTick(110);
  const text = useMemo(() => scramble(150), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="viz-cipher" aria-hidden="true">
      <div className="bar"><i /><i /><i /></div>
      <div className="plain">pan-card.jpg · 412 KB → AES-256-GCM</div>
      <div>{text}</div>
    </div>
  );
}

function CodeViz() {
  const tick = useTick(4000);
  const code = useMemo(() => String(Math.floor(100000 + Math.random() * 900000)), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div aria-hidden="true">
      <div className="viz-code" key={code}>{code.split('').map((d, i) => <span key={i} style={{ '--i': i }}>{d}</span>)}</div>
      <div className="viz-timer"><i key={code} /></div>
    </div>
  );
}

// A QR-looking pattern (decorative, not a real code): fixed so it never changes between renders.
function QrArt() {
  const cells = useMemo(() => {
    const out = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const finder = (x, y) => (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) if (!finder(x, y) && rnd() > 0.52) out.push([x, y]);
    return out;
  }, []);
  const eye = (x, y) => <g key={`${x}${y}`}><rect x={x} y={y} width="7" height="7" rx="1.6" /><rect x={x + 1} y={y + 1} width="5" height="5" rx="1" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" rx="0.6" /></g>;
  return (
    <svg viewBox="0 0 21 21" fill="#05050a" shapeRendering="crispEdges">
      {eye(0, 0)}{eye(14, 0)}{eye(0, 14)}
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)}
    </svg>
  );
}

export default function Landing() {
  const root = useRef(null);
  useLandingMotion(root);
  const stats = useAsync(() => api('/public/stats'));
  const live = stats.data?.documents > 0;
  const numbers = [
    [256, '-bit', 'AES encryption on every file'],
    [3, '', 'factors to sign in'],
    live ? [stats.data.documents, '', 'documents protected'] : [60, 'min', 'sessions, then locked'],
    live ? [stats.data.verified, '', 'verified with a QR'] : [0, '', 'files stored unencrypted'],
  ];

  return (
    <div className="lp" ref={root}>
      <VaultIntro />
      <div className="lp-stars" aria-hidden="true" />
      <div className="lp-orb a" aria-hidden="true" /><div className="lp-orb b" aria-hidden="true" /><div className="lp-orb c" aria-hidden="true" />
      <div className="lp-cursor" aria-hidden="true" />

      <header className="lp-nav">
        <Brand to="/welcome" />
        <nav className="flex items-center gap-2" aria-label="Site">
          <Link to="/verify" className="lp-btn ghost sm lp-wide">Verify a document</Link>
          <SoundToggle />
          <ThemeToggle />
          <Link to="/login" className="lp-btn sm">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <span className="lp-chip lp-in"><i />Digital identity, verified</span>
          <HeroTitle />
          <p className="lp-sub">TrustVault keeps your identity and academic documents in an encrypted vault, checks them in seconds, and lets anyone confirm they are genuine with a QR code.</p>
          <div className="lp-cta">
            <Link to="/register" className="lp-btn">Create free account <ArrowRight className="size-5" /></Link>
            <Link to="/login" className="lp-btn ghost">I already have an account</Link>
          </div>

          <div className="lp-sides" aria-hidden="true">
            {SIDES.map(([Icon, label, sub, tone], i) => (
              <span key={label} className={`lp-side s${i} ${tone}`}><b><Icon className="size-4" /></b><span><strong>{label}</strong><small>{sub}</small></span></span>
            ))}
          </div>

          <div className="lp-scene" aria-hidden="true">
            <div className="lp-floor" />
            <div className="lp-halo" />
            <div className="lp-ring r1" /><div className="lp-ring r2" />
            <div className="lp-stack">
              <div className="lp-card back2" />
              <div className="lp-card back" />
              <div className="lp-card">
                <span className="sheen" /><span className="beam" />
                <div className="flex items-center justify-between">
                  <span className="lp-mono text-[clamp(10px,1.3vw,13px)] font-semibold">Income Tax Department</span>
                  <ShieldCheck className="size-7" />
                </div>
                <div className="flex items-end gap-5">
                  <span className="lp-photo"><User className="size-1/2 text-black/70" /></span>
                  <div>
                    <div className="font-mono text-[clamp(20px,3.6vw,38px)] leading-none font-semibold tracking-wider">ABCPS1234F</div>
                    <div className="mt-2 text-[clamp(11px,1.4vw,15px)] opacity-80">Permanent Account Number · Rahul Sharma</div>
                  </div>
                </div>
                <div className="lp-mono flex items-center justify-between border-t border-white/25 pt-3 text-[clamp(9px,1.2vw,12px)]">
                  <span>OCR · checksum · number match</span><span className="font-bold">96%</span>
                </div>
                <span className="lp-stamp">VERIFIED</span>
              </div>
            </div>
            <div className="lp-sat s1"><b><Lock className="size-5" /></b><span>AES-256 encrypted</span></div>
            <div className="lp-sat s2"><b><QrCode className="size-5" /></b><span>QR proof for anyone</span></div>
            <div className="lp-sat s3"><b><Check className="size-5" /></b><span>Checked in seconds</span></div>
            <div className="lp-sat s4"><b><Fingerprint className="size-5" /></b><span>Authenticator 2FA</span></div>
          </div>
        </section>

        <div className="lp-marquee" aria-label="Security standards used">
          <div>
            {[0, 1].map((copy) => (
              <span key={copy} className="set" aria-hidden={copy === 1}>{STANDARDS.map((s) => <span key={s}>{s}<em /></span>)}</span>
            ))}
          </div>
        </div>

        <section className="lp-sec lp-center">
          <p className="lp-say" aria-label={SAY.join(' ')}>
            {SAY.map((w, i) => <span key={i} aria-hidden="true" className={HI.includes(w) ? 'hi' : undefined}>{w} </span>)}
          </p>
        </section>

        <section className="lp-sec" style={{ paddingTop: 'clamp(60px, 8vw, 110px)' }}>
          <TryDemo />
        </section>

        <section className="lp-sec">
          <div className="rv">
            <span className="lp-eyebrow">Security</span>
            <h2 className="lp-h2">Locked down. <span className="lp-neon" style={{ animation: 'shimmer 5s linear infinite' }}>Lit up.</span></h2>
            <p className="lp-lead">The same protections and checks every document in your vault goes through.</p>
          </div>
          <div className="lp-grid">
            <article data-tilt="translateY(-10px) scale(1.012)" className="lp-panel w4 c-cyan rv left">
              <span className="tag">AES-256-GCM</span>
              <div className="viz"><CipherViz /></div>
              <div><h3>Encrypted vault</h3><p>Every file is locked before it is saved. Even someone with the database sees only ciphertext.</p></div>
            </article>
            <article data-tilt="translateY(-10px) scale(1.012)" className="lp-panel w2 c-hot rv right" style={{ '--d': 120 }}>
              <span className="tag">Changes every 30 s</span>
              <div className="viz"><CodeViz /></div>
              <div><h3>Authenticator</h3><p>Password, email code, and a 6-digit code from your phone.</p></div>
            </article>
            <article data-tilt="translateY(-10px) scale(1.012)" className="lp-panel w3 c-green rv left">
              <span className="tag">Automatic checks</span>
              <div className="viz grid w-full items-center gap-6 sm:grid-cols-[auto_1fr]">
                <div className="viz-ring justify-self-center">
                  <svg viewBox="0 0 36 36"><circle className="track" cx="18" cy="18" r="15.9" pathLength="100" /><circle className="run" cx="18" cy="18" r="15.9" pathLength="100" /></svg>
                  <b><span>96<small>SCORE</small></span></b>
                </div>
                <ul className="viz-checks">{CHECKS.map((c, i) => <li key={c} style={{ '--i': i }}><i><Check className="size-4" /></i>{c}</li>)}</ul>
              </div>
              <div><h3>Real checks</h3><p>Numbers, OCR text and file originality are checked the moment you upload.</p></div>
            </article>
            <article data-tilt="translateY(-10px) scale(1.012)" className="lp-panel w3 c-purple rv right" style={{ '--d': 120 }}>
              <span className="tag">No login needed</span>
              <div className="viz">
                <div className="viz-phone">
                  <div className="screen">
                    <span className="notch" />
                    <div className="viz-qr"><QrArt /></div>
                    <span className="viz-ok"><Check className="size-4" /> VERIFIED</span>
                    <span className="text-xs opacity-70">PAN Card · Rahul Sharma</span>
                  </div>
                </div>
              </div>
              <div><h3>QR verification</h3><p>Employers scan the QR to confirm a document is genuine. No calls, no photocopies.</p></div>
            </article>
            <article data-tilt="translateY(-10px) scale(1.012)" className="lp-panel w2 c-cyan rv left">
              <span className="tag">Consent first</span>
              <div className="viz">
                <div className="viz-consent">
                  <div className="req"><b>PV</b><span><b className="block text-sm">Priya (verifier)</b><span className="text-xs opacity-70">asks to see your records</span></span></div>
                  <div className="acts"><span className="yes">Approve 24 h</span><span className="no">Deny</span></div>
                </div>
              </div>
              <div><h3>You decide</h3><p>Verifiers must ask first. Every view is watermarked and logged.</p></div>
            </article>
            <article data-tilt="translateY(-10px) scale(1.012)" className="lp-panel w4 c-purple rv right" style={{ '--d': 120 }}>
              <span className="tag">SHA-256 hash chain</span>
              <div className="viz">
                <div className="viz-chain">
                  {BLOCKS.map(([n, h], i) => (
                    <span key={n} className="contents">
                      <span className="blk" style={{ '--i': i }}><b>{n}</b>{h}</span>
                      {i < BLOCKS.length - 1 && <span className="lnk" style={{ '--i': i }} />}
                    </span>
                  ))}
                </div>
              </div>
              <div><h3>Tamper-evident ledger</h3><p>Every upload and approval is chained. Change one byte of history and the chain breaks.</p></div>
            </article>
          </div>
        </section>

        <StoryScroll />

        <section className="lp-sec lp-center">
          <div className="rv lp-center">
            <span className="lp-eyebrow">The app</span>
            <h2 className="lp-h2" style={{ maxWidth: '18ch' }}>See it before you <span className="lp-neon" style={{ animation: 'shimmer 5s linear infinite' }}>sign up.</span></h2>
            <p className="lp-lead">Your vault at a glance on a laptop, and in your pocket on a phone.</p>
          </div>
          <ProductPreview />
        </section>

        <section className="lp-sec lp-center">
          <span className="lp-eyebrow rv">By the numbers</span>
          <div className="lp-nums w-full">
            {numbers.map(([n, unit, label], i) => (
              <div key={i} className="lp-num rv zoom" style={{ '--d': i * 110 }}>
                <b><CountUp value={n} duration={1600} />{unit && <span className="text-[0.4em] tracking-normal">{unit}</span>}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-sec">
          <div className="rv">
            <span className="lp-eyebrow">How it works</span>
            <h2 className="lp-h2">Three steps. That's it.</h2>
          </div>
          <ol className="lp-steps">
            {STEPS.map(([Icon, title, text, tone], i) => (
              <li key={title} className={`lp-step rv ${tone}`} style={{ '--d': i * 150 }}>
                <span className="no" aria-hidden="true">0{i + 1}</span>
                <span className="ico"><Icon className="size-7" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-sec lp-center" id="tour">
          <div className="rv lp-center">
            <span className="lp-eyebrow">60-second tour</span>
            <h2 className="lp-h2" style={{ maxWidth: '16ch' }}>Watch it <span className="lp-neon" style={{ animation: 'shimmer 5s linear infinite' }}>work.</span></h2>
            <p className="lp-lead">Sign in, upload, automatic checks and QR proof, start to finish.</p>
          </div>
          <div className="rv zoom mt-10 w-full max-w-5xl"><TourVideo /></div>
          <div className="lp-cta rv mt-8"><Link to="/tutorial" className="lp-btn ghost">Step-by-step tutorial <ArrowRight className="size-5" /></Link></div>
        </section>

        <section className="lp-final rv zoom">
          <div className="floor" aria-hidden="true" />
          <ParticleShield className="lp-shield" scale={0.9} />
          <h2 className="lp-h2" style={{ maxWidth: '16ch', marginTop: 0 }}>Stop carrying <span className="lp-neon" style={{ animation: 'shimmer 5s linear infinite' }}>photocopies.</span></h2>
          <p className="lp-lead" style={{ marginTop: 0 }}>Set up takes about 3 minutes. You'll need your phone for Google Authenticator.</p>
          <Link to="/register" className="lp-btn">Get started free <ArrowRight className="size-5" /></Link>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="font-mono text-xs uppercase">TrustVault · AES-256 · SHA-256 ledger · TOTP 2FA</span>
        <span className="flex flex-wrap gap-6 font-semibold">
          {!navigator.userAgent.includes('TrustVaultApp') && <a href="https://github.com/SriNithish-JK/TrustVault/releases/latest/download/TrustVault.apk">Android app</a>}
          <Link to="/tutorial">Tutorial</Link><Link to="/privacy">Privacy policy</Link><Link to="/verify">Public verifier</Link>
        </span>
      </footer>
    </div>
  );
}
