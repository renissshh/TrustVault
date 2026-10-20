// "How it works" as a camera move: the section pins while the visitor scrolls, and a camera zooms through one
// document's life on a dot-matrix stage. Upload -> checked -> approved automatically -> faculty ask a batch ->
// the student ticks what to share -> faculty open it once. Pattern: sticky stage + scroll-linked timeline (Apple-style
// zoom); background after the Canvas Reveal Effect (Aceternity UI). Reduced motion: the finished overview, no pinning.
import { useEffect, useRef, useState } from 'react';
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
const N = CHAPTERS.length, HOLD = 0.62; // each chapter: 62% animation, then the camera moves on
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const ease = (x) => 1 - (1 - clamp(x)) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ApprovalZoom() {
  const ref = useRef(null);
  const pin = useRef(null);
  const card = useRef(null);
  const view = useRef({});
  const [still] = useState(reduced);
  const [p, setP] = useState(still ? 1 : 0);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => { if (!still) setP(Math.round(v * 1000) / 1000); });
  useEffect(() => {
    const el = pin.current;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const t = p * N;
  const k = (i) => clamp((t - i) / HOLD); // progress of chapter i's own animation
  const at = Math.min(N - 1, Math.floor(t));
  const [k0, k1, k2, k3, k4, k5] = CHAPTERS.map((_, i) => k(i));

  // camera: hold on chapter i, then glide (and zoom) to chapter i + 1
  const from = CHAPTERS[at][4], to = CHAPTERS[Math.min(N - 1, at + 1)][4];
  const f = at === N - 1 ? 0 : smooth((t - at - HOLD) / (1 - HOLD));
  const cx = lerp(from[0], to[0], f), cy = lerp(from[1], to[1], f), z = lerp(from[2], to[2], f);
  // aim at the free area beside the caption (right of it on wide screens, above it on phones)
  const wide = size.w >= 900, side = wide ? Math.min(500, size.w * 0.36) : 0, under = wide ? 0 : 190;
  const vw = size.w - side, vh = size.h - under;
  const overview = at === N - 1 ? 1 : at === N - 2 ? f : 0; // phones zoom closer, except for the final overview
  const s = Math.min(vw / (wide ? 1150 : 900), vh / 720) * z * (wide ? 1 : lerp(1, 0.8, overview));
  const world = { transform: `translate(${side + vw / 2 - cx * s}px, ${vh / 2 + (wide ? 30 : 10) - cy * s}px) scale(${s})` };
  view.current = { color: CHAPTERS[f > 0.5 ? Math.min(N - 1, at + 1) : at][5], zoom: z, x: -cx * s, y: -cy * s };

  // the stamp lands once per pass: burst + sound
  const verified = k2 > 0.2;
  const landed = useRef(false);
  useEffect(() => {
    if (verified && !landed.current && !still) {
      burst(card.current, { size: 1.6 });
      sfx('success');
    }
    landed.current = verified;
  }, [verified, still]);

  const drop = ease(k0 * 1.5);
  const typed = '26MX'.slice(0, Math.floor(clamp((k3 - 0.05) / 0.35) * 4));
  const chips = (i) => k3 > 0.42 + i * 0.1;
  const sent = k3 > 0.8;
  const ticks = [k4 > 0.2, k4 > 0.38, false]; // the 12th marksheet stays unticked: "share 2 of 3"
  const shared = k4 > 0.7;
  const viewing = k5 > 0.15, locked = k5 > 0.75;
  const ch = CHAPTERS[at];
  const Icon = ch[1];

  return (
    <section ref={ref} className={`lz ${still ? 'lz-still' : ''}`} aria-label="How it works, step by step">
      <ol className="sr-only">
        {CHAPTERS.map(([, , title, text]) => <li key={title}>{title}: {text}</li>)}
      </ol>
      <div ref={pin} className="lz-pin" aria-hidden="true">
        <DotMatrix view={view} className="lz-dots" />
        <div className="lz-vignette" />

        <div className="lz-world" style={world}>
          {/* 1. upload: the card drops into the vault */}
          <div className="lz-drop" style={{ opacity: 1 - drop * 0.85 }}><UploadCloud /> Drop a photo or PDF</div>
          <div ref={card} className="lz-card" style={{ transform: `translateY(${(1 - drop) * -320}px) rotate(${(1 - drop) * -14}deg)`, opacity: clamp(k0 * 4) }}>
            <IdCard verified={verified} hint={false} />
          </div>
          <span className={`lz-pill ${k0 > 0.7 ? 'on' : ''}`} style={{ left: 140, top: 680 }}><Lock /> Encrypted · AES-256</span>
          <span className={`lz-pill ok ${k2 > 0.5 ? 'on' : ''}`} style={{ left: 140, top: 734 }}><Check /> Sealed in ledger · block #482</span>

          {/* 2. automatic checks */}
          <div className="lz-panel lz-checks" style={{ opacity: clamp(k1 * 5), transform: `translateX(${(1 - ease(k1 * 2)) * 40}px)` }}>
            <b>Automatic checks</b>
            <ul>
              {CHECKS.map((c, i) => <li key={c} className={k1 > 0.15 + i * 0.15 ? 'on' : ''}><i><Check /></i>{c}</li>)}
            </ul>
            <span className="lz-score"><b>{Math.round(100 * clamp((k1 - 0.1) / 0.85))}</b>/ 100</span>
          </div>

          {/* 3 + 6. the faculty laptop: ask a batch, later open the shared file once */}
          <div className="lz-laptop" style={{ opacity: clamp(k3 * 5 + (k5 > 0 ? 1 : 0)) }}>
            <div className="lz-bar"><i /><i /><i /><span>Student records · Dr. Priya Raman</span></div>
            {!viewing ? (
              <div className="lz-ask">
                <small>Ask a whole batch</small>
                <div className="lz-input"><span>{typed}</span><em className={typed.length < 4 && k3 > 0 ? 'caret' : ''} /></div>
                <small className="lz-count">{typed.length === 4 ? '58 students in 26MX' : 'The joining year, then MX'}</small>
                <div className="lz-chips">{['PAN Card', '10th Marksheet', '12th Marksheet'].map((c, i) => <span key={c} className={chips(i) ? 'on' : ''}><i><Check /></i>{c}</span>)}</div>
                <span className={`lz-btn ${sent ? 'done' : ''}`}>{sent ? <><Check /> Sent to 58 students</> : <><Send /> Send to all 58 students</>}</span>
              </div>
            ) : (
              <div className="lz-viewer">
                <div className="lz-doc"><IdCard verified hint={false} /><span className="lz-wm">priya.raman@psgtech · 20 Oct 14:02 · TrustVault</span></div>
                <span className={`lz-badge ${locked ? 'lock' : ''}`}>{locked ? <><Lock /> Already opened · locked</> : <><Eye /> Opened once · logged</>}</span>
              </div>
            )}
          </div>

          {/* the request travels to the phone, the shared file travels back */}
          <svg className="lz-wires" viewBox="0 0 1800 1000">
            <path d="M1460 400 C 1460 470, 1300 470, 1250 545" className="lz-wire" style={{ strokeDashoffset: 1 - clamp((k3 - 0.8) / 0.2) }} pathLength="1" />
            <path d="M1170 910 C 980 900, 940 520, 1060 330" className="lz-wire back" style={{ strokeDashoffset: 1 - clamp((k4 - 0.75) / 0.25) }} pathLength="1" />
          </svg>

          {/* 4 + 5. the student's phone */}
          <div className="lz-phone" style={{ opacity: clamp((k3 - 0.75) * 6) }}>
            <span className="lz-notch" />
            <div className={`lz-note ${k3 > 0.92 ? 'in' : ''}`}><b>PR</b><span><b>Dr. Priya Raman</b><small>asks for 3 documents · 26MX</small></span></div>
            <div className="lz-rows">
              {['PAN Card', '10th Marksheet', '12th Marksheet'].map((c, i) => <span key={c} className={ticks[i] ? 'on' : ''}><i>{ticks[i] && <Check />}</i>{c}</span>)}
            </div>
            <span className={`lz-share ${shared ? 'done' : ''} ${k4 > 0.55 && !shared ? 'press' : ''}`}>{shared ? <><Check /> Shared · opens once</> : 'Share 2 of 3'}</span>
            <small className="lz-fine">12th marksheet not shared</small>
          </div>
        </div>

        {/* caption */}
        <div className="lz-hud">
          <span className="lz-step">Step {ch[0]} of 3 · {STEP_NAMES[ch[0]]}</span>
          <h3 key={ch[2]}><Icon className="size-7" /> {ch[2]}</h3>
          <p key={ch[3]}>{ch[3]}</p>
          <div className="lz-progress">{CHAPTERS.map((c, i) => <i key={c[2]} style={{ '--k': i < at ? 1 : i === at ? clamp((t - i) / 1) : 0 }} />)}</div>
        </div>
      </div>
    </section>
  );
}
