// The 60-second product tour video (made with the explainer-default skill from Barty-Bart/motion-graphics).
// It has no voice-over: every step is written on screen, so it needs no captions.
// Chapters let a page jump to a part of it: <TourVideo ref={video} />, then playAt(video.current, 20.5).
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CHAPTERS = [
  [0, 'Intro'],
  [8.6, 'Sign in with three locks'],
  [20.5, 'Upload and encrypt'],
  [31.5, 'Automatic checks: verified when all pass'],
  [42.5, 'Faculty ask, you decide'],
];

export const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function playAt(video, seconds) {
  if (!video) return;
  video.currentTime = seconds;
  video.play().catch(() => {}); // the browser may block playing with sound until the person interacts
  video.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export const TourVideo = forwardRef(function TourVideo({ className, onEnded }, ref) {
  return (
    <video ref={ref} className={cn('aspect-video w-full rounded-3xl border border-border bg-black shadow-glow', className)}
      src="/media/trustvault-tour.mp4" poster="/media/trustvault-tour.jpg" controls preload="none" playsInline onEnded={onEnded}
      aria-label="TrustVault in 60 seconds: sign in, upload, automatic checks and sharing with faculty" />
  );
});

// The 24-second showreel (docs/video/showreel.src.html): plays muted on a loop while it is on screen, with a sound
// toggle. Nothing is downloaded until it comes near the screen; people who prefer reduced motion get the poster and controls.
export function ShowreelVideo({ className }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = ref.current;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { v.controls = true; return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
    }, { rootMargin: '200px 0px', threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <div className={cn('relative', className)}>
      <video ref={ref} className="aspect-video w-full rounded-3xl border border-border bg-black shadow-glow" src="/media/trustvault-showreel.mp4" poster="/media/trustvault-showreel.jpg"
        muted={muted} loop playsInline preload="none" aria-label="TrustVault showreel, 24 seconds: three-lock sign-in, upload and encryption, automatic checks, faculty batch requests, files that open once, the tamper-evident ledger" />
      <button type="button" onClick={() => { setMuted((m) => !m); ref.current.play().catch(() => {}); }}
        className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/80">
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />} {muted ? 'Sound on' : 'Sound off'}
      </button>
    </div>
  );
}
