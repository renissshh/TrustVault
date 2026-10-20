// Home: one greeting, then only what matters for this person. Students: what needs them, their documents, recent
// activity. Faculty: their requests. Administrators: the college at a glance. Details live on their own pages
// (signed-in devices on Security, charts on Activity and Admin).
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FolderLock, Users, GraduationCap, ShieldCheck, History, ArrowRight, Eye, Hourglass, KeyRound, XCircle, AlertTriangle, FileCheck2 } from 'lucide-react';
import { api, firstName } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Aurora, Words } from '@/lib/fx';
import { useVerifiedCelebration } from '@/lib/confetti';
import { Wallet } from '@/components/app/wallet';
import { IdentityRing } from '@/components/app/charts';
import { NeedsYou, RecentActivity } from '@/components/app/insights';
import { useAsync, Callout, toast, DocStatus } from '@/components/app/kit';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
};

// a number with a label, linking to where it comes from
function Figure({ value, label, tone = 'var(--primary)', icon: Icon, to }) {
  const inner = (
    <>
      <span className="grid size-9 place-items-center rounded-xl" style={{ color: tone, background: `color-mix(in srgb, ${tone} 15%, transparent)` }}><Icon className="size-4" /></span>
      <b className="font-mono text-3xl leading-none font-semibold">{value}</b>
      <small className="text-muted-foreground">{label}</small>
    </>
  );
  const cls = 'grid content-start gap-2 rounded-2xl border border-border bg-background/40 p-4 transition-colors hover:border-primary/40';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function YourDocuments({ docs, user }) {
  const n = (s) => docs.filter((d) => d.status === s).length;
  return (
    <Card className="[container-type:inline-size]">
      <CardHeader><CardTitle>Your documents</CardTitle><Button asChild variant="link"><Link to="/documents">Open vault →</Link></Button></CardHeader>
      <IdentityRing docs={docs} user={user} />
      <p className="mt-2 text-sm text-muted-foreground [&_b]:text-foreground">
        <b>{docs.length}</b> in your vault · <b>{n('verified')}</b> verified{n('pending') > 0 && <> · <b>{n('pending')}</b> being checked</>}{n('rejected') > 0 && <> · <b className="text-destructive!">{n('rejected')}</b> not verified</>}
      </p>
    </Card>
  );
}

// Faculty and administrators: their own ID documents, one line each.
const DOC_TONE = { verified: 'var(--success)', stored: 'var(--success)', pending: '#fbbf24', rejected: 'var(--destructive)' };
function DocsMini({ docs }) {
  return (
    <Card>
      <CardHeader><CardTitle>Your documents</CardTitle><Button asChild variant="link"><Link to="/documents">Open vault →</Link></Button></CardHeader>
      {docs.length ? (
        <ul className="grid gap-2">
          {docs.slice(0, 4).map((d) => (
            <li key={d.id}>
              <Link to="/documents" className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 transition-colors hover:border-primary/50">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ color: DOC_TONE[d.status] ?? 'var(--muted-foreground)', background: `color-mix(in srgb, ${DOC_TONE[d.status] ?? 'var(--muted-foreground)'} 15%, transparent)` }}><FileCheck2 className="size-4" /></span>
                <span className="grid min-w-0 flex-1"><b className="truncate text-sm">{d.title}</b><small className="truncate font-mono text-xs text-muted-foreground">{d.numberMasked || d.originalName}</small></span>
                <DocStatus status={d.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">No documents yet. <Link to="/documents?upload=pan" className="font-semibold underline">Add your PAN card</Link>.</p>}
    </Card>
  );
}

// Faculty: every batch that has students, one tap to open it in Student records.
function YourBatches() {
  const batches = useAsync(() => api('/records/batches')).data ?? [];
  return (
    <Card>
      <CardHeader><CardTitle>Batches</CardTitle><Button asChild variant="link"><Link to="/records">All students →</Link></Button></CardHeader>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {batches.map((b) => (
          <Link key={b.group} to={`/records?batch=${b.group}`} className="group grid gap-0.5 rounded-xl border border-border px-3 py-2.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/60">
            <b className="font-mono text-lg tracking-wider text-primary">{b.group}</b>
            <small className="text-xs text-muted-foreground">{b.students} student{b.students === 1 ? '' : 's'} <ArrowRight className="inline size-3 opacity-0 transition-opacity group-hover:opacity-100" /></small>
          </Link>
        ))}
        {!batches.length && <p className="col-span-full text-sm text-muted-foreground">No students have signed up yet.</p>}
      </div>
    </Card>
  );
}

// Faculty: where each of my requests stands, and who has shared something I can open now.
function FacultyRequests() {
  const students = useAsync(() => api('/records/students?q=')).data ?? [];
  const by = (s) => students.filter((x) => x.access?.status === s);
  const ready = by('approved');
  return (
    <Card>
      <CardHeader><CardTitle>Your requests</CardTitle><Button asChild variant="link"><Link to="/records">Student records →</Link></Button></CardHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure icon={Hourglass} value={by('pending').length} label="Waiting for students" tone="#fbbf24" to="/records" />
        <Figure icon={KeyRound} value={ready.length} label="Ready to open" tone="var(--success)" to="/records" />
        <Figure icon={Eye} value={by('used').length} label="Opened" tone="var(--info)" to="/records" />
        <Figure icon={XCircle} value={by('denied').length} label="Declined" tone="var(--destructive)" to="/records" />
      </div>
      {ready.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {ready.slice(0, 4).map((s) => (
            <li key={s.id}>
              <Link to={`/records/${s.id}`} className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/8 px-3 py-2.5 transition-transform hover:translate-x-1">
                <span className="grid"><b className="text-sm">{s.name} <span className="font-mono text-xs text-muted-foreground">{s.studentId}</span></b><small className="text-muted-foreground">shared {s.access.granted?.length ?? 0} document{s.access.granted?.length === 1 ? '' : 's'} · opens once</small></span>
                <ArrowRight className="ml-auto size-4 opacity-60" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Administrators: the college in four numbers, plus anything that needs attention.
function CollegeGlance({ stats }) {
  const requests = useAsync(() => api('/admin/requests')).data ?? [];
  if (!stats) return null;
  const waiting = requests.filter((r) => r.status === 'pending').length;
  return (
    <Card>
      <CardHeader><CardTitle>College at a glance</CardTitle><Button asChild variant="link"><Link to="/admin">Admin console →</Link></Button></CardHeader>
      {stats.tampered > 0 && <Callout tone="bad" className="mb-3 flex items-center gap-2"><AlertTriangle className="size-4" /> {stats.tampered} document{stats.tampered > 1 ? 's' : ''} failed the tamper check. Run the ledger check in the Admin console.</Callout>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure icon={GraduationCap} value={stats.users.student ?? 0} label="Students" to="/admin" />
        <Figure icon={Users} value={stats.users.verifier ?? 0} label="Faculty" tone="var(--violet)" to="/admin" />
        <Figure icon={ShieldCheck} value={stats.documents.verified ?? 0} label="Documents verified" tone="var(--success)" to="/admin" />
        <Figure icon={Hourglass} value={waiting} label="Requests waiting" tone="#fbbf24" to="/admin" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{stats.logins24h} sign-ins in the last 24 hours · {stats.blocks} ledger blocks</p>
      {waiting > 0 && (
        <ul className="mt-4 grid gap-2">
          {requests.filter((r) => r.status === 'pending').slice(0, 4).map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/8 px-3 py-2 text-sm">
              <Hourglass className="size-4 shrink-0 text-amber-400" />
              <span className="min-w-0 flex-1 truncate"><b>{r.faculty?.name}</b> asked <b>{r.student?.name}</b> <span className="font-mono text-xs text-muted-foreground">{r.student?.studentId}</span></span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { user, pendingAccess, expiresAt } = useAuth();
  const role = user.role;
  const { data, loading, reload } = useAsync(() => Promise.all([
    api('/documents'),
    api('/auth/activity'),
    role !== 'student' ? api('/admin/stats') : null,
  ]));
  const [docs = [], activity = [], stats] = data ?? [];
  const first = firstName(user.name);
  const minutesLeft = Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 60e3));
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  useEffect(() => { window.addEventListener('tv-live', reload); return () => window.removeEventListener('tv-live', reload); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useVerifiedCelebration(data?.[0], user.id, (fresh) => toast(`${fresh[0].title} was verified.`));
  const verified = docs.filter((d) => d.status === 'verified').length;

  return (
    <div className="grid gap-6">
      <section data-tour="hero" className="neon-ring relative grid items-center gap-10 overflow-hidden rounded-[2rem] border border-primary/30 bg-card/70 p-6 shadow-brutal-lg sm:p-10 xl:grid-cols-[1.15fr_1fr]">
        <Aurora />
        <div className="relative grid gap-5">
          <span className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">{today}</span>
          <h1 className="text-5xl leading-[0.98] font-extrabold sm:text-7xl"><Words text={`${greeting()},`} /><br /><Words text={`${first}.`} className="text-gradient" delay={0.2} /></h1>
          <p className="max-w-2xl font-medium text-muted-foreground [&_b]:text-foreground">
            {loading ? 'Opening your vault…' : role === 'student'
              ? <><b>{verified}</b> of <b>{docs.length}</b> documents verified · secure session {minutesLeft} min left</>
              : <>{role === 'verifier' ? 'Faculty' : 'Administrator'} · secure session {minutesLeft} min left</>}
          </p>
          <div className="flex flex-wrap gap-3">
            {role === 'verifier' ? <>
              <Button asChild size="lg"><Link to="/records"><Users /> Ask a batch</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/records"><GraduationCap /> Student records</Link></Button>
            </> : role === 'admin' ? <>
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

      {!loading && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="grid min-w-0 grid-cols-1 gap-6" data-tour="charts">
            {role === 'student' ? (
              <div className="grid items-start gap-6 lg:grid-cols-2">
                <NeedsYou user={user} docs={docs} pendingAccess={pendingAccess} />
                <YourDocuments docs={docs} user={user} />
              </div>
            ) : role === 'verifier' ? <>
              <FacultyRequests />
              <div className="grid items-start gap-6 lg:grid-cols-2"><YourBatches /><DocsMini docs={docs} /></div>
            </> : <>
              <CollegeGlance stats={stats} />
              <DocsMini docs={docs} />
            </>}
          </div>
          <RecentActivity activity={activity} user={user} className="xl:sticky! xl:top-24" />
        </div>
      )}
    </div>
  );
}
