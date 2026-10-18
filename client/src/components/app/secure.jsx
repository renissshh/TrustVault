// Two security moments, each one step at a time:
//  1. VaultLock - after signing in, the vault PIN is entered once; then the whole site works without it.
//  2. SecureFlow - before a sensitive change: password -> email code -> Google Authenticator -> the change.
//     Passing it once keeps you verified for 10 minutes (server: requireStepUp).
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { KeyRound, Mail, Smartphone, Check, Lock, Unlock, ShieldCheck, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Aurora, ease } from '@/lib/fx';
import { burst } from '@/lib/burst';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, OtpInput, PasswordInput, ErrorText, Field, Callout, toast } from './kit';
import { Avatar } from './account';

// Runs a form submit with busy/error handling; `fail` remounts the code boxes so they clear and shake.
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const run = (fn) => async (e) => {
    e.preventDefault();
    if (busy) return;
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      await fn(form);
    } catch (err) {
      setError(err.message);
      setAttempt((a) => a + 1);
    }
    setBusy(false);
  };
  return { busy, error, setError, attempt, run };
}

// ---------- 1. Vault lock screen ----------
export function VaultLock() {
  const { user, setVault, logout } = useAuth();
  const { busy, error, attempt, run } = useSubmit();
  const [opening, setOpening] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();
  const first = user.name.split(' ')[0];

  const padlock = useRef(null);
  const unlock = run(async ({ pin }) => {
    if (!/^\d{6}$/.test(pin)) throw new Error('Enter all 6 digits.');
    await api('/auth/vault/unlock', { method: 'POST', body: { pin } });
    setOpening(true); // show the open padlock for a beat, then reveal the site
    burst(padlock.current, { size: 1.1 });
    setTimeout(() => setVault(true), 700);
  });

  return createPortal(
    <motion.div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-background p-4" role="dialog" aria-modal="true" aria-label="Unlock your vault"
      animate={opening ? { opacity: 0, scale: 1.08, filter: 'blur(12px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.5, ease }}>
      <Aurora />
      <motion.form className="glass relative grid w-full max-w-md gap-4 rounded-3xl border border-border p-6 text-center shadow-brutal-lg sm:p-8" onSubmit={unlock}
        initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
        <span className="relative mx-auto grid size-20 place-items-center">
          <span className={cn('absolute inset-0 rounded-full border', opening ? 'border-success' : 'animate-pulse-ring border-primary')} />
          <motion.span ref={padlock} className={cn('grid size-16 place-items-center rounded-2xl text-ink shadow-glow', opening ? 'bg-success' : 'bg-linear-to-br from-primary to-violet')}
            animate={opening ? { rotate: [0, -12, 12, 0], scale: [1, 1.2, 1] } : { rotate: 0 }} transition={{ duration: 0.5 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={opening ? 'open' : 'shut'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
                {opening ? <Unlock className="size-7" /> : <Lock className="size-7" />}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        </span>
        <p className="flex items-center justify-center gap-2 text-sm"><Avatar user={user} size={28} /> Welcome back, <b>{first}</b></p>
        <h2 className="text-3xl">Unlock your vault</h2>
        <p className="text-sm text-muted-foreground">Enter your 6-digit vault PIN once. Your documents stay unlocked until this session ends.</p>
        <OtpInput key={attempt} name="pin" secret invalid={attempt > 0} />
        <ErrorText>{error}</ErrorText>
        <Button size="lg" disabled={busy || opening}>{opening ? 'Unlocked' : busy ? 'Checking…' : 'Unlock vault'}</Button>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <Button type="button" variant="link" onClick={() => setResetting(true)}>Forgot your PIN?</Button>
          <Button type="button" variant="link" onClick={async () => { await logout(); navigate('/welcome'); }}><LogOut /> Sign out</Button>
        </div>
        <p className="flex items-center justify-center gap-1.5 font-mono text-[11px] text-muted-foreground uppercase"><ShieldCheck className="size-3.5" /> 5 wrong tries lock the vault for 15 minutes</p>
      </motion.form>
      {resetting && (
        <SecureFlow title="Reset your vault PIN" finalLabel="New PIN" onClose={() => setResetting(false)}>
          {(ctx) => <PinSetup {...ctx} onDone={() => { setResetting(false); setVault(true); }} />}
        </SecureFlow>
      )}
    </motion.div>,
    document.body,
  );
}

// ---------- 2. Step-by-step security check ----------
const STEPS = [
  [KeyRound, 'Password'],
  [Mail, 'Email code'],
  [Smartphone, 'Authenticator'],
];

export function SecureFlow({ title, finalLabel = 'Change', onClose, children }) {
  const { elevatedUntil, setElevated } = useAuth();
  const verified = elevatedUntil && new Date(elevatedUntil) > new Date();
  const [step, setStep] = useState(verified ? 3 : 0);
  const [ticket, setTicket] = useState('');
  const [email, setEmail] = useState('');
  const [backup, setBackup] = useState(false);
  const { busy, error, setError, attempt, run } = useSubmit();
  const go = (n) => { setError(''); setStep(n); };
  // the final change can come back with STEP_UP if the 10 minutes ran out meanwhile
  const expire = () => { setElevated(null); go(0); toast('Your security check expired - please confirm again.', 'error'); };

  const steps = [...STEPS, [Check, finalLabel]];
  const minutesLeft = verified ? Math.max(1, Math.round((new Date(elevatedUntil) - Date.now()) / 60e3)) : 10;

  return (
    <Modal title={title} onClose={onClose}>
      <ol className="grid grid-cols-4 overflow-hidden rounded-xl border border-border" aria-label="Steps">
        {steps.map(([Icon, label], i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined}
            className={cn('grid justify-items-center gap-1 border-border px-1 py-2 text-center [&:not(:last-child)]:border-r', 'transition-colors duration-500', i < step && 'bg-success/20 text-foreground', i === step && 'bg-primary text-ink', i > step && 'bg-muted/50 text-muted-foreground')}>
            {i < step ? <Check className="size-4" /> : <Icon className="size-4" />}
            <small className="font-mono text-[10px] font-semibold uppercase">{label}</small>
          </li>
        ))}
      </ol>

      <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease }}>
        {step === 0 && (
          <form className="grid gap-4" onSubmit={run(async ({ password }) => {
            const r = await api('/auth/step-up/password', { method: 'POST', body: { password } });
            setTicket(r.ticket);
            setEmail(r.email);
            go(1);
          })}>
            <h3 className="text-lg">First, confirm your password</h3>
            <p className="text-sm text-muted-foreground">For your safety we check three things before this change: your password, a code sent to your email, and Google Authenticator.</p>
            <Field label="Account password"><PasswordInput required autoFocus autoComplete="current-password" /></Field>
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy}>{busy ? 'Checking…' : 'Continue'}</Button>
          </form>
        )}

        {step === 1 && (
          <form className="grid gap-4" onSubmit={run(async ({ code }) => {
            const r = await api('/auth/step-up/otp', { method: 'POST', body: { ticket, code } });
            setTicket(r.ticket);
            go(2);
          })}>
            <h3 className="text-lg">Check your email</h3>
            <p className="text-sm text-muted-foreground">We sent a 6-digit code to <b className="text-foreground">{email}</b>. It expires in 5 minutes.</p>
            <OtpInput key={attempt} invalid={attempt > 0} />
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy}>{busy ? 'Checking…' : 'Verify email code'}</Button>
            <Button type="button" variant="link" className="justify-self-center" onClick={() => go(0)}>Didn't get it? Start again</Button>
          </form>
        )}

        {step === 2 && (
          <form className="grid gap-4" onSubmit={run(async ({ code }) => {
            const r = await api('/auth/step-up/totp', { method: 'POST', body: { ticket, code } });
            setElevated(r.elevatedUntil);
            go(3);
          })}>
            <h3 className="text-lg">Open Google Authenticator</h3>
            <p className="text-sm text-muted-foreground">{backup ? 'Type one of your backup codes (XXXX-XXXX). It can be used only once.' : 'Enter the 6-digit code shown for TrustVault.'}</p>
            {backup
              ? <Input key="b" name="code" required autoFocus className="font-mono text-lg" placeholder="XXXX-XXXX" autoComplete="off" aria-label="Backup code" />
              : <OtpInput key={attempt} invalid={attempt > 0} />}
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy}>{busy ? 'Checking…' : 'Confirm it is me'}</Button>
            <Button type="button" variant="link" className="justify-self-center" onClick={() => setBackup(!backup)}>{backup ? 'Use the Authenticator app instead' : 'Lost your phone? Use a backup code'}</Button>
          </form>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <Callout tone="ok" className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0" /> Identity confirmed · you can make changes for {minutesLeft} min</Callout>
            {children({ expire, close: onClose })}
          </div>
        )}
      </motion.div>
    </Modal>
  );
}

