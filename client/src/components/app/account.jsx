// Top-bar pieces: avatar, account menu (photo, progress, shortcuts, sign-out), photo editor,
// theme toggle and the notification centre.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Camera, Trash2, ChevronRight, ChevronDown, ShieldCheck, History, FolderLock, Share2, KeyRound, ScanSearch, FileText, LogOut,
  RotateCw, ZoomIn, BadgeCheck, Lock, Sun, Moon, Bell, XCircle, Eye, Link2, LogIn, ShieldAlert, UploadCloud, ArrowRight,
} from 'lucide-react';
import { api, cleanDetail, ROLE_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { applyTheme, currentTheme, store } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Modal, toast, ask, ago } from './kit';
import { startTour } from './tour';

// Any picture a phone or computer makes: JPG, PNG, WebP, GIF, BMP, AVIF, TIFF, and iPhone HEIC/HEIF.
const MAX_PHOTO = 20 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|jfif|png|webp|gif|bmp|avif|tiff?|heic|heif|ico)$/i;
const isImage = (f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name);
const isHeic = (f) => /image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);

// Browsers (except Safari) can't draw HEIC, so convert it to JPEG first. Loaded only when needed.
async function readable(file) {
  if (!isHeic(file)) return file;
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return new File([Array.isArray(out) ? out[0] : out], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export function Avatar({ user, size = 32, className }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user.avatarV]);
  const photo = user.avatarV > 0 && !broken;
  return (
    <span className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-violet font-mono font-semibold text-ink', className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {photo ? <img src={`/api/auth/avatar?v=${user.avatarV}`} alt="" onError={() => setBroken(true)} draggable="false" className="size-full object-cover" /> : initials(user.name)}
    </span>
  );
}

// ---------- Theme ----------
export function ThemeToggle({ className }) {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    window.addEventListener('tv-theme', sync);
    return () => window.removeEventListener('tv-theme', sync);
  }, []);
  return (
    <Button type="button" variant="outline" size="icon-sm" className={className} onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
      <span key={theme} className="grid animate-pop place-items-center">{theme === 'dark' ? <Sun /> : <Moon />}</span>
    </Button>
  );
}

