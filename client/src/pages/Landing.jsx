// Landing page: Apple-clean layout on a dark neon stage. Styles live in ../landing.css.
// The page is fully visible without scripts; the effect below only adds motion (scroll reveals,
// cursor light, card tilt, the sentence that lights up as you scroll).
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, Fingerprint, Lock, ScanLine, ShieldCheck, UploadCloud } from 'lucide-react';
import { api } from '@/lib/api';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/account';
import { useAsync, CountUp } from '@/components/app/kit';
import { SoundToggle } from '@/components/app/fx-global';
import { VaultIntro, TryDemo, ProductPreview } from './landing-extras';
import { LiveShowreel } from '@/components/app/live-showreel';
import { ParticleShield } from '@/lib/motion-kit';
import { StoryScroll } from './landing-story';
import { ApprovalZoom } from './landing-zoom';
import { HeroCard } from './landing-hero';
import { CheckHeadline } from './landing-headline';

// three.js is large, so the 3D vault loads on its own after the page. React caches a failed lazy load,
// so a retry needs a fresh lazy component; the failure view offers one.
const Failed3D = ({ onRetry }) => (
  <div className="lp-3d-wait" role="status">
    <p>The 3D view did not load. <button type="button" className="lp-btn ghost sm" onClick={onRetry}>Try again</button></p>
  </div>
);
const load3D = () => lazy(() => import('@/components/ui/trustvault-3d').catch(() => ({ default: Failed3D })));
import '../landing-story.css';
import '../landing.css';

const STANDARDS = ['AES-256-GCM', 'SHA-256 ledger', 'TOTP · RFC 6238', 'Verhoeff checksum', 'Tesseract OCR', 'Have I Been Pwned', 'DPDP Act 2023', 'WCAG accessible'];
const SAY = 'Encrypted before it is saved. Checked in seconds. Proven with one scan.'.split(' ');
const HI = ['Encrypted', 'Checked', 'Proven'];
const CHECKS = ['PAN format and checksum', 'Number matches the card', 'Text readable by OCR', 'No editing traces'];
const BLOCKS = [['#41', 'a3f7…9c'], ['#42', '0b9e…41'], ['#43', '44d2…e7'], ['#44', 'c6a1…0f']];
const STEPS = [
  [UploadCloud, 'Upload', 'Add your PAN, Aadhaar, licence, marksheets or any document - photo or PDF. It is encrypted before it touches the disk.', 'c-cyan'],
  [BadgeCheck, 'Get verified', 'Format, checksum, the text on the card, signs of editing and your other documents are checked in seconds. Pass them all and it is verified.', 'c-purple'],
  [ScanLine, 'Share with faculty', 'Faculty ask for what they need. You tick what to share, and each file opens one time.', 'c-hot'],
];
const HEX = '0123456789abcdef';
const scramble = (n) => Array.from({ length: n }, (_, i) => (i % 5 === 4 ? ' ' : HEX[(Math.random() * 16) | 0])).join('');

// Side chips that fill the wide-screen margins beside the headline.
const SIDES = [
  [BadgeCheck, 'PAN Card', 'verified · 96%', 'c-green'], [Lock, 'Aadhaar', 'masked · encrypted', 'c-cyan'], [ScanLine, 'Marksheet', 'OCR passed', 'c-purple'],
  [ScanLine, 'Checks passed', 'verified automatically', 'c-hot'], [ShieldCheck, 'Access approved', 'for 24 hours', 'c-green'], [Fingerprint, '2FA code', 'accepted', 'c-cyan'],
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
    // the hero card slides away to the left once its centre scrolls above 42% of the screen (and back on the way up)
    const scene = el.querySelector('.lp-scene');
    const fly = el.querySelector('.lp-fly');
    const onScrollAll = () => {
      onScroll();
      if (!fly || reduce) return;
      const r = scene.getBoundingClientRect();
      const mid = r.top + r.height * 0.46; // .lp-stack sits at top: 46%
      fly.style.setProperty('--exit', Math.min(1, Math.max(0, (innerHeight * 0.42 - mid) / (innerHeight * 0.55))).toFixed(3));
    };
    onScrollAll();
    addEventListener('scroll', onScrollAll, { passive: true });

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

    return () => { io.disconnect(); mo.disconnect(); clearTimeout(safety); removeEventListener('scroll', onScrollAll); removeEventListener('pointermove', onMove); el.classList.remove('js'); };
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


// three.js needs WebGL 2; without it the page simply starts with the hero.
function hasWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
}

