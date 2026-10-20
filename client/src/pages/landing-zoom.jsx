// "How it works" as a camera move: the section pins while the visitor scrolls, and a camera zooms through one
// document's life on a dot-matrix stage. Upload -> checked -> approved automatically -> faculty ask a batch ->
// the student ticks what to share -> faculty open it once. Pattern: sticky stage + scroll-linked timeline (Apple-style
// zoom); background after the Canvas Reveal Effect (Aceternity UI). Reduced motion: the finished overview, no pinning.
// Smoothness: everything that moves every frame is written straight to the DOM from the scroll value; React only
// re-renders when something discrete changes (a tick, a label, the chapter).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { Check, Eye, FileCheck2, KeyRound, Lock, ScanLine, Send, UploadCloud, Users } from 'lucide-react';
import { IdCard } from '@/components/app/id-card';
import { DotMatrix } from '@/lib/dot-matrix';
import { burst } from '@/lib/burst';
import { sfx } from '@/lib/sound';
import '../landing-zoom.css';

// [step of the three, icon, title, text, camera {x, y, zoom} in stage pixels, dot colour]
const CHAPTERS = [
  [1, UploadCloud, 'Upload', 'Drop in a PAN, Aadhaar or marksheet. It is encrypted with AES-256 before it is saved.', [350, 515, 1.25], [25, 230, 255]],
  [2, ScanLine, 'Checked in seconds', 'Number format, checksum, the text on the card, signs of editing and your other documents.', [520, 515, 1.02], [120, 170, 255]],
  [2, FileCheck2, 'Approved automatically', 'Every check passed, so it is verified. No queue, no waiting. Sealed in the ledger.', [350, 515, 1.6], [57, 255, 156]],
  [3, Users, 'Faculty ask', 'A faculty member asks one student, or a whole batch like 26MX, for the documents they need.', [1290, 255, 1.28], [181, 107, 255]],
  [3, KeyRound, 'You approve', 'You tick what to share and leave the rest. Nothing moves without your yes.', [1210, 740, 1.42], [255, 79, 216]],
  [3, Eye, 'Opened once', 'They open each file one time, watermarked and logged. Then it locks.', [860, 525, 0.72], [57, 255, 156]],
];
const STEP_NAMES = ['', 'Upload', 'Get verified', 'Share with faculty'];
const CHECKS = ['Text read (OCR)', 'Number format', 'Checksum', 'No editing traces', 'Matches your other documents'];
const DOCS = ['PAN Card', '10th Marksheet', '12th Marksheet'];
const N = CHAPTERS.length, HOLD = 0.62; // each chapter: 62% animation, then the camera moves on
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const ease = (x) => 1 - (1 - clamp(x)) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The discrete state of the scene at scroll progress p (0..1): only these values re-render React.
function stateAt(p) {
  const t = p * N, k = (i) => clamp((t - i) / HOLD);
  const [k0, k1, k2, k3, k4, k5] = CHAPTERS.map((_, i) => k(i));
  return {
    at: Math.min(N - 1, Math.floor(t)),
    encrypted: k0 > 0.7, verified: k2 > 0.2, sealed: k2 > 0.5,
    checks: CHECKS.filter((_, i) => k1 > 0.15 + i * 0.15).length,
    typed: Math.floor(clamp((k3 - 0.05) / 0.35) * 4), chips: [0, 1, 2].filter((i) => k3 > 0.42 + i * 0.1).length, sent: k3 > 0.8, note: k3 > 0.92,
    ticks: [k4 > 0.2, k4 > 0.38].filter(Boolean).length, press: k4 > 0.55 && k4 <= 0.7, shared: k4 > 0.7,
    viewing: k5 > 0.15, locked: k5 > 0.75,
  };
}

