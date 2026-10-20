// The 24-second showreel as live motion graphics: drawn on a canvas in real time by lib/showreel.js, no video file.
// It plays while on screen and pauses off screen or in a hidden tab. Sound is synthesised in the browser when asked for
// and drives the clock, so picture and music stay in sync. Reduced motion: a still frame, and play only on request.
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { createShowreel } from '@/lib/showreel';
import { cn } from '@/lib/utils';

const FACES = ['900 20px "Inter Tight"', '800 20px "Inter Tight"', '500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter', '500 20px "JetBrains Mono"', '600 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function LiveShowreel({ className }) {
  const canvas = useRef(null);
  const s = useRef({ t: 0, last: 0, raf: 0, visible: false, playing: !reduced(), reel: null, ac: null, buf: null, src: null, startAt: 0 }).current;
  const [playing, setPlaying] = useState(s.playing);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopAudio = () => { try { s.src?.stop(); } catch { /* already stopped */ } s.src = null; };
  const startAudio = async () => {
    s.ac ??= new AudioContext();
    if (!s.buf) {
      setBusy(true);
      const off = new OfflineAudioContext(2, Math.ceil(48000 * s.reel.duration), 48000);
      await s.reel.buildAudio(off);
      s.buf = await off.startRendering();
      setBusy(false);
    }
    if (s.ac.state === 'suspended') await s.ac.resume();
    stopAudio();
    s.src = s.ac.createBufferSource(); s.src.buffer = s.buf; s.src.loop = true; s.src.connect(s.ac.destination);
    s.src.start(0, s.t); s.startAt = s.ac.currentTime - s.t;
  };
  const tick = (now) => {
    const d = s.reel.duration;
    if (s.src) s.t = (s.ac.currentTime - s.startAt) % d; // the music is the clock
    else if (s.last) s.t = (s.t + Math.min(0.1, (now - s.last) / 1000)) % d;
    s.last = now;
    s.reel.seek(s.t);
    s.raf = requestAnimationFrame(tick);
  };
  const run = () => {
    cancelAnimationFrame(s.raf); s.last = 0;
    const go = s.reel && s.playing && s.visible && !document.hidden;
    if (go) { s.raf = requestAnimationFrame(tick); if (s.wantSound && !s.src) startAudio(); } else stopAudio();
  };

  useEffect(() => {
    const cv = canvas.current;
    cv.width = innerWidth < 800 ? 960 : 1920; cv.height = cv.width * 9 / 16; // half the drawing work on phones
    let alive = true;
    Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => {}))).then(() => {
      if (!alive) return;
      s.reel = createShowreel(cv);
      s.t = s.playing ? 0 : 23.2; // reduced motion: the logo frame
      s.reel.seek(s.t);
      run();
    });
    const io = new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; run(); }, { threshold: 0.3 });
    io.observe(cv);
    const onVis = () => run();
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; io.disconnect(); document.removeEventListener('visibilitychange', onVis); cancelAnimationFrame(s.raf); stopAudio(); s.ac?.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => { s.playing = !s.playing; setPlaying(s.playing); run(); };
  const toggleSound = async () => {
    s.wantSound = !s.wantSound; setSound(s.wantSound);
    if (!s.wantSound) { stopAudio(); return; }
    if (!s.playing) { s.playing = true; setPlaying(true); }
    run();
    if (s.visible && !s.src) await startAudio();
  };

  return (
    <div className={cn('relative overflow-hidden rounded-3xl border border-border bg-black shadow-glow', className)}>
      <canvas ref={canvas} onClick={togglePlay} className="block aspect-video w-full cursor-pointer"
        role="img" aria-label="TrustVault showreel, 24 seconds of live motion graphics: three-lock sign-in, upload and encryption, automatic checks, a faculty batch request, a file that opens once, and the tamper-evident ledger" />
      <div className="absolute right-2 bottom-2 flex gap-1.5 sm:right-4 sm:bottom-4 sm:gap-2">
        <button type="button" onClick={togglePlay} aria-pressed={!playing}
          className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 p-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/80 sm:px-4">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}<span className="max-sm:sr-only">{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button type="button" onClick={toggleSound} aria-pressed={sound} disabled={busy}
          className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 p-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/80 disabled:opacity-60 sm:px-4">
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}<span className="max-sm:sr-only">{busy ? 'Loading sound…' : sound ? 'Sound off' : 'Sound on'}</span>
        </button>
      </div>
    </div>
  );
}
