// Account settings: a section menu, then tidy rows.
// Nothing sensitive is edited in place - each row opens a step-by-step flow (see components/app/secure.jsx).
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ShieldCheck, KeyRound, LifeBuoy, AlertTriangle, Check, X, User, IdCard, Mail, Lock, Unlock, Smartphone,
  MonitorSmartphone, Monitor, Palette, ChevronRight, ChevronLeft, Gauge, LogOut, ShieldAlert,
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
    <section id={id} className={cn('overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-brutal', danger && 'border-destructive/70')}>
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

const LOST = ['Every document in your vault is destroyed', 'Shared links and faculty access end'];

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
        {user.role === 'student' && (
          <Field label="MCA roll number" hint="MCA students only: the 2-digit year you joined, MX, then your 3-digit number.">
            <Input name="studentId" defaultValue={user.studentId ?? ''} required placeholder="e.g. 23MX347" autoComplete="off" className="font-mono uppercase placeholder:normal-case" maxLength={12} />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <Button>Save</Button>
      </form>
    </Modal>
  );
}

const TAB_IDS = SECTIONS.map(([id]) => id);

// One summary tile on the Overview: what the section holds, its state, and a way in.
function Tile({ icon: Icon, title, lines, state = 'ok', onOpen, danger }) {
  const tone = danger ? 'var(--destructive)' : state === 'warn' ? '#fbbf24' : 'var(--success)';
  return (
    <button type="button" onClick={onOpen} style={{ '--c': tone }} className={cn('sec-tile group', danger && 'danger')}>
      <span className="sec-tile-icon"><Icon className="size-5" /></span>
      <span className="grid min-w-0 flex-1 gap-1 text-left">
        <b className="flex items-center gap-2">{title}{!danger && <span className="sec-dot" role="img" aria-label={state === 'warn' ? 'needs attention' : 'all good'} />}</b>
        {lines.map((l) => <small key={l} className="truncate text-muted-foreground">{l}</small>)}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </button>
  );
}

