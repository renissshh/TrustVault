// A blank SPECIMEN ID card in the neon gradient. Hover, focus or tap it and the automatic check "runs": a scan line
// sweeps, every field gets a tick and a VERIFIED stamp lands. Pass `verified` to drive it from outside (the landing
// page's scroll section) instead of the pointer.
import { useState } from 'react';
import { Check, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/id-card.css';

const FIELDS = [['Name', 'XXXXX XXXXX'], ['ID number', 'XXXX XXXX 4F'], ['Date of birth', 'XX / XX / XXXX']];

export function IdCard({ verified, className, hint = true }) {
  const [hover, setHover] = useState(false);
  const controlled = verified !== undefined;
  const on = controlled ? verified : hover;
  const glare = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const events = controlled ? {} : {
    onPointerEnter: (e) => { if (e.pointerType === 'mouse') setHover(true); },
    onPointerLeave: (e) => { if (e.pointerType === 'mouse') setHover(false); },
    onClick: () => setHover((v) => !v), // touch screens: tap to check, tap again to reset
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
  };
  return (
    <div className={cn('idc-wrap', className)}>
      <div
        className={cn('idc', on && 'is-on')}
        data-tilt={controlled ? undefined : ''}
        onPointerMove={glare}
        {...events}
        {...(controlled ? { 'aria-hidden': true } : { role: 'button', tabIndex: 0, 'aria-pressed': on, 'aria-label': `Sample ID card, ${on ? 'verified: every check passed' : 'not checked yet. Hover or press to check it'}` })}
      >
        <span className="idc-glare" aria-hidden="true" />
        <span className="idc-scan" aria-hidden="true" />
        <div className="idc-in">
          <div className="idc-top">
            <span className="idc-brand"><ShieldCheck className="size-[1.1em]" /> TrustVault</span>
            <span className="idc-state">{on ? 'Verified' : 'Not checked'}</span>
          </div>
          <div className="idc-mid">
            <span className="idc-photo"><User /></span>
            <dl>
              {FIELDS.map(([k, v], i) => (
                <div key={k} style={{ '--i': i }}>
                  <dt>{k}</dt>
                  <dd>{v}<i className="idc-tick"><Check /></i></dd>
                </div>
              ))}
            </dl>
            <span className="idc-chip" aria-hidden="true" />
          </div>
          <div className="idc-mrz" aria-hidden="true">{'P<IND<XXXXX<<XXXXX<<<<<<<<<<<<<<<<<<<<<'}<br />{'XXXX0000<4IND0000000X0000000<<<<<<<<<<04'}</div>
        </div>
        <span className="idc-stamp" aria-hidden="true"><Check /> Verified</span>
      </div>
      {hint && <p className="idc-hint" aria-hidden="true">{on ? 'All checks passed · sealed in the ledger' : controlled ? 'Running the automatic checks…' : 'Hover the card to verify it'}</p>}
    </div>
  );
}
