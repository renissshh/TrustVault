import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Clock, FileSearch, FolderLock, Loader2, ShieldX, XCircle } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { cn } from '@/lib/utils';
import { burst } from '@/lib/burst';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ErrorText, useAsync, Stat } from '@/components/app/kit';
import { PublicShell, Kicker } from '@/components/app/public';

// status -> [icon, heading, explanation, fill]
const HEADINGS = {
  verified: [BadgeCheck, 'Verified document', 'An authorized verifier checked this document and it has not been changed since.', 'bg-success'],
  tampered: [ShieldX, 'Tampered - do not trust', 'The stored file no longer matches its original fingerprint.', 'bg-destructive'],
  pending: [Clock, 'Waiting for verification', 'This document is in TrustVault but has not been approved yet.', 'bg-primary'],
  rejected: [XCircle, 'Rejected', 'A verifier rejected this document.', 'bg-destructive'],
  stored: [FolderLock, 'Stored, not verified', 'This file is in a TrustVault vault as an "Other" document. It was checked for originality but not verified by an authority.', 'bg-info'],
};

function Result({ r, onReset }) {
  const [Icon, heading, text, tone] = r.status ? HEADINGS[r.status] : [XCircle, 'No match found', '', 'bg-destructive'];
  const icon = useRef(null);
  useEffect(() => { if (r.status === 'verified') setTimeout(() => burst(icon.current, { size: 1.2 }), 200); }, [r]);
  const facts = r.title && [
    ['Document', `${r.title}${r.title !== r.type ? ` (${r.type})` : ''}`],
    ['Holder', `${r.holder}${r.studentId ? ` · ${r.studentId}` : ''}`],
    r.number && ['Number', r.number, true],
    r.verifiedBy && ['Verified by', `${r.verifiedBy} on ${fmtDate(r.verifiedAt)}`],
    ['Uploaded', fmtDate(r.uploadedAt)],
    ['SHA-256', r.sha256, true],
  ].filter(Boolean);
  return (
    <section className="animate-pop overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-brutal-lg" aria-live="polite">
      <div className={cn('flex flex-wrap items-center justify-between gap-4 border-b border-border p-5 text-ink', tone)}>
        <h2 className="flex items-center gap-3 text-2xl sm:text-3xl"><span ref={icon} className="grid shrink-0"><Icon className="size-8" /></span> {heading}</h2>
        <Button size="sm" variant="outline" onClick={onReset}>Check another</Button>
      </div>
      <div className="grid gap-4 p-5">
        {facts ? <>
          <p className="text-sm text-muted-foreground">{text}</p>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            {facts.map(([k, v, mono]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">{k}</dt>
                <dd className={cn('break-all', mono && 'font-mono text-xs')}>{v}</dd>
              </div>
            ))}
          </dl>
        </> : (
          <div className="grid gap-2 text-sm">
            <p>This file is not in TrustVault. That means one of these:</p>
            <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground">
              <li>It was <b className="text-foreground">never uploaded</b> to a TrustVault vault, or</li>
              <li>It was <b className="text-foreground">edited</b> after upload - even one changed pixel or a re-save changes the fingerprint, or</li>
              <li>It is a <b className="text-foreground">screenshot / photo / re-scan</b> of the document rather than the original file. Ask the holder for the QR code instead.</li>
            </ul>
          </div>
        )}
        {r.fileHash && <p className="font-mono text-xs break-all text-muted-foreground">Fingerprint of your file: {r.fileHash}</p>}
      </div>
    </section>
  );
}

const STEPS = [
  ['Upload', 'The holder uploads a document. It is encrypted with AES-256 and its SHA-256 fingerprint is written to a tamper-evident ledger.', 'bg-primary'],
  ['Verify', 'OCR and format checks run automatically, then an authorized verifier approves it.', 'bg-violet'],
  ['Prove', 'A QR code is issued. Anyone can scan it - or drop the original file here - to confirm it is genuine.', 'bg-success'],
];