// ---------- Photo editor: drag to position, slider/wheel to zoom, rotate in 90° steps ----------
const STAGE = 260; // px, the round frame
function PhotoEditor({ file, onClose, onSaved }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);

  // `live` guards against React running this twice in development: the first, cancelled load must not
  // report an error. If the browser can't draw the format (e.g. TIFF), the server converts it instead.
  useEffect(() => {
    let live = true;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => live && setImg(image);
    image.onerror = () => live && uploadAsIs();
    image.src = url;
    return () => { live = false; URL.revokeObjectURL(url); };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (blob, name) => {
    const form = new FormData();
    form.append('photo', blob, name);
    await api('/auth/avatar', { method: 'PUT', form });
    await onSaved();
    toast('Profile photo updated.');
    onClose();
  };
  const uploadAsIs = async () => {
    setBusy(true);
    try {
      await send(file, file.name);
    } catch {
      toast('We could not read that picture. Try a JPG or PNG photo.', 'error');
      onClose();
    }
  };

  // size of the picture so it always covers the round frame
  const sideways = turn % 180 !== 0;
  const w = img ? (sideways ? img.height : img.width) : 1;
  const h = img ? (sideways ? img.width : img.height) : 1;
  const scale = (STAGE / Math.min(w, h)) * zoom;
  const limit = (p) => ({ x: Math.max(-(w * scale - STAGE) / 2, Math.min((w * scale - STAGE) / 2, p.x)), y: Math.max(-(h * scale - STAGE) / 2, Math.min((h * scale - STAGE) / 2, p.y)) });
  useEffect(() => setPos((p) => limit(p)), [zoom, turn, img]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMove = (e) => drag.current && setPos(limit({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }));
  const onWheel = (e) => setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.0015)));

  const save = async () => {
    setBusy(true);
    try {
      const out = 512;
      const canvas = Object.assign(document.createElement('canvas'), { width: out, height: out });
      const ctx = canvas.getContext('2d');
      const k = out / STAGE;
      ctx.translate(out / 2 + pos.x * k, out / 2 + pos.y * k);
      ctx.rotate((turn * Math.PI) / 180);
      ctx.scale(scale * k, scale * k);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.9));
      await send(blob, 'photo.webp');
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal title="Adjust your photo" onClose={onClose}>
      <div className="grid justify-items-center gap-4">
        <div className="relative cursor-grab touch-none overflow-hidden rounded-full border border-border bg-muted active:cursor-grabbing" style={{ width: STAGE, height: STAGE }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onWheel={onWheel} aria-label="Drag to position the photo">
          {img && <img src={img.src} alt="" draggable="false" className="absolute top-1/2 left-1/2 max-w-none" style={{ transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${turn}deg) scale(${scale})` }} />}
        </div>
        <p className="text-xs text-muted-foreground">{img ? 'Drag to position · scroll or use the slider to zoom' : busy ? 'Converting your picture…' : 'Opening your picture…'}</p>
        <div className="flex w-full items-center gap-3">
          <ZoomIn className="size-4 shrink-0" />
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="h-2 flex-1 accent-[var(--violet)]" />
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setTurn((t) => (t + 90) % 360)} aria-label="Rotate 90 degrees"><RotateCw /></Button>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={save} disabled={!img || busy}>{busy ? 'Saving…' : 'Save photo'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Account menu ----------
const itemClass = 'group flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-200 hover:bg-accent hover:text-accent-foreground';
function MenuItem({ icon: Icon, label, hint, to, onClick, badge }) {
  const body = <>
    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-card-foreground"><Icon className="size-4" /></span>
    <span className="grid flex-1 leading-tight"><b className="font-semibold">{label}</b><small className="opacity-75">{hint}</small></span>
    {badge ? <Badge>{badge}</Badge> : <ChevronRight className="size-4 opacity-60" />}
  </>;
  return to ? <Link to={to} className={itemClass}>{body}</Link> : <button type="button" className={itemClass} onClick={onClick}>{body}</button>;
}

export function AccountMenu() {
  const { user, expiresAt, pendingAccess, refresh, logout, vaultUnlocked, setVault } = useAuth();
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState(null);
  const [file, setFile] = useState(null);
  const input = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { if (open) api('/documents').then(setDocs).catch(() => setDocs([])); }, [open]);

  const pick = async (f) => {
    if (!f) return;
    if (!isImage(f)) return toast('That is not a picture. Choose a photo or image file.', 'error');
    if (f.size > MAX_PHOTO) return toast('That picture is over 20 MB - choose a smaller one.', 'error');
    try {
      if (isHeic(f)) toast('Converting your iPhone photo…');
      setOpen(false);
      setFile(await readable(f));
    } catch {
      toast('We could not read that picture. Try a JPG or PNG photo.', 'error');
    }
  };
  const removePhoto = async () => {
    setOpen(false);
    if (!(await ask({ title: 'Remove your profile photo?', message: 'Your initials will be shown instead.', confirmText: 'Remove photo', danger: true }))) return;
    await api('/auth/avatar', { method: 'DELETE' });
    await refresh();
    toast('Profile photo removed.');
  };
  const signOut = async () => { setOpen(false); await logout(); navigate('/welcome'); toast('You are signed out.'); };

  const student = user.role === 'student';
  const verified = docs?.filter((d) => d.status === 'verified').length ?? 0;
  const minutesLeft = Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 60e3));
  const steps = [
    ['Add a profile photo', user.avatarV > 0, () => input.current?.click()],
    ...(student ? [['Add your roll number', Boolean(user.studentId), () => navigate('/security')]] : []),
    ['Set your vault PIN', user.hasVaultPin, () => navigate('/security')],
    ['Upload a document', (docs?.length ?? 0) > 0, () => navigate('/documents?upload=pan')],
    ['Get a document verified', verified > 0, () => navigate('/documents')],
  ];
  const done = steps.filter((s) => s[1]).length;
  const next = steps.find((s) => !s[1]);

  return <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1" aria-label="Account menu">
          <Avatar user={user} size={36} /><ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto p-0">
        <div className="flex items-center gap-3 border-b border-border bg-linear-to-br from-primary to-violet p-4 text-ink">
          <button type="button" className="relative shrink-0" onClick={() => input.current?.click()} aria-label="Change profile photo">
            <Avatar user={user} size={64} />
            <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border border-ink bg-white"><Camera className="size-3" /></span>
          </button>
          <div className="grid min-w-0 gap-1">
            <b className="flex items-center gap-1 truncate">{user.name} {verified > 0 && <BadgeCheck className="size-4 shrink-0" aria-label="Has verified documents" />}</b>
            <span className="truncate text-xs">{user.email}</span>
            <span className="flex flex-wrap gap-1"><Badge variant="ink">{ROLE_LABELS[user.role] ?? user.role}</Badge>{user.studentId && <Badge variant="outline">Roll {user.studentId}</Badge>}</span>
          </div>
        </div>

        {user.avatarV > 0 && (
          <button type="button" className={cn(itemClass, 'border-b border-border text-xs')} onClick={removePhoto}><Trash2 className="size-4" /> Remove profile photo</button>
        )}

        <div className="grid grid-cols-3 border-b border-border text-center">
          {[[docs ? docs.length : '–', 'Documents'], [docs ? verified : '–', 'Verified'], [`${minutesLeft}m`, 'Session left']].map(([n, label]) => (
            <span key={label} className="grid border-border py-2 [&:not(:last-child)]:border-r"><b className="font-mono text-lg">{n}</b><small className="text-[11px] text-muted-foreground uppercase">{label}</small></span>
          ))}
        </div>

        {done < steps.length && (
          <button type="button" className="grid w-full gap-1.5 border-b border-border p-3 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => { setOpen(false); next[2](); }}>
            <span className="flex justify-between"><b>Profile {Math.round((done / steps.length) * 100)}% complete</b><span className="font-mono text-xs">{done}/{steps.length}</span></span>
            <span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-linear-to-r from-primary to-success" style={{ width: `${(done / steps.length) * 100}%` }} /></span>
            <span className="flex items-center gap-1 text-xs">Next: {next[0]} <ChevronRight className="size-3" /></span>
          </button>
        )}

        <nav className="grid py-1" aria-label="Account">
          <MenuItem icon={ShieldCheck} label="Security & profile" hint="Password, PIN, 2FA, devices" to="/security" />
          <MenuItem icon={History} label="Activity log" hint="Everything done with your account" to="/activity" />
          <MenuItem icon={FolderLock} label="My documents" hint={docs ? `${docs.length} stored · ${verified} verified` : 'Your encrypted files'} to="/documents" />
          <MenuItem icon={Share2} label="Shared links" hint="Links you sent to others" to="/shares" />
          {student && <MenuItem icon={KeyRound} label="Access requests" hint={pendingAccess ? `${pendingAccess} waiting for you` : 'Who can see your records'} to="/access" badge={pendingAccess || null} />}
          {user.hasVaultPin && vaultUnlocked && (
            <MenuItem icon={Lock} label="Lock vault now" hint="Your PIN will be asked again" onClick={async () => { setOpen(false); await api('/auth/vault/lock', { method: 'POST' }); setVault(false); }} />
          )}
          <MenuItem icon={ArrowRight} label="Take the tour" hint="A 1-minute walkthrough" onClick={() => { setOpen(false); navigate('/'); setTimeout(startTour, 600); }} />
          <MenuItem icon={FileText} label="Privacy policy" hint="How your data is protected" to="/privacy" />
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <Button type="button" variant="secondary" size="sm" onClick={signOut}><LogOut /> Sign out</Button>
          <span className="font-mono text-[10px] text-muted-foreground uppercase">AES-256 encrypted</span>
        </div>
      </PopoverContent>
    </Popover>
    <input ref={input} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
    {file && <PhotoEditor file={file} onClose={() => setFile(null)} onSaved={refresh} />}
  </>;
}

// ---------- Notification centre ----------
// Built from the activity log: the events a person actually cares about, newest first.
const NOTES = {
  'document.verified': [BadgeCheck, 'bg-success', (a) => `${a.detail.split(' - ')[0]} was verified`],
  'document.rejected': [XCircle, 'bg-destructive', (a) => `${a.detail.split(' - ')[0]} was rejected`],
  'record.view': [Eye, 'bg-primary', (a) => `${a.user?.name ?? 'A faculty member'} viewed ${a.detail}`],
  'record.open': [Eye, 'bg-primary', (a) => `${a.user?.name ?? 'A faculty member'} opened your documents`],
  'access.request': [KeyRound, 'bg-primary', (a) => `${a.user?.name ?? 'A faculty member'} asked for your documents`],
  'access.approved': [KeyRound, 'bg-success', () => 'You shared documents with faculty'],
  'share.view': [Link2, 'bg-info', (a) => a.detail],
  'document.upload': [UploadCloud, 'bg-info', (a) => `Uploaded ${cleanDetail(a.detail)}`],
  login: [LogIn, 'bg-info', (a) => `Signed in · ${a.detail.replace(' | ', ' · ')}`],
  'login.failed': [ShieldAlert, 'bg-destructive', () => 'Failed sign-in attempt (wrong password)'],
  'password.reset': [ShieldAlert, 'bg-primary', () => 'Your password was reset'],
  'user.reset-2fa': [ShieldAlert, 'bg-primary', () => 'Your Google Authenticator was reset'],
};

export function NotificationCenter() {
  const { user, pendingAccess, refresh } = useAuth();
  const seenKey = `tv-seen:${user.id}`;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(() => Number(store.get(seenKey)) || 0);
  const navigate = useNavigate();

  // Live: check every 15 seconds. Anything new that someone else did (or a verification result) slides in
  // as a toast, and pages showing documents refresh themselves ('tv-live').
  const newest = useRef(null);
  useEffect(() => {
    const load = () => api('/auth/activity').then((logs) => {
      const notable = logs.filter((a) => NOTES[a.action]);
      setItems(notable.slice(0, 25));
      const latest = logs[0] ? new Date(logs[0].createdAt).getTime() : 0;
      if (newest.current != null) {
        const fresh = notable.filter((a) => new Date(a.createdAt) > newest.current && ((a.user && a.user._id !== user.id) || /^document\.(verified|rejected)$/.test(a.action)));
        fresh.slice(0, 3).reverse().forEach((a) => toast(NOTES[a.action][2](a), a.action === 'document.rejected' ? 'error' : 'ok'));
        if (fresh.length) { refresh(); window.dispatchEvent(new Event('tv-live')); }
      }
      newest.current = latest;
    }).catch(() => {});
    load();
    const t = setInterval(() => !document.hidden && load(), 15e3);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unread = items.filter((a) => new Date(a.createdAt) > seen).length + pendingAccess;
  const markRead = () => { const now = Date.now(); store.set(seenKey, String(now)); setSeen(now); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon-sm" className="relative" aria-label={`Notifications, ${unread} unread`}>
          <Bell />
          {unread > 0 && <span className="absolute -top-2 -right-2 grid min-w-5 place-items-center rounded-lg border border-border bg-destructive px-1 font-mono text-[10px] font-semibold text-ink">{Math.min(unread, 9)}{unread > 9 ? '+' : ''}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <b>Notifications</b>
          <Button variant="link" className="text-xs" onClick={markRead}>Mark all read</Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {pendingAccess > 0 && (
            <button type="button" className={cn(itemClass, 'border-b border-border bg-amber-400/15')} onClick={() => { setOpen(false); navigate('/access'); }}>
              <KeyRound className="size-4 shrink-0" />
              <span className="grid leading-tight"><b>{pendingAccess} access request{pendingAccess > 1 ? 's' : ''} waiting</b><small>Tap to approve or deny</small></span>
            </button>
          )}
          {items.map((a) => {
            const [Icon, tone, text] = NOTES[a.action];
            const fresh = new Date(a.createdAt) > seen;
            return (
              <div key={a._id} className={cn('flex items-start gap-3 border-b border-border/30 px-3 py-2 text-sm', fresh && 'bg-muted')}>
                <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border border-border text-ink', tone)}><Icon className="size-3" /></span>
                <span className="grid leading-tight"><span className={fresh ? 'font-semibold' : undefined}>{text(a)}</span><small className="text-muted-foreground">{ago(a.createdAt)}</small></span>
              </div>
            );
          })}
          {!items.length && !pendingAccess && <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>}
        </div>
        <Link to="/activity" className="flex items-center justify-center gap-1 border-t border-border py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground" onClick={() => setOpen(false)}>Full activity log <ArrowRight className="size-4" /></Link>
      </PopoverContent>
    </Popover>
  );
}
