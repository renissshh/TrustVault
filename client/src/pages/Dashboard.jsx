// Home: one greeting, then only what matters for this person. Students: what needs them, their documents, recent
// activity. Faculty: their requests. Administrators: the college at a glance. Details live on their own pages
// (signed-in devices on Security, charts on Activity and Admin).
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FolderLock, Users, GraduationCap, ShieldCheck, History, ArrowRight, Eye, Hourglass, KeyRound, XCircle, AlertTriangle } from 'lucide-react';
import { api, firstName } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Aurora, Words } from '@/lib/fx';
import { useVerifiedCelebration } from '@/lib/confetti';
import { Wallet } from '@/components/app/wallet';
import { IdentityRing } from '@/components/app/charts';
import { NeedsYou, RecentActivity } from '@/components/app/insights';
import { useAsync, Callout, toast } from '@/components/app/kit';

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
    <Card>
      <CardHeader><CardTitle>Your documents</CardTitle><Button asChild variant="link"><Link to="/documents">Open vault →</Link></Button></CardHeader>
      <IdentityRing docs={docs} user={user} />
      <p className="mt-2 text-sm text-muted-foreground [&_b]:text-foreground">
        <b>{docs.length}</b> in your vault · <b>{n('verified')}</b> verified{n('pending') > 0 && <> · <b>{n('pending')}</b> being checked</>}{n('rejected') > 0 && <> · <b className="text-destructive!">{n('rejected')}</b> not verified</>}
      </p>
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

      {!loading && (role === 'student' ? (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-2" data-tour="charts">
            <NeedsYou user={user} docs={docs} pendingAccess={pendingAccess} />
            <YourDocuments docs={docs} user={user} />
          </div>
          <RecentActivity activity={activity} user={user} />
        </>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]" data-tour="charts">
          {role === 'verifier' ? <FacultyRequests /> : <CollegeGlance stats={stats} />}
          <RecentActivity activity={activity} user={user} />
        </div>
      ))}
    </div>
  );
}
