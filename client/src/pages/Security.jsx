// Account settings: a section menu, then tidy rows.
// Nothing sensitive is edited in place - each row opens a step-by-step flow (see components/app/secure.jsx).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, KeyRound, LifeBuoy, AlertTriangle, Check, X, User, IdCard, Mail, Lock, Unlock, Smartphone,
  MonitorSmartphone, Monitor, Palette, ChevronRight, Gauge, LogOut, ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/app/account';
import { SecureFlow, PinSetup } from '@/components/app/secure';
import { useAsync, ErrorText, BackupCodes, PasswordInput, toast, friendlyIp, PageHeader, CountUp, Modal, Field, ago } from '@/components/app/kit';

const SECTIONS = [
  ['overview', 'Overview', Gauge],
  ['personal', 'Personal info', User],
  ['signin', 'Sign-in & security', ShieldCheck],
  ['devices', 'Your devices', MonitorSmartphone],
  ['prefs', 'Preferences', Palette],
  ['danger', 'Delete account', AlertTriangle],
];

function Group({ id, title, desc, children, danger }) {
  return (
    <section id={id} className={cn('scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-brutal', danger && 'border-destructive/70')}>
      <header className={cn('border-b border-border px-5 py-3', danger ? 'border-destructive/70 bg-destructive/15' : 'bg-muted/60')}>
        <h2 className="text-lg">{title}</h2>{desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </header>
      <div className="grid">{children}</div>
    </section>
  );
}

// One setting: icon, name, current value, and (optionally) the action that opens its flow.
function Row({ icon: Icon, title, value, status, action, onClick, secure, extra }) {
  return (
    <div className="group flex flex-wrap items-center gap-3 border-border px-5 py-3 transition-colors duration-200 hover:bg-accent/40 [&:not(:last-child)]:border-b">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-6"><Icon className="size-4" /></span>
      <span className="grid min-w-40 flex-1 gap-0.5 text-sm">
        <b>{title}</b>
        <span className={cn('flex items-center gap-1 text-xs', status === 'warn' ? 'font-semibold' : 'text-muted-foreground')}>
          {status === 'ok' && <Check className="size-3.5 rounded-full bg-success p-0.5 text-ink" />}
          {status === 'warn' && <ShieldAlert className="size-3.5 text-amber-400" />}
          {value}
        </span>
      </span>
      {extra}
      {action && <Button type="button" size="sm" variant="outline" onClick={onClick}>{secure && <Lock aria-label="Needs a security check" />}{action}<ChevronRight /></Button>}
    </div>
  );
}

// Final step of a flow: runs the change, and sends the user back to step 1 if the check expired.
const guarded = (expire, fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    if (err.code === 'STEP_UP') return expire();
    throw err;
  }
};

function PasswordChange({ expire, close }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-4" onSubmit={async (e) => {
      e.preventDefault();
      const { next, again } = Object.fromEntries(new FormData(e.currentTarget));
      if (next !== again) return setError('The two passwords do not match.');
      setBusy(true);
      setError('');
      try {
        await guarded(expire, () => api('/auth/password', { method: 'POST', body: { next } }))();
        toast('Password changed. Other devices were signed out.');
        close();
      } catch (err) { setError(err.message); }
      setBusy(false);
    }}>
      <Field label="New password"><PasswordInput name="next" required minLength={8} strength autoFocus autoComplete="new-password" /></Field>
      <Field label="Type it again" hint="We check it against known data breaches. Other devices are signed out and trusted devices forgotten.">
        <PasswordInput name="again" required autoComplete="new-password" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button disabled={busy}>{busy ? 'Saving…' : 'Change password'}</Button>
    </form>
  );
}