export function ApprovalZoom() {
  const ref = useRef(null);
  const els = useRef({});
  const el = (name) => (node) => { els.current[name] = node; };
  const view = useRef({});
  const size = useRef({ w: 1280, h: 720 });
  const [still] = useState(reduced);
  const [s, setS] = useState(() => stateAt(still ? 1 : 0));
  const key = useRef('');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  // everything continuous, written straight to the DOM
  const apply = useCallback((v) => {
    const p = still ? 1 : v, t = p * N, E = els.current;
    const k = (i) => clamp((t - i) / HOLD);
    const at = Math.min(N - 1, Math.floor(t));
    const f = at === N - 1 ? 0 : smooth((t - at - HOLD) / (1 - HOLD));
    const from = CHAPTERS[at][4], to = CHAPTERS[Math.min(N - 1, at + 1)][4];
    const cx = lerp(from[0], to[0], f), cy = lerp(from[1], to[1], f), z = lerp(from[2], to[2], f);
    // aim at the free area beside the caption (right of it on wide screens, above it on phones)
    const { w, h } = size.current;
    const wide = w >= 900, side = wide ? Math.min(500, w * 0.36) : 0, under = wide ? 0 : 190;
    const vw = w - side, vh = h - under;
    const overview = at === N - 1 ? 1 : at === N - 2 ? f : 0; // phones zoom closer, except for the final overview
    const sc = Math.min(vw / (wide ? 1150 : 900), vh / 720) * z * (wide ? 1 : lerp(1, 0.8, overview));
    const tx = side + vw / 2 - cx * sc, ty = vh / 2 + (wide ? 30 : 10) - cy * sc;
    if (E.world) E.world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sc})`;
    if (E.dots) E.dots.style.transform = `translate3d(${(tx * 0.08) % 20}px, ${(ty * 0.08) % 20}px, 0) scale(${0.9 + 0.1 * z})`;
    view.current.color = CHAPTERS[f > 0.5 ? Math.min(N - 1, at + 1) : at][5];

    const [k0, k1, k3, k4] = [k(0), k(1), k(3), k(4)];
    const drop = ease(k0 * 1.5);
    if (E.drop) E.drop.style.opacity = 1 - drop * 0.85;
    if (E.card) { E.card.style.transform = `translate3d(0, ${(1 - drop) * -320}px, 0) rotate(${(1 - drop) * -14}deg)`; E.card.style.opacity = clamp(k0 * 4); }
    if (E.checks) { E.checks.style.opacity = clamp(k1 * 5); E.checks.style.transform = `translate3d(${(1 - ease(k1 * 2)) * 40}px, 0, 0)`; }
    if (E.score) E.score.textContent = Math.round(100 * clamp((k1 - 0.1) / 0.85));
    if (E.laptop) E.laptop.style.opacity = clamp(k3 * 5 + (k(5) > 0 ? 1 : 0));
    if (E.phone) E.phone.style.opacity = clamp((k3 - 0.75) * 6);
    if (E.wire1) E.wire1.style.strokeDashoffset = 1 - clamp((k3 - 0.8) / 0.2);
    if (E.wire2) E.wire2.style.strokeDashoffset = 1 - clamp((k4 - 0.75) / 0.25);
    E.bars?.forEach((b, i) => b?.style.setProperty('--k', i < at ? 1 : i === at ? clamp(t - i) : 0));

    // while the camera moves, keep the stage on its own GPU layer; drop it when scrolling stops so text re-sharpens
    if (E.world && !still) {
      E.world.classList.add('moving');
      clearTimeout(E.idle);
      E.idle = setTimeout(() => E.world?.classList.remove('moving'), 180);
    }

    const next = stateAt(p), nk = JSON.stringify(next);
    if (nk !== key.current) { key.current = nk; setS(next); }
  }, [still]);

  useMotionValueEvent(scrollYProgress, 'change', apply);
  useLayoutEffect(() => {
    const E = els.current;
    const ro = new ResizeObserver(([e]) => { size.current = { w: e.contentRect.width, h: e.contentRect.height }; apply(scrollYProgress.get()); });
    ro.observe(E.pin);
    return () => { ro.disconnect(); clearTimeout(E.idle); };
  }, [apply, scrollYProgress]);

  // the stamp lands once per pass: burst + sound
  const landed = useRef(false);
  useEffect(() => {
    if (s.verified && !landed.current && !still) { burst(els.current.card, { size: 1.6 }); sfx('success'); }
    landed.current = s.verified;
  }, [s.verified, still]);

  const ch = CHAPTERS[s.at];
  const Icon = ch[1];
  const typed = '26MX'.slice(0, s.typed);
  return (
    <section ref={ref} className={`lz ${still ? 'lz-still' : ''}`} aria-label="How it works, step by step">
      <ol className="sr-only">
        {CHAPTERS.map(([, , title, text]) => <li key={title}>{title}: {text}</li>)}
      </ol>
      <div ref={el('pin')} className="lz-pin" aria-hidden="true">
        <div ref={el('dots')} className="lz-dots"><DotMatrix view={view} /></div>
        <div className="lz-vignette" />

        <div ref={el('world')} className="lz-world">
          {/* 1. upload: the card drops into the vault */}
          <div ref={el('drop')} className="lz-drop"><UploadCloud /> Drop a photo or PDF</div>
          <div ref={el('card')} className="lz-card"><IdCard verified={s.verified} hint={false} /></div>
          <span className={`lz-pill ${s.encrypted ? 'on' : ''}`} style={{ left: 140, top: 680 }}><Lock /> Encrypted · AES-256</span>
          <span className={`lz-pill ok ${s.sealed ? 'on' : ''}`} style={{ left: 140, top: 734 }}><Check /> Sealed in ledger · block #482</span>

          {/* 2. automatic checks */}
          <div ref={el('checks')} className="lz-panel lz-checks">
            <b>Automatic checks</b>
            <ul>{CHECKS.map((c, i) => <li key={c} className={i < s.checks ? 'on' : ''}><i><Check /></i>{c}</li>)}</ul>
            <span className="lz-score"><b ref={el('score')}>0</b>/ 100</span>
          </div>

          {/* 3 + 6. the faculty laptop: ask a batch, later open the shared file once */}
          <div ref={el('laptop')} className="lz-laptop">
            <div className="lz-bar"><i /><i /><i /><span>Student records · Dr. Priya Raman</span></div>
            {!s.viewing ? (
              <div className="lz-ask">
                <small>Ask a whole batch</small>
                <div className="lz-input"><span>{typed}</span><em className={s.typed < 4 && s.at === 3 ? 'caret' : ''} /></div>
                <small className="lz-count">{s.typed === 4 ? '58 students in 26MX' : 'The joining year, then MX'}</small>
                <div className="lz-chips">{DOCS.map((c, i) => <span key={c} className={i < s.chips ? 'on' : ''}><i><Check /></i>{c}</span>)}</div>
                <span className={`lz-btn ${s.sent ? 'done' : ''}`}>{s.sent ? <><Check /> Sent to 58 students</> : <><Send /> Send to all 58 students</>}</span>
              </div>
            ) : (
              <div className="lz-viewer">
                <div className={`lz-doc ${s.locked ? 'lock' : ''}`}><IdCard verified hint={false} /><span className="lz-wm">priya.raman@psgtech · 20 Oct 14:02 · TrustVault</span></div>
                <span className={`lz-badge ${s.locked ? 'lock' : ''}`}>{s.locked ? <><Lock /> Already opened · locked</> : <><Eye /> Opened once · logged</>}</span>
              </div>
            )}
          </div>

          {/* the request travels to the phone, the shared file travels back */}
          <svg className="lz-wires" viewBox="0 0 1800 1000">
            <path ref={el('wire1')} d="M1460 400 C 1460 470, 1300 470, 1250 545" className="lz-wire" pathLength="1" />
            <path ref={el('wire2')} d="M1170 910 C 980 900, 940 520, 1060 330" className="lz-wire back" pathLength="1" />
          </svg>

          {/* 4 + 5. the student's phone */}
          <div ref={el('phone')} className="lz-phone">
            <span className="lz-notch" />
            <div className={`lz-note ${s.note ? 'in' : ''}`}><b>PR</b><span><b>Dr. Priya Raman</b><small>asks for 3 documents · 26MX</small></span></div>
            <div className="lz-rows">{DOCS.map((c, i) => <span key={c} className={i < s.ticks ? 'on' : ''}><i>{i < s.ticks && <Check />}</i>{c}</span>)}</div>
            <span className={`lz-share ${s.shared ? 'done' : ''} ${s.press ? 'press' : ''}`}>{s.shared ? <><Check /> Shared · opens once</> : 'Share 2 of 3'}</span>
            <small className="lz-fine">12th marksheet not shared</small>
          </div>
        </div>

        {/* caption */}
        <div className="lz-hud">
          <span className="lz-step">Step {ch[0]} of 3 · {STEP_NAMES[ch[0]]}</span>
          <h3 key={ch[2]}><Icon className="size-7" /> {ch[2]}</h3>
          <p key={ch[3]}>{ch[3]}</p>
          <div className="lz-progress">{CHAPTERS.map((c, i) => <i key={c[2]} ref={(n) => { (els.current.bars ??= [])[i] = n; }} />)}</div>
        </div>
      </div>
    </section>
  );
}
