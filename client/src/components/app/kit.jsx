// Shared building blocks used by every page: toasts, confirm dialog, modal, code boxes, vault forms,
// page header, filters, status badges. Primitives come from components/ui (shadcn/ui).
import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Toaster as Sonner, toast as sonner } from 'sonner';
import { AlertCircle, ArrowBigUp, Check, CheckCircle2, ClipboardPaste, Copy, Eye, EyeOff, Loader2, Unlock, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/fx';
import { sfx } from '@/lib/sound';
import { burst } from '@/lib/burst';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Toasts: toast('Saved') or toast('Failed', 'error') from anywhere ----------
export const toast = (message, tone = 'ok') => { sfx(tone === 'error' ? 'error' : 'success'); return tone === 'error' ? sonner.error(message) : sonner.success(message); };

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      icons={{ success: <CheckCircle2 className="size-5" />, error: <AlertCircle className="size-5" /> }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'glass flex w-full items-center gap-2.5 rounded-xl border border-border p-3 text-sm font-semibold text-card-foreground shadow-brutal-lg',
          success: '!border-success/60 [&_svg]:text-success',
          error: '!border-destructive/70 [&_svg]:text-destructive',
        },
      }}
    />
  );
}

// ---------- Modal: Esc closes, focus stays inside, focus returns afterwards (Radix Dialog) ----------
// `locked` keeps it open until the page closes it (used for the session-ending warning).
export function Modal({ title, onClose, children, wide, locked }) {
  // Opened from code (no Radix trigger), so remember what had focus and give it back on close.
  const [previous] = useState(() => document.activeElement);
  useEffect(() => () => { setTimeout(() => previous?.isConnected && previous.focus?.(), 0); }, [previous]);
  return (
    <Dialog open onOpenChange={(open) => !open && !locked && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={!locked}
        className={wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}
        onInteractOutside={(e) => locked && e.preventDefault()}
        onEscapeKeyDown={(e) => locked && e.preventDefault()}
      >
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Styled confirm / prompt: `await ask({...})` -> true | text | null ----------
let openDialog = () => {};
export const ask = (options) => new Promise((resolve) => openDialog({ ...options, resolve }));

export function DialogHost() {
  const [d, setD] = useState(null);
  openDialog = setD;
  if (!d) return null;
  const close = (value) => { d.resolve(value); setD(null); };
  return (
    <Modal title={d.title} onClose={() => close(null)}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); close(d.input ? new FormData(e.currentTarget).get('value').trim() : true); }}>
        {d.message && <p className="text-sm text-muted-foreground">{d.message}</p>}
        {d.input && (
          <Field label={d.input.label}>
            <Input name="value" required minLength={d.input.minLength ?? 1} placeholder={d.input.placeholder} />
          </Field>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => close(null)}>Cancel</Button>
          <Button variant={d.danger ? 'destructive' : 'default'}>{d.confirmText ?? 'Confirm'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Form field: label above, optional hint below ----------
export function Field({ label, hint, children, className }) {
  return (
    <label className={cn('grid gap-1.5 text-sm font-semibold', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const CheckRow = ({ children, className, ...props }) => (
  <label className={cn('flex items-start gap-2.5 text-sm', className)}>
    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--violet)]" {...props} />
    <span>{children}</span>
  </label>
);

// ---------- 6-box code input. Paste works; submits the form when all 6 digits are in. ----------
// `invalid` shakes the boxes when they appear (parents remount them after a wrong code).
export function OtpInput({ name = 'code', autoSubmit = true, autoFocus = true, invalid = false, secret = false, paste = false }) {
  const pasteCode = async () => {
    try { fill(0, await navigator.clipboard.readText()); } catch { toast('Allow clipboard access, or press Ctrl+V in the first box.', 'error'); }
  };
  const [digits, setDigits] = useState(Array(6).fill(''));
  const refs = useRef([]);
  const fill = (start, text) => {
    const chars = text.replace(/\D/g, '').slice(0, 6 - start).split('');
    const next = [...digits];
    chars.forEach((c, k) => { next[start + k] = c; });
    setDigits(next);
    refs.current[Math.min(start + chars.length, 5)]?.focus();
    if (autoSubmit && next.every(Boolean)) setTimeout(() => refs.current[0]?.form?.requestSubmit(), 0);
  };
  return (<>
    <div className={cn('flex justify-center gap-2', invalid && 'animate-shake')} role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          inputMode="numeric"
          type={secret ? 'password' : 'text'}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            'h-13 w-full max-w-12 rounded-lg border border-input bg-card text-center font-mono text-xl font-semibold text-card-foreground transition-[box-shadow,border-color,transform] duration-200 ease-[var(--ease-spring)] focus-visible:scale-105 focus-visible:border-ring focus-visible:shadow-[0_0_0_4px_var(--glow)] focus-visible:outline-none',
            d && 'animate-pop border-primary/60 bg-accent text-accent-foreground',
            invalid && 'border-destructive',
          )}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) { const next = [...digits]; next[i] = ''; setDigits(next); return; }
            fill(i, d && v.length === 2 ? v.replace(d, '') || v[0] : v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowLeft' && i) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); fill(0, e.clipboardData.getData('text')); }}
        />
      ))}
      <input type="hidden" name={name} value={digits.join('')} />
    </div>
    {paste && navigator.clipboard?.readText && (
      <button type="button" onClick={pasteCode} className="mx-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition-[color,border-color,box-shadow] duration-200 hover:border-primary hover:text-foreground hover:shadow-glow">
        <ClipboardPaste className="size-3.5" /> Paste code
      </button>
    )}
  </>);
}

// ---------- Password with show/hide and optional strength meter ----------
const STRENGTH = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_TONE = ['bg-destructive', 'bg-destructive', 'bg-amber-400', 'bg-amber-400', 'bg-success', 'bg-success'];
export function PasswordInput({ name = 'password', strength, ...rest }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  const [caps, setCaps] = useState(false);
  const onKey = (e) => setCaps(Boolean(e.getModifierState?.('CapsLock')));
  const score = [/.{8,}/, /.{12,}/, /[a-z].*[A-Z]|[A-Z].*[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  return <>
    <span className="relative block">
      <Input name={name} type={show ? 'text' : 'password'} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey} onKeyUp={onKey} onBlur={() => setCaps(false)} className="pr-11" {...rest} />
      <button type="button" className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
    {caps && <span className="flex animate-pop items-center gap-1.5 text-xs font-semibold text-amber-500 dark:text-amber-300" role="status"><ArrowBigUp className="size-4" /> Caps Lock is on</span>}
    {strength && value && (
      <span className="flex items-center gap-2 text-xs font-normal">
        <span className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => <i key={n} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', n <= score ? STRENGTH_TONE[score] : 'bg-muted')} />)}
        </span>
        <span className="w-20 text-right font-mono uppercase">{STRENGTH[score]}</span>
      </span>
    )}
  </>;
}

export const ErrorText = ({ children }) => (children ? (
  <p className="flex animate-pop items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/15 px-3 py-2 text-sm font-semibold [&>svg]:text-destructive" role="alert">
    <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{children}</span>
  </p>
) : null);

// Highlighted note. tone: default (amber) | ok | bad | info
const CALLOUT = { default: 'border-amber-400/50 bg-amber-400/12', ok: 'border-success/50 bg-success/12', bad: 'border-destructive/60 bg-destructive/12', info: 'border-violet/50 bg-violet/12' };
export const Callout = ({ tone = 'default', className, children }) => (
  <div className={cn('rounded-xl border px-4 py-3 text-sm font-medium', CALLOUT[tone], className)}>{children}</div>
);

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const reload = () => fn().then((data) => setState({ loading: false, data, error: '' }), (e) => setState({ loading: false, data: null, error: e.message }));
  useEffect(() => { reload(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload };
}

export const SkeletonRows = ({ rows = 3 }) => (
  <div className="grid gap-3" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
);

export const Spinner = ({ children }) => (
  <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" /> {children}</p>
);

// Guided empty state: an animated emblem, one line of explanation, optional "how it works" steps
// (steps = [[Icon, text], ...]) and the next action. `compact` is for small spots inside a card.
export function EmptyState({ icon: Icon, title, children, action, steps, compact }) {
  return (
    <div className={cn('es', compact && 'compact')}>
      {Icon && (
        <span className="es-emblem" aria-hidden="true">
          <i className="es-ring a" /><i className="es-ring b" /><i className="es-dot d1" /><i className="es-dot d2" /><i className="es-dot d3" />
          <span className="es-icon"><Icon className="size-1/2" /></span>
        </span>
      )}
      {title && <h3 className={compact ? 'text-lg' : 'text-2xl font-extrabold'}>{title}</h3>}
      {children && <p className="max-w-lg text-sm text-muted-foreground">{children}</p>}
      {steps && (
        <ol className="es-steps">
          {steps.map(([StepIcon, text], i) => (
            <li key={text} style={{ '--i': i }}>
              <span className="es-step-no">{i + 1}</span>
              <StepIcon className="size-5 text-primary" />
              <span>{text}</span>
            </li>
          ))}
        </ol>
      )}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

// Numbers count up from 0 with an ease-out curve.
export function CountUp({ value = 0, duration = 900 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return setN(value);
    let raf;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}

// Big number tile. tone picks the fill.
const STAT = {
  amber: 'border-amber-400/40 bg-amber-400/12 [&>b]:text-amber-600 dark:[&>b]:text-amber-300', violet: 'border-violet/40 bg-violet/12 [&>b]:text-blue-600 dark:[&>b]:text-violet',
  green: 'border-success/40 bg-success/12 [&>b]:text-emerald-600 dark:[&>b]:text-success', red: 'border-destructive/50 bg-destructive/12 [&>b]:text-rose-600 dark:[&>b]:text-destructive',
  sky: 'border-info/40 bg-info/12 [&>b]:text-sky-600 dark:[&>b]:text-info', ink: 'border-border bg-muted', card: 'border-border bg-card',
};
export const Stat = ({ label, value, tone = 'card', className, style }) => (
  <div data-spot data-tilt="" className={cn('rounded-xl border p-4 shadow-brutal transition-transform duration-300 ease-[var(--ease-spring)] hover:-translate-y-1', STAT[tone], className)} style={style}>
    <b className="block font-mono text-4xl leading-none font-semibold tabular-nums"><CountUp value={value} /></b>
    <span className="mt-2 block text-sm font-medium text-muted-foreground">{label}</span>
  </div>
);

const STATUS = {
  verified: 'success', approved: 'success', active: 'success', pending: 'warning', rejected: 'destructive', denied: 'destructive',
  tampered: 'destructive', revoked: 'ink', expired: 'outline', stored: 'info', used: 'outline',
};
export const StatusBadge = ({ status, children }) => <Badge variant={STATUS[status] ?? 'outline'}>{children ?? status}</Badge>;

// Form for actions that need the vault. The PIN is asked only while the vault is locked; the first
// correct PIN unlocks it for the rest of the session. `children` are the caller's own fields.
export function PinForm({ label = 'Enter your 6-digit vault PIN', submitText = 'Unlock', onSubmit, children }) {
  const { vaultUnlocked, setVault } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form className="grid gap-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError('');
      const form = Object.fromEntries(new FormData(e.currentTarget));
      try {
        await onSubmit(form);
        if (form.pin) setVault(true);
      } catch (err) {
        if (err.code === 'VAULT_LOCKED') setVault(false);
        setError(err.message);
      }
      setBusy(false);
    }}>
      {children}
      {vaultUnlocked
        ? <p className="flex items-center gap-2 font-mono text-xs uppercase"><Unlock className="size-4" /> Vault unlocked for this session - no PIN needed.</p>
        : <Field label={label}>
          <Input name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required className="font-mono text-lg tracking-[0.5em]" autoComplete="off" />
        </Field>}
      <ErrorText>{error}</ErrorText>
      <Button disabled={busy}>{busy ? 'Please wait…' : submitText}</Button>
    </form>
  );
}

// Asks for the PIN, then shows the watermarked file. Right-click and the PDF toolbar are disabled.
export function DocViewer({ doc, onClose }) {
  const { vaultUnlocked, setVault } = useAuth();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  const open = async ({ pin }) => {
    const res = await api(`/documents/${doc.id}/view`, { method: 'POST', body: { pin }, raw: true });
    setUrl(URL.createObjectURL(await res.blob()));
  };
  // vault already unlocked this session: open straight away, no PIN
  useEffect(() => {
    if (vaultUnlocked) open({}).catch((e) => { if (e.code === 'VAULT_LOCKED') setVault(false); else setError(e.message); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal title={doc.title} onClose={onClose} wide={Boolean(url)}>
      {url ? (
        <FileFrame url={url} pdf={doc.mime === 'application/pdf'} title={doc.title}>
          This copy is watermarked with your email. Every view is recorded in the activity log.
        </FileFrame>
      ) : vaultUnlocked ? (
        error ? <ErrorText>{error}</ErrorText> : <Spinner>Opening securely…</Spinner>
      ) : (
        <PinForm label="Enter your 6-digit vault PIN to view this document" onSubmit={open} />
      )}
    </Modal>
  );
}

export const FileFrame = ({ url, pdf, title, children }) => (
  <div className="grid gap-3" onContextMenu={(e) => e.preventDefault()}>
    {pdf
      ? <iframe src={`${url}#toolbar=0`} title={title} className="h-[70dvh] w-full rounded-lg border border-border bg-white" />
      : <img src={url} alt={title} draggable={false} className="max-h-[70dvh] w-full rounded-lg border border-border bg-white object-contain" />}
    <p className="text-xs text-muted-foreground">{children}</p>
  </div>
);

export function ScoreBar({ check }) {
  if (!check || check.state === 'running') return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Checking…</span>;
  if (check.state === 'failed') return <span className="text-xs text-muted-foreground">Check failed</span>;
  const tone = check.score >= 80 ? 'bg-success' : check.score >= 50 ? 'bg-amber-400' : 'bg-destructive';
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold" title="Automatic verification score">
      <span className="block h-2 w-20 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', tone)} style={{ width: `${check.score}%` }} /></span>{check.score}%
    </span>
  );
}

export const CheckList = ({ checks = [] }) => (
  <ul className="grid gap-1.5 text-sm">
    {checks.map((c) => (
      <li key={c.name} className="flex items-start gap-2">
        <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-ink', c.ok ? 'bg-success' : 'bg-destructive')}>
          {c.ok ? <Check className="size-3" /> : <X className="size-3" />}
        </span>
        <span><span className="sr-only">{c.ok ? 'Passed: ' : 'Failed: '}</span>{c.name}{c.detail && <span className="text-muted-foreground"> - {c.detail}</span>}</span>
      </li>
    ))}
  </ul>
);

export const copyText = async (text, message) => {
  const button = document.activeElement?.matches('button') ? document.activeElement : null;
  try { await navigator.clipboard.writeText(text); } catch { return toast('Could not copy. Select the text and copy it by hand.', 'error'); }
  toast(message);
  if (button) burst(button, { size: 0.6 });
};

export function BackupCodes({ codes }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Save these one-time backup codes somewhere safe. Each one can replace a Google Authenticator code once if you lose your phone.</p>
      <div className="grid grid-cols-2 gap-2">{codes.map((c) => <code key={c} className="rounded-md border border-border bg-muted px-2 py-1.5 text-center font-mono text-sm font-semibold">{c}</code>)}</div>
      <Button type="button" variant="outline" onClick={() => copyText(codes.join('\n'), 'Backup codes copied.')}><Copy /> Copy codes</Button>
    </div>
  );
}

// ---------- Page header shared by every signed-in page ----------
// stats: [label, value, tone]
export function PageHeader({ icon: Icon, kicker, title, children, actions, stats }) {
  return (
    <header className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="hidden size-14 shrink-0 animate-pop place-items-center rounded-2xl bg-linear-to-br from-primary to-violet text-ink shadow-glow sm:grid"><Icon className="size-7" /></span>
          <div>
            <span className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">{kicker}</span>
            <h1 className="text-3xl leading-none sm:text-4xl">{title}</h1>
            {children && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{children}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
      {stats && (
        <div className="stagger grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ '--n': stats.length }}>
          {stats.map(([label, value, tone], i) => (
            <Stat key={label} label={label} value={value} tone={tone === 'ok' ? 'green' : tone === 'warn' ? 'amber' : 'card'} className="p-3 [&>b]:text-3xl" style={{ '--i': i }} />
          ))}
        </div>
      )}
    </header>
  );
}

// ---------- Segmented filter: options are [value, text, count?] ----------
export function Segmented({ options, value, onChange, label }) {
  const id = useId();
  return (
    <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-3xl border border-border bg-card/70 p-1 backdrop-blur-md" role="group" aria-label={label}>
      {options.map(([v, text, count]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => v !== value && onChange(v)}
          className={cn('relative inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-200', v === value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {v === value && <motion.span layoutId={id} className="absolute inset-0 rounded-full neon-fill shadow-glow" transition={spring} />}
          <span className="relative">{text}</span>
          {count != null && <span className={cn('relative rounded-full px-1.5 font-mono text-xs', v === value ? 'bg-ink/15' : 'bg-card')}>{count}</span>}
        </button>
      ))}
    </div>
  );
}

const LOCAL_IP = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/;
export const friendlyIp = (ip) => (LOCAL_IP.test(ip) ? 'This computer' : ip);

export const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// Round initials badge for other people (verifiers, students) - the signed-in user has <Avatar>.
export const Initials = ({ name = '', size = 40, className }) => (
  <span className={cn('inline-grid shrink-0 place-items-center rounded-full font-mono font-semibold text-ink', className)} style={{ width: size, height: size, fontSize: size * 0.36, background: 'linear-gradient(135deg, var(--primary), var(--violet) 60%, var(--pink))', boxShadow: '0 0 18px -6px var(--primary)' }} aria-hidden="true">
    {name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'}
  </span>
);
