// First-time guided tour: a spotlight moves from one part of the dashboard to the next.
// Starts once per account on the dashboard; restart it from quick search or the account menu.
import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { store } from '@/lib/theme';
import { sfx } from '@/lib/sound';
import { Button } from '@/components/ui/button';

const STEPS = [
  { sel: '[data-tour="hero"]', title: 'Welcome to your vault', text: 'This is your home. Your documents, progress and recent activity all live here.' },
  { sel: '[data-tour="upload"]', title: 'Upload in one click', text: 'Add a PAN, Aadhaar, licence, marksheet or any file. It is encrypted before it is saved.' },
  { sel: '[data-tour="wallet"]', title: 'Your document wallet', text: 'Click the front card to flip it. Its back shows the status and checks can scan.' },
  { sel: '[data-tour="charts"]', title: 'See your progress', text: 'How many documents are verified, and what happened in your account lately.' },
  { sel: '[data-tour="search"]', title: 'Jump anywhere', text: 'Press Ctrl+K to search pages, actions and documents.' },
  { sel: '[data-tour="timer"]', title: '60-minute secure session', text: 'After an hour you only need your Authenticator code to continue.' },
  { sel: '[data-tour="nav"]', title: 'Everything else', text: 'Point at Vault or Privacy to open their menus: documents, sharing, the activity log and your security settings.' },
];

export const startTour = () => window.dispatchEvent(new Event('tv-tour'));
const visible = (sel) => [...document.querySelectorAll(sel)].find((el) => el.getClientRects().length);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Tour({ user }) {
  const key = `tv-tour:${user.id}`;
  const [steps, setSteps] = useState([]);
  const [i, setI] = useState(-1);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const start = () => { const found = STEPS.filter((s) => visible(s.sel)); if (found.length) { setSteps(found); setI(0); } };
    window.addEventListener('tv-tour', start);
    const t = !store.get(key) && location.pathname === '/' ? setTimeout(start, 2200) : null;
    return () => { window.removeEventListener('tv-tour', start); clearTimeout(t); };
  }, [key]);

  const finish = () => { setI(-1); setRect(null); store.set(key, '1'); };

  useLayoutEffect(() => {
    if (i < 0) return undefined;
    const el = visible(steps[i].sel);
    if (!el) { finish(); return undefined; }
    sfx('tick');
    el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const t = setTimeout(update, 480);
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    addEventListener('resize', update); addEventListener('scroll', update, true); addEventListener('keydown', onKey);
    return () => { clearTimeout(t); removeEventListener('resize', update); removeEventListener('scroll', update, true); removeEventListener('keydown', onKey); };
  }, [i, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  if (i < 0 || !rect) return null;
  const step = steps[i];
  const pad = 10;
  const below = rect.bottom + 230 < innerHeight;
  const left = Math.min(Math.max(16, rect.left), innerWidth - 356);
  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div className="tour-card" key={i} style={{ left, top: below ? rect.bottom + 22 : undefined, bottom: below ? undefined : innerHeight - rect.top + 22 }}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-semibold tracking-widest text-primary uppercase">Step {i + 1} of {steps.length}</span>
          <button type="button" onClick={finish} aria-label="Close the tour" className="grid size-7 place-items-center rounded-full border border-border transition-transform duration-200 hover:rotate-90"><X className="size-4" /></button>
        </div>
        <h3 className="mt-2 text-xl">{step.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="flex gap-1.5" aria-hidden="true">{steps.map((s, n) => <i key={s.sel} className={n === i ? 'on' : undefined} />)}</span>
          <span className="flex gap-2">
            {i > 0 && <Button size="sm" variant="outline" onClick={() => setI(i - 1)}>Back</Button>}
            {i < steps.length - 1 ? <Button size="sm" onClick={() => setI(i + 1)} autoFocus>Next</Button> : <Button size="sm" onClick={finish} autoFocus>Finish</Button>}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
