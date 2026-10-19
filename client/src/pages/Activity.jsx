import { useState } from 'react';
import { History, LogIn, FileText, Eye, ShieldCheck } from 'lucide-react';
import { api, fmtDate, actionLabel, cleanDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityLine } from '@/components/app/charts';
import { useAsync, ErrorText, PageHeader, Segmented, EmptyState } from '@/components/app/kit';

export function AuditTable({ logs, showSubject }) {
  const { user } = useAuth();
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead><TableHead>By</TableHead>{showSubject && <TableHead>Whose data</TableHead>}<TableHead>IP</TableHead></TableRow></TableHeader>
      <TableBody>
        {logs.map((a) => {
          const byOther = a.user && a.user._id !== user.id && !showSubject;
          return (
            <TableRow key={a._id} className={byOther ? 'bg-amber-400/12' : undefined}>
              <TableCell className="whitespace-nowrap">{fmtDate(a.createdAt)}</TableCell>
              <TableCell className="font-semibold whitespace-nowrap" title={a.action}>{actionLabel(a.action)}</TableCell>
              <TableCell className="min-w-56">{cleanDetail(a.detail)}</TableCell>
              <TableCell className="whitespace-nowrap">{a.user ? `${a.user.name} (${a.user.role})` : <span className="text-muted-foreground">system / guest</span>}</TableCell>
              {showSubject && <TableCell>{a.subject?.name ?? '-'}</TableCell>}
              <TableCell className="font-mono text-xs">{a.ip}</TableCell>
            </TableRow>
          );
        })}
        {!logs.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No activity yet.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

// Category of each action -> filter group, icon, fill
const KIND = (action) => {
  if (/^login|^session|^devices/.test(action)) return ['signin', LogIn, 'bg-info'];
  if (/^document/.test(action)) return ['docs', FileText, 'bg-violet'];
  if (/^(record|access|share)/.test(action)) return ['access', Eye, 'bg-primary'];
  return ['security', ShieldCheck, 'bg-success'];
};
const FILTERS = [['all', 'Everything'], ['signin', 'Sign-ins'], ['docs', 'Documents'], ['access', 'Access & sharing'], ['security', 'Security']];

const dayLabel = (d) => {
  const day = new Date(d).toDateString();
  if (day === new Date().toDateString()) return 'Today';
  if (day === new Date(Date.now() - 864e5).toDateString()) return 'Yesterday';
  return new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};

export default function Activity() {
  const { user } = useAuth();
  const { data, error } = useAsync(() => api('/auth/activity'));
  const [filter, setFilter] = useState('all');
  const logs = data ?? [];
  const shown = logs.filter((a) => filter === 'all' || KIND(a.action)[0] === filter);
  const days = Object.entries(Object.groupBy(shown, (a) => dayLabel(a.createdAt)));
  const byOthers = logs.filter((a) => a.user && a.user._id !== user.id).length;

  return (
    <div className="grid gap-8">
      <PageHeader icon={History} kicker="Tamper-evident audit trail" title="Activity Log"
        stats={[['events recorded', logs.length], ['sign-ins', logs.filter((a) => a.action === 'login').length], ['views by faculty', byOthers, byOthers ? 'warn' : '']]}>
        Everything done with your account - including every time a faculty member opened your documents (highlighted).
      </PageHeader>
      <ErrorText>{error}</ErrorText>
      <Segmented label="Filter activity" value={filter} onChange={setFilter}
        options={FILTERS.map(([k, label]) => [k, label, k === 'all' ? logs.length : logs.filter((a) => KIND(a.action)[0] === k).length])} />
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-8">
      {days.map(([day, items]) => (
        <section key={day} className="grid gap-3">
          <h2 className="w-fit rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day}</h2>
          <ol className="tl stagger">
            {items.map((a) => {
              const [, Icon, tone] = KIND(a.action);
              const other = a.user && a.user._id !== user.id;
              const failed = a.action === 'login.failed';
              return (
                <li key={a._id} style={{ '--i': Math.min(items.indexOf(a), 12) }} className={cn('tl-item', other && 'other')}>
                  <span className={cn('tl-icon', failed ? 'bg-destructive' : tone)}><Icon className="size-4" /></span>
                  <div className="grid gap-0.5 text-sm">
                    <span><b>{actionLabel(a.action)}</b>{a.detail && <span className="text-muted-foreground"> · {cleanDetail(a.detail)}</span>}</span>
                    <small className="font-mono text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {other && <> · by <b className="text-foreground">{a.user.name}</b> ({a.user.role})</>}
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
        </div>
        {logs.length > 0 && (
          <aside className="grid gap-6 xl:sticky xl:top-28">
            <Card>
              <CardHeader><CardTitle>Last 14 days</CardTitle></CardHeader>
              <ActivityLine activity={logs} />
            </Card>
            <Card>
              <CardHeader><CardTitle>What happened</CardTitle></CardHeader>
              <ul className="grid gap-3">
                {FILTERS.slice(1).map(([k, label], i) => {
                  const n = logs.filter((x) => KIND(x.action)[0] === k).length;
                  return (
                    <li key={k}>
                      <button type="button" onClick={() => setFilter(k)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-left text-sm">
                        <span className="text-muted-foreground">{label}</span><b className="font-mono">{n}</b>
                        <span className="col-span-2 h-2 overflow-hidden rounded-full bg-muted"><i className="neon-fill block h-full origin-left animate-[bar_0.9s_var(--ease-out-expo)_both] rounded-full" style={{ width: `${(n / logs.length) * 100}%`, animationDelay: `${i * 100}ms` }} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card className={byOthers ? 'border-amber-400/50' : undefined}>
              <CardHeader><CardTitle>By other people</CardTitle></CardHeader>
              <p className="flex items-baseline gap-3"><b className="font-mono text-4xl">{byOthers}</b><span className="text-sm text-muted-foreground">{byOthers ? 'actions on your records by verifiers or admins. They are highlighted in the timeline.' : 'Nobody else has touched your records.'}</span></p>
            </Card>
          </aside>
        )}
      </div>
      {data && !shown.length && <EmptyState icon={History} title="Nothing in this group yet">Sign-ins, uploads, views and security changes are recorded here the moment they happen.</EmptyState>}
    </div>
  );
}
