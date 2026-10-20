// Dashboard charts drawn in SVG: a status donut and a 14-day activity line. Both animate in.
import { useEffect, useId, useRef, useState } from 'react';
import { store } from '@/lib/theme';
import { burst } from '@/lib/burst';
import { Link } from 'react-router-dom';
import { Check, Clock, KeyRound, Plus, X } from 'lucide-react';

const TONE = { verified: 'var(--success)', pending: '#fbbf24', rejected: 'var(--destructive)', stored: 'var(--info)' };
const NAME = { verified: 'Verified', pending: 'Pending', rejected: 'Rejected', stored: 'Stored' };

// Share of documents in each status. The legend carries the numbers, so colour is never the only cue.
export function StatusDonut({ docs }) {
  const total = docs.length;
  const parts = Object.keys(TONE).map((k) => [k, docs.filter((d) => d.status === k).length]).filter(([, n]) => n > 0);
  const verified = docs.filter((d) => d.status === 'verified').length;
  let offset = 0;
  return (
    <div className="ch-donut">
      <div className="ch-ring" role="img" aria-label={total ? parts.map(([k, n]) => `${n} ${NAME[k]}`).join(', ') : 'No documents yet'}>
        <svg viewBox="0 0 42 42">
          <circle cx="21" cy="21" r="15.9" fill="none" className="stroke-muted" strokeWidth="4.2" />
          {parts.map(([k, n], i) => {
            const len = (n / total) * 100;
            const seg = <circle key={k} cx="21" cy="21" r="15.9" fill="none" stroke={TONE[k]} strokeWidth="4.2" strokeLinecap="round" pathLength="100"
              strokeDasharray={`${Math.max(0.5, len - 2)} ${100 - Math.max(0.5, len - 2)}`} strokeDashoffset={-offset} className="ch-seg" style={{ '--i': i, color: TONE[k] }} />;
            offset += len;
            return seg;
          })}
        </svg>
        <b><em>{total ? Math.round((verified / total) * 100) : 0}<small>%</small></em><span>verified</span></b>
      </div>
      <ul className="ch-legend">
        {Object.keys(TONE).map((k) => {
          const n = docs.filter((d) => d.status === k).length;
          return <li key={k}><i style={{ background: TONE[k], boxShadow: `0 0 12px -1px ${TONE[k]}` }} /><span>{NAME[k]}</span><b>{n}</b></li>;
        })}
      </ul>
    </div>
  );
}

