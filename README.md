<div align="center">

# TrustVault

**Smart digital identity and document verification portal**

MCA students keep their ID and academic documents in an encrypted vault. Documents are checked and verified automatically, and faculty can open only what a student chooses to share, one time.

**[Live demo: trustvault-5lgg.onrender.com](https://trustvault-5lgg.onrender.com)** · **[Android app (APK)](https://github.com/SriNithish-JK/TrustVault/releases/latest/download/TrustVault.apk)** (free hosting: the first visit can take a minute to wake up; use sample documents only)

[![CI](https://github.com/SriNithish-JK/TrustVault/actions/workflows/ci.yml/badge.svg)](https://github.com/SriNithish-JK/TrustVault/actions/workflows/ci.yml)
![End-to-end checks](https://img.shields.io/badge/end--to--end_checks-140-19e6ff)
![License](https://img.shields.io/badge/license-MIT-b56bff)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-5fa04e?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-database-47a248?logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)

<img src="docs/screenshots/landing-1-hero.jpg" alt="TrustVault main page: a 3D model of the vault beside the headline Every check, one by one." width="100%">

</div>

## The 3D vault (first screen)

The main page opens on a 3D model of the whole journey, drawn live in the browser with [three.js](https://threejs.org) (no models or images): a specimen document rides a ring conveyor through the sign-in gate, upload, the AES-256-GCM vault, the automatic checks, the human verifier and the QR proof, while the ledger in the middle chains every step. Switch between Assembled, X-ray, Exploded and One document, look from the Top or follow one document, or press **Tamper test** to watch the chain break and heal. Its heading is kinetic type, after a [prompt-motion](https://prompt-motion.com/twoclipping-221cab) launch film: *one by one* squeezes like an accordion into its full stop, the stop grows into a pill that shows each check in turn (OCR, Checksum, Number match, Score 96%, Verified), then the letters spring back out. It is script-driven motion graphics, not a video. Below it, the hero ID card verifies itself: it flies in, the number rolls and locks, the checks tick, VERIFIED stamps down and the card turns, then slides away as you scroll.

<img src="docs/agile/screens/kinetic-heading.jpg" alt="The kinetic heading frame by frame: one by one folds into its full stop, which becomes a pill showing each check, then Verified" width="100%">

<img src="docs/screenshots/landing-2-card.jpg" alt="The hero ID card stamped VERIFIED after its checks" width="100%">

Across the site the cursor is a scanner reticle: a dot on the pointer and four corner brackets that snap around a button or link like a scanner framing a document (text fields keep the normal caret).

<img src="docs/agile/screens/scanner-cursor.jpg" alt="The scanner cursor: idle reticle, framing Create free account, framing Sign in, in the dark and light themes" width="100%">

## Showreel and tour

[![The TrustVault showreel](docs/screenshots/showreel.jpg)](https://trustvault-5lgg.onrender.com/welcome#showreel)

The 24-second showreel on the main page is live motion graphics, drawn in the browser in real time (no video file; sound is synthesised on request): three-lock sign-in, upload and encryption, automatic checks, a faculty batch request, a file that opens once, and the tamper-evident ledger, cut to a 120 BPM soundtrack. The full [60-second tour](client/public/media/trustvault-tour.mp4) (sign in, upload, automatic checks, sharing with faculty) plays on the tutorial page. Made from code with the [motion-graphics](https://github.com/Barty-Bart/motion-graphics) explainer skill ([how](docs/video/README.md)). New here? Follow the [step-by-step tutorial](https://trustvault-5lgg.onrender.com/tutorial), which includes demo documents to try.

## What it does

- **Encrypted vault.** Every file is locked with AES-256-GCM before it touches the disk. Document numbers are shown masked.
- **Three-step sign-in, separate for each role.** Student, Faculty and Administrator tabs; each account can only use its own. Password, an email code, then Google Authenticator. A separate 6-digit PIN protects the vault.
- **Automatic checks, no human approval.** PAN format, Aadhaar checksum, OCR of the document text and signs of editing, scored out of 100. A document is **verified automatically when every check passes**; otherwise it is *not verified* and the student sees why. Each document is also compared with the student's **other** documents (shared name and details), never with the account name. 10th and 12th marksheets are stored as they are, without checks.
- **Faculty requests with consent.** Faculty tick the documents they need (10th, 12th, PAN, Aadhaar, licence, college certificate...) and ask one student or a **whole batch** (type `26MX` and every student whose roll number starts with it is asked). The student shares all or only some, and each shared document opens **one time**. Only that faculty member can open them; the administrator sees every request and answer but cannot open students' files.
- **Shrink and email.** Students email themselves an encrypted ZIP and can set a size limit per file (e.g. max 200 KB for an application form).
- **Tamper-evident history.** Uploads and decisions are chained by SHA-256; changing one record breaks the chain.

**Stack:** React (Vite) · Tailwind CSS · shadcn/ui · Motion · Node.js + Express · MongoDB · AES-256-GCM · TOTP · Tesseract OCR

**Who can sign up:** MCA students only. The roll number must look like `23MX347`: the 2-digit year the student joined, `MX`, then a 3-digit number. Other formats, future years and a second account for the same roll number are refused. **Faculty** sign up with the faculty code and **administrators** with the administrator code (`FACULTY_CODE` / `ADMIN_CODE` in `server/.env`, made by `npm run setup`), or join through an invitation. They need no roll number.

## How it is built

Agile sprints: the product owner reviews the running app, each point becomes a user story with acceptance criteria, and every story ships with tests. Every push runs unit, end-to-end and browser tests on GitHub (CI), and the live site deploys only when they all pass (CD). See [docs/agile](docs/agile/README.md) for the process, the sprint backlog and review (with before/after screenshots), and [the CI/CD pipeline](docs/agile/ci-cd.md).

## Demo on a laptop

`npm run demo` creates 10 students, 2 faculty and 1 administrator with SPECIMEN documents in the local database; [DEMO-GUIDE.md](DEMO-GUIDE.md) has the step-by-step demo. Mail to the demo addresses (`@trustvault.demo`) stays on the laptop; `npm run demo:codes` shows each account's email and Authenticator codes.

## Screens

| Dashboard | Top navigation |
|---|---|
| <img src="docs/screenshots/app-6-dashboard-wide.jpg" alt="Dashboard with identity ring, charts and recent documents"> | <img src="docs/screenshots/app-5-top-menu.jpg" alt="Top navigation with the Privacy menu open"> |

| Documents | Activity timeline |
|---|---|
| <img src="docs/screenshots/app-2-documents.jpg" alt="My Documents with verified and pending cards"> | <img src="docs/screenshots/page-3-activity.jpg" alt="Activity log as a timeline with a summary column"> |

| Sign-in | Admin console |
|---|---|
| <img src="docs/screenshots/signin-1-welcome-back.jpg" alt="Sign-in with step tracker and welcome-back card"> | <img src="docs/screenshots/admin-1-overview.jpg" alt="Admin overview with charts"> |

| Light theme | Try-it demo |
|---|---|
| <img src="docs/screenshots/light-1-dashboard.jpg" alt="Dashboard in the light theme"> | <img src="docs/screenshots/landing-4-demo.jpg" alt="Landing page demo that scans a sample card"> |

More in [`docs/screenshots`](docs/screenshots).

## Quick start

You need **Node.js 24+** and **MongoDB** running locally.

```bash
git clone https://github.com/SriNithish-JK/TrustVault.git
cd TrustVault
npm run setup     # installs everything and creates server/.env with fresh secret keys
npm run dev       # API on :5000, site on http://localhost:5173
```

Without email settings the app runs in dev mode: sign-in codes are printed in the terminal and saved in `server/dev-mail/`.

| Command | What it does |
|---|---|
| `npm test` | Unit tests |
| `npm run test:e2e` | 105-check end-to-end test against its own server and database |
| `npm run test:ui` | Opens every page in headless Chrome and signs in through the real screens |
| `npm run build` | Production build of the site |

To put it on the internet for free, follow [DEPLOY.md](DEPLOY.md).

### Android app

[**Download TrustVault.apk**](https://github.com/SriNithish-JK/TrustVault/releases/latest/download/TrustVault.apk) on an Android phone and tap it to install (Android asks once to allow installing from your browser).

The app is a small shell in [`mobile/`](mobile) that opens the live site full screen, so it always shows the latest version. GitHub builds it: pushing a tag such as `app-v1.1` publishes a new APK. If the site's address changes, update it in `mobile/capacitor.config.json` and `mobile/www/`.

---

## Features

### Security
| Feature | How it works |
|---|---|
| Multi-factor sign-in | Password → 6-digit **email OTP** → **Google Authenticator** (TOTP). Optional **Trust this device for 30 days** skips the email code (still password + Authenticator) |
| Forgot password | Email code **plus** Authenticator / backup code, so a stolen inbox alone can't take over the account. Admins can reset a lost Authenticator |
| Session warning | 2 minutes before the hour ends: *Stay signed in?* – enter the Authenticator code to extend without losing work |
| 60-minute session | After 60 min the session closes automatically; the user re-enters only the Authenticator code (a live countdown is shown in the header) |
| Vault PIN (once per session) | A separate 6-digit PIN protects every document. After sign-in a **lock screen** asks for it **once**; the vault then stays unlocked for that session only (not other devices). "Lock now" re-locks it. Easy PINs (123456, 111111) are refused; 5 wrong tries lock the vault for 15 min |
| Security check for sensitive changes | Changing the PIN or password, new backup codes, forgetting devices and deleting the account go **step by step**: password → email code → Google Authenticator → the change. Passing it once allows changes for 10 minutes; a full sign-in counts as a check |
| Encryption at rest | Every file is encrypted with **AES-256-GCM** before it touches the disk. PAN/Aadhaar numbers are encrypted and only shown masked (`XXXX XXXX 1234`) |
| Tamper-evident ledger | Each upload/approval/rejection is written to a **hash chain** (blockchain-inspired). Changing one byte of a file or one ledger record is detected |
| Watermarked viewing | Every view is stamped with the viewer's email + time (burned into the image/PDF on the server). Right-click and the PDF toolbar are disabled |
| Backup codes | 8 one-time codes for a lost phone |
| Breached-password check | Passwords found in data leaks are blocked (Have I Been Pwned, k-anonymity API) |
| Disposable-email block | Throw-away inboxes (mailinator etc.) can't register (Disify API) |
| Brute-force protection | Rate limiting, 5-strike account lockout, OTP attempt limits, TOTP replay protection |
| New-device alerts | Email alert when an account signs in from a new device (with IP + city via ip-api.com) |
| Real file-type check | Files are identified by their bytes, not their name (a renamed `.exe` is rejected) |

### Documents
| Feature | How it works |
|---|---|
| Three sections | **Identity** (PAN, Aadhaar, Driving Licence) · **Academic** (Marksheet, Certificate) · **Other** (any file) |
| Automatic validation | PAN format + holder-type + surname-initial check, **Aadhaar Verhoeff checksum**, **Driving Licence** state code / RTO / issue year, OCR reads the file and confirms the number, name and official keywords are present → score out of 100 |
| Originality check (every file) | Looks inside the file for traces of editing tools (Photoshop, Canva, GIMP, iLovePDF…), detects PDFs modified after creation, recognises digitally signed PDFs (e-PAN, e-Aadhaar, DigiLocker), checks resolution |
| "Other" documents | Stored safely and checked for originality only – **not** sent for official verification (status *Stored*) |
| Type detection | OCR recognises what a document really is. If a PAN is uploaded as "Other", the app says *"This looks like a PAN Card"* and lets the user change the type in one click |
| Automatic decision | No human verifier: **verified** when every check passes, otherwise **not verified** with the failed checks listed. The decision is sealed in the ledger |
| Batch requests | Faculty type a batch (e.g. `26MX`), tick documents and send one request to every student in it; students with a waiting request are not asked twice |
| Compressed export by email | Choose Original / Medium / **Small KB**. Files are compressed into an **AES-256 password-protected ZIP** and **emailed** – never downloaded in the browser. The password is shown on screen only, never in the email. ZIPs over 18 MB are sent as a one-time 15-minute link |
| Front + back upload | Aadhaar and Driving Licence take both sides; they are merged into one file and both sides are checked |
| Camera & guidance | *Take photo* button on phones, preview before upload, and plain-language tips when a score is low ("retake in good light", "name must match") |
| Secure share links | Share one document with an employer: link expires (1 h – 7 days), max 5 views, recipient must enter an OTP sent to their email, owner is notified on every view |
| Expiry reminders | Optional expiry date → reminder email 30 days before |
| Identity checklist | Progress bar showing PAN / Aadhaar / Marksheet verification status |

### Roles
| Role | Can do |
|---|---|
| **Student** | Upload, view, share, export own documents; **share all or some / deny / revoke** faculty requests; edit profile; delete account |
| **Faculty** | **Student records**: ask one student or a whole batch for documents; open each shared document **once** (24 h). Sign-up needs the faculty code |
| **Administrator** | User roles, **invite faculty and admins by email**, unlock accounts, **reset lost 2FA**, every request and answer, ledger integrity check, full audit log (filter, search, CSV export). Cannot open students' files. Sign-up needs the administrator code |

**Consent first:** faculty see only the documents a student chose to share, each one time, within 24 hours. Every view is **audit-logged** and the student is **emailed**.

### Privacy & UX
- **Sign-in:** step tracker, Caps Lock warning, paste-code button, a welcome-back card on devices you chose to trust, and vault doors that open onto the dashboard.
- **Home:** 3D document wallet, charts, a "while you were away" summary, one next best step, live notifications, quick search (Ctrl+K), a guided tour, optional sounds.
- Landing page, privacy policy (DPDP Act 2023 rights, masked-Aadhaar advice), consent checkbox at sign-up, **Delete my account** (right to erasure).
- 6-box OTP input with paste + auto-submit, resend countdown, show/hide password, strength meter, toasts, styled confirm dialogs, keyboard-accessible pop-ups (Esc, focus trap), skeleton loading, a floating **top navigation** with drop-down menus (mobile: **bottom navigation**), light and dark themes.

### Built with these open-source projects
| Repo | Used for |
|---|---|
| [public-apis](https://github.com/public-apis/public-apis) | The free, key-less APIs used: **Have I Been Pwned** (breached passwords), **ip-api** (login location), **Disify** (disposable email) |
| [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com) | Component primitives and styling; the design rules are written down in [DESIGN.md](DESIGN.md) |
| [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) · [21st.dev](https://21st.dev) | Design system (palette, type, UX checklist) and the theme, bento grid and hero the landing page is adapted from |
| [three.js](https://github.com/mrdoob/three.js) | The interactive 3D vault on the main page (loaded only there, on its own) |
| [prompt-motion](https://prompt-motion.com/twoclipping-221cab) (film by @twoclipping) · [Archivo](https://fonts.google.com/specimen/Archivo) | The motion style and the wide typeface of the kinetic heading on the main page |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Minimal-code rules in [AGENTS.md](AGENTS.md), which every change follows |

---

## Interface

The site in `client/` is the neon interface (Apple-clean layout, dark neon stage, animated) described in [DESIGN.md](DESIGN.md).

The first interface (neo-brutalist) is kept as files in `client-classic/` and is not part of the run commands. To look at it:
`npm install --prefix client-classic` once, then `npm run dev --prefix client-classic` while the API is running (stop the main site first, both use port 5173).

---

## First-time setup (Windows)

You need **Node.js** (installed) and **MongoDB** (installed as a Windows service – it starts automatically).

Open a terminal in this folder (`D:\content games`) and run:

```bash
npm run setup
```

This creates `server/.env` with secret keys and installs all packages. Then start the app:

```bash
npm run dev
```

Open **http://localhost:5173** and create an account.

### Make yourself admin
After registering in the website:

```bash
npm run make-admin -- your-email@gmail.com
```

Sign out and sign in again. You can now promote other users to *faculty* from **Admin Console → Users**. Or sign up directly on the **Administrator** tab with `ADMIN_CODE` from `server/.env`.

---

## Email setup (Gmail)

Without email settings the app runs in **dev mode**: every email (including OTP codes) is printed in the
terminal and saved as a file in `server/dev-mail/`. Exported ZIPs are saved there too.

To send real emails:

1. Go to **myaccount.google.com → Security** and turn on **2-Step Verification**.
2. Open **myaccount.google.com/apppasswords**, type a name like `TrustVault`, click **Create**.
3. Google shows a 16-letter password. Copy it.
4. Open `server/.env` in a text editor and fill in:
   ```
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=the16letterpassword
   ```
5. Restart `npm run dev`.

> Never put your normal Gmail password here, and never upload `.env` to GitHub (it is already in `.gitignore`).

---

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time install + create `server/.env` |
| `npm run dev` | Run the website (5173) and API (5000) with auto-reload |
| `npm run build` then `npm start` | Production mode – everything on http://localhost:5000 (set `APP_URL=http://localhost:5000` in `.env`) |
| `npm test` | Unit tests (PAN / Aadhaar / licence validation, type detection, encryption, tamper detection, file-type check) |
| `npm run test:e2e` | **105-check end-to-end test** of every feature. Starts its own isolated server + database and cleans up – safe to run any time |
| `npm run make-admin -- email` | Give an account the admin role |

---

## Project structure

```
content games/
├── client/                 React website
│   └── src/
│       ├── pages/          Landing, Login, Dashboard, Documents, Records, Review, Admin, PublicVerify, ...
│       ├── components/ui/  shadcn/ui primitives (button, dialog, select, table, ...)
│       ├── components/app/ layout, kit, secure (vault lock), wallet, charts, command (Ctrl+K), tour, insights, signin-extras
│       ├── lib/            api.js, auth.jsx, theme.js, fx.jsx (motion helpers), sound.js, confetti.js
│       └── index.css       Tailwind + design tokens (landing.css, app.css hold the bigger pieces)
├── client-classic/         the first interface, kept as files (not run by default)
└── server/                 Express API
    ├── src/
    │   ├── routes/         auth, documents, shares, records, admin, public
    │   ├── lib/            crypto (AES), verify (OCR + checks), ledger (hash chain), files (watermark/compress), mail
    │   ├── middleware/     session + role + vault PIN checks
    │   └── models.js       MongoDB collections
    ├── storage/            encrypted files (*.enc) – never committed
    ├── test/               unit tests
    └── e2e/run.mjs         end-to-end test (105 checks)
.github/workflows/ci.yml    GitHub Actions: runs all tests on every push
```

## How it works

```
 Sign in:   password ──► email OTP ──► Google Authenticator ──► 60-min session cookie (httpOnly)
                                                   ▲                       │ expires
                                                   └── Authenticator only ◄┘ (within 12 h)

 Upload:    file ──► detect real type ──► SHA-256 ──► AES-256-GCM encrypt ──► storage/*.enc
                                              │
                                              └──► ledger block (hash of previous block)
            OCR + PAN/Aadhaar checks ──► score ──► all pass? verified : not verified

 View:      vault PIN ──► decrypt ──► re-hash (tamper check) ──► watermark ──► browser (no download)
 Export:    vault PIN ──► decrypt ──► compress ──► ZIP ──► email
```

## Demo script (for the viva)

1. **Register** → show the email OTP → scan the QR with Google Authenticator → save backup codes.
2. **Security page** → Vault PIN → *Set up* → walk through the steps (password → email code → Authenticator → new PIN).
3. Sign out and back in → the **vault lock screen** asks for the PIN once.
4. **Upload a PAN** card image → watch the auto-check score appear (OCR, format, number match).
5. Try an invalid PAN like `ABCXE1234F` → rejected. Try a renamed `.exe` → rejected.
6. **View** the document → it opens straight away (vault already unlocked) → point out the watermark with your email and time.
7. The PAN turns **verified** by itself once every check passes. Upload one with a wrong number → **not verified**, with the reason.
8. **Email me a ZIP** → Size limit 150 KB → show the KB reduction in the email.
9. Sign up a **faculty** account with the faculty code → **Student Records** → *Ask a whole batch* `23MX` → the student shares some documents on **Access Requests** → faculty open each one **once** → student's Activity Log shows every view → student revokes.
12. Admin → **Ledger → Run integrity check** ✓. Then edit a file in `server/storage` → run again → **tampered** detected.
13. Set `SESSION_MINUTES=3` in `.env` → the *Stay signed in?* warning appears → let it expire → only the Authenticator code is asked.
13. Sign out → **Forgot password?** → email code + Authenticator → new password.
14. Open the site on a phone (bottom navigation, *Take photo*, front + back Aadhaar).
15. Run `npm run test:e2e` live – 140 checks pass in about a minute.

## Limitations (be honest in the report)

- PAN/Aadhaar are checked by **format, checksum and OCR**; real government lookups (NSDL / UIDAI) need licensed paid APIs, so "verified" means every automatic check passed, not that the government confirmed it.
- OCR works on clear photos/scans; text-based PDFs are read directly, scanned PDFs that cannot be read are marked not verified, and the student is asked for a clearer copy.
- Download protection (watermark, no right-click) deters leaks but cannot stop someone photographing their screen – the watermark identifies who leaked it.
- PDF compression only repacks the file; image compression gives the big KB savings.
- The encrypted ZIP uses AES-256, which Windows Explorer cannot open – use 7-Zip, WinRAR or a phone file manager.
- The ledger lives in the same database; a full database administrator could rebuild it. Production systems anchor the latest hash externally (timestamp authority / public chain).
- One master encryption key in `.env`; production would use a key vault (AWS KMS / Azure Key Vault) with per-file keys and rotation.
- Runs locally; going live needs HTTPS hosting (e.g. Render + MongoDB Atlas) and backups.

## License

[MIT](LICENSE). See [SECURITY.md](SECURITY.md) to report a vulnerability and [CONTRIBUTING.md](CONTRIBUTING.md) to propose a change.
