// 3D document wallet: every document is a glowing card. Click a card behind to bring it forward,
// click the front card to flip it to see its status.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FolderLock, Plus, RotateCw, ShieldCheck, XCircle } from 'lucide-react';
import { fmtDay, TYPE_LABELS } from '@/lib/api';
import { sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';

const ISSUER = { pan: 'Income Tax Department', aadhaar: 'Aadhaar · UIDAI', license: 'Driving Licence', class10: 'School Board · 10th', class12: 'School Board · 12th', marksheet: 'Academic Record', certificate: 'Certificate', other: 'Personal Document' };
const STATUS = { verified: [ShieldCheck, 'Verified'], pending: [Clock, 'Checking'], rejected: [XCircle, 'Not verified'], stored: [FolderLock, 'Stored'] };

function Back({ doc }) {
  return (
    <div className="wl-face wl-back">
      {doc.status === 'verified' ? <>
        <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-success/15 text-success"><ShieldCheck className="size-10" /></span>
        <div className="grid gap-1"><b>Verified automatically</b><small>Every check passed. The decision is sealed in the tamper-evident ledger.</small></div>
      </> : (
        <div className="grid gap-2">
          <b className="text-lg">{STATUS[doc.status][1]}</b>
          <small>{doc.status === 'pending' ? 'Being checked now. Verified automatically if every check passes.' : doc.status === 'rejected' ? (doc.reviewNote || 'Upload a clearer copy.') : 'Kept safely - not sent for official verification.'}</small>
          {doc.autoCheck?.score != null && <span className="font-mono text-xs">Automatic checks {doc.autoCheck.score}% passed</span>}
        </div>
      )}
    </div>
  );
}

export function Wallet({ docs, holder }) {
  const cards = docs.slice(0, 5);
  const [active, setActive] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const ref = useRef(null);

  // tilt toward the pointer
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--tx', `${((e.clientX - r.left) / r.width - 0.5) * 22}deg`);
    ref.current.style.setProperty('--ty', `${((e.clientY - r.top) / r.height - 0.5) * -16}deg`);
  };
  const onLeave = () => { ref.current.style.setProperty('--tx', '0deg'); ref.current.style.setProperty('--ty', '0deg'); };

  if (!cards.length) {
    return (
      <Link to="/documents?upload=pan" className="wl-empty" data-tour="wallet">
        <span className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-primary to-violet text-ink shadow-glow"><Plus className="size-7" /></span>
        <b>Your first card goes here</b>
        <small>Upload a PAN or Aadhaar to start your wallet</small>
      </Link>
    );
  }

  const order = cards.map((_, i) => (i - active + cards.length) % cards.length); // 0 = front
  const pick = (i) => {
    sfx(i === active ? 'open' : 'tick');
    if (i === active) setFlipped((f) => !f); else { setActive(i); setFlipped(false); }
  };

  return (
    <div className="wl" ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} data-tour="wallet">
      <div className="wl-stack">
        {cards.map((d, i) => {
          const depth = order[i];
          const [Icon, label] = STATUS[d.status];
          const front = depth === 0;
          return (
            <button key={d.id} type="button" className={cn('wl-card', `wl-${d.type}`, front && 'front', front && flipped && 'flipped')} style={{ '--z': depth, zIndex: cards.length - depth }}
              onClick={() => pick(i)} aria-label={`${d.title}, ${label}. ${front ? (flipped ? 'Flip to the front' : 'Flip to see the back') : 'Bring to the front'}`}>
              <span className="wl-inner">
                <span className="wl-face wl-front">
                  <span className="wl-sheen" aria-hidden="true" />
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase">{ISSUER[d.type]}</span>
                    <span className={cn('wl-status', d.status)}><Icon className="size-3" /> {label}</span>
                  </span>
                  <span className="wl-chip" aria-hidden="true" />
                  <span className="font-mono text-[clamp(17px,2vw,24px)] leading-none font-semibold tracking-wider">{d.numberMasked || TYPE_LABELS[d.type].toUpperCase()}</span>
                  <span className="flex items-end justify-between gap-2 text-left text-[11px]">
                    <span><small className="block opacity-70">Holder</small>{holder}</span>
                    <span className="text-right"><small className="block opacity-70">{d.title}</small>{fmtDay(d.createdAt)}</span>
                  </span>
                </span>
                <Back doc={d} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="wl-hint"><RotateCw className="size-3.5" /> Click the front card to flip it · click a card behind to bring it forward</p>
    </div>
  );
}