export default function Security() {
  const { user, vaultUnlocked, setVault, elevatedUntil } = useAuth();
  const sessions = useAsync(() => api('/auth/sessions'));
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get('tab')) ? params.get('tab') : 'overview';
  const open = (id) => { setParams(id === 'overview' ? {} : { tab: id }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const [flow, setFlow] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const student = user.role === 'student';

  const revoke = async (id) => { await api(`/auth/sessions/${id}`, { method: 'DELETE' }); toast('Device signed out.'); sessions.reload(); };
  const revokeOthers = async () => {
    for (const s of (sessions.data ?? []).filter((x) => x.active && !x.current)) await api(`/auth/sessions/${s.id}`, { method: 'DELETE' });
    toast('All other devices signed out.');
    sessions.reload();
  };
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
  const dark = document.documentElement.classList.contains('dark');

  const sections = {
    overview: <>
      <Card className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className={cn('grid size-36 animate-pop place-items-center rounded-full text-ink shadow-glow', score >= 90 ? 'bg-linear-to-br from-success to-primary' : score >= 70 ? 'bg-linear-to-br from-primary to-violet' : 'bg-destructive')}>
          <span className="text-center leading-none"><b className="block font-mono text-6xl font-semibold"><CountUp value={score} /></b><small className="font-mono text-[11px] font-semibold uppercase">{grade}</small></span>
        </div>
        <div className="grid gap-3">
          <div><h2 className="text-2xl">Security score</h2><p className="text-sm text-muted-foreground">Every protection you turn on raises your score. Aim for 100.</p></div>
          <ul className="grid gap-x-10 gap-y-1.5 text-sm md:grid-cols-2">
            {factors.map(([label, ok, pts]) => (
              <li key={label} className="flex items-center gap-2">
                <span className={cn('grid size-5 shrink-0 place-items-center rounded-full text-ink', ok ? 'bg-success' : 'border border-border bg-card text-card-foreground')}>{ok ? <Check className="size-3" /> : <X className="size-3" />}</span>
                <span className="flex-1">{label}</span><span className="font-mono text-xs text-muted-foreground">+{pts}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        <Tile icon={User} title="Personal info" onOpen={() => open('personal')} state={student && !user.studentId ? 'warn' : 'ok'}
          lines={[user.name, student ? `Roll no. ${user.studentId || 'not added yet'}` : user.email]} />
        <Tile icon={ShieldCheck} title="Sign-in & security" onOpen={() => open('signin')} state={user.hasVaultPin && user.backupCodesLeft >= 4 ? 'ok' : 'warn'}
          lines={[`Vault PIN ${user.hasVaultPin ? 'on' : 'not set'} · Authenticator on`, `${user.backupCodesLeft} of 8 backup codes left`]} />
        <Tile icon={MonitorSmartphone} title="Your devices" onOpen={() => open('devices')} state={otherActive ? 'warn' : 'ok'}
          lines={[otherActive ? `${otherActive} other device${otherActive > 1 ? 's are' : ' is'} signed in` : 'Only this device is signed in', 'See where you are signed in']} />
        <Tile icon={Palette} title="Preferences" onOpen={() => open('prefs')} lines={[`${dark ? 'Dark' : 'Light'} theme`, 'Vault PIN asked once per session']} />
        <Tile icon={AlertTriangle} title="Delete account" danger onOpen={() => open('danger')} lines={['Permanently erase your account and documents']} />
      </div>
    </>,
    personal: (
      <Group id="personal" title="Personal info" desc="Shown on your profile and compared with your documents.">
        <Row icon={User} title="Full name" value={user.name} action="Edit" onClick={() => setEditing(true)} />
        {student
          ? <Row icon={IdCard} title="Roll number" value={user.studentId || 'Not added yet'} status={user.studentId ? undefined : 'warn'} action={user.studentId ? 'Edit' : 'Add'} onClick={() => setEditing(true)} />
          : <Row icon={IdCard} title="Role" value={user.role === 'admin' ? 'Administrator' : 'Faculty'} />}
        <Row icon={Mail} title="Email" value={`${user.email} · sign-in codes are sent here`} />
      </Group>
    ),
    signin: (
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
    ),
    devices: (
      <Group id="devices" title="Your devices" desc={otherActive ? `${otherActive} other device(s) are signed in right now.` : 'Only this device is signed in right now.'}>
        {shown.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border border-border', s.active ? 'bg-success text-ink' : 'bg-muted')}><Monitor className="size-4" /></span>
            <span className="grid min-w-40 flex-1 gap-0.5 text-sm">
              <b className="flex flex-wrap items-center gap-2">{s.device} {s.current && <Badge variant="success">this device</Badge>}</b>
              <span className="text-xs text-muted-foreground">{friendlyIp(s.ip)} · {s.location} · {s.active ? `signed in ${ago(s.createdAt)}` : `ended · ${ago(s.createdAt)}`}</span>
            </span>
            {s.active && !s.current && <Button size="sm" variant="destructive" onClick={() => revoke(s.id)}><LogOut /> Sign out</Button>}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          {list.length > shown.length ? <Button variant="link" className="px-0" onClick={() => setShowAll(true)}>Show {list.length - shown.length} earlier sign-ins</Button> : <span />}
          {otherActive > 1 && <Button size="sm" variant="outline" onClick={revokeOthers}><LogOut /> Sign out all other devices</Button>}
        </div>
      </Group>
    ),
    prefs: (
      <Group id="prefs" title="Preferences">
        <Row icon={Palette} title="Appearance" value="Light or dark theme" extra={<ThemeToggle />} />
        <Row icon={vaultUnlocked ? Unlock : Lock} title="Vault session" value="The PIN is asked once after you sign in, then the vault stays open until you sign out or the session ends." />
      </Group>
    ),
    danger: (
      <Group id="danger" title="Delete account" danger desc="Your right to erasure under the DPDP Act 2023. This cannot be undone.">
        <Row icon={AlertTriangle} title="Delete my account and all documents" value="Needs a security check, then typing DELETE" secure action="Delete" onClick={() => setFlow('remove')} />
      </Group>
    ),
  };

  return (
    <div className="grid gap-8">
      <PageHeader icon={ShieldCheck} kicker="Account protection" title="Security & profile">
        Your password, email code and Google Authenticator protect sign-in. Your vault PIN protects your documents.
      </PageHeader>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav className="top-24 flex gap-2 overflow-x-auto pb-1 lg:sticky lg:grid lg:overflow-visible" aria-label="Settings sections">
          {SECTIONS.map(([id, label, Icon]) => (
            <a key={id} href={id === 'overview' ? '/security' : `/security?tab=${id}`} aria-current={tab === id ? 'page' : undefined}
              className={cn('flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200',
                tab === id ? 'neon-fill text-ink shadow-glow' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
              onClick={(e) => { e.preventDefault(); open(id); }}>
              <Icon className="size-4" /> {label}
            </a>
          ))}
          {verifiedMin > 0 && <Badge variant="success" className="mt-2 shrink-0 self-center"><ShieldCheck /> Verified for {verifiedMin} min</Badge>}
        </nav>

        <motion.div key={tab} className="grid min-w-0 max-w-4xl gap-6" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          {tab !== 'overview' && (
            <button type="button" onClick={() => open('overview')} className="flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" /> Overview
            </button>
          )}
          {sections[tab]}
        </motion.div>
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
