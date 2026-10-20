// Home page building blocks: "Needs you" (up to three things to do now, most urgent first) and "Recent activity"
// (the latest events, with the ones since your last visit marked new).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Eye, History, KeyRound, LifeBuoy, LogIn, PartyPopper, ShieldAlert, Upload, XCircle } from 'lucide-react';
import { actionLabel, cleanDetail, groupRuns } from '@/lib/api';
import { cn } from '@/lib/utils';
import { store } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ago } from '@/components/app/kit';

// ---------- Needs you ----------
// [icon, title, text, link, colour]
export function todo({ user, docs, pendingAccess }) {
  const has = (t) => docs.some((d) => d.type === t);
  const list = [];
  if (pendingAccess > 0) list.push([KeyRound, `Answer ${pendingAccess} faculty request${pendingAccess > 1 ? 's' : ''}`, 'Tick what to share. Nothing is shared without your yes.', '/access', '#fbbf24']);
  for (const d of docs.filter((x) => x.status === 'rejected')) list.push([XCircle, `Replace "${d.title}"`, d.reviewNote || 'It did not pass the automatic checks.', `/documents?upload=${d.type}`, 'var(--destructive)']);
  if (!user.hasVaultPin) list.push([KeyRound, 'Set your vault PIN', 'It protects every view, share and export.', '/security?tab=signin', 'var(--primary)']);
  for (const [t, label] of [['pan', 'PAN card'], ['aadhaar', 'Aadhaar card'], ['class10', '10th marksheet'], ['class12', '12th marksheet']]) {
    if (!has(t)) list.push([Upload, `Add your ${label}`, 'Faculty often ask for it.', `/documents?upload=${t}`, 'var(--primary)']);
  }
  if (user.backupCodesLeft < 4) list.push([LifeBuoy, 'Get new backup codes', `Only ${user.backupCodesLeft} left. They sign you in if you lose your phone.`, '/security?tab=signin', 'var(--violet)']);
  return list;
}

export function NeedsYou(props) {
  const items = todo(props);
  return (
    <section className="away" aria-label="Needs you">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Needs you</h2>
        {items.length > 3 && <span className="font-mono text-xs text-muted-foreground">{items.length - 3} more after these</span>}
      </div>
      {items.length ? (
        <ul className="away-list one">
          {items.slice(0, 3).map(([Icon, title, text, to, tone], i) => (
            <li key={title} style={{ '--i': i, '--c': tone }}>
              <Link to={to}><span className="away-icon"><Icon className="size-5" /></span><span className="grid"><b>{title}</b><small className="text-muted-foreground">{text}</small></span><ArrowRight className="ml-auto size-4 shrink-0 opacity-60" /></Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-4 py-2">
          <span className="away-icon" style={{ '--c': 'var(--success)' }}><PartyPopper className="size-5" /></span>
          <span className="grid"><b>You're all set</b><small className="text-muted-foreground">Everything is uploaded and protected. Faculty can ask you when they need something.</small></span>
        </div>
      )}
    </section>
  );
}

// ---------- Recent activity ----------
const ICONS = [[/^document\.verified/, BadgeCheck, 'var(--success)'], [/rejected|failed/, ShieldAlert, 'var(--destructive)'], [/^access\./, KeyRound, '#fbbf24'],
  [/^record\.|view/, Eye, 'var(--info)'], [/^login|^session/, LogIn, 'var(--violet)']];
const iconFor = (action) => ICONS.find(([re]) => re.test(action))?.slice(1) ?? [History, 'var(--primary)'];

export function RecentActivity({ activity, user, className, max = 6 }) {
  // "new" = since the end of the last visit; the next visit counts from when this one ends
  const key = `tv-away:${user.id}`;
  const [since] = useState(() => Number(store.get(key)) || 0);
  useEffect(() => {
    if (!since) store.set(key, String(Date.now()));
    return () => store.set(key, String(Date.now()));
  }, [key, since]);
  const runs = groupRuns(activity);
  const rows = runs.slice(0, max);
  const fresh = since ? activity.filter((a) => new Date(a.createdAt) > since).length : 0;
  return (
    <Card className={cn('ra', className)}>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2">Recent activity {fresh > 0 && <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[11px] text-ink">{fresh} new</span>}</CardTitle>
      </CardHeader>
      {rows.length ? (
        <ol className="ra-list">
          {rows.map((a, i) => {
            const [Icon, tone] = iconFor(a.action);
            const isNew = Boolean(since) && new Date(a.createdAt) > since;
            return (
              <li key={a._id} style={{ '--c': tone, '--i': i }}>
                <span className="ra-dot"><Icon className="size-3.5" /></span>
                <span className="grid min-w-0 flex-1">
                  <b className="flex items-center gap-1.5 truncate text-sm">{actionLabel(a.action)}{a.count > 1 && <span className="ra-count" title={`${a.count} times in a row`}>×{a.count}</span>}</b>
                  {a.detail && <small className="truncate text-xs text-muted-foreground" title={cleanDetail(a.detail)}>{cleanDetail(a.detail)}</small>}
                </span>
                <small className="shrink-0 self-start pt-0.5 font-mono text-[11px] text-muted-foreground">{isNew && <span className="mr-1 text-primary" aria-label="new">●</span>}{ago(a.createdAt)}</small>
              </li>
            );
          })}
        </ol>
      ) : <p className="text-sm text-muted-foreground">Nothing yet.</p>}
      <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link to="/activity">{runs.length > max ? `See all ${activity.length} events` : 'Open the activity log'} <ArrowRight /></Link></Button>
    </Card>
  );
}
