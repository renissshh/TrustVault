import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Eye, Check, X, PartyPopper, GraduationCap } from 'lucide-react';
import { api, fmtDate, TYPE_LABELS } from '@/lib/api';
import { burst } from '@/lib/burst';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsync, ErrorText, DocViewer, ScoreBar, CheckList, ask, toast, PageHeader, EmptyState, Initials } from '@/components/app/kit';

export default function Review() {
  const { data, error, reload } = useAsync(() => api('/admin/queue'));
  const [viewing, setViewing] = useState(null);
  const [done, setDone] = useState(0);
  // Optimistic: the card leaves the queue at once; if the server refuses, it comes back.
  const [gone, setGone] = useState([]);
  const queue = (data ?? []).filter((d) => !gone.includes(d.id));

  const decide = async (doc, decision, button) => {
    const note = decision === 'rejected'
      ? await ask({ title: `Reject "${doc.title}"?`, message: 'The student receives this reason by email.', input: { label: 'Reason', placeholder: 'e.g. Photo is blurry, please upload a clearer scan', minLength: 5 }, confirmText: 'Reject', danger: true })
      : await ask({ title: `Approve "${doc.title}"?`, message: `${doc.owner.name} gets a QR code anyone can use to confirm this document. This is recorded in the ledger.`, confirmText: 'Approve' });
    if (!note) return;
    const spot = button?.getBoundingClientRect(); // remembered before the card leaves
    setGone((g) => [...g, doc.id]);
    try {
      await api(`/admin/documents/${doc.id}/review`, { method: 'POST', body: { decision, note: decision === 'rejected' ? note : '' } });
      toast(`"${doc.title}" ${decision}.`);
      if (decision === 'verified') burst(spot);
      setDone((n) => n + 1);
    } catch (e) {
      toast(e.message, 'error');
      setGone((g) => g.filter((id) => id !== doc.id)); // server refused: the card comes back
    }
    reload();
  };

  return (
    <div className="grid gap-8">
      <PageHeader icon={ClipboardCheck} kicker="Verifier workspace" title="Verification Queue"
        stats={[['waiting for review', queue.length, queue.length ? 'warn' : 'ok'], ['reviewed this session', done, 'ok']]}>
        Open each document, compare it with the automatic checks, then approve or reject. Every decision is written to the hash ledger.
      </PageHeader>
      <ErrorText>{error}</ErrorText>
      <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {queue.map((d) => (
          <article key={d.id} data-spot className="grid content-start gap-3 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-brutal transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-primary/50 hover:shadow-brutal-lg">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Badge variant="violet">{TYPE_LABELS[d.type]}</Badge>
                <h3 className="mt-2 text-xl leading-tight">{d.title}</h3>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Initials name={d.owner.name} size={26} /><span><b className="text-foreground">{d.owner.name}</b> ({d.owner.studentId || d.owner.email}) · <span className="font-mono">{d.numberMasked || d.originalName}</span> · {fmtDate(d.createdAt)}</span></p>
              </div>
              <ScoreBar check={d.autoCheck} />
            </div>
            <CheckList checks={d.autoCheck?.checks} />
            {d.tampered && <ErrorText>This file failed its integrity check.</ErrorText>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setViewing(d)}><Eye /> View document</Button>
              <Button size="sm" variant="success" onClick={(e) => decide(d, 'verified', e.currentTarget)}><Check /> Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => decide(d, 'rejected')}><X /> Reject</Button>
            </div>
          </article>
        ))}
      </div>
      {data && !queue.length && <EmptyState icon={PartyPopper} title="The queue is clear" action={<Button asChild variant="outline"><Link to="/records"><GraduationCap /> Open student records</Link></Button>}>
        Nothing is waiting for verification. New uploads appear here as soon as their automatic checks finish.
      </EmptyState>}
      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
