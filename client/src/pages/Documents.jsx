import { useDeferredValue, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Car, CreditCard, FileText, Fingerprint, GraduationCap, Upload, Camera, Mail, Eye, QrCode, Share2, Trash2, Repeat, Lightbulb, Copy, FolderLock, Search, ChevronDown, Check, Plus, CheckCircle2 } from 'lucide-react';
import { api, fmtDate, fmtDay, fmtSize, TYPE_LABELS, SECTIONS, NUMBER_FIELD } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useVerifiedCelebration } from '@/lib/confetti';
import { burst } from '@/lib/burst';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useAsync, Modal, StatusBadge, ErrorText, PinForm, DocViewer, ScoreBar, CheckList, SkeletonRows, ask, toast, PageHeader, Segmented,
  Field, CheckRow, Callout, EmptyState, copyText,
} from '@/components/app/kit';

const REQUIRED = ['pan', 'aadhaar', 'marksheet'];
const inSection = (n) => (d) => SECTIONS[n].types.includes(d.type);
const FILTERS = {
  all: ['All', () => true],
  identity: ['Identity', inSection(0)],
  academic: ['Academic', inSection(1)],
  other: ['Other', inSection(2)],
  verified: ['Verified', (d) => d.status === 'verified'],
  pending: ['Pending', (d) => d.status === 'pending'],
};
const TWO_SIDED = ['aadhaar', 'license'];
// [icon, one-line hint, colour] for the "add this document" tiles
const TYPE_TILE = {
  pan: [CreditCard, 'Number and name are checked automatically', 'var(--primary)'],
  aadhaar: [Fingerprint, 'Front and back. Use a masked copy', 'var(--violet)'],
  license: [Car, 'Front and back, with the licence number', 'var(--info)'],
  marksheet: [GraduationCap, 'Any semester or board marksheet', 'var(--success)'],
  certificate: [Award, 'Degrees, courses and awards', '#fbbf24'],
  other: [FileText, 'Anything else. Stored safely, not verified', 'var(--pink)'],
};
const TYPE_TONE = { pan: 'bg-linear-to-r from-primary to-success', aadhaar: 'bg-linear-to-r from-violet to-info', license: 'bg-info', marksheet: 'bg-linear-to-r from-success to-primary', certificate: 'bg-success', other: 'bg-muted' };

// Plain-language advice for each failed automatic check.
const TIPS = [
  ['readable', 'Retake the photo in good light, flat on a table, with all 4 corners visible and no glare.'],
  ['resolution', 'Use a sharper photo or scan (at least 1000 pixels wide).'],
  ['number appears', 'Check that the number you typed matches the card exactly. Use "Change type" to fix it.'],
  ['name appears', 'Your profile name must match the card. You can correct it on the Security page.'],
  ['keywords', 'Make sure the whole card is in the photo, including the printed header.'],
  ['editing software', 'Upload the original photo or PDF, not a copy edited in an app.'],
  ['modified after', 'Download a fresh copy of the PDF from the official source (e.g. DigiLocker) and upload that.'],
  ['unique', 'This exact file already exists in another account. Contact your administrator if that is a mistake.'],
  ['5th letter', 'The 5th letter of a PAN is the first letter of the surname. Check the PAN number and your name.'],
];
const tipsFor = (checks = []) => [...new Set(checks.filter((c) => !c.ok).map((c) => TIPS.find(([k]) => c.name.toLowerCase().includes(k))?.[1]).filter(Boolean))];

