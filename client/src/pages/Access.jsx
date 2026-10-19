import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, KeyRound, Mail, ShieldCheck, UserSearch, X } from 'lucide-react';
import { api, fmtDate, TYPE_LABELS, ROLE_LABELS } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAsync, ErrorText, StatusBadge, SkeletonRows, ask, toast, PageHeader, EmptyState, Initials, ago } from '@/components/app/kit';

// The student decides who may see their records.
export default function Access() {
  const { data, error, loading, reload } = useAsync(() => api('/access'));
  const { refresh } = useAuth();
  const answer = async (a, decision, types) => {
    const confirmText = { approve: 'Share', deny: 'Deny', revoke: 'Withdraw access' }[decision];
    const ok = await ask({
      title: decision === 'approve' ? `Share ${types.length} document${types.length > 1 ? 's' : ''} with ${a.verifier.name}?` : `${confirmText}?`,
      message: decision === 'approve'
        ? `${a.verifier.name} can open each of these one time: ${types.map((t) => TYPE_LABELS[t]).join(', ')}. Every view is logged and emailed to you.`
        : `${a.verifier.name} will not be able to see these documents.`,
      confirmText, danger: decision !== 'approve',
    });
    if (!ok) return;
    try {
      await api(`/access/${a.id}`, { method: 'POST', body: { decision, ...(types && { types }) } });
      toast(`Request ${decision === 'approve' ? 'approved' : decision === 'deny' ? 'denied' : 'revoked'}.`);
      reload();
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const pending = data?.filter((a) => a.status === 'pending') ?? [];
  const history = data?.filter((a) => a.status !== 'pending') ?? [];

  return (
    <div className="grid gap-8">
      <PageHeader icon={KeyRound} kicker="You decide who sees what" title="Access Requests"
        stats={[['waiting for you', pending.length, pending.length ? 'warn' : ''], ['active approvals', history.filter((a) => a.status === 'approved').length, 'ok'], ['answered', history.length]]}>
        Faculty must ask for the documents they need. You choose which ones to share, and each shared document opens one time.
      </PageHeader>
      <ErrorText>{error}</ErrorText>
      {loading && <SkeletonRows />}

      {!loading && (pending.length ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{pending.map((a) => (
        <PendingRequest key={a.id} a={a} onAnswer={answer} />
      ))}</div> : <EmptyState icon={KeyRound} title="Nobody is asking right now" steps={[[UserSearch, 'A faculty member ticks the documents they need'], [Mail, 'You get an email and the request appears here'], [ShieldCheck, 'You share all or some of them. Each opens one time']]}
        action={<Button asChild variant="outline"><Link to="/activity">See who viewed your records</Link></Button>}>
        Faculty cannot open your vault on their own. This is how a request works:
      </EmptyState>)}

      {history.length > 0 && (
        <section className="grid gap-4">
          <h2 className="text-2xl">History</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Requested</TableHead><TableHead>By</TableHead><TableHead>Documents</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(a.requestedAt)}</TableCell><TableCell className="font-semibold">{a.verifier.name}</TableCell><TableCell className="min-w-48">{(a.status === 'approved' || a.status === 'used' || a.status === 'expired' ? a.granted : a.types)?.map((t) => TYPE_LABELS[t]).join(', ') || a.reason}</TableCell>
                  <TableCell>{a.status === 'approved' ? <StatusBadge status="approved">Opened {a.opened} · open until {fmtDate(a.expiresAt)}</StatusBadge> : a.status === 'used' ? <StatusBadge status="used">Opened, closed</StatusBadge> : <StatusBadge status={a.status} />}</TableCell>
                  <TableCell>{a.status === 'approved' && <Button size="sm" variant="destructive" onClick={() => answer(a, 'revoke')}>Withdraw</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}

// One request: the documents asked for, each with a tick box (all ticked by default).
function PendingRequest({ a, onAnswer }) {
  const [picked, setPicked] = useState(a.types?.length ? a.types : []);
  const toggle = (t) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  return (
    <article data-spot data-tilt="" className="grid content-start gap-4 rounded-3xl border border-amber-400/40 bg-card p-5 text-card-foreground shadow-brutal">
      <div className="flex items-start gap-3">
        <Initials name={a.verifier.name} size={48} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl leading-tight">{a.verifier.name}</h3>
          <p className="truncate font-mono text-xs text-muted-foreground">{a.verifier.email}</p>
        </div>
        <span className="grid justify-items-end gap-1"><Badge variant="violet">{ROLE_LABELS[a.verifier.role] ?? a.verifier.role}</Badge><small className="text-xs whitespace-nowrap text-muted-foreground">{ago(a.requestedAt)}</small></span>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Asking for - untick anything you don't want to share</legend>
        {(a.types ?? []).map((t) => {
          const on = picked.includes(t);
          return (
            <label key={t} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors', on ? 'border-success/50 bg-success/10' : 'border-border bg-muted/40 text-muted-foreground line-through')}>
              <input type="checkbox" className="size-4 accent-[var(--success)]" checked={on} onChange={() => toggle(t)} />{TYPE_LABELS[t]}
            </label>
          );
        })}
      </fieldset>
      {a.reason && <blockquote className="rounded-2xl border border-border bg-muted/60 p-3 text-sm"><span className="mb-1 block font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Their reason</span>{a.reason}</blockquote>}
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Eye className="mt-0.5 size-3.5 shrink-0" /> Each document you share can be opened one time. Every view is logged and emailed to you.</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="success" className="flex-1" disabled={!picked.length} onClick={() => onAnswer(a, 'approve', picked)}><Check /> Share {picked.length} of {a.types?.length ?? 0}</Button>
        <Button variant="outline" onClick={() => onAnswer(a, 'deny')}><X /> Deny</Button>
      </div>
    </article>
  );
}
