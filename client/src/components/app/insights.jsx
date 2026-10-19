// After sign-in: "while you were away" (what changed since the last visit) and the one next best step.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Eye, KeyRound, LifeBuoy, Link2, PartyPopper, ShieldAlert, ShieldCheck, Sparkles, Upload, Users, X, XCircle } from 'lucide-react';
import { fmtDate } from '@/lib/api';
import { store } from '@/lib/theme';
import { Button } from '@/components/ui/button';

// ---------- While you were away ----------
// [action test, icon, sentence builder, link]
const AWAY = [
  [(a) => a.action === 'document.verified', BadgeCheck, (n) => `${n} document${n > 1 ? 's were' : ' was'} verified`, '/documents', 'var(--success)'],
  [(a) => a.action === 'document.rejected', XCircle, (n) => `${n} document${n > 1 ? 's were' : ' was'} rejected`, '/documents', 'var(--destructive)'],
  [(a) => a.action === 'access.request', KeyRound, (n) => `${n} faculty request${n > 1 ? 's' : ''} for your documents`, '/access', '#fbbf24'],
  [(a) => a.action === 'record.view' || a.action === 'record.open', Eye, (n) => `Your records were opened ${n} time${n > 1 ? 's' : ''}`, '/activity', 'var(--info)'],
  [(a) => a.action === 'share.view', Link2, (n) => `Your shared links were opened ${n} time${n > 1 ? 's' : ''}`, '/shares', 'var(--violet)'],
  [(a) => a.action === 'login.failed', ShieldAlert, (n) => `${n} failed sign-in attempt${n > 1 ? 's' : ''}`, '/activity', 'var(--destructive)'],
];

export function AwayCard({ activity, user }) {
  const key = `tv-away:${user.id}`;
  const [since] = useState(() => Number(store.get(key)) || 0);
  const [open, setOpen] = useState(true);
  const rows = useMemo(() => {
    if (!since) return [];
    const fresh = activity.filter((a) => new Date(a.createdAt) > since);
    return AWAY.map(([test, icon, text, to, tone]) => [fresh.filter(test).length, icon, text, to, tone]).filter(([n]) => n > 0);
  }, [activity, since]);

  // the next visit counts from when this one ends (or from now, the very first time)
  useEffect(() => {
    if (!since) store.set(key, String(Date.now()));
    return () => store.set(key, String(Date.now()));
  }, [key, since]);

  if (!open || !rows.length) return null;
  return (
    <section className="away" aria-label="While you were away">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="flex items-center gap-2 font-mono text-xs font-semibold tracking-widest text-primary uppercase"><Sparkles className="size-4" /> While you were away</span>
          <p className="mt-1 text-sm text-muted-foreground">Since {fmtDate(since)}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss" className="grid size-8 place-items-center rounded-full border border-border transition-transform duration-200 hover:rotate-90"><X className="size-4" /></button>
      </div>
      <ul className="away-list">
        {rows.map(([n, Icon, text, to, tone], i) => (
          <li key={to + i} style={{ '--i': i, '--c': tone }}>
            <Link to={to}><span className="away-icon"><Icon className="size-5" /></span><b>{text(n)}</b><ArrowRight className="ml-auto size-4 opacity-60" /></Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Next best step: the single most useful thing to do now ----------
export function nextStep({ user, docs, pendingAccess }) {
  const has = (t) => docs.some((d) => d.type === t);
  const rejected = docs.find((d) => d.status === 'rejected');
  const verified = docs.find((d) => d.status === 'verified');
  if (!user.hasVaultPin) return [KeyRound, 'Set your vault PIN', 'It protects every view, share and export. It takes one minute.', '/security', 'Set it up'];
  if (user.role === 'verifier') return [Users, 'Ask a batch for documents', 'Type a batch like 26MX, tick the documents, and every student in it is asked. Each student decides.', '/records', 'Student records'];
  if (user.role === 'admin') return [ShieldCheck, 'Check the college at a glance', 'Every faculty request and answer, user roles, the ledger and the audit log.', '/admin', 'Admin console'];
  if (pendingAccess > 0) return [KeyRound, `Answer ${pendingAccess} access request${pendingAccess > 1 ? 's' : ''}`, 'A faculty member is waiting for your permission to see your records.', '/access', 'Review'];
  if (rejected) return [XCircle, `Replace "${rejected.title}"`, `${rejected.reviewNote || 'It did not pass the automatic checks.'} Upload a clearer copy.`, `/documents?upload=${rejected.type}`, 'Upload again'];
  if (!docs.length) return [Upload, 'Upload your first document', 'Start with your PAN or Aadhaar. It is encrypted and checked in seconds.', '/documents?upload=pan', 'Upload'];
  if (!has('pan')) return [Upload, 'Add your PAN card', 'It is one of the four documents on your checklist.', '/documents?upload=pan', 'Upload'];
  if (!has('aadhaar')) return [Upload, 'Add your Aadhaar card', 'Use a masked Aadhaar with only the last 4 digits showing.', '/documents?upload=aadhaar', 'Upload'];
  if (!has('class10')) return [Upload, 'Add your 10th marksheet', 'Faculty often ask for it. It is stored as it is.', '/documents?upload=class10', 'Upload'];
  if (!has('class12')) return [Upload, 'Add your 12th marksheet', 'Faculty often ask for it. It is stored as it is.', '/documents?upload=class12', 'Upload'];
  if (user.backupCodesLeft < 4) return [LifeBuoy, 'Get new backup codes', `Only ${user.backupCodesLeft} left. They sign you in if you lose your phone.`, '/security', 'Open security'];
  if (verified) return [Link2, `Share "${verified.title}"`, 'It is verified. Send a time-limited link instead of a photocopy.', '/documents', 'Open vault'];
  return [PartyPopper, 'You are all set', 'Everything is uploaded and protected. Faculty can ask you for documents when they need them.', '/documents', 'Open vault'];
}

export function NextStep(props) {
  const [Icon, title, text, to, cta] = nextStep(props);
  return (
    <section className="ns" data-spot aria-label="Next best step">
      <span className="ns-icon"><Icon className="size-7" /></span>
      <div className="grid gap-1">
        <span className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">Next best step</span>
        <h2 className="text-2xl leading-tight font-extrabold">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <Button asChild size="lg" className="sm:ml-auto"><Link to={to}>{cta} <ArrowRight /></Link></Button>
    </section>
  );
}
