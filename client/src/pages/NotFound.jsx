import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ScanSearch } from 'lucide-react';
import { Brand } from '@/components/app/brand';
import '../landing.css';

// Neon "page not found" screen.
export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="lp grid min-h-dvh grid-rows-[auto_1fr]">
      <div className="lp-stars" aria-hidden="true" />
      <div className="lp-orb a" aria-hidden="true" /><div className="lp-orb b" aria-hidden="true" />
      <header className="lp-nav"><Brand to="/welcome" /><Link to="/login" className="lp-btn sm">Sign in</Link></header>
      <main className="lp-hero content-center pb-24">
        <span className="lp-chip lp-in"><i />Error 404</span>
        <h1 className="nf-code" aria-label="404"><span aria-hidden="true">4</span><span aria-hidden="true" className="nf-zero"><ScanSearch /></span><span aria-hidden="true">4</span></h1>
        <p className="lp-sub">This vault door leads nowhere. <code className="font-mono text-foreground">{pathname}</code> does not exist, or it was moved.</p>
        <div className="lp-cta">
          <Link to="/" className="lp-btn">Take me home <ArrowRight className="size-5" /></Link>
          <Link to="/tutorial" className="lp-btn ghost">Read the tutorial</Link>
        </div>
      </main>
    </div>
  );
}
