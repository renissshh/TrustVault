import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { History, LogIn, FileText, Eye, ShieldCheck, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, fmtDate, actionLabel, cleanDetail, groupRuns } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ActivityLine } from '@/components/app/charts';
import { useAsync, ErrorText, PageHeader, Segmented, EmptyState, SkeletonRows } from '@/components/app/kit';

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

// Category of each action -> filter group, icon, colour
const KIND = (action) => {
  if (/^login|^session|^devices|^register/.test(action)) return ['signin', LogIn, 'var(--info)'];
  if (/^document/.test(action)) return ['docs', FileText, 'var(--violet)'];
  if (/^(record|access|share)/.test(action)) return ['access', Eye, 'var(--primary)'];
  return ['security', ShieldCheck, 'var(--success)'];
};
const FILTERS = [['all', 'Everything'], ['signin', 'Sign-ins'], ['docs', 'Documents'], ['access', 'Access & sharing'], ['security', 'Security']];
const PAGE = 15;

const dayLabel = (d) => {
  const day = new Date(d).toDateString();
  if (day === new Date().toDateString()) return 'Today';
  if (day === new Date(Date.now() - 864e5).toDateString()) return 'Yesterday';
  return new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};
const time = (d) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// One line per event (or per run of identical events); a run opens to show each one.
function Row({ a, me, open, onToggle, i }) {
  const [, Icon, tone] = KIND(a.action);
  const other = a.user && a.user._id !== me;
  const c = a.action === 'login.failed' ? 'var(--destructive)' : other ? '#fbbf24' : tone;
  return (
    <li className={cn('al-row', other && 'other')} style={{ '--c': c, '--i': i }}>
      <div className="al-line">
        <span className="al-icon"><Icon className="size-3.5" /></span>
        <span className="line-clamp-2 min-w-0 flex-1 text-sm sm:line-clamp-1">
          <b>{actionLabel(a.action)}</b>
          {a.count > 1 && <span className="al-count">×{a.count}</span>}
          {a.detail && <span className="text-muted-foreground"> · {cleanDetail(a.detail)}</span>}
          {other && <span className="text-muted-foreground"> · by <b className="text-foreground">{a.user.name}</b></span>}
        </span>
        <time className="shrink-0 font-mono text-xs text-muted-foreground" dateTime={a.createdAt}>{a.count > 1 && time(a.items.at(-1).createdAt) !== time(a.createdAt) ? `${time(a.items.at(-1).createdAt)}–${time(a.createdAt)}` : time(a.createdAt)}</time>
        {a.count > 1 && (
          <button type="button" className="al-more" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} the ${a.count} events`}>
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>
      {open && (
        <ul className="al-sub">
          {a.items.map((e) => <li key={e._id}><span className="font-mono text-xs text-muted-foreground">{time(e.createdAt)}</span> {cleanDetail(e.detail) || actionLabel(e.action)}{e.ip && <span className="font-mono text-xs text-muted-foreground"> · {e.ip}</span>}</li>)}
        </ul>
      )}
    </li>
  );
}

export default function Activity() {
  const { user } = useAuth();
  const { data, error, loading } = useAsync(() => api('/auth/activity'));
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);
  const search = useDeferredValue(query.trim().toLowerCase());
  const logs = data ?? [];
  const runs = useMemo(() => groupRuns(logs.filter((a) => (filter === 'all' || KIND(a.action)[0] === filter)
    && (!search || `${actionLabel(a.action)} ${a.detail ?? ''} ${a.user?.name ?? ''}`.toLowerCase().includes(search)))), [logs, filter, search]);
  useEffect(() => { setPage(0); setOpen(null); }, [filter, search]);
  const pages = Math.max(1, Math.ceil(runs.length / PAGE));
  const slice = runs.slice(page * PAGE, page * PAGE + PAGE);
  const days = Object.entries(Object.groupBy(slice, (a) => dayLabel(a.createdAt)));
  const byOthers = logs.filter((a) => a.user && a.user._id !== user.id).length;
  const go = (p) => { setPage(p); setOpen(null); document.getElementById('al-top')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };

  return (
    <div className="grid gap-8">
      <PageHeader icon={History} kicker="Tamper-evident audit trail" title="Activity Log"
        stats={[['events recorded', logs.length], ['sign-ins', logs.filter((a) => a.action === 'login').length], ['actions by other people', byOthers, byOthers ? 'warn' : '']]}>
        Everything done with your account - including every time a faculty member opened your documents (highlighted in amber).
      </PageHeader>
      <ErrorText>{error}</ErrorText>
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div id="al-top" className="grid min-w-0 scroll-mt-28 gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Filter activity" value={filter} onChange={setFilter}
              options={FILTERS.map(([k, label]) => [k, label, k === 'all' ? logs.length : logs.filter((a) => KIND(a.action)[0] === k).length])} />
            <label className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" className="pl-9" placeholder="Search activity…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search activity" />
            </label>
          </div>

          {loading && <SkeletonRows rows={6} />}
          {days.map(([day, items]) => (
            <section key={day} className="al-day" aria-label={day}>
              <h2 className="al-day-label">{day} <span>{items.reduce((n, a) => n + a.count, 0)}</span></h2>
              <ol className="al-list">
                {items.map((a, i) => <Row key={a._id} a={a} me={user.id} i={i} open={open === a._id} onToggle={() => setOpen(open === a._id ? null : a._id)} />)}
              </ol>
            </section>
          ))}
          {data && !runs.length && (
            <EmptyState icon={search ? Search : History} title={search ? `Nothing matches "${query.trim()}"` : 'Nothing in this group yet'}
              action={(search || filter !== 'all') && <Button size="sm" variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>Show everything</Button>}>
              {search ? 'Try a shorter word, such as "PAN" or "signed in".' : 'Sign-ins, uploads, views and security changes are recorded here the moment they happen.'}
            </EmptyState>
          )}

          {pages > 1 && (
            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Activity pages">
              <span className="text-sm text-muted-foreground">Showing {page * PAGE + 1}–{Math.min(runs.length, page * PAGE + PAGE)} of {runs.length} rows</span>
              <span className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => go(page - 1)} aria-label="Newer"><ChevronLeft /></Button>
                {Array.from({ length: pages }, (_, p) => (
                  <Button key={p} size="sm" variant={p === page ? 'default' : 'ghost'} aria-current={p === page ? 'page' : undefined} onClick={() => go(p)} className="min-w-9">{p + 1}</Button>
                ))}
                <Button size="sm" variant="outline" disabled={page === pages - 1} onClick={() => go(page + 1)} aria-label="Older"><ChevronRight /></Button>
              </span>
            </nav>
          )}
        </div>

        {logs.length > 0 && (
          <aside className="grid gap-6 xl:sticky xl:top-24">
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
                      <button type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={cn('grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded-lg p-1 text-left text-sm transition-colors hover:bg-accent/50', filter === k && 'bg-accent/60')}>
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
              <p className="flex items-baseline gap-3"><b className="font-mono text-4xl">{byOthers}</b><span className="text-sm text-muted-foreground">{byOthers ? 'actions on your records by faculty or admins. They are highlighted in amber.' : 'Nobody else has touched your records.'}</span></p>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
