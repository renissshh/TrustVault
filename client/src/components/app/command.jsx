// Quick search (Ctrl+K / Cmd+K): jump to any page, run an action, or open a document.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, Compass, CornerDownLeft, FileText, FolderLock, GraduationCap, History, KeyRound, LayoutDashboard, Link2, Lock, LogOut, Moon,
  ScanSearch, Search, Settings, ShieldCheck, Upload, Volume2,
} from 'lucide-react';
import { api, TYPE_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { applyTheme, currentTheme } from '@/lib/theme';
import { setSound, sfx, soundOn } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { startTour } from './tour';
import { toast } from './kit';

const PAGES = [
  ['/', 'Dashboard', LayoutDashboard], ['/documents', 'My Documents', FolderLock],
  ['/records', 'Student Records', GraduationCap, ['verifier']], ['/access', 'Access Requests', KeyRound, ['student']], ['/shares', 'Shared Links', Link2],
  ['/activity', 'Activity Log', History], ['/security', 'Security & profile', ShieldCheck], ['/admin', 'Admin Console', Settings, ['admin']],
];

export const openCommand = () => window.dispatchEvent(new Event('tv-command'));

export function CommandButton() {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button type="button" onClick={openCommand} data-tour="search" aria-label="Search (Ctrl+K)"
      className="group flex h-9 items-center gap-2 rounded-full border border-border bg-card/60 px-3 text-sm text-muted-foreground transition-[border-color,box-shadow,color] duration-200 hover:border-primary hover:text-foreground hover:shadow-glow">
      <Search className="size-4 transition-transform duration-300 group-hover:scale-110" />
      <span className="hidden md:inline">Search…</span>
      <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] md:inline">{mac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const { user, logout, setVault, vaultUnlocked } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [docs, setDocs] = useState([]);
  const [at, setAt] = useState(0);
  const list = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); } };
    const onOpen = () => setOpen(true);
    addEventListener('keydown', onKey);
    window.addEventListener('tv-command', onOpen);
    return () => { removeEventListener('keydown', onKey); window.removeEventListener('tv-command', onOpen); };
  }, []);
  useEffect(() => {
    if (!open) return;
    setQ(''); setAt(0); sfx('open');
    api('/documents').then(setDocs).catch(() => setDocs([]));
  }, [open]);

  const items = useMemo(() => {
    const go = (to) => () => navigate(to);
    const all = [
      ...PAGES.filter(([, , , roles]) => !roles || roles.includes(user.role)).map(([to, label, icon]) => ({ group: 'Pages', label, icon, run: go(to) })),
      { group: 'Actions', label: 'Upload a document', icon: Upload, run: go('/documents?upload=pan') },
      ...(user.hasVaultPin && vaultUnlocked ? [{ group: 'Actions', label: 'Lock the vault now', icon: Lock, run: async () => { await api('/auth/vault/lock', { method: 'POST' }); setVault(false); } }] : []),
      { group: 'Actions', label: `Switch to ${currentTheme() === 'dark' ? 'light' : 'dark'} theme`, icon: Moon, run: () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark') },
      { group: 'Actions', label: soundOn() ? 'Turn sound off' : 'Turn sound on', icon: Volume2, run: () => setSound(!soundOn()) },
      { group: 'Actions', label: 'Take the guided tour', icon: Compass, run: () => { navigate('/'); setTimeout(startTour, 600); } },
      { group: 'Actions', label: 'Sign out', icon: LogOut, run: async () => { await logout(); navigate('/welcome'); toast('You are signed out.'); } },
      ...docs.map((d) => ({ group: 'Documents', label: d.title, hint: `${TYPE_LABELS[d.type]} · ${d.status}`, icon: FileText, run: go('/documents') })),
    ];
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((i) => `${i.label} ${i.hint ?? ''} ${i.group}`.toLowerCase().includes(needle)) : all;
  }, [q, docs, user, vaultUnlocked, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setAt(0), [q]);
  useEffect(() => { list.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' }); }, [at]);

  const run = (item) => { if (!item) return; setOpen(false); item.run(); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((n) => Math.min(n + 1, items.length - 1)); sfx('tick'); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAt((n) => Math.max(n - 1, 0)); sfx('tick'); }
    if (e.key === 'Enter') { e.preventDefault(); run(items[at]); }
  };

  let lastGroup = '';
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" onKeyDown={onKeyDown}>
        <DialogTitle className="sr-only">Quick search</DialogTitle>
        <label className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 text-primary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, actions and documents…" aria-label="Search" autoFocus
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
        </label>
        <div ref={list} className="max-h-[min(56dvh,26rem)] overflow-y-auto p-2" role="listbox" aria-label="Results">
          {items.map((item, i) => {
            const head = item.group !== lastGroup && (lastGroup = item.group);
            const Icon = item.icon;
            return (
              <div key={`${item.group}-${item.label}-${i}`}>
                {head && <p className="px-3 pt-3 pb-1 font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{head}</p>}
                <button type="button" role="option" aria-selected={i === at} data-on={i === at} onMouseMove={() => setAt(i)} onClick={() => run(item)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-100', i === at ? 'bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--primary)]' : 'text-foreground')}>
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border border-border', i === at ? 'bg-primary text-ink' : 'bg-muted')}><Icon className="size-4" /></span>
                  <span className="grid flex-1 leading-tight"><b className="font-semibold">{item.label}</b>{item.hint && <small className="text-muted-foreground capitalize">{item.hint}</small>}</span>
                  {i === at && <CornerDownLeft className="size-4 text-primary" />}
                </button>
              </div>
            );
          })}
          {!items.length && <p className="p-8 text-center text-sm text-muted-foreground">Nothing matches "{q}".</p>}
        </div>
        <p className="flex gap-4 border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></p>
      </DialogContent>
    </Dialog>
  );
}
