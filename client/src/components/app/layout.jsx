// Signed-in shell: floating top navigation with drop-down menus, bottom navigation on phones.
import { Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderLock, Link2, History, ShieldCheck, ClipboardCheck, GraduationCap, Settings, ScanSearch, LogOut, KeyRound, Clock, Ellipsis,
  ArrowUpRight, ChevronDown, Upload,
} from 'lucide-react';
import { api, ROLE_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ease, spring, useSpotlight } from '@/lib/fx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Brand, PageLoader } from './brand';
import { AccountMenu, NotificationCenter, ThemeToggle } from './account';
import { VaultLock } from './secure';
import { SoundToggle } from './fx-global';
import { CommandButton, CommandPalette } from './command';
import { Tour } from './tour';
import '../../app.css';
import { Modal, OtpInput, ErrorText, toast } from './kit';

// ---------- Session countdown + "Stay signed in" warning 2 minutes before the hour ends ----------
function SessionTimer() {
  const { expiresAt, refresh, logout } = useAuth();
  const [left, setLeft] = useState(() => new Date(expiresAt) - Date.now());
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt) - Date.now();
      setLeft(ms);
      if (ms <= 0) window.dispatchEvent(new Event('session-expired'));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.max(0, Math.floor(left / 60000));
  const s = String(Math.max(0, Math.floor(left / 1000) % 60)).padStart(2, '0');

  const extend = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/reauth', { method: 'POST', body: { code: new FormData(e.currentTarget).get('code') } });
      await refresh();
      setError('');
      toast('Session extended for another 60 minutes.');
    } catch (err) {
      setError(err.message);
      setAttempt((a) => a + 1);
    }
  };

  return <>
    <Badge variant={left < 5 * 60e3 ? 'destructive' : 'outline'} className="h-8 px-2.5 text-xs tabular-nums" title="Sessions end after 60 minutes" data-tour="timer">
      <Clock /> <span className="sr-only">Session time left</span>{m}:{s}
    </Badge>
    {left > 0 && left < 2 * 60e3 && (
      <Modal title="Your secure session is ending" locked>
        <form className="grid gap-4" onSubmit={extend}>
          <p className="text-sm text-muted-foreground">For your safety, sessions last 60 minutes. You will be signed out in <b className="font-mono text-foreground">{m}:{s}</b>.
            Enter your Google Authenticator code to stay signed in.</p>
          <OtpInput key={attempt} invalid={Boolean(error)} />
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={async () => { await logout(); navigate('/welcome'); }}>Log out</Button>
            <Button>Stay signed in</Button>
          </div>
        </form>
      </Modal>
    )}
  </>;
}

// ---------- Top navigation: a floating pill bar, with a menu that drops under each section ----------
// (after the 21st.dev "Motion Navigation Menu" pattern: one panel that morphs between sections,
// a highlight that slides, and content that enters from the side you moved toward)
const SECTIONS = [
  { label: 'Home', to: '/', items: [] },
  { label: 'Vault', blurb: 'Every document, encrypted and checked.', items: [
    { to: '/documents', label: 'My Documents', icon: FolderLock, desc: 'Upload, view, filter and verify' },
    { to: '/shares', label: 'Shared Links', icon: Link2, desc: 'Time-limited links you sent' },
  ], feature: { to: '/documents?upload=pan', icon: Upload, title: 'Upload a document', text: 'PAN, Aadhaar, licence, marksheet - encrypted in seconds.' } },
  { label: 'Privacy', blurb: 'You decide who sees what.', items: [
    { to: '/access', label: 'Access Requests', icon: KeyRound, desc: 'Share documents with faculty', roles: ['student'] },
    { to: '/activity', label: 'Activity Log', icon: History, desc: 'Every sign-in, view and change' },
    { to: '/security', label: 'Security', icon: ShieldCheck, desc: 'PIN, password, devices, score' },
  ], feature: { to: '/security', icon: ShieldCheck, title: 'Check your security score', text: 'See which protections are on. Aim for 100.' } },
  { label: 'Students', roles: ['verifier'], blurb: 'Ask students for documents. They decide what to share.', items: [
    { to: '/records', label: 'Student Records', icon: GraduationCap, desc: 'Ask one student or a whole batch' },
  ] },
  { label: 'Admin', to: '/admin', roles: ['admin'], items: [] },
];
const DOCK = [
  { to: '/', short: 'Home', icon: LayoutDashboard }, { to: '/documents', short: 'Docs', icon: FolderLock },
  { to: '/access', short: 'Access', icon: KeyRound, roles: ['student'] },
  { to: '/shares', short: 'Shares', icon: Link2 }, { to: '/records', short: 'Students', icon: GraduationCap, roles: ['verifier'] },
  { to: '/activity', short: 'Activity', icon: History }, { to: '/security', short: 'Security', icon: ShieldCheck }, { to: '/admin', short: 'Admin', icon: Settings, roles: ['admin'] },
];
const allowed = (user) => (x) => !x.roles || x.roles.includes(user.role);