function NewBackupCodes({ expire, close }) {
  const { refresh } = useAuth();
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState('');
  if (codes) return <div className="grid gap-4"><BackupCodes codes={codes} /><Button onClick={close}>I saved them</Button></div>;
  return (
    <div className="grid gap-4">
      <p className="text-sm">You will get 8 new one-time codes. <b>Your old codes stop working immediately.</b></p>
      <p className="text-xs text-muted-foreground">Each code signs you in once if you lose your phone. Print them or keep them in a password manager.</p>
      <ErrorText>{error}</ErrorText>
      <Button onClick={async () => {
        try {
          const r = await guarded(expire, () => api('/auth/backup-codes', { method: 'POST' }))();
          if (r) { setCodes(r.backupCodes); refresh(); }
        } catch (err) { setError(err.message); }
      }}>Generate new codes</Button>
    </div>
  );
}

function ForgetDevices({ expire, close }) {
  const [error, setError] = useState('');
  return (
    <div className="grid gap-4">
      <p className="text-sm">Devices you marked "trust this device" skip the email code for 30 days. This makes every device ask for it again.</p>
      <ErrorText>{error}</ErrorText>
      <Button onClick={async () => {
        try {
          const r = await guarded(expire, () => api('/auth/forget-devices', { method: 'POST' }))();
          if (r) { toast('Trusted devices forgotten.'); close(); }
        } catch (err) { setError(err.message); }
      }}>Forget all trusted devices</Button>
    </div>
  );
}

const LOST = ['Every document in your vault is destroyed', 'Verification QR codes stop working', 'Shared links and verifier access end'];

function DeleteAccount({ expire }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="grid gap-4">
      <ul className="grid gap-1.5 text-sm">
        {LOST.map((t) => <li key={t} className="flex items-center gap-2"><X className="size-4 shrink-0 rounded-full bg-destructive p-0.5 text-ink" /> {t}</li>)}
        <li className="flex items-center gap-2"><Check className="size-4 shrink-0 rounded-full bg-success p-0.5 text-ink" /> The audit log is kept, as the law requires</li>
      </ul>
      <Field label={<>Type <b className="font-mono">DELETE</b> to confirm</>}><Input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoFocus className="font-mono" /></Field>
      <ErrorText>{error}</ErrorText>
      <Button variant="destructive" disabled={text !== 'DELETE'} onClick={async () => {
        try {
          const r = await guarded(expire, () => api('/auth/delete-account', { method: 'POST', body: { confirm: text } }))();
          if (!r) return;
          await logout();
          toast('Your account was deleted.');
          navigate('/welcome');
        } catch (err) { setError(err.message); }
      }}>Permanently delete my account</Button>
    </div>
  );
}

const FLOWS = {
  pin: ['Vault PIN', 'New PIN', (ctx) => <PinSetup {...ctx} onDone={ctx.close} />],
  password: ['Change password', 'New password', (ctx) => <PasswordChange {...ctx} />],
  codes: ['New backup codes', 'New codes', (ctx) => <NewBackupCodes {...ctx} />],
  devices: ['Forget trusted devices', 'Forget', (ctx) => <ForgetDevices {...ctx} />],
  remove: ['Delete your account', 'Delete', (ctx) => <DeleteAccount {...ctx} />],
};

function ProfileEdit({ onClose }) {
  const { user, refresh } = useAuth();
  const [error, setError] = useState('');
  return (
    <Modal title="Personal info" onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api('/auth/profile', { method: 'PATCH', body: Object.fromEntries(new FormData(e.currentTarget)) });
          await refresh();
          toast('Personal info saved.');
          onClose();
        } catch (err) { setError(err.message); }
      }}>
        <Field label="Full name" hint="Must match your documents exactly - the automatic checks compare them.">
          <Input name="name" defaultValue={user.name} required minLength={2} autoComplete="name" autoFocus />
        </Field>
        <Field label="MCA roll number" hint="MCA students only: the 2-digit year you joined, MX, then your 3-digit number.">
          <Input name="studentId" defaultValue={user.studentId ?? ''} required={user.role === 'student'} placeholder="e.g. 23MX347" autoComplete="off" className="font-mono uppercase placeholder:normal-case" maxLength={12} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button>Save</Button>
      </form>
    </Modal>
  );
}

