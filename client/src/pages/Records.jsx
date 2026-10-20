import { useDeferredValue, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Lock, Search, GraduationCap, ArrowLeft, Hourglass, Mail, ShieldCheck, Eye, Check, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, fmtDate, fmtDay, TYPE_LABELS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAsync, ErrorText, StatusBadge, DocStatus, DocViewer, ScoreBar, SkeletonRows, toast, PageHeader, Field, EmptyState, Initials, Callout } from '@/components/app/kit';

const accessLabel = (a) => {
  if (!a) return <span className="text-muted-foreground">No access</span>;
  if (a.status === 'approved') return <StatusBadge status="approved">Approved: {(a.granted ?? []).map((t) => TYPE_LABELS[t]).join(', ')}</StatusBadge>;
  if (a.status === 'used') return <StatusBadge status="used">Opened · ask again to see more</StatusBadge>;
  return <StatusBadge status={a.status} />;
};

// "26", "26mx" or "26 MX" -> "26MX"; "", "all" -> "ALL"; anything else -> null (still typing)
const parseBatch = (text) => {
  const t = text.toUpperCase().replace(/\s/g, '');
  if (!t || t === 'ALL') return 'ALL';
  const m = t.match(/^(\d{2})(MX)?$/);
  return m ? `${m[1]}MX` : null;
};

// A student as a profile card: who, which batch, how many documents are verified, and where your request stands.
function StudentCard({ s, i }) {
  const pct = s.total ? s.verified / s.total : 0;
  return (
    <Link to={`/records/${s.id}`} className="rc-card group" style={{ '--i': i }} data-tilt="translateY(-4px)">
      <span className="flex items-center gap-3">
        <Initials name={s.name} size={46} />
        <span className="grid min-w-0">
          <b className="truncate">{s.name}</b>
          <span className="font-mono text-xs tracking-wider text-primary">{s.studentId || '-'}</span>
        </span>
        <svg viewBox="0 0 36 36" className="ml-auto size-11 shrink-0 -rotate-90" role="img" aria-label={`${s.verified} of ${s.total} documents verified`}>
          <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="4" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray={`${pct * 100} 100`} className="rc-ring" />
          <text x="18" y="18" className="rotate-90 fill-foreground font-mono text-[9px] font-semibold" style={{ transformOrigin: '18px 18px' }} textAnchor="middle" dominantBaseline="central">{s.verified}/{s.total}</text>
        </svg>
      </span>
      <span className="truncate text-xs text-muted-foreground">{s.email}</span>
      <span className="flex items-center justify-between gap-2">
        {accessLabel(s.access)}
        <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">Open <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
      </span>
    </Link>
  );
}