function TypeFields({ type, setType }) {
  const field = NUMBER_FIELD[type];
  return <>
    <Field label="Document type">
      <Select name="type" value={type} onValueChange={setType}>
        <SelectTrigger className="h-10 w-full bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SECTIONS.map((s) => (
            <SelectGroup key={s.title}>
              <SelectLabel>{s.title}</SelectLabel>
              {s.types.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </Field>
    <Field label={field.label} hint={SECTIONS.find((s) => s.types.includes(type)).note}>
      <Input key={type} name="number" required={field.required} className="font-mono" placeholder={field.placeholder} autoComplete="off" />
    </Field>
    {import.meta.env.VITE_DEMO && <Callout className="text-xs"><b>Demo site.</b> Upload sample documents only, not your real ID.</Callout>}
    {type === 'aadhaar' && <Callout tone="info" className="text-xs">Privacy tip: upload a <b>Masked Aadhaar</b> (only last 4 digits visible) from myaadhaar.uidai.gov.in.</Callout>}
  </>;
}

// Drag & drop, file picker, or phone camera - with a preview of the chosen file.
function FilePick({ label, file, setFile, optional }) {
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!file?.type.startsWith('image/')) return setPreview('');
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{label}{optional && <span className="font-normal text-muted-foreground"> (optional)</span>}</span>
      <label className={cn('group grid cursor-pointer place-items-center gap-1 rounded-xl border border-dashed hover:border-primary border-border bg-muted p-4 text-center transition-colors', file && 'border-solid bg-card', dragging && 'bg-accent text-accent-foreground')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); setFile(e.dataTransfer.files[0]); }}>
        {preview ? <img src={preview} alt="" className="max-h-32 border border-border" /> : <Upload className="size-6 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-1 group-hover:scale-110" />}
        <b className="text-sm break-all">{file ? file.name : 'Tap or drop to upload'}</b>
        <span className="text-xs text-muted-foreground">{file ? fmtSize(file.size) : 'PDF, JPG, PNG, WEBP · up to 10 MB'}</span>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(e) => setFile(e.target.files[0])} />
      </label>
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <label><Camera /> Take photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files[0])} /></label>
        </Button>
        {file && <Button type="button" size="sm" variant="ghost" onClick={() => setFile(null)}>Remove</Button>}
      </div>
    </div>
  );
}

function UploadModal({ onClose, onDone, initialType = 'pan' }) {
  const [type, setType] = useState(NUMBER_FIELD[initialType] ? initialType : 'pan');
  const [file, setFile] = useState(null);
  const [back, setBack] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const twoSided = TWO_SIDED.includes(type);

  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const button = e.currentTarget.querySelector('[type=submit]');
    form.set('type', type);
    form.set('file', file);
    if (twoSided && back) form.set('back', back);
    setBusy(true);
    setError('');
    try {
      await api('/documents', { method: 'POST', form });
      burst(button?.getBoundingClientRect(), { size: 0.9 });
      toast('Uploaded and encrypted. Automatic checks are running.');
      onDone();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <Modal title="Upload a document" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <TypeFields type={type} setType={setType} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title (optional)"><Input name="title" placeholder={TYPE_LABELS[type]} /></Field>
          <Field label="Expiry date (optional)"><Input name="expiryDate" type="date" /></Field>
        </div>
        <FilePick label={twoSided ? 'Front side' : 'File'} file={file} setFile={setFile} />
        {twoSided && <FilePick label="Back side" optional file={back} setFile={setBack} />}
        <ErrorText>{error}</ErrorText>
        <Button size="lg" disabled={busy || !file}>{busy ? 'Encrypting & uploading…' : 'Upload securely'}</Button>
      </form>
    </Modal>
  );
}