// Events per day for the last `days` days, as a glowing line with a soft fill.
export function ActivityLine({ activity, days = 14 }) {
  const id = useId().replace(/:/g, '');
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * 864e5));
  const counts = dates.map((d) => activity.filter((a) => new Date(a.createdAt).toDateString() === d.toDateString()).length);
  const peak = Math.max(1, ...counts);
  const W = 300, H = 96, pad = 6;
  const pts = counts.map((n, i) => [pad + (i * (W - pad * 2)) / (days - 1), H - pad - (n / peak) * (H - pad * 2)]);
  // smooth curve through the points
  const line = pts.reduce((d, [x, y], i) => {
    if (!i) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, '');
  const total = counts.reduce((a, b) => a + b, 0);
  const [lx, ly] = pts.at(-1);
  return (
    <div className="ch-line" role="img" aria-label={`${total} events in the last ${days} days, busiest day ${peak}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${id}s`} x1="0" x2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="0.6" stopColor="var(--violet)" /><stop offset="1" stopColor="var(--pink)" /></linearGradient>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--violet)" stopOpacity="0.45" /><stop offset="1" stopColor="var(--violet)" stopOpacity="0" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="stroke-border" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
        <path d={`${line} L${lx},${H} L${pts[0][0]},${H} Z`} fill={`url(#${id}f)`} className="ch-fill" />
        <path d={line} fill="none" stroke={`url(#${id}s)`} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength="1" className="ch-path" />
      </svg>
      <span className="ch-dot" style={{ left: `${(lx / W) * 100}%`, top: `${(ly / H) * 100}%` }} />
      <div className="ch-axis"><span>{dates[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><span>Today</span></div>
    </div>
  );
}

// Document progress: PAN, Aadhaar, 10th and 12th are each worth 22 (11 uploaded + 11 verified; the marksheets count fully
// once stored, as they are not verified); the vault PIN is the last 12.
const REQUIRED = [['pan', 'PAN card'], ['aadhaar', 'Aadhaar card'], ['class10', '10th marksheet'], ['class12', '12th marksheet']];
const STATE = {
  verified: ['Verified', 'var(--success)', Check], stored: ['Stored', 'var(--success)', Check], pending: ['Checking', '#fbbf24', Clock], rejected: ['Not verified', 'var(--destructive)', X],
  missing: ['Add it', 'var(--muted)', Plus],
};
export function IdentityRing({ docs, user }) {
  const id = useId().replace(/:/g, '');
  const rows = REQUIRED.map(([type, label]) => {
    const mine = docs.filter((d) => d.type === type);
    // 10th / 12th marksheets are stored without checks: they count as done, but say "Stored", not "Verified"
    const state = mine.some((d) => d.status === 'verified') ? 'verified' : mine.some((d) => d.status === 'stored') ? 'stored' : mine.some((d) => d.status === 'pending') ? 'pending' : mine.length ? 'rejected' : 'missing';
    return { type, label, state, points: state === 'verified' || state === 'stored' ? 22 : state === 'pending' ? 11 : 0 };
  });
  const score = rows.reduce((n, r) => n + r.points, 0) + (user.hasVaultPin ? 12 : 0);
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(score), 60); return () => clearTimeout(t); }, [score]);
  const ring = useRef(null);
  useEffect(() => { // celebrate once, when this browser sees the score climb to 100
    const key = `tv-identity:${user.id}`;
    const before = store.get(key);
    store.set(key, String(score));
    if (score === 100 && before != null && +before < 100) { const t = setTimeout(() => burst(ring.current, { size: 1.6 }), 1300); return () => clearTimeout(t); }
  }, [score, user.id]);
  return (
    <div className="idr">
      <div ref={ring} className="idr-ring" role="img" aria-label={`Identity ${score} percent complete`}>
        <svg viewBox="0 0 42 42">
          <defs><linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="0.6" stopColor="var(--violet)" /><stop offset="1" stopColor="var(--pink)" /></linearGradient></defs>
          <circle cx="21" cy="21" r="17" fill="none" className="stroke-muted" strokeWidth="3.4" />
          <circle className="run" cx="21" cy="21" r="17" fill="none" stroke={`url(#${id})`} strokeWidth="3.4" strokeLinecap="round" pathLength="100" style={{ strokeDashoffset: 100 - shown }} />
        </svg>
        <b><em className="not-italic">{score}<small>%</small></em><span>{score === 100 ? 'complete' : 'identity'}</span></b>
      </div>
      <div className="idr-list">
        {rows.map(({ type, label, state }) => {
          const [text, tone, Icon] = STATE[state];
          const inner = <><i style={{ background: tone, boxShadow: state === 'missing' ? 'none' : `0 0 14px -2px ${tone}` }}><Icon className="size-3.5" /></i>{label}<small>{text}</small></>;
          return state === 'missing' || state === 'rejected' ? <Link key={type} to={`/documents?upload=${type}`}>{inner}</Link> : <div key={type}>{inner}</div>;
        })}
        {user.hasVaultPin
          ? <div><i style={{ background: 'var(--success)', boxShadow: '0 0 14px -2px var(--success)' }}><KeyRound className="size-3.5" /></i>Vault PIN<small>Set</small></div>
          : <Link to="/security"><i style={{ background: 'var(--muted)' }}><KeyRound className="size-3.5" /></i>Vault PIN<small>Set it</small></Link>}
      </div>
    </div>
  );
}
