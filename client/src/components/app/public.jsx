// Frame for pages anyone can open without signing in: aurora backdrop, glass header, scroll progress.
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Aurora, ScrollProgress, ease, useSpotlight } from '@/lib/fx';
import { Brand } from './brand';
import { ThemeToggle } from './account';

export function PublicShell({ children, brandTo = '/welcome', nav, className }) {
  useSpotlight();
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-dvh overflow-x-clip">
        <Aurora className="fixed" />
        <div className="bg-grid pointer-events-none fixed inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" aria-hidden="true" />
        <ScrollProgress />
        <motion.header className="glass sticky top-0 z-20 border-b border-border" initial={{ y: -64 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease }}>
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
            <Brand to={brandTo} />
            <div className="flex items-center gap-2.5">
              {nav}
              <ThemeToggle />
              <Button asChild size="sm" variant="secondary"><Link to="/login">Sign in</Link></Button>
            </div>
          </div>
        </motion.header>
        <main className={cn('relative mx-auto grid max-w-6xl gap-20 px-4 py-10 sm:py-16', className)}>{children}</main>
        <footer className="relative border-t border-border bg-card/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm">
            <span className="font-mono text-xs text-muted-foreground uppercase">TrustVault · AES-256 · SHA-256 ledger · TOTP 2FA</span>
            <span className="flex flex-wrap gap-5 font-semibold"><Link to="/tutorial" className="transition-colors hover:text-primary">Tutorial</Link><Link to="/privacy" className="transition-colors hover:text-primary">Privacy policy</Link></span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

export const Kicker = ({ children, className }) => (
  <span className={cn('inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold tracking-widest text-primary uppercase', className)}>
    <span className="relative grid size-2 place-items-center"><span className="absolute size-2 animate-pulse-ring rounded-full bg-primary" /><span className="size-2 rounded-full bg-primary" /></span>
    {children}
  </span>
);
