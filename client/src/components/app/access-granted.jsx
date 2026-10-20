// "Access granted": a dark iris opens from where the person confirmed, the sample ID card flips up and is stamped
// VERIFIED, rings pulse out, the words assemble letter by letter, then the camera flies through the card onto the
// page underneath. Used after sign-in (closeDoors) and as the site's first-visit intro. Only transform/opacity/
// clip-path are animated, so it stays smooth.
import { useEffect, useRef, useState } from 'react';
import { IdCard } from '@/components/app/id-card';
import { burst } from '@/lib/burst';
import { sfx } from '@/lib/sound';
import '@/enter.css';

export const GRANTED_MS = 2300;
const WORDS = 'ACCESS GRANTED';

export function AccessGranted({ name, origin, subtitle, onDone }) {
  const card = useRef(null);
  const [stamped, setStamped] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => { setStamped(true); burst(card.current, { size: 1.6 }); sfx('success'); }, 720);
    const b = setTimeout(() => onDone?.(), GRANTED_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  const style = { '--ox': `${origin?.x ?? innerWidth / 2}px`, '--oy': `${origin?.y ?? innerHeight / 2}px` };
  return (
    <div className="ag" style={style} aria-hidden="true">
      <div className="ag-bg" />
      <div className="ag-scan" />
      <div className="ag-center">
        <div className="ag-rings"><i /><i /><i /></div>
        <div ref={card} className="ag-card"><IdCard verified={stamped} hint={false} /></div>
        <p className="ag-title">
          {[...WORDS].map((ch, i) => <span key={i} style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>)}
        </p>
        <p className="ag-sub">{name ? `Welcome back, ${name}` : subtitle ?? 'Welcome to your vault'}</p>
      </div>
    </div>
  );
}