// Final step used by both the Security page and "Forgot your PIN?": new PIN typed twice.
export function PinSetup({ expire, onDone }) {
  const { refresh } = useAuth();
  const { busy, error, setError, attempt, run } = useSubmit();
  return (
    <form className="grid gap-4" onSubmit={run(async ({ pin, pin2 }) => {
      if (!/^\d{6}$/.test(pin)) throw new Error('Enter all 6 digits of the new PIN.');
      if (pin !== pin2) throw new Error('The two PINs do not match.');
      try {
        await api('/auth/vault-pin', { method: 'POST', body: { pin } });
      } catch (err) {
        if (err.code === 'STEP_UP') return expire();
        throw err;
      }
      await refresh();
      toast('Vault PIN saved - your vault is unlocked.');
      onDone();
    })} onChange={() => error && setError('')}>
      <span className="text-sm font-semibold">New 6-digit PIN</span>
      <OtpInput key={`a${attempt}`} name="pin" secret autoSubmit={false} invalid={attempt > 0} />
      <span className="text-sm font-semibold">Type it again</span>
      <OtpInput key={`b${attempt}`} name="pin2" secret autoSubmit={false} autoFocus={false} />
      <p className="text-xs text-muted-foreground">Avoid easy PINs like 123456 or 111111. Do not reuse your bank PIN.</p>
      <ErrorText>{error}</ErrorText>
      <Button disabled={busy}>{busy ? 'Saving…' : 'Save PIN'}</Button>
    </form>
  );
}