function MegaPanel({ section, user, dir, pendingAccess, onClose }) {
  const items = section.items.filter(allowed(user));
  const F = section.feature;
  return (
    <motion.div key={section.label} className="grid gap-6 p-6 md:grid-cols-[14rem_1fr_17rem]" role="menu" aria-label={`${section.label} pages`}
      initial={{ opacity: 0, x: dir * 40, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 0.35, ease }}>
      <div>
        <span className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">{section.label}</span>
        <p className="mt-2 text-2xl leading-tight font-extrabold [font-family:var(--font-display)]">{section.blurb}</p>
      </div>
      <div className="grid content-start gap-2 sm:grid-cols-2">
        {items.map(({ to, label, icon: Icon, desc }, i) => (
          <NavLink key={to} to={to} role="menuitem" onClick={onClose} style={{ animationDelay: `${i * 60 + 80}ms` }}
            className={({ isActive }) => cn('mega-item group', isActive && 'on')}>
            <span className="mega-icon"><Icon className="size-5" /></span>
            <span className="grid leading-tight"><b className="flex items-center gap-2 whitespace-nowrap">{label}{to === '/access' && pendingAccess > 0 && <Badge variant="destructive">{pendingAccess}</Badge>}</b><small>{desc}</small></span>
            <ArrowUpRight className="ml-auto size-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
          </NavLink>
        ))}
      </div>
      {F && (
        <NavLink to={F.to} onClick={onClose} role="menuitem" className="mega-feature group" style={{ animationDelay: '200ms' }}>
          <span className="font-mono text-[10px] font-semibold tracking-widest uppercase opacity-80">Featured</span>
          <b className="flex items-center gap-2 text-lg leading-tight"><F.icon className="size-5" />{F.title}</b>
          <small>{F.text}</small>
          <ArrowUpRight className="absolute top-4 right-4 size-5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
        </NavLink>
      )}
    </motion.div>
  );
}