// First screen: the document's journey as a 3D machine (copy above it on phones, beside it on wide screens).
function Vault3D() {
  const [ok] = useState(hasWebGL);
  const [TrustVault3D, setTrustVault3D] = useState(load3D);
  if (!ok) return null;
  return (
    <section className="lp-3d" aria-labelledby="lp-3d-title">
      <div className="lp-3d-copy">
        <span className="lp-eyebrow lp-in">Live 3D · 7 stations · 1 chain</span>
        <CheckHeadline id="lp-3d-title" />
        <p className="lp-in" style={{ animationDelay: '0.2s' }}>
          A document passes the sign-in gate, upload, the encrypted vault, the automatic checks and a person&apos;s approval, then gets a QR proof,
          while the ledger chains every step. Drag to turn it, or pick <b>Top</b> or <b>One document</b> below.
        </p>
        <Link to="/register" className="lp-btn lp-in" style={{ animationDelay: '0.3s' }}>Create free account <ArrowRight className="size-5" /></Link>
      </div>
      <div className="lp-3d-stage">
        <Suspense fallback={<div className="lp-3d-wait" aria-hidden="true"><i /></div>}>
          <TrustVault3D embed height="100%" onRetry={() => setTrustVault3D(() => load3D())} />
        </Suspense>
      </div>
    </section>
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
    live ? [stats.data.verified, '', 'verified automatically'] : [0, '', 'files stored unencrypted'],
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
          <Link to="/tutorial" className="lp-btn ghost sm lp-wide">How it works</Link>
          <SoundToggle />
          <ThemeToggle />
          <Link to="/login" className="lp-btn sm">Sign in</Link>
        </nav>
      </header>

      <main>
        <Vault3D />

        <section className="lp-hero">
          <span className="lp-chip lp-in"><i />Digital identity, verified</span>
          <HeroTitle />
          <p className="lp-sub">TrustVault keeps your identity and academic documents in an encrypted vault, checks them in seconds, and shares them with faculty only when you say so.</p>
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
            <HeroCard />
            <div className="lp-sat s1"><b><Lock className="size-5" /></b><span>AES-256 encrypted</span></div>
            <div className="lp-sat s2"><b><ShieldCheck className="size-5" /></b><span>Faculty see it once</span></div>
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

        <section className="lp-sec">
          <div className="rv">
            <span className="lp-eyebrow">How it works</span>
            <h2 className="lp-h2">Three steps. That's it.</h2>
          </div>
          <ApprovalZoom />
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
              <span className="tag">Whole batch at once</span>
              <div className="viz">
                <div className="viz-phone">
                  <div className="screen">
                    <span className="notch" />
                    <span className="viz-batch">26MX</span>
                    <span className="text-xs opacity-80">PAN · 10th · 12th</span>
                    <span className="viz-ok"><Check className="size-4" /> Sent to the batch</span>
                    <span className="text-xs opacity-70">Each student decides</span>
                  </div>
                </div>
              </div>
              <div><h3>Batch requests</h3><p>Faculty type a batch like 26MX, tick the documents, and every student in it gets the request.</p></div>
            </article>
            <article data-tilt="translateY(-10px) scale(1.012)" className="lp-panel w2 c-cyan rv left">
              <span className="tag">Consent first</span>
              <div className="viz">
                <div className="viz-consent">
                  <div className="req"><b>PV</b><span><b className="block text-sm">Priya (faculty)</b><span className="text-xs opacity-70">asks for your PAN and 10th</span></span></div>
                  <div className="acts"><span className="yes">Share once</span><span className="no">Deny</span></div>
                </div>
              </div>
              <div><h3>You decide</h3><p>Faculty must ask first. You choose the files, each opens once, watermarked and logged.</p></div>
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


        <section className="lp-sec lp-center" id="showreel">
          <div className="rv lp-center">
            <span className="lp-eyebrow">The showreel</span>
            <h2 className="lp-h2" style={{ maxWidth: '16ch' }}>24 seconds. <span className="lp-neon" style={{ animation: 'shimmer 5s linear infinite' }}>All of it.</span></h2>
            <p className="lp-lead">Three locks, automatic checks, a whole batch asked at once, files that open once, and a ledger that tells you if anything changed.</p>
          </div>
          <div className="rv zoom mt-10 w-full max-w-5xl"><LiveShowreel /></div>
          <div className="lp-cta rv mt-8"><Link to="/tutorial" className="lp-btn ghost">Full 60-second tour and tutorial <ArrowRight className="size-5" /></Link></div>
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
          <Link to="/tutorial">Tutorial</Link><Link to="/privacy">Privacy policy</Link>
        </span>
      </footer>
    </div>
  );
}