function ChangeTypeModal({ doc, onClose, onDone }) {
  const [type, setType] = useState(doc.autoCheck?.detectedType ?? doc.type);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/documents/${doc.id}/type`, { method: 'PATCH', body: { ...Object.fromEntries(new FormData(e.currentTarget)), type } });
      toast(`Saved as ${TYPE_LABELS[type]}. Checking again…`);
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal title={`Change type of "${doc.title}"`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm text-muted-foreground">The file stays the same. It will be checked again for its new type.</p>
        <TypeFields type={type} setType={setType} />
        <ErrorText>{error}</ErrorText>
        <Button>Save type & re-check</Button>
      </form>
    </Modal>
  );
}

const QUALITY = [['original', 'Original', 'Exact files, no compression'], ['medium', 'Medium', 'Good for email & forms'], ['small', 'Small KB', 'For portals with tight size limits']];

function ExportModal({ docs, onClose }) {
  const [selected, setSelected] = useState(docs.map((d) => d.id));
  const [result, setResult] = useState(null);
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const send = async ({ pin, quality }) => {
    if (!selected.length) throw new Error('Select at least one document.');
    setResult(await api('/documents/export', { method: 'POST', body: { ids: selected, quality, pin } }));
  };

  return (
    <Modal title="Email me my documents" onClose={onClose}>
      {result ? (
        <div className="grid gap-4">
          <Callout tone="ok" className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Sent to {result.sentTo}</Callout>
          <p className="text-sm">{result.summary}</p>
          <div className="grid gap-2 border border-border bg-muted p-3">
            <span className="text-sm font-semibold">ZIP password - write it down now, it is not in the email</span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="font-mono text-lg font-semibold break-all">{result.zipPassword}</code>
              <Button size="sm" variant="outline" onClick={() => copyText(result.zipPassword, 'Password copied.')}><Copy /> Copy</Button>
            </div>
          </div>
          <Callout className="grid gap-1.5 text-xs">
            <b>How to open the ZIP</b>
            <span>It is locked with AES-256, so Windows' own "Extract All" cannot open it. Use the free <a className="font-semibold underline" href="https://www.7-zip.org/" target="_blank" rel="noreferrer">7-Zip</a> (or WinRAR, or your phone's file manager):</span>
            <ol className="ml-4 list-decimal">
              <li>Save the ZIP from the email.</li>
              <li>Right-click it, choose <b>7-Zip → Extract Here</b> (on Windows 11 click <b>Show more options</b> first).</li>
              <li>Type the password above.</li>
            </ol>
          </Callout>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <PinForm submitText="Compress, encrypt & email" onSubmit={send}>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">Documents</legend>
            {docs.map((d) => (
              <CheckRow key={d.id} checked={selected.includes(d.id)} onChange={() => toggle(d.id)}>{d.title} <span className="text-xs text-muted-foreground">({fmtSize(d.size)})</span></CheckRow>
            ))}
          </fieldset>
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold">File size</legend>
            {QUALITY.map(([value, title, hint]) => (
              <label key={value} className="grid cursor-pointer gap-0.5 rounded-lg border border-border bg-card p-3 transition-[border-color,box-shadow,background-color] duration-200 has-checked:border-primary has-checked:bg-primary/15 has-checked:shadow-glow has-focus-visible:outline-3 has-focus-visible:outline-ring">
                <input type="radio" name="quality" value={value} defaultChecked={value === 'medium'} className="sr-only" />
                <b className="text-sm">{title}</b><span className="text-xs opacity-80">{hint}</span>
              </label>
            ))}
          </fieldset>
        </PinForm>
      )}
    </Modal>
  );
}

function ShareModal({ doc, onClose }) {
  const [hours, setHours] = useState('24');
  return (
    <Modal title={`Share "${doc.title}"`} onClose={onClose}>
      <PinForm submitText="Send secure link" onSubmit={async (f) => {
        await api('/shares', { method: 'POST', body: { ...f, hours, docId: doc.id } });
        toast(`Secure link emailed to ${f.email}.`);
        onClose();
      }}>
        <p className="text-sm text-muted-foreground">The recipient gets a link and must confirm a code sent to their email. Every view is watermarked with their address.</p>
        <Field label="Recipient email"><Input name="email" type="email" required placeholder="hr@company.com" /></Field>
        <Field label="Link expires after">
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger className="h-10 w-full bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hour</SelectItem><SelectItem value="24">24 hours</SelectItem><SelectItem value="72">3 days</SelectItem><SelectItem value="168">7 days</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </PinForm>
    </Modal>
  );
}

function QrModal({ doc, onClose }) {
  const { data, error } = useAsync(() => api(`/documents/${doc.id}/qr`));
  return (
    <Modal title="Verification QR code" onClose={onClose}>
      <ErrorText>{error}</ErrorText>
      {!data && !error && <SkeletonRows rows={2} />}
      {data && (
        <div className="grid justify-items-center gap-3 text-center">
          <img className="size-52 border border-border bg-white p-2 rounded-xl shadow-brutal" src={data.qr} alt="Verification QR" />
          <p className="text-sm text-muted-foreground">Anyone can scan this to confirm "{doc.title}" is verified - no login needed.</p>
          <code className="bg-muted px-2 py-1 font-mono text-xs break-all">{data.url}</code>
          <Button variant="outline" onClick={() => copyText(data.url, 'Link copied.')}><Copy /> Copy link</Button>
        </div>
      )}
    </Modal>
  );
}

function DocCard({ d, open, onToggle, onAction }) {
  const suggested = d.autoCheck?.detectedType;
  const tips = d.autoCheck?.state === 'done' && d.autoCheck.score < 80 && d.status !== 'verified' ? tipsFor(d.autoCheck.checks) : [];
  return (
    <article data-spot className={cn('grid gap-3 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-brutal transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-primary/40 hover:shadow-brutal-lg', d.tampered && 'border-destructive')}>
      <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-ink', TYPE_TONE[d.type], d.type === 'other' && 'text-foreground')}>
        <span className="font-mono text-[11px] font-semibold tracking-widest uppercase">{TYPE_LABELS[d.type]}{d.sides > 1 && ' · front + back'}</span>
        <span className="flex gap-1.5">{d.tampered && <Badge variant="destructive">Tampered</Badge>}<StatusBadge status={d.status} /></span>
      </div>
      <div className="grid gap-3 px-4 pb-4">
        <div>
          <h3 className="text-lg leading-tight">{d.title}</h3>
          <p className="text-xs text-muted-foreground"><span className="font-mono">{d.numberMasked || d.originalName}</span> · {fmtSize(d.size)} · {fmtDate(d.createdAt)}{d.expiryDate && <> · expires {fmtDay(d.expiryDate)}</>}</p>
        </div>
        {suggested && d.status !== 'verified' && (
          <Callout className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>This looks like a <b>{TYPE_LABELS[suggested]}</b>, not "{TYPE_LABELS[d.type]}".</span>
            <Button size="sm" variant="secondary" onClick={() => onAction('retype', d)}>Change type</Button>
          </Callout>
        )}
        {tips.length > 0 && (
          <div className="grid gap-1 border border-border bg-muted p-3 text-xs">
            <b className="flex items-center gap-1.5"><Lightbulb className="size-4" /> How to improve this score</b>
            <ul className="grid list-disc gap-1 pl-5">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}
        <button type="button" className="flex w-fit items-center gap-2 text-xs font-semibold" onClick={onToggle} aria-expanded={open}>
          {d.type === 'other' ? 'Originality check' : 'Auto-check'} <ScoreBar check={d.autoCheck} /> <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
        {open && <>
          <CheckList checks={d.autoCheck?.checks} />
          <p className="font-mono text-[11px] break-all text-muted-foreground">Digital fingerprint (SHA-256): {d.sha256}</p>
        </>}
        {d.status === 'rejected' && d.reviewNote && <ErrorText>Reason: {d.reviewNote}</ErrorText>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAction('view', d)}><Eye /> View</Button>
          {d.status === 'verified' && <Button size="sm" variant="accent" onClick={() => onAction('qr', d)}><QrCode /> QR code</Button>}
          <Button size="sm" variant="outline" onClick={() => onAction('share', d)}><Share2 /> Share</Button>
          {d.status !== 'verified' && !suggested && <Button size="sm" variant="outline" onClick={() => onAction('retype', d)}><Repeat /> Change type</Button>}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onAction('delete', d)} aria-label={`Delete ${d.title}`}><Trash2 /> Delete</Button>
        </div>
      </div>
    </article>
  );
}

export default function Documents() {
  const { data, loading, error, reload } = useAsync(() => api('/documents'));
  const [params, setParams] = useSearchParams();
  // ?upload=pan (from the dashboard) opens the upload window straight away
  const [modal, setModal] = useState(() => (params.get('upload') ? { kind: 'upload', type: params.get('upload') } : null)); // { kind, doc }
  useEffect(() => { if (params.has('upload')) setParams({}, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim()); // typing stays instant; the list catches up
  const list = data ?? [];
  const { user } = useAuth();
  useVerifiedCelebration(data, user.id, (fresh) => toast(`${fresh[0].title} was verified. Its QR code is ready.`));

  useEffect(() => { window.addEventListener('tv-live', reload); return () => window.removeEventListener('tv-live', reload); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // While OCR checks are running, refresh every 3 seconds.
  const running = list.some((d) => d.autoCheck?.state === 'running');
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const verifiedTypes = REQUIRED.filter((t) => list.some((d) => d.type === t && d.status === 'verified'));
  const close = () => setModal(null);
  const done = () => { close(); reload(); };
  const onAction = async (kind, doc) => {
    if (kind !== 'delete') return setModal({ kind, doc });
    const ok = await ask({ title: 'Delete document?', message: `"${doc.title}" will be permanently removed from your vault. This cannot be undone.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    await api(`/documents/${doc.id}`, { method: 'DELETE' });
    toast('Document deleted.');
    reload();
  };

  const shown = list.filter((d) => FILTERS[filter][1](d)
    && (!search || `${d.title} ${TYPE_LABELS[d.type]} ${d.numberMasked} ${d.originalName}`.toLowerCase().includes(search.toLowerCase())));
  const grouped = filter === 'all' && !search;
  const card = (d) => <DocCard key={d.id} d={d} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} onAction={onAction} />;
  const grid = 'grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3';

  return (
    <div className="grid gap-8">
      <PageHeader
        icon={FolderLock}
        kicker="Encrypted vault"
        title="My Documents"
        actions={<>
          <Button variant="outline" disabled={!list.length} onClick={() => setModal({ kind: 'export' })}><Mail /> Email me a ZIP</Button>
          <Button onClick={() => setModal({ kind: 'upload' })}><Upload /> Upload document</Button>
        </>}
        stats={[['in your vault', list.length], ['verified', list.filter((d) => d.status === 'verified').length, 'ok'], ['waiting for review', list.filter((d) => d.status === 'pending').length, 'warn']]}
      >
        AES-256 encrypted · SHA-256 fingerprinted · checked for originality.
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filter documents" value={filter} onChange={setFilter}
          options={Object.entries(FILTERS).map(([k, [label, test]]) => [k, label, list.filter(test).length])} />
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" className="pl-9" placeholder="Search title, type or number…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search documents" />
        </label>
      </div>

      <Card className="grid gap-3">
        <div className="flex items-center justify-between gap-2"><b>Identity checklist</b><span className="font-mono text-xs">{verifiedTypes.length} of {REQUIRED.length} verified</span></div>
        <Progress value={(verifiedTypes.length / REQUIRED.length) * 100} aria-label="Identity checklist progress" />
        <div className="flex flex-wrap gap-2">
          {REQUIRED.map((t) => <Badge key={t} variant={verifiedTypes.includes(t) ? 'success' : 'outline'}>{verifiedTypes.includes(t) && <Check />}{TYPE_LABELS[t]}</Badge>)}
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>
      {loading && <SkeletonRows rows={3} />}

      {!loading && grouped && SECTIONS.map((s) => {
        const docs = list.filter((d) => s.types.includes(d.type));
        return (
          <section key={s.title} className="grid gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl">{s.title} <span className="rounded-full bg-muted px-2.5 font-mono text-sm text-muted-foreground">{docs.length}</span></h2>
              <p className="text-sm text-muted-foreground">{s.note}</p>
            </div>
            {docs.length > 0 && <div className={grid}>{docs.map(card)}</div>}
            {!docs.length && (
              <div className="dt">
                {s.types.map((t) => {
                  const [Icon, hint, tone] = TYPE_TILE[t];
                  return (
                    <button key={t} type="button" style={{ '--c': tone }} onClick={() => setModal({ kind: 'upload', type: t })}>
                      <span className="dt-icon"><Icon className="size-6" /></span>
                      <span><b>{TYPE_LABELS[t]}</b><small>{hint}</small></span>
                      <span className="plus"><Plus className="size-4" /></span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {!loading && !grouped && (
        shown.length
          ? <div className={grid}>{shown.map(card)}</div>
          : <EmptyState icon={Search} title="Nothing found">No documents match{search && <> "<b>{search}</b>"</>}.</EmptyState>
      )}

      {modal?.kind === 'upload' && <UploadModal onClose={close} onDone={done} initialType={modal.type} />}
      {modal?.kind === 'retype' && <ChangeTypeModal doc={modal.doc} onClose={close} onDone={done} />}
      {modal?.kind === 'export' && <ExportModal docs={list} onClose={close} />}
      {modal?.kind === 'view' && <DocViewer doc={modal.doc} onClose={close} />}
      {modal?.kind === 'share' && <ShareModal doc={modal.doc} onClose={close} />}
      {modal?.kind === 'qr' && <QrModal doc={modal.doc} onClose={close} />}
    </div>
  );
}