export function Layout() {
  const { user, logout, pendingAccess, vaultUnlocked } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(null); // label of the section whose menu is showing
  const [hot, setHot] = useState(null); // section under the pointer or focus
  const [dir, setDir] = useState(1);
  const timer = useRef(0);
  const signOut = async () => { await logout(); navigate('/welcome'); toast('You are signed out.'); };
  useSpotlight();

  const sections = SECTIONS.filter(allowed(user));
  const firstLink = (s) => s.to ?? s.items.find(allowed(user))?.to;
  const isIn = (s) => (s.to ? (s.to === '/' ? pathname === '/' : pathname.startsWith(s.to)) : s.items.some((i) => pathname.startsWith(i.to)));
  const active = sections.find(isIn)?.label;
  const show = (label) => {
    clearTimeout(timer.current);
    const from = sections.findIndex((s) => s.label === (open ?? hot ?? active));
    const to = sections.findIndex((s) => s.label === label);
    setDir(to >= from ? 1 : -1);
    setHot(label);
    setOpen(sections[to].items.length ? label : null);
  };
  const hideSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { setOpen(null); setHot(null); }, 180); };
  const hideNow = () => { clearTimeout(timer.current); setOpen(null); setHot(null); };

  useEffect(() => { setMore(false); hideNow(); window.scrollTo(0, 0); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && hideNow();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSection = sections.find((s) => s.label === open);
  const dockAll = DOCK.filter(allowed(user));
  const [dock, rest] = [dockAll.slice(0, 4), dockAll.slice(4)];
  const moreActive = rest.some((n) => pathname.startsWith(n.to));
  const pill = hot ?? active;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh">
        <div className="app-stage" aria-hidden="true"><i /><i /><i /></div>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-ink">Skip to content</a>

        <header className="topnav" onMouseLeave={hideSoon} onMouseEnter={() => clearTimeout(timer.current)}>
          <div className="topnav-bar">
            <Brand className="[&>span]:hidden sm:[&>span]:inline" />
            <nav aria-label="Main" data-tour="nav" className="hidden items-center gap-1 lg:flex">
              {sections.map((s) => (
                <NavLink key={s.label} to={firstLink(s)} end={s.to === '/'} onMouseEnter={() => show(s.label)} onFocus={() => show(s.label)}
                  aria-haspopup={s.items.length ? 'menu' : undefined} aria-expanded={s.items.length ? open === s.label : undefined} aria-current={active === s.label ? 'page' : undefined}
                  className={cn('relative flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors duration-200', pill === s.label ? 'text-ink' : 'text-muted-foreground hover:text-foreground')}>
                  {pill === s.label && <motion.span layoutId="nav-pill" className="neon-fill absolute inset-0 rounded-full shadow-glow" transition={spring} />}
                  <span className="relative">{s.label}</span>
                  {s.items.length > 0 && <ChevronDown className={cn('relative size-3.5 transition-transform duration-300', open === s.label && 'rotate-180')} />}
                  {s.label === 'Privacy' && pendingAccess > 0 && <span className="relative grid min-w-5 place-items-center rounded-full bg-destructive px-1 font-mono text-[10px] text-ink">{pendingAccess}</span>}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <CommandButton />
              <SessionTimer />
              <SoundToggle className="hidden sm:inline-flex" />
              <ThemeToggle />
              <NotificationCenter />
              <Badge variant="violet" className="hidden h-8 px-2.5 xl:inline-flex">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              <AccountMenu />
            </div>
          </div>
          <AnimatePresence>
            {openSection && (
              <motion.div layout className="mega" initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
                <MegaPanel section={openSection} user={user} dir={dir} pendingAccess={pendingAccess} onClose={hideNow} />
              </motion.div>
            )}
          </AnimatePresence>
        </header>
        <AnimatePresence>
          {openSection && <motion.div className="fixed inset-0 z-20 bg-background/55 backdrop-blur-[3px]" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseEnter={hideSoon} />}
        </AnimatePresence>

        <motion.main id="main" key={pathname} className="mx-auto w-full max-w-[1640px] px-4 pt-8 pb-28 lg:px-10 lg:pt-10 lg:pb-16"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
          <Suspense fallback={<PageLoader inline />}><Outlet /></Suspense>
        </motion.main>

        <nav aria-label="Main" className="glass fixed inset-x-3 bottom-3 z-30 flex rounded-2xl border border-border p-1 shadow-brutal-lg lg:hidden">
          {dock.map(({ to, short, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('relative grid flex-1 justify-items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors', isActive ? 'text-ink' : 'text-muted-foreground')}>
              {({ isActive }) => <>
                {isActive && <motion.span layoutId="dock-pill" className="neon-fill absolute inset-0 rounded-xl shadow-glow" transition={spring} />}
                <Icon className="relative size-5" /><span className="relative">{short}</span>
              </>}
            </NavLink>
          ))}
          <Popover open={more} onOpenChange={setMore}>
            <PopoverTrigger className={cn('relative grid flex-1 justify-items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold', moreActive ? 'text-ink' : 'text-muted-foreground')}>
              {moreActive && <motion.span layoutId="dock-pill" className="neon-fill absolute inset-0 rounded-xl shadow-glow" transition={spring} />}
              <Ellipsis className="relative size-5" /><span className="relative">More</span>
              {pendingAccess > 0 && rest.some((n) => n.to === '/access') && <span className="absolute top-1 right-1/4 size-2.5 rounded-full bg-destructive" />}
            </PopoverTrigger>
            <PopoverContent align="end" side="top" sideOffset={12} className="grid w-60 gap-1 p-2">
              {rest.map(({ to, short, icon: Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => cn('flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold', isActive ? 'neon-fill' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}><Icon className="size-4.5" />{short}</NavLink>
              ))}
              <button type="button" className="flex items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground" onClick={signOut}><LogOut className="size-4.5" />Log out</button>
            </PopoverContent>
          </Popover>
        </nav>

        <CommandPalette />
        {(!user.hasVaultPin || vaultUnlocked) && <Tour user={user} />}
        {user.hasVaultPin && !vaultUnlocked && <VaultLock />}
      </div>
    </MotionConfig>
  );
}