export function StudentList() {
  const [params, setParams] = useSearchParams();
  const batch = parseBatch(params.get('batch') ?? '') ?? 'ALL';
  const [typed, setTyped] = useState(batch === 'ALL' ? '' : batch);
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const batches = useAsync(() => api('/records/batches'));
  const { data, error, loading, reload } = useAsync(() => api(`/records/students?batch=${batch}&q=${encodeURIComponent(query)}`), [batch, query]);
  const pick = (b) => { setTyped(b === 'ALL' ? '' : b); setParams(b === 'ALL' ? {} : { batch: b }, { replace: true }); };
  const onType = (v) => { setTyped(v); const b = parseBatch(v); if (b) setParams(b === 'ALL' ? {} : { batch: b }, { replace: true }); };
  const list = data ?? [];
  const known = batches.data ?? [];
  const total = known.reduce((n, b) => n + b.students, 0);
  const pending = parseBatch(typed) === null;

  return (
    <div className="grid gap-8">
      <PageHeader icon={GraduationCap} kicker="Consent-based access" title="Student Records"
        stats={[['students', total], ['you can open now', list.filter((s) => s.access?.status === 'approved').length, 'ok'], ['requests waiting', list.filter((s) => s.access?.status === 'pending').length, 'warn']]}>
        Pick a batch to see its students. Tick the documents you need and ask them; each student approves all or some, and each approved document opens one time.
      </PageHeader>

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Batch" className="w-56" hint={pending ? 'Like 26 or 26MX' : 'Type a joining year, or All'}>
            <Input value={typed} onChange={(e) => onType(e.target.value)} placeholder="All, 26, 23MX…" maxLength={6} className="font-mono uppercase placeholder:normal-case" aria-label="Batch" />
          </Field>
          <div className="flex flex-wrap gap-2 pb-6" role="group" aria-label="Batches">
            {[{ group: 'ALL', students: total }, ...known].map((b) => (
              <button key={b.group} type="button" aria-pressed={batch === b.group} onClick={() => pick(b.group)}
                className={cn('rc-chip', batch === b.group && 'on')}>
                <span className="font-mono tracking-wider">{b.group === 'ALL' ? 'All' : b.group}</span><span className="rc-chip-n">{b.students}</span>
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full pb-6 sm:w-72">
            <Search className="pointer-events-none absolute top-[38%] left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" className="pl-9" placeholder="Search name, email or roll no…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
          </label>
        </div>
      </Card>

      <section className="grid gap-4" aria-live="polite">
        <h2 className="flex items-baseline gap-3 text-2xl">
          {batch === 'ALL' ? 'All batches' : <span className="font-mono tracking-wider">{batch}</span>}
          <span className="text-base font-semibold text-muted-foreground">{loading ? '…' : `${list.length} student${list.length === 1 ? '' : 's'}`}{query && ` matching "${query}"`}</span>
        </h2>
        <ErrorText>{error}</ErrorText>
        {loading && !data ? <SkeletonRows rows={3} /> : list.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((s, i) => <StudentCard key={s.id} s={s} i={i} />)}</div>
        ) : (
          <EmptyState icon={Users} title={batch !== 'ALL' && !query ? `No students in ${batch} yet` : 'No students found'}
            action={known.length > 0 && (
              <span className="flex flex-wrap justify-center gap-2">
                {known.map((b) => <Button key={b.group} size="sm" variant="outline" onClick={() => { setQ(''); pick(b.group); }}>{b.group} · {b.students}</Button>)}
                <Button size="sm" variant="ghost" onClick={() => { setQ(''); pick('ALL'); }}>Show all</Button>
              </span>
            )}>
            {batch !== 'ALL' && !query ? 'Nobody has signed up with a roll number from this batch. These batches have students:' : 'Try another name or roll number, or one of these batches:'}
          </EmptyState>
        )}
      </section>

      {batch !== 'ALL' && list.length > 0 && !query
        ? <BatchRequest group={batch} count={list.length} onSent={reload} />
        : <Callout tone="info" className="flex items-center gap-2"><Users className="size-4 shrink-0" /> Pick a batch above to ask all of its students for documents at once.</Callout>}
    </div>
  );
}

// Document types faculty can ask for, in the order a college usually needs them.
const REQUESTABLE = ['class10', 'class12', 'pan', 'aadhaar', 'license', 'certificate', 'marksheet', 'other'];
const typeList = (types = []) => types.map((t) => TYPE_LABELS[t]).join(', ');

function RequestAccess({ student, access, onSent }) {
  const [error, setError] = useState('');
  const [picked, setPicked] = useState([]);
  const toggle = (t) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const submit = async (e) => {
    e.preventDefault();
    if (!picked.length) return setError('Tick at least one document you need.');
    try {
      await api(`/records/students/${student.id}/request`, { method: 'POST', body: { types: picked, reason: new FormData(e.currentTarget).get('reason') } });
      toast(`Request sent to ${student.name}.`);
      setPicked([]);
      onSent();
    } catch (err) {
      setError(err.message);
    }
  };
  if (access?.status === 'pending') {
    return <EmptyState icon={Hourglass} title={`Waiting for ${student.name}`} steps={[[Mail, `They were asked for: ${typeList(access.types)}`], [ShieldCheck, 'They can approve all or only some of them'], [Eye, 'Each approved document opens one time']]} />;
  }
  return (
    <Card>
      <form className="grid gap-4" onSubmit={submit}>
        <h2 className="flex items-center gap-2 text-xl"><Lock className="size-5" /> Ask {student.name} for documents</h2>
        <p className="text-sm text-muted-foreground">
          {access?.status === 'denied' && 'Your last request was denied. '}
          {access?.status === 'expired' && 'Your previous access has expired. '}
          {access?.status === 'revoked' && 'The student withdrew your access. '}
          {access?.status === 'used' && 'You have opened everything from your last request. '}
          Tick what you need. The student approves all or some, and each approved document can be opened <b>one time</b>.
        </p>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">Documents you need</legend>
          <div className="flex flex-wrap gap-2">
            {REQUESTABLE.map((t) => {
              const on = picked.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => toggle(t)}
                  className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors', on ? 'border-primary bg-primary/15 text-foreground shadow-glow' : 'border-border bg-card text-muted-foreground hover:border-primary/50')}>
                  <span className={cn('grid size-4 place-items-center rounded border', on ? 'border-primary bg-primary text-ink' : 'border-muted-foreground/50')}>{on && <Check className="size-3" />}</span>
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Reason (optional)"><Input name="reason" maxLength={300} placeholder="e.g. Documents for the Infosys placement drive" /></Field>
        <ErrorText>{error}</ErrorText>
        <Button className="justify-self-start" disabled={!picked.length}>Send request{picked.length ? ` for ${picked.length} document${picked.length > 1 ? 's' : ''}` : ''}</Button>
      </form>
    </Card>
  );
}

export function StudentRecord() {
  const { id } = useParams();
  const { data, error, reload } = useAsync(() => api(`/records/students/${id}`), [id]);
  const [viewing, setViewing] = useState(null);
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <SkeletonRows rows={4} />;
  const { student, documents, access } = data;
  return (
    <div className="grid gap-6">
      <Button asChild variant="link" className="justify-self-start"><Link to="/records"><ArrowLeft /> All students</Link></Button>
      <header data-spot className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/12 p-5 shadow-brutal">
        <div className="flex items-center gap-4"><Initials name={student.name} size={56} /><div><h1 className="text-3xl leading-none">{student.name}</h1><p className="mt-1 text-sm">{student.email} · Roll no. <span className="font-mono">{student.studentId || '-'}</span></p></div></div>
        {accessLabel(access)}
      </header>
      {documents.length > 0 && (
        <Card className="grid gap-3">
          <h2 className="text-xl">Documents {student.name} shared with you</h2>
          <p className="text-sm text-muted-foreground">Each one opens one time. Every view is logged and the student is told.</p>
          <Table>
            <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Checks</TableHead><TableHead>Status</TableHead><TableHead>Uploaded</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-semibold">{d.title} {d.tampered && <Badge variant="destructive">Tampered</Badge>}</TableCell><TableCell>{TYPE_LABELS[d.type]}</TableCell>
                  <TableCell className="font-mono">{d.numberMasked || '-'}</TableCell><TableCell><ScoreBar check={d.autoCheck} /></TableCell>
                  <TableCell><DocStatus status={d.status} /></TableCell><TableCell className="whitespace-nowrap">{fmtDate(d.createdAt)}</TableCell>
                  <TableCell>{d.canOpen ? <Button size="sm" onClick={() => setViewing(d)}><Eye /> Open once</Button> : <Badge variant="outline">Already opened</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <RequestAccess student={student} access={access} onSent={reload} />
      {viewing && <DocViewer doc={viewing} onClose={() => { setViewing(null); reload(); }} />}
    </div>
  );
}

// Ask every student of the selected batch for the same documents. Each student decides for themselves.
function BatchRequest({ group, count, onSent }) {
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (t) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const send = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setError(''); setBusy(true);
    try {
      const r = await api('/records/batch-request', { method: 'POST', body: { group, types: picked, reason: new FormData(form).get('reason') } });
      toast(r.sent
        ? `Request sent to ${r.sent} student${r.sent === 1 ? '' : 's'} in ${r.group}${r.skipped ? ` (${r.skipped} already had a request waiting)` : ''}.`
        : `Everyone in ${r.group} already has a request from you waiting.`);
      setPicked([]);
      form.reset();
      onSent?.();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <Card className="rc-ask">
      <form className="grid gap-4" onSubmit={send}>
        <h2 className="flex items-center gap-2 text-xl"><Users className="size-5" /> Ask all {count} students in <span className="font-mono tracking-wider text-primary">{group}</span></h2>
        <p className="text-sm text-muted-foreground">Tick the documents you need. Every student in {group} gets the request and decides for themselves. Students who already have a request from you waiting are skipped.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Documents to ask for">
          {REQUESTABLE.map((t) => {
            const on = picked.includes(t);
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => toggle(t)}
                className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors', on ? 'border-primary bg-primary/15 text-foreground shadow-glow' : 'border-border bg-card text-muted-foreground hover:border-primary/50')}>
                <span className={cn('grid size-4 place-items-center rounded border', on ? 'border-primary bg-primary text-ink' : 'border-muted-foreground/50')}>{on && <Check className="size-3" />}</span>
                {TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
        <Field label="Reason (optional)"><Input name="reason" maxLength={300} placeholder="e.g. Documents for the TCS placement drive" /></Field>
        <ErrorText>{error}</ErrorText>
        <Button className="justify-self-start" disabled={busy || !picked.length}>
          {busy ? 'Sending…' : picked.length ? `Send to all ${count} students in ${group}` : 'Tick at least one document'}
        </Button>
      </form>
    </Card>
  );
}
