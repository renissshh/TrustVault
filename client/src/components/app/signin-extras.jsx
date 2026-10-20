// Sign-in extras: the step tracker, the "welcome back" memory for a trusted device, and the Access granted
// animation that plays when a sign-in succeeds.
import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { store } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { AccessGranted } from '@/components/app/access-granted';

// ---------- Step tracker: glowing nodes joined by a line that fills as you go ----------
export function StepTracker({ steps, at }) {
  return (
    <ol className="st" aria-label={at < steps.length ? `Step ${at + 1} of ${steps.length}: ${steps[at]}` : 'All steps done'}>
      {steps.map((label, i) => (
        <li key={label} className={cn(i < at && 'done', i === at && 'now')} aria-current={i === at ? 'step' : undefined}>
          <span className="st-node">{i < at ? <Check className="size-3.5" /> : i + 1}</span>
          <span className="st-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------- Welcome back: only remembered on a device the person chose to trust ----------
const KEY = 'tv-known';
export const getKnown = () => { try { return JSON.parse(store.get(KEY)); } catch { return null; } };
export const setKnown = (user) => store.set(KEY, JSON.stringify({ name: user.name, email: user.email, at: Date.now() }));
export const touchKnown = () => { const k = getKnown(); if (k) store.set(KEY, JSON.stringify({ ...k, at: Date.now() })); };
export const clearKnown = () => { try { localStorage.removeItem(KEY); } catch { /* fine */ } };
export const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// ---------- After sign-in: the Access granted animation covers the page, then opens onto the dashboard ----------
// closeDoors({ name, origin }) - origin is where the person confirmed (the iris opens from there).
export const closeDoors = (detail = {}) => window.dispatchEvent(new CustomEvent('tv-doors', { detail }));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function DoorTransition() {
  const [run, setRun] = useState(null);
  useEffect(() => {
    const start = (e) => { if (!reduced()) setRun({ id: Date.now(), ...e.detail }); };
    window.addEventListener('tv-doors', start);
    return () => window.removeEventListener('tv-doors', start);
  }, []);
  const done = useCallback(() => setRun(null), []);
  if (!run) return null;
  return <AccessGranted key={run.id} name={run.name} origin={run.origin} onDone={done} />;
}
