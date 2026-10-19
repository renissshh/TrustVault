import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Download, FolderArchive, KeyRound, Play, ScanLine, UploadCloud, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PublicShell, Kicker } from '@/components/app/public';
import { TourVideo, CHAPTERS, playAt, clock } from '@/components/app/tour-video';
import { burst } from '@/lib/burst';

// [icon, title, steps, video chapter start or null]
const STEPS = [
  [UserPlus, 'Create your account', [
    <>Open <Link className="font-semibold text-primary underline" to="/register">Create account</Link>. Type the name you want to be shown in TrustVault. Documents are checked on their own, not against this name.</>,
    'Enter your email and a strong password. Passwords that appear in known data leaks are refused.',
    'Type the 6-digit code we email you. If it is not in your inbox, look in Spam.',
    'Scan the QR code with Google Authenticator and type the 6-digit code it shows.',
    'Save your backup codes somewhere safe. Each one replaces an Authenticator code once if you lose your phone.',
  ], 8.6],
  [KeyRound, 'Set your vault PIN', [
    'The first time you open your vault, choose a 6-digit PIN.',
    'You type it once per session to see your documents, so a stolen session alone cannot open them.',
  ], null],
  [UploadCloud, 'Upload a document', [
    'Go to Documents and choose Upload. Pick the type (PAN, Aadhaar, driving licence, marksheet or other).',
    'Type the document number and add the file. Aadhaar and licences take a front and a back.',
    'The file is encrypted with AES-256 before it is stored, and the number is shown masked.',
  ], 20.5],
  [BadgeCheck, 'Get it verified automatically', [
    'Automatic checks run in seconds: number format, checksum, the text on the card, signs of editing, and whether it matches your other documents.',
    'If every check passes it is verified straight away. If one fails you see which one, so you can upload a clearer copy.',
  ], 31.5],
  [ScanLine, 'Share with faculty', [
    'Faculty ask for the documents they need - sometimes for your whole batch at once.',
    'On Privacy → Access Requests, untick anything you do not want to share and press Share. Each shared file opens one time.',
  ], null],
  [FolderArchive, 'Take a copy with you', [
    'On Documents choose Email me a ZIP. It is locked with AES-256 and the password is shown only on screen.',
    <>Windows' own Extract All cannot open it: use the free <a className="font-semibold text-primary underline" href="https://www.7-zip.org/" target="_blank" rel="noreferrer">7-Zip</a>, right-click the ZIP, choose 7-Zip → Extract Here, and type the password.</>,
  ], null],
];

const DEMO = [
  ['Aadhaar', '2341 2341 2346', ['Aadhaar-front', 'Aadhaar-back']],
  ['PAN card', 'ABCPS1234F', ['PAN-card']],
  ['Driving licence', 'MH12 20110012345', ['Driving-licence-front', 'Driving-licence-back']],
];

export default function Tutorial() {
  const video = useRef(null);
  const cta = useRef(null);
  return (
    <PublicShell>
      <section className="grid gap-6">
        <Kicker>Tutorial</Kicker>
        <h1 className="max-w-3xl text-5xl leading-[0.95] sm:text-6xl">From sign-up to <span className="text-gradient">verified</span> in six steps.</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">Watch the 60-second tour, then follow the steps. Use the demo documents below to try everything without your real ID.</p>
        <TourVideo ref={video} onEnded={() => burst(cta.current, { size: 1.3 })} />
        <div className="flex flex-wrap gap-2" aria-label="Jump to a part of the video">
          {CHAPTERS.map(([at, name]) => (
            <Button key={at} size="sm" variant="outline" onClick={() => playAt(video.current, at)}>
              <Play /> <span className="font-mono text-xs text-muted-foreground">{clock(at)}</span> {name}
            </Button>
          ))}
        </div>
      </section>

      <section className="grid gap-5">
        <h2 className="text-3xl">Step by step</h2>
        <ol className="grid gap-4 md:grid-cols-2">
          {STEPS.map(([Icon, title, items, at], i) => (
            <li key={title}>
              <Card className="grid h-full content-start gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-violet text-ink shadow-glow"><Icon className="size-5" /></span>
                  <h3 className="text-xl"><span className="mr-2 font-mono text-sm text-muted-foreground">0{i + 1}</span>{title}</h3>
                </div>
                <ul className="grid list-disc gap-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-primary">
                  {items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
                {at != null && (
                  <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => playAt(video.current, at)}>
                    <Play /> Watch this step ({clock(at)})
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5">
        <div className="grid gap-2">
          <h2 className="text-3xl">Try it with demo documents</h2>
          <p className="max-w-2xl text-muted-foreground">These cards are fake and marked SPECIMEN. Upload them with the numbers shown. Any account can use them.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {DEMO.map(([type, number, files]) => (
            <Card key={type} className="grid content-start gap-3">
              <img src={`/demo-docs/${files[0]}.png`} alt={`Demo ${type}, marked specimen`} className="aspect-[1012/638] w-full rounded-xl border border-border" loading="lazy" />
              <div>
                <h3 className="text-lg">{type}</h3>
                <p className="font-mono text-sm text-primary">{number}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {files.map((f) => (
                  <Button key={f} asChild size="sm" variant="outline">
                    <a href={`/demo-docs/${f}.png`} download><Download /> {f.endsWith('back') ? 'Back' : f.endsWith('front') ? 'Front' : 'Card'}</a>
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid justify-items-center gap-4 text-center">
        <h2 className="text-3xl">Ready?</h2>
        <p className="text-muted-foreground">Setting up takes about 3 minutes. Keep your phone nearby for Google Authenticator.</p>
        <Button ref={cta} asChild size="lg"><Link to="/register">Create free account <ArrowRight /></Link></Button>
      </section>
    </PublicShell>
  );
}
