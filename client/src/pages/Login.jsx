import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, MotionConfig } from 'motion/react';
import { Lock, Smartphone, Link2, ScanLine, Check, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/account';
import { Aurora, Words, ease } from '@/lib/fx';
import { IdCard } from '@/components/app/id-card';
import { ErrorText, BackupCodes, OtpInput, PasswordInput, Field, CheckRow, Callout, Segmented, toast, ago } from '@/components/app/kit';
import { StepTracker, closeDoors, getKnown, setKnown, touchKnown, clearKnown, initialsOf } from '@/components/app/signin-extras';

const PROOF = [[Lock, 'AES-256 encrypted vault'], [Smartphone, 'Google Authenticator 2FA'], [Link2, 'Tamper-evident hash ledger'], [ScanLine, 'Verified automatically by checks']];

export function AuthShell({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative grid min-h-dvh overflow-hidden lg:grid-cols-2">
        <Aurora />
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_left,black,transparent_70%)]" aria-hidden="true" />
        <section className="relative hidden h-dvh flex-col gap-8 p-10 lg:flex">
          <Brand to="/welcome" />
          <div className="grid gap-8">
            <h1 className="text-6xl leading-[1.02]">
              <Words text="Your identity." /><br />
              <Words text="Verified. Vaulted." className="text-gradient" delay={0.25} />
            </h1>
            <ul className="flex max-w-2xl flex-wrap gap-3">
              {PROOF.map(([Icon, text], i) => (
                <motion.li key={text} className="glass flex w-fit items-center gap-3 rounded-full border border-border px-4 py-2 text-sm font-semibold shadow-brutal"
                  initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.12, type: 'spring', stiffness: 260, damping: 20 }} whileHover={{ x: 8 }}>
                  <Icon className="size-4 text-primary" /> {text}
                </motion.li>
              ))}
            </ul>
          </div>
          {/* a blank sample ID card: hover it and the automatic check verifies it. It fills whatever height is left. */}
          <div className="min-h-0 flex-1 [container-type:size]" style={{ '--idc-w': 'min(440px, 100cqw, calc((100cqh - 34px) * 1.586))' }}>
            <IdCard className="h-full justify-items-start" />
          </div>
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Sessions end after 60 minutes · every view is logged</p>
        </section>
        <section className="relative grid content-start gap-8 p-4 sm:p-10 lg:content-center">
          <div className="flex items-center justify-between lg:justify-end">
            <Brand to="/welcome" className="lg:hidden" />
            <ThemeToggle />
          </div>
          <motion.div layout className="neon-ring glass mx-auto w-full max-w-md rounded-3xl border border-border p-6 text-card-foreground shadow-brutal-lg sm:p-8"
            initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
            {children}
          </motion.div>
        </section>
      </div>
    </MotionConfig>
  );
}

