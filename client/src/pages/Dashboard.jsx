import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Upload, FolderLock, Monitor, ChevronRight, FileLock2, Check, ArrowRight, Users, GraduationCap, ShieldCheck, History } from 'lucide-react';
import { api, fmtDate, actionLabel, cleanDetail, firstName } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Aurora, Words } from '@/lib/fx';
import { useVerifiedCelebration } from '@/lib/confetti';
import { Wallet } from '@/components/app/wallet';
import { StatusDonut, ActivityLine, IdentityRing } from '@/components/app/charts';
import { AwayCard, NextStep } from '@/components/app/insights';
import { useAsync, StatusBadge, DocStatus, friendlyIp, Stat, Callout, EmptyState, ago, toast } from '@/components/app/kit';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
};

// Same device + place signed in many times -> one row with a count.
function groupSessions(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const key = `${s.device}|${s.location}`;
    const g = groups.get(key);
    if (g) { g.count += 1; g.current ||= s.current; } else groups.set(key, { ...s, count: 1 });
  }
  return [...groups.values()].slice(0, 3);
}

function SetupChecklist({ user, docs }) {
  const has = (...types) => docs.some((d) => types.includes(d.type));
  const steps = [
    ['Create your account & Google Authenticator', true, null],
    ['Set your 6-digit vault PIN', user.hasVaultPin, '/security'],
    ['Upload your PAN card', has('pan'), '/documents?upload=pan'],
    ['Upload your Aadhaar card', has('aadhaar'), '/documents?upload=aadhaar'],
    ['Upload your 10th and 12th marksheets', has('class10') && has('class12'), '/documents?upload=class10'],
    ['Get a document verified', docs.some((d) => d.status === 'verified'), null],
  ];
  const done = steps.filter((s) => s[1]).length;
  if (done === steps.length) return null;
  const left = steps.length - done;
  return (
    <Card className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center md:gap-8">
      <div className="grid size-28 animate-float place-items-center rounded-3xl bg-linear-to-br from-violet to-primary text-ink shadow-glow">
        <span className="text-center leading-none"><b className="block font-mono text-4xl font-semibold">{Math.round((done / steps.length) * 100)}%</b><small className="font-mono text-[11px] uppercase">set up</small></span>
      </div>
      <div className="grid gap-3">
        <div>
          <h2 className="text-2xl">Finish setting up your vault</h2>
          <p className="text-sm text-muted-foreground">{left} quick step{left > 1 ? 's' : ''} left. Each one takes under a minute.</p>
        </div>
        <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {steps.map(([label, ok, to], n) => (
            <li key={label} className="flex items-center gap-2">
              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold', ok ? 'bg-success text-ink' : 'border border-border bg-card')}>{ok ? <Check className="size-3" /> : n + 1}</span>
              {!ok && to
                ? <Link to={to} className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">{label} <ArrowRight className="size-3.5" /></Link>
                : <span className={ok ? 'text-muted-foreground line-through' : undefined}>{label}</span>}
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

// Last event, a 7-day bar chart, and a tap opens the full timeline.
function ActivityTeaser({ activity }) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 864e5));
  const perDay = days.map((d) => activity.filter((a) => new Date(a.createdAt).toDateString() === d.toDateString()).length);
  const peak = Math.max(1, ...perDay);
  const week = perDay.reduce((a, b) => a + b, 0);
  const last = activity[0];
  return (
    <Link to="/activity" data-spot className="group grid gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-brutal transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-primary/40 hover:shadow-brutal-lg" aria-label="Open your full activity timeline">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">Activity this week</h2>
          <p className="text-sm text-muted-foreground" title={last ? cleanDetail(last.detail) : undefined}>{last ? <>Last: {actionLabel(last.action)} · {ago(last.createdAt)}</> : 'Nothing recorded yet'}</p>
        </div>
        <b className="text-gradient font-mono text-4xl leading-none font-semibold">{week}</b>
      </div>
      <div className="flex h-16 items-end gap-1.5" role="img" aria-label={`${week} events in the last 7 days`}>
        {perDay.map((n, i) => (
          <span key={days[i].toDateString()} className="grid flex-1 gap-1">
            <i className="block origin-bottom animate-[grow_0.7s_var(--ease-spring)_both] rounded-t-md bg-linear-to-t from-primary to-violet" style={{ height: `${Math.max(4, (n / peak) * 44)}px`, animationDelay: `${i * 70}ms` }} />
            <small className="text-center font-mono text-[10px] uppercase opacity-70">{days[i].toLocaleDateString(undefined, { weekday: 'narrow' })}</small>
          </span>
        ))}
      </div>
      <span className="flex items-center gap-1 text-sm font-semibold">Open full timeline <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
    </Link>
  );
}

export default function Dashboard() {
  const { user, pendingAccess, expiresAt } = useAuth();
  const staff = user.role !== 'student';
  const { data, loading, reload } = useAsync(() => Promise.all([
    api('/documents'),
    api('/auth/sessions'),
    api('/auth/activity'),
    staff ? api('/admin/stats') : null,
  ]));
  const [docs = [], sessions = [], activity = [], stats] = data ?? [];
  const count = (s) => docs.filter((d) => d.status === s).length;
  const first = firstName(user.name);
  const minutesLeft = Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 60e3));
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  useEffect(() => { window.addEventListener('tv-live', reload); return () => window.removeEventListener('tv-live', reload); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useVerifiedCelebration(data?.[0], user.id, (fresh) => toast(`${fresh[0].title} was verified.`));

  return (
    <div className="grid gap-6">
      <section data-tour="hero" className="neon-ring relative grid items-center gap-10 overflow-hidden rounded-[2rem] border border-primary/30 bg-card/70 p-6 shadow-brutal-lg sm:p-10 xl:grid-cols-[1.15fr_1fr]">
        <Aurora />
        <div className="relative grid gap-5">
        <span className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">{today}</span>
        <h1 className="text-5xl leading-[0.98] font-extrabold sm:text-7xl"><Words text={`${greeting()},`} /><br /><Words text={`${first}.`} className="text-gradient" delay={0.2} /></h1>
        <p className="max-w-2xl font-medium text-muted-foreground [&_b]:text-foreground">
          {loading ? 'Opening your vault…' : staff && stats ? <>
            <b>{stats.users.student ?? 0}</b> students · <b>{stats.documents.verified ?? 0}</b> documents verified across the college · secure session {minutesLeft} min left
          </> : <>
            <b>{docs.length}</b> document{docs.length === 1 ? '' : 's'} in your vault · <b>{count('verified')}</b> verified
            {count('pending') > 0 && <> · <b>{count('pending')}</b> being checked</>} · secure session {minutesLeft} min left
          </>}
        </p>
        <div className="flex flex-wrap gap-3">
          {user.role === 'verifier' ? <>
            <Button asChild size="lg"><Link to="/records"><Users /> Ask a batch</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/records"><GraduationCap /> Student records</Link></Button>
          </> : user.role === 'admin' ? <>
            <Button asChild size="lg"><Link to="/admin"><ShieldCheck /> Admin console</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/activity"><History /> Activity log</Link></Button>
          </> : <>
            <Button asChild size="lg" data-tour="upload"><Link to="/documents?upload=pan"><Upload /> Upload document</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/documents"><FolderLock /> Open vault</Link></Button>
          </>}
        </div>
        </div>
        <div className="relative" data-tilt="">{!loading && <Wallet docs={docs} holder={user.name.toUpperCase()} />}</div>
      </section>

      {!loading && <AwayCard activity={activity} user={user} />}
      {!loading && <NextStep user={user} docs={docs} pendingAccess={pendingAccess} />}

      {pendingAccess > 0 && (
        <Callout tone="info" className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2"><KeyRound className="size-4" /> {pendingAccess} faculty request(s) waiting for your answer.</span>
          <Button asChild size="sm" variant="secondary"><Link to="/access">Review requests</Link></Button>
        </Callout>
      )}

      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Verified documents" value={count('verified')} tone="green" />
        <Stat label="Being checked" value={count('pending')} tone="amber" style={{ '--i': 1 }} />
        <Stat label="Not verified" value={count('rejected')} tone={count('rejected') ? 'red' : 'card'} style={{ '--i': 2 }} />
        <Stat label="In your vault" value={docs.length} tone="violet" style={{ '--i': 3 }} />
        {staff && stats && <Stat label="Verified across the college" value={stats.documents.verified ?? 0} tone="sky" style={{ '--i': 4 }} />}
        {staff && stats && <Stat label="Students registered" value={stats.users.student ?? 0} tone="ink" style={{ '--i': 5 }} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3" data-tour="charts">
        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader><CardTitle>Document progress</CardTitle><Button asChild variant="link"><Link to="/documents">Checklist →</Link></Button></CardHeader>
          {!loading && <IdentityRing docs={docs} user={user} />}
        </Card>
        <Card>
          <CardHeader><CardTitle>Verification progress</CardTitle><Button asChild variant="link"><Link to="/documents">Open vault →</Link></Button></CardHeader>
          {!loading && <StatusDonut docs={docs} />}
        </Card>
        <Card>
          <CardHeader><CardTitle>Activity, last 14 days</CardTitle><Button asChild variant="link"><Link to="/activity">Full timeline →</Link></Button></CardHeader>
          {!loading && <ActivityLine activity={activity} />}
        </Card>
      </div>

      {!loading && <SetupChecklist user={user} docs={docs} />}

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr] 2xl:grid-cols-[1.6fr_1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Recent documents</CardTitle><Button asChild variant="link"><Link to="/documents">View all →</Link></Button></CardHeader>
          {docs.length ? (
            <ul className="grid">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id} className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border-t border-border px-2 py-3 transition-colors duration-200 first:border-t-0 hover:bg-accent/40">
                  <span className="grid"><b>{d.title}</b><small className="text-muted-foreground">{fmtDate(d.createdAt)}{d.numberMasked && <> · <span className="font-mono">{d.numberMasked}</span></>}</small></span>
                  <DocStatus status={d.status} />
                </li>
              ))}
            </ul>
          ) : !loading && (
            <EmptyState compact icon={FileLock2} title="Your vault is empty" action={<Button asChild size="sm"><Link to="/documents?upload=pan"><Upload /> Upload your first document</Link></Button>}>
              Add a PAN or Aadhaar card - it is encrypted and checked in seconds.
            </EmptyState>
          )}
        </Card>

        <ActivityTeaser activity={activity} />
        <div className="grid gap-6 lg:col-span-2 2xl:col-span-1">
          <Card>
            <CardHeader><CardTitle>Where you're signed in</CardTitle><Button asChild variant="link"><Link to="/security">Manage →</Link></Button></CardHeader>
            <ul className="grid gap-3">
              {groupSessions(sessions).map((s) => (
                <li key={s.id} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted"><Monitor className="size-4" /></span>
                  <span className="grid gap-0.5 text-sm">
                    <b className="flex flex-wrap items-center gap-2">{s.device} {s.current && <Badge variant="success">this device</Badge>}</b>
                    <small className="text-muted-foreground">{friendlyIp(s.ip)} · {s.location} · {ago(s.createdAt)}{s.count > 1 && ` · ${s.count} sign-ins`}</small>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