const FAQ = [
  ['Do I need an account?', 'No. This page is public. You only see the verification result - never the document itself.'],
  ['Why does a photo of a verified certificate show "No match"?', 'File checks compare exact fingerprints. A photo or screenshot is a different file. Use the QR code for printed or photographed documents.'],
  ['Is my file uploaded or stored?', 'No. Your file is only used to calculate its fingerprint for this check and is not saved.'],
  ['Are PAN / Aadhaar checked against the government database?', 'TrustVault checks format, checksums and the document text, and a human verifier makes the final decision. Direct NSDL / UIDAI lookups need licensed government access.'],
];

export default function PublicVerify() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const stats = useAsync(() => api('/public/stats'));

  useEffect(() => {
    setResult(null);
    if (code) api(`/public/verify/${code}`).then(setResult, (e) => setError(e.message));
  }, [code]);

  const checkFile = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    setError('');
    setBusy(true);
    try { setResult(await api('/public/verify-file', { method: 'POST', form })); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const reset = () => { setResult(null); if (code) navigate('/verify'); };

  return (
    <PublicShell brandTo="/">
      <section className="grid gap-6">
        <Kicker>Public document verifier</Kicker>
        <h1 className="max-w-3xl text-5xl leading-[0.95] sm:text-6xl">Is this document <span className="text-gradient">genuine?</span></h1>
        <p className="max-w-2xl text-lg text-muted-foreground">Employers, colleges and banks can confirm a TrustVault document in seconds - no account, no phone calls.</p>
        {stats.data && (
          <div className="stagger grid max-w-2xl grid-cols-3 gap-3">
            <Stat label="verified documents" value={stats.data.verified} tone="green" className="p-3 [&>b]:text-3xl" />
            <Stat label="documents protected" value={stats.data.documents} tone="violet" className="p-3 [&>b]:text-3xl" style={{ '--i': 1 }} />
            <Stat label="ledger records" value={stats.data.blocks} className="p-3 [&>b]:text-3xl" style={{ '--i': 2 }} />
          </div>
        )}
      </section>

      <div className="grid gap-4">
        <ErrorText>{error}</ErrorText>
        {result ? <Result r={result} onReset={reset} /> : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const c = new FormData(e.currentTarget).get('code').trim(); if (c) navigate(`/verify/${c.split('/').pop()}`); }}>
                <h2 className="text-xl">Have a QR code or link?</h2>
                <p className="text-sm text-muted-foreground">Scan the QR on the document with your phone camera, or paste the code / link here.</p>
                <Input name="code" placeholder="e.g. e96dec60dcbbeb63" className="font-mono" aria-label="Verification code or link" />
                <Button>Check code</Button>
              </form>
            </Card>
            <label
              className={cn('grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center text-card-foreground transition-colors', dragging && 'bg-accent text-accent-foreground')}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); checkFile(e.dataTransfer.files[0]); }}>
              {busy ? <Loader2 className="size-8 animate-spin" /> : <FileSearch className="size-8" />}
              <b className="text-xl">{busy ? 'Checking fingerprint…' : 'Have the original file?'}</b>
              <span className="text-sm text-muted-foreground">Drop the PDF or image here, or click to choose. Even a 1-pixel edit changes its SHA-256 fingerprint.</span>
              <input type="file" className="sr-only" onChange={(e) => checkFile(e.target.files[0])} />
            </label>
          </div>
        )}
      </div>

      <section className="grid gap-6">
        <h2 className="text-4xl">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, text, tone], i) => (
            <li key={title} className="relative grid gap-2 border border-border bg-card p-5 pt-8 text-card-foreground rounded-xl shadow-brutal">
              <span className={cn('absolute -top-5 left-5 grid size-10 place-items-center rounded-xl font-mono text-lg font-semibold text-ink shadow-glow', tone)}>{i + 1}</span>
              <h3 className="text-xl">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4">
        <h2 className="text-4xl">Questions</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="group border border-border bg-card text-card-foreground rounded-lg shadow-brutal-sm open:shadow-brutal">
            <summary className="flex items-center justify-between gap-4 p-4 font-semibold marker:content-none">
              {q}<span className="font-mono text-xl leading-none group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="border-t border-border p-4 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </section>
    </PublicShell>
  );
}