const TITLES = {
  login: 'Sign in', register: 'Create your account', 'verify-email': 'Verify your email', otp: 'Check your email',
  totp: 'Google Authenticator', 'totp-setup': 'Set up Google Authenticator', backup: 'Save your backup codes',
  forgot: 'Reset your password', reset: 'Choose a new password',
};
const SUBMIT = { login: 'Continue', register: 'Create account', backup: "I've saved them - continue", forgot: 'Send reset code', reset: 'Reset password' };
// which tracker a step belongs to, and where it sits in it
const FLOWS = {
  login: [['Password', 'Email code', 'Authenticator'], 0], otp: [['Password', 'Email code', 'Authenticator'], 1], totp: [['Password', 'Email code', 'Authenticator'], 2],
  register: [['Your details', 'Email code', 'Authenticator', 'Backup codes'], 0], 'verify-email': [['Your details', 'Email code', 'Authenticator', 'Backup codes'], 1],
  'totp-setup': [['Your details', 'Email code', 'Authenticator', 'Backup codes'], 2], backup: [['Your details', 'Email code', 'Authenticator', 'Backup codes'], 3],
  forgot: [['Your email', 'New password'], 0], reset: [['Your email', 'New password'], 1],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Login({ mode = 'login' }) {
  const [step, setStep] = useState(mode);
  const [data, setData] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0); // remounts the code boxes after a wrong code
  const [cooldown, setCooldown] = useState(0);
  const [useBackup, setUseBackup] = useState(false);
  const [known, setKnownState] = useState(getKnown); // remembered on a trusted device
  const [invite, setInvite] = useState(null); // { token, email, role, invitedBy } from an invitation link
  const [params] = useSearchParams();
  // Separate sign-in for each kind of account; the server refuses an account that doesn't match the tab.
  const [mailbox, setMailbox] = useState(false);
  useEffect(() => { api('/dev/mailbox').then((r) => setMailbox(r.enabled), () => {}); }, []);
  const [as, setAs] = useState(['student', 'faculty', 'admin'].includes(params.get('as')) ? params.get('as') : 'student');
  const { refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { setStep(mode); setError(''); }, [mode]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  // /register?invite=... : show who the invitation is for and lock the email to it
  useEffect(() => {
    const token = params.get('invite');
    if (mode !== 'register' || !token) return;
    api(`/public/invite/${token}`).then((r) => setInvite({ ...r, token }), (e) => setError(e.message));
  }, [mode, params]);

  const go = (next, extra = {}) => {
    setData((d) => ({ ...d, ...extra }));
    setStep(next);
    setUseBackup(false);
    if (next === 'otp' || next === 'verify-email' || next === 'reset') setCooldown(30);
  };
  // Signed in: the vault doors close over the form and open again on the dashboard.
  const finish = async (trustDevice) => {
    closeDoors();
    await sleep(matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380);
    if (trustDevice) await api('/auth/me').then((me) => setKnown(me.user), () => {}); else touchKnown();
    await refresh();
    navigate('/');
  };
  const post = (path, body) => api(path, { method: 'POST', body });

  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setError('');
    setBusy(true);
    try {
      switch (step) {
        case 'login': { const r = await post('/auth/login', f); go(r.next, r); break; }
        case 'register': { const r = await post('/auth/register', { ...f, consent: f.consent === 'on', ...(invite && { invite: invite.token }) }); go(r.next, r); break; }
        case 'verify-email': { const r = await post('/auth/verify-email', { ticket: data.ticket, code: f.code }); go(r.next, r); break; }
        case 'otp': { const r = await post('/auth/login/otp', { ticket: data.ticket, code: f.code }); go(r.next, r); break; }
        case 'totp':
        case 'totp-setup': {
          const trust = f.remember === 'on' || Boolean(data.trusted);
          const r = await post('/auth/login/totp', { ticket: data.ticket, code: f.code, remember: f.remember === 'on' });
          if (r.backupCodes) go('backup', { backupCodes: r.backupCodes, trust }); else await finish(trust);
          break;
        }
        case 'backup': await finish(data.trust); break;
        case 'forgot': { const r = await post('/auth/forgot', f); go('reset', { ...r, emailRaw: f.email }); break; }
        case 'reset':
          await post('/auth/reset', { ticket: data.ticket, code: f.code, totp: f.totp, password: f.password });
          toast('Password changed. Sign in with your new password.');
          go('login');
          break;
      }
    } catch (err) {
      setError(err.message);
      setAttempt((a) => a + 1);
    }
    setBusy(false);
  };

  const resend = async () => {
    try {
      if (step === 'reset') await post('/auth/forgot', { email: data.emailRaw });
      else await post('/auth/login/resend', { ticket: data.ticket });
      toast('A new code was sent.');
      setCooldown(30);
    } catch (err) { setError(err.message); }
  };
  const forget = () => { clearKnown(); setKnownState(null); };

  const resendButton = (
    <Button type="button" variant="link" className="justify-self-center text-xs" onClick={resend} disabled={cooldown > 0}>
      {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
    </Button>
  );
  const rememberDevice = <CheckRow name="remember" className="text-xs">Trust this device for 30 days (skip the email code next time)</CheckRow>;
  const muted = 'text-sm text-muted-foreground';
  const [steps, at] = FLOWS[step];
  const welcome = step === 'login' && known;

  return (
    <AuthShell>
      <form onSubmit={submit}>
        <StepTracker steps={steps} at={at} />
        <motion.div key={step} className="mt-6 grid gap-4" initial={{ opacity: 0, x: 28, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 0.45, ease }}>
        {(step === 'login' || (step === 'register' && !invite)) && <Segmented label={step === 'login' ? 'Sign in as' : 'Sign up as'} value={as} onChange={(v) => { setAs(v); setError(''); }}
          options={[['student', 'Student'], ['faculty', 'Faculty'], ['admin', 'Administrator']]} />}
        <h2 className="text-3xl leading-none">{welcome ? 'Welcome back' : step === 'login' ? { student: 'Student sign-in', faculty: 'Faculty sign-in', admin: 'Administrator sign-in' }[as]
          : step === 'register' && !invite ? { student: 'Create a student account', faculty: 'Create a faculty account', admin: 'Create an administrator account' }[as] : TITLES[step]}</h2>
        {step === 'register' && !invite && <input type="hidden" name="role" value={as} />}
        {step === 'login' && <input type="hidden" name="as" value={as} />}

        {step === 'login' && (welcome ? <>
          <div className="wb">
            <span className="wb-avatar">{initialsOf(known.name)}</span>
            <span className="grid min-w-0 leading-tight">
              <b className="truncate text-lg">{known.name}</b>
              <span className="truncate text-sm text-muted-foreground">{known.email}</span>
              <span className="mt-1 font-mono text-[11px] text-muted-foreground uppercase">Last sign-in on this device: {ago(known.at)}</span>
            </span>
          </div>
          <input type="hidden" name="email" value={known.email} />
          <Field label="Password"><PasswordInput required autoFocus autoComplete="current-password" /></Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="link" className="text-xs" onClick={forget}>Not you? Use another account</Button>
            <Button type="button" variant="link" className="text-xs" onClick={() => go('forgot')}>Forgot password?</Button>
          </div>
        </> : <>
          <Field label="Email"><Input name="email" type="email" required autoFocus autoComplete="email" /></Field>
          <Field label="Password"><PasswordInput required autoComplete="current-password" /></Field>
          <Button type="button" variant="link" className="justify-self-end text-xs" onClick={() => go('forgot')}>Forgot password?</Button>
        </>)}

        {step === 'register' && <>
          {import.meta.env.VITE_DEMO && <Callout className="text-xs"><b>Demo site.</b> Use it with sample documents only. Do not upload your real ID.</Callout>}
          {invite && <Callout tone="info" className="flex items-start gap-2"><MailCheck className="mt-0.5 size-4 shrink-0" /><span><b>{invite.invitedBy ?? 'An admin'}</b> invited you to join as {invite.role === 'admin' ? 'an' : 'a'} <b>{invite.role}</b>.</span></Callout>}
          <Field label="Name"><Input name="name" required autoFocus autoComplete="name" /></Field>
          {invite
            ? <Field key="invited" label="Email" hint="The invitation works only for this address."><Input name="email" type="email" required readOnly value={invite.email} className="opacity-80" /></Field>
            : <Field key="open" label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>}
          {!invite && as === 'student' && (
            <Field key="roll" label="MCA roll number" hint="MCA students only: the 2-digit year you joined, MX, then your 3-digit number.">
              <Input name="studentId" required placeholder="e.g. 23MX347" pattern="\s*\d{2}\s*-?\s*[Mm][Xx]\s*-?\s*\d{3}\s*" title="Like 23MX347" autoComplete="off" className="font-mono uppercase placeholder:normal-case" maxLength={12} />
            </Field>
          )}
          {!invite && as !== 'student' && (
            <Field key={as} label={as === 'admin' ? 'Administrator code' : 'Faculty code'} hint={as === 'admin' ? 'Only the person who set up TrustVault has this code.' : 'Ask the administrator for the faculty code.'}>
              <Input name="code" required autoComplete="off" spellCheck={false} placeholder={as === 'admin' ? 'ADM-XXXX-XXXX-XXXX' : 'FAC-XXXX-XXXX'} className="font-mono uppercase placeholder:normal-case" />
            </Field>
          )}
          <Field label="Password" hint="8+ characters with letters and numbers. Passwords found in data breaches are blocked.">
            <PasswordInput required minLength={8} strength autoComplete="new-password" />
          </Field>
          <CheckRow name="consent" required className="text-xs">
            I agree to the <Link to="/privacy" target="_blank" className="font-semibold underline underline-offset-4">privacy policy</Link> and consent to TrustVault storing my documents for verification.
          </CheckRow>
        </>}

        {(step === 'verify-email' || step === 'otp') && <>
          <p className={muted}>We sent a 6-digit code to <b className="text-foreground">{data.email}</b>. It expires in 5 minutes.</p>
          <OtpInput key={step + attempt} invalid={Boolean(error)} paste />
          {resendButton}
        </>}

        {step === 'totp-setup' && <>
          <ol className={`${muted} grid list-decimal gap-1 pl-5`}>
            <li>Install <b className="text-foreground">Google Authenticator</b> on your phone.</li>
            <li>Tap <b className="text-foreground">+</b> → <b className="text-foreground">Scan a QR code</b> and scan this:</li>
          </ol>
          <img className="mx-auto size-44 animate-pop rounded-xl border border-border bg-white p-2" src={data.qr} alt="Google Authenticator QR code" />
          <p className="text-xs text-muted-foreground">Can't scan? Enter this key manually: <code className="bg-muted px-1 font-mono font-semibold break-all text-foreground">{data.secret}</code></p>
          <p className="text-sm font-semibold">Enter the 6-digit code shown in the app:</p>
          <OtpInput key={step + attempt} autoFocus={false} invalid={Boolean(error)} paste />
          {rememberDevice}
        </>}

        {step === 'totp' && <>
          {data.trusted && <Callout tone="ok" className="flex items-center gap-2"><Check className="size-4" /> Trusted device - email code skipped.</Callout>}
          <p className={muted}>Open Google Authenticator and enter the 6-digit code for TrustVault.</p>
          {useBackup
            ? <Field label="Backup code"><Input name="code" required autoFocus placeholder="XXXX-XXXX" className="font-mono" autoComplete="off" /></Field>
            : <OtpInput key={step + attempt} invalid={Boolean(error)} paste />}
          <Button type="button" variant="link" className="justify-self-center text-xs" onClick={() => setUseBackup(!useBackup)}>
            {useBackup ? 'Use Google Authenticator instead' : 'Lost your phone? Use a backup code'}
          </Button>
          {!data.trusted && rememberDevice}
        </>}

        {step === 'backup' && <BackupCodes codes={data.backupCodes} />}

        {step === 'forgot' && <>
          <p className={muted}>Enter your account email. We'll send a code to reset your password.</p>
          <Field label="Email"><Input name="email" type="email" required autoFocus autoComplete="email" defaultValue={known?.email} onChange={(e) => setData((d) => ({ ...d, emailRaw: e.target.value }))} /></Field>
        </>}

        {step === 'reset' && <>
          <p className={muted}>If an account exists for <b className="text-foreground">{data.email}</b>, we sent it a 6-digit code.</p>
          <span className="text-sm font-semibold">Email code</span>
          <OtpInput key={step + attempt} autoSubmit={false} invalid={Boolean(error)} paste />
          {resendButton}
          <Field label="Google Authenticator code (or a backup code)" hint="Leave empty only if you never finished setting up Google Authenticator.">
            <Input name="totp" className="font-mono" autoComplete="off" placeholder="123456 or XXXX-XXXX" />
          </Field>
          <Field label="New password"><PasswordInput required minLength={8} strength autoComplete="new-password" /></Field>
        </>}

        <ErrorText>{error}</ErrorText>
        <Button size="lg" disabled={busy}>{busy ? 'Please wait…' : SUBMIT[step] ?? 'Verify'}</Button>

        <div className="grid justify-items-center gap-2 text-sm">
          {mailbox && <p><a href="/mailbox" target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">Open the demo mailbox</a> to read sign-in codes.</p>}
          {step === 'login' && (as === 'student'
            ? <p>New here? <Link to="/register" className="font-semibold underline underline-offset-4">Create an account</Link></p>
            : <p>New {as === 'faculty' ? 'faculty member' : 'administrator'}? <Link to={`/register?as=${as}`} className="font-semibold underline underline-offset-4">Create {as === 'faculty' ? 'a faculty' : 'an administrator'} account</Link> with your code.</p>)}
          {step === 'register' && <p>Have an account? <Link to="/login" className="font-semibold underline underline-offset-4">Sign in</Link></p>}
          {(step === 'forgot' || step === 'reset') && <Button type="button" variant="link" onClick={() => go('login')}>← Back to sign in</Button>}
        </div>
        </motion.div>
      </form>
    </AuthShell>
  );
}
