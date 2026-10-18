// Motion helpers shared by the Aurora interface (motion = the Framer Motion library).
import { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';

export const spring = { type: 'spring', stiffness: 380, damping: 30 };
export const ease = [0.16, 1, 0.3, 1];

// One listener for the whole app: elements with data-spot get --mx/--my so CSS can draw a light under the cursor.
export function useSpotlight() {
  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches) return undefined;
    const onMove = (e) => {
      const el = e.target.closest?.('[data-spot]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => removeEventListener('pointermove', onMove);
  }, []);
}

// Fades and slides its children in the first time they scroll into view.
export function Reveal({ children, delay = 0, y = 28, className, as = 'div' }) {
  const Tag = motion[as];
  return (
    <Tag className={className} initial={{ opacity: 0, y, filter: 'blur(8px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-10% 0px' }} transition={{ duration: 0.7, delay, ease }}>
      {children}
    </Tag>
  );
}

// Headline that builds letter by letter: each letter flips up out of a blur, words stay together.
export function Words({ text, className, delay = 0 }) {
  let n = 0;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" style={{ perspective: 600 }}>
        {text.split(' ').map((w, i) => (
          <span key={i} className="inline-block whitespace-nowrap pb-[0.12em] align-bottom">
            {[...w].map((ch, j) => (
              <motion.span key={j} className="inline-block origin-bottom" initial={{ y: '60%', rotateX: -80, opacity: 0, filter: 'blur(8px)' }}
                animate={{ y: 0, rotateX: 0, opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.7, delay: delay + (n++) * 0.028, ease }}>
                {ch}
              </motion.span>
            ))}
            {' '}
          </span>
        ))}
      </span>
    </span>
  );
}

// Tilts toward the cursor in 3D and springs back when the pointer leaves.
export function Tilt({ children, className, max = 10 }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 18 });
  return (
    <motion.div className={className} style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width - 0.5); y.set((e.clientY - r.top) / r.height - 0.5); }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}

// Thin bar at the top of the page that fills as you scroll.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });
  return <motion.div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-linear-to-r from-primary via-violet to-success" style={{ scaleX }} />;
}

// Three slow colour fields. Decorative only.
export const Aurora = ({ className }) => <div className={cn('aurora', className)} aria-hidden="true"><i /><i /><i /></div>;

// Children appear one after another. Use with <StaggerItem>.
export const Stagger = ({ children, className, gap = 0.07, ...props }) => (
  <motion.div className={className} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: gap } } }} {...props}>{children}</motion.div>
);
export const staggerItem = { hidden: { opacity: 0, y: 18, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease } } };

// true once the element has been on screen; for starting counters when visible.
export function useSeen(margin = '-15% 0px') {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin });
  return [ref, seen];
}
