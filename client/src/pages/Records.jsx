import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock, Search, GraduationCap, ArrowLeft, Hourglass, Mail, ShieldCheck, Eye, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, fmtDate, fmtDay, TYPE_LABELS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAsync, ErrorText, StatusBadge, DocViewer, ScoreBar, SkeletonRows, toast, PageHeader, Field, EmptyState, Initials } from '@/components/app/kit';

const accessLabel = (a) => {
  if (!a) return <span className="text-muted-foreground">No access</span>;
  if (a.status === 'approved') return <StatusBadge status="approved">Approved: {(a.granted ?? []).map((t) => TYPE_LABELS[t]).join(', ')}</StatusBadge>;
  if (a.status === 'used') return <StatusBadge status="used">Opened · ask again to see more</StatusBadge>;
  return <StatusBadge status={a.status} />;
};

export function StudentList() {
  const [q, setQ] = useState('');
  const { data, error, loading } = useAsync(() => api(`/records/students?q=${encodeURIComponent(q)}`), [q]);
  return (
    <div className="grid gap-8">
      <PageHeader icon={GraduationCap} kicker="Consent-based access" title="Student Records"
        stats={[['students', data?.length ?? 0], ['you can open now', data?.filter((s) => s.access?.status === 'approved').length ?? 0, 'ok'], ['requests pending', data?.filter((s) => s.access?.status === 'pending').length ?? 0, 'warn']]}>
        Tick the documents you need and ask the student. They approve all or some, and each approved document opens one time.
      </PageHeader>
      <label className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" className="pl-9" placeholder="Search by name, email or roll number…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
      </label>
      <ErrorText>{error}</ErrorText>
      {loading ? <SkeletonRows /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Roll no.</TableHead><TableHead>Email</TableHead><TableHead>Verified</TableHead><TableHead>Your access</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell><Link to={`/records/${s.id}`} className="group flex items-center gap-3 font-semibold"><Initials name={s.name} size={34} /><span className="underline decoration-primary/40 underline-offset-4 transition-colors group-hover:text-primary group-hover:decoration-primary">{s.name}</span></Link></TableCell><TableCell className="font-mono">{s.studentId || '-'}</TableCell><TableCell>{s.email}</TableCell>
                <TableCell><span className="flex items-center gap-2 font-mono text-xs"><span className="block h-2 w-24 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-success" style={{ width: `${s.total ? (s.verified / s.total) * 100 : 0}%` }} /></span>{s.verified}/{s.total}</span></TableCell><TableCell>{accessLabel(s.access)}</TableCell>
              </TableRow>
            ))}
            {data && !data.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No students found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
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
                  <TableCell><StatusBadge status={d.status} /></TableCell><TableCell className="whitespace-nowrap">{fmtDate(d.createdAt)}</TableCell>
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
