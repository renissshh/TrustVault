import { useEffect, useState } from 'react';
import { Inbox, Mail, RefreshCw } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PublicShell, Kicker } from '@/components/app/public';
import { EmptyState, ErrorText } from '@/components/app/kit';

// Demo mailbox for laptop demos: every email TrustVault "sends" when no email service is set up (DEMO_MAILBOX=1).
export default function Mailbox() {
  const [mails, setMails] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [to, setTo] = useState('');
  const load = () => api('/dev/mail').then((m) => { setMails(m); setError(''); }, (e) => setError(e.status === 404 ? 'The demo mailbox is off. It only works on a laptop with DEMO_MAILBOX=1 and no email service.' : e.message));
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const people = [...new Set((mails ?? []).map((m) => m.to))].sort();
  const shown = (mails ?? []).filter((m) => !to || m.to === to);
  return (
    <PublicShell>
      <section className="grid gap-4">
        <Kicker>Demo mailbox</Kicker>
        <h1 className="text-5xl leading-[0.95]">Every email TrustVault <span className="text-gradient">sent</span>.</h1>
        <p className="max-w-2xl text-muted-foreground">On this laptop no real email is sent. Sign-in codes, document requests and approvals land here instead. It refreshes by itself.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-full border border-border bg-card px-3 text-sm" aria-label="Show emails for">
            <option value="">Everyone ({mails?.length ?? 0})</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw /> Refresh</Button>
        </div>
      </section>
      <ErrorText>{error}</ErrorText>
      {mails && !mails.length && <EmptyState icon={Inbox} title="No emails yet">Sign in or send a request and the email appears here.</EmptyState>}
      {shown.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <ul className="grid content-start gap-2">
            {shown.map((m) => (
              <li key={m.file}>
                <button type="button" onClick={() => setOpen(m)} className={cn('grid w-full gap-0.5 rounded-xl border p-3 text-left transition-colors', open?.file === m.file ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50')}>
                  <span className="flex items-center gap-2 font-semibold"><Mail className="size-4 shrink-0 text-primary" /><span className="truncate">{m.subject}</span></span>
                  <span className="flex justify-between gap-2 text-xs text-muted-foreground"><span className="truncate font-mono">{m.to}</span><span className="whitespace-nowrap">{fmtDate(m.at)}</span></span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-h-[60vh] overflow-hidden rounded-xl border border-border bg-white">
            {open ? <iframe title={open.subject} src={`/api/dev/mail/${encodeURIComponent(open.file)}`} sandbox="" className="h-full min-h-[60vh] w-full" />
              : <p className="p-6 text-sm text-neutral-500">Pick an email to read it.</p>}
          </div>
        </div>
      )}
    </PublicShell>
  );
}
