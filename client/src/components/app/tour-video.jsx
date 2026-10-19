// The 60-second product tour video (made with the explainer-default skill from Barty-Bart/motion-graphics).
// It has no voice-over: every step is written on screen, so it needs no captions.
// Chapters let a page jump to a part of it: <TourVideo ref={video} />, then playAt(video.current, 20.5).
import { forwardRef } from 'react';
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
