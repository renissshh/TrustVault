import { PublicShell, Kicker } from '@/components/app/public';

const SECTIONS = [
  ['What we collect', [
    'Your name, email, roll number and password (stored only as a bcrypt hash).',
    'The documents you upload, and the document numbers you type (encrypted; shown only masked, e.g. XXXX XXXX 1234).',
    'Sign-in records: time, device type, IP address and approximate city - to protect your account.',
  ]],
  ['Why we collect it', [
    'To store your documents safely, check that they are genuine, and share them with faculty when you choose to.',
    'To detect suspicious sign-ins and keep a tamper-evident record of who accessed what.',
    'We do not sell or share your data, and we do not use it for advertising.',
  ]],
  ['How it is protected', [
    'Files are encrypted with AES-256-GCM before being saved. Sign-in needs your password and Google Authenticator.',
    'Opening, sharing or exporting a document needs your separate 6-digit vault PIN.',
    'Faculty can only see the documents you choose to share with them, and each shared document opens one time. You get an email every time one is viewed.',
  ]],
  ['About Aadhaar', [
    'Under the Aadhaar Act, organisations should avoid storing full Aadhaar copies. We recommend uploading a Masked Aadhaar (only the last 4 digits visible), which you can download from myaadhaar.uidai.gov.in.',
  ]],
  ['Your rights (Digital Personal Data Protection Act, 2023)', [
    'See your data: everything you uploaded and every access is on your Documents and Activity pages.',
    'Correct your data: edit your name and roll number on the Security page.',
    'Withdraw consent and erase your data: use "Delete my account" on the Security page. Your files are permanently removed; an anonymous audit entry is kept for security.',
    'Withdraw a faculty member\'s access at any time on the Access Requests page.',
  ]],
  ['How long we keep it', [
    'Documents stay until you delete them or your account. Emailed export ZIPs and one-time links expire after 15 minutes on our side.',
  ]],
];

export default function Privacy() {
  return (
    <PublicShell className="max-w-3xl gap-8">
      <header className="grid gap-3">
        <Kicker>Plain-language summary</Kicker>
        <h1 className="text-5xl leading-none">Privacy policy</h1>
        <p className="text-muted-foreground">How TrustVault handles your personal data. This is a student project; an operator running it for real users must review it with a legal advisor.</p>
      </header>
      {SECTIONS.map(([title, points], i) => (
        <section key={title} className="grid gap-3 border border-border bg-card p-5 text-card-foreground rounded-xl shadow-brutal">
          <h2 className="flex items-baseline gap-3 text-xl"><span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>{title}</h2>
          <ul className="grid list-disc gap-2 pl-5 text-sm leading-relaxed">{points.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
      ))}
      <p className="text-sm text-muted-foreground">Questions or complaints: contact your TrustVault administrator.</p>
    </PublicShell>
  );
}