export default function Security() {
  const { user, vaultUnlocked, setVault, elevatedUntil } = useAuth();
  const sessions = useAsync(() => api('/auth/sessions'));
  const [flow, setFlow] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState('overview');

  // section menu follows the scroll position
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id);
    }, { rootMargin: '-20% 0px -65% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const revoke = async (id) => { await api(`/auth/sessions/${id}`, { method: 'DELETE' }); toast('Device signed out.'); sessions.reload(); };
  const lockNow = async () => { await api('/auth/vault/lock', { method: 'POST' }); setVault(false); toast('Vault locked.'); };

  const list = sessions.data ?? [];
  const otherActive = list.filter((s) => s.active && !s.current).length;
  const factors = [
    ['Strong password (breach-checked)', true, 15],
    ['Google Authenticator on', true, 30],
    ['Vault PIN set', user.hasVaultPin, 25],
    ['4+ backup codes saved', user.backupCodesLeft >= 4, 15],
    ['No other devices signed in', otherActive === 0, 15],
  ];
  const score = factors.reduce((s, [, ok, pts]) => s + (ok ? pts : 0), 0);
  const grade = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Needs attention';
  const verifiedMin = elevatedUntil && new Date(elevatedUntil) > new Date() ? Math.max(1, Math.round((new Date(elevatedUntil) - Date.now()) / 60e3)) : 0;
  const shown = showAll ? list : list.filter((s) => s.active).concat(list.filter((s) => !s.active).slice(0, 2));

  return (
    <div className="grid gap-8">
      <PageHeader icon={ShieldCheck} kicker="Account protection" title="Security & profile">
        Your password, email code and Google Authenticator protect sign-in. Your vault PIN protects your documents.
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[13rem_1fr]">
        <nav className="top-24 flex gap-2 overflow-x-auto pb-1 lg:sticky lg:grid lg:overflow-visible" aria-label="Settings sections">
          {SECTIONS.map(([id, label, Icon]) => (
            <a key={id} href={`#${id}`} aria-current={active === id ? 'true' : undefined}
              className={cn('flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200', active === id ? 'neon-fill text-ink shadow-glow' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
              onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: 'start' }); }}>
              <Icon className="size-4" /> {label}
            </a>
          ))}
          {verifiedMin > 0 && <Badge variant="success" className="mt-2 shrink-0 self-center"><ShieldCheck /> Verified for {verifiedMin} min</Badge>}
        </nav>

        <div className="grid items-start gap-6 2xl:block 2xl:columns-2 2xl:gap-6 2xl:[&>*]:mb-6 2xl:[&>*]:break-inside-avoid">
          <Card id="overview" className="grid scroll-mt-24 gap-5 sm:grid-cols-[auto_1fr] sm:items-center 2xl:[column-span:all]">
            <div className={cn('grid size-36 animate-pop place-items-center rounded-full text-ink shadow-glow', score >= 90 ? 'bg-linear-to-br from-success to-primary' : score >= 70 ? 'bg-linear-to-br from-primary to-violet' : 'bg-destructive')}>
              <span className="text-center leading-none"><b className="block font-mono text-6xl font-semibold"><CountUp value={score} /></b><small className="font-mono text-[11px] font-semibold uppercase">{grade}</small></span>
            </div>
            <div className="grid gap-3">
              <div><h2 className="text-2xl">Security score</h2><p className="text-sm text-muted-foreground">Every protection you turn on raises your score. Aim for 100.</p></div>
              <ul className="grid gap-x-10 gap-y-1.5 text-sm 2xl:grid-cols-2">
                {factors.map(([label, ok, pts]) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full text-ink', ok ? 'bg-success' : 'border border-border bg-card text-card-foreground')}>{ok ? <Check className="size-3" /> : <X className="size-3" />}</span>
                    <span className="flex-1">{label}</span><span className="font-mono text-xs text-muted-foreground">+{pts}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Group id="personal" title="Personal info" desc="Shown on your profile and compared with your documents.">
            <Row icon={User} title="Full name" value={user.name} action="Edit" onClick={() => setEditing(true)} />
            <Row icon={IdCard} title="Student ID / Roll number" value={user.studentId || 'Not added yet'} status={user.studentId ? undefined : 'warn'} action={user.studentId ? 'Edit' : 'Add'} onClick={() => setEditing(true)} />
            <Row icon={Mail} title="Email" value={`${user.email} · sign-in codes are sent here`} />
          </Group>

          <Group id="signin" title="Sign-in & security" desc="Changes marked with a lock ask you to confirm it's you: password, then an email code, then Google Authenticator.">
            <Row icon={KeyRound} title="Vault PIN" secure action={user.hasVaultPin ? 'Change' : 'Set up'} onClick={() => setFlow('pin')}
              value={user.hasVaultPin ? (vaultUnlocked ? 'On · unlocked for this session' : 'On · vault is locked') : 'Not set - needed to open your documents'}
              status={user.hasVaultPin ? 'ok' : 'warn'}
              extra={user.hasVaultPin && vaultUnlocked && <Button type="button" size="sm" variant="ghost" onClick={lockNow}><Lock /> Lock now</Button>} />
            <Row icon={Lock} title="Password" value="Breach-checked · changing it signs out other devices" status="ok" secure action="Change" onClick={() => setFlow('password')} />
            <Row icon={Smartphone} title="Google Authenticator" value="On · asked at every sign-in" status="ok" />
            <Row icon={LifeBuoy} title="Backup codes" value={`${user.backupCodesLeft} of 8 left · for when you lose your phone`} status={user.backupCodesLeft >= 4 ? 'ok' : 'warn'} secure action="Get new codes" onClick={() => setFlow('codes')} />
            <Row icon={MonitorSmartphone} title="Trusted devices" value="Trusted devices skip the email code for 30 days" secure action="Forget all" onClick={() => setFlow('devices')} />
          </Group>

          <Group id="devices" title="Your devices" desc={otherActive ? `${otherActive} other device(s) are signed in right now.` : 'Only this device is signed in right now.'}>
            {shown.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 border-border px-5 py-3 [&:not(:last-child)]:border-b">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border border-border', s.active ? 'bg-success text-ink' : 'bg-muted')}><Monitor className="size-4" /></span>
                <span className="grid min-w-40 flex-1 gap-0.5 text-sm">
                  <b className="flex flex-wrap items-center gap-2">{s.device} {s.current && <Badge variant="success">this device</Badge>}</b>
                  <span className="text-xs text-muted-foreground">{friendlyIp(s.ip)} · {s.location} · {s.active ? `signed in ${ago(s.createdAt)}` : `ended · ${ago(s.createdAt)}`}</span>
                </span>
                {s.active && !s.current && <Button size="sm" variant="destructive" onClick={() => revoke(s.id)}><LogOut /> Sign out</Button>}
              </div>
            ))}
            {list.length > shown.length && <Button variant="link" className="justify-self-start px-5 py-3" onClick={() => setShowAll(true)}>Show {list.length - shown.length} earlier sign-ins</Button>}
          </Group>

          <Group id="prefs" title="Preferences">
            <Row icon={Palette} title="Appearance" value="Light or dark theme" extra={<ThemeToggle />} />
            <Row icon={vaultUnlocked ? Unlock : Lock} title="Vault session" value="The PIN is asked once after you sign in, then the vault stays open until you sign out or the session ends." />
          </Group>

          <Group id="danger" title="Delete account" danger desc="Your right to erasure under the DPDP Act 2023. This cannot be undone.">
            <Row icon={AlertTriangle} title="Delete my account and all documents" value="Needs a security check, then typing DELETE" secure action="Delete" onClick={() => setFlow('remove')} />
          </Group>
        </div>
      </div>

      {flow && (
        <SecureFlow title={FLOWS[flow][0]} finalLabel={FLOWS[flow][1]} onClose={() => setFlow(null)}>
          {(ctx) => FLOWS[flow][2]({ ...ctx, close: () => setFlow(null) })}
        </SecureFlow>
      )}
      {editing && <ProfileEdit onClose={() => setEditing(false)} />}
    </div>
  );
}
