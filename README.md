<div align="center">

# TrustVault

**Smart digital identity and document verification portal**

Store identity documents in an encrypted vault, have them verified, and let anyone confirm they are genuine by scanning a QR code.

**[Live demo: trustvault-5lgg.onrender.com](https://trustvault-5lgg.onrender.com)** · **[Android app (APK)](https://github.com/SriNithish-JK/TrustVault/releases/latest/download/TrustVault.apk)** (free hosting: the first visit can take a minute to wake up; use sample documents only)

[![CI](https://github.com/SriNithish-JK/TrustVault/actions/workflows/ci.yml/badge.svg)](https://github.com/SriNithish-JK/TrustVault/actions/workflows/ci.yml)
![End-to-end checks](https://img.shields.io/badge/end--to--end_checks-105-19e6ff)
![License](https://img.shields.io/badge/license-MIT-b56bff)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-5fa04e?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-database-47a248?logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)

<img src="docs/screenshots/landing-1-hero.jpg" alt="TrustVault landing page: Your documents. Verified once." width="100%">

</div>

## 60-second tour

[![Watch the TrustVault tour](client/public/media/trustvault-tour.jpg)](client/public/media/trustvault-tour.mp4)

Sign in with three locks, upload and encrypt, automatic checks, and QR proof anyone can check. Made from code with the [motion-graphics](https://github.com/Barty-Bart/motion-graphics) explainer skill ([how](docs/video/README.md)). New here? Follow the [step-by-step tutorial](https://trustvault-5lgg.onrender.com/tutorial), which includes demo documents to try.

## What it does

- **Encrypted vault.** Every file is locked with AES-256-GCM before it touches the disk. Document numbers are shown masked.
- **Three-step sign-in.** Password, an email code, then Google Authenticator. A separate 6-digit PIN protects the vault.
- **Automatic checks.** PAN format, Aadhaar checksum, OCR of the document text and signs of editing, scored out of 100.
- **Human verification with consent.** A verifier approves or rejects. To open a student's record they must ask, and the student approves for 24 hours.
- **Proof anyone can check.** A verified document gets a QR code. Scanning it shows the result without an account.
- **Tamper-evident history.** Uploads and decisions are chained by SHA-256; changing one record breaks the chain.

**Stack:** React (Vite) · Tailwind CSS · shadcn/ui · Motion · Node.js + Express · MongoDB · AES-256-GCM · TOTP · Tesseract OCR

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
| Human verification | Verifier/admin reviews the auto-check report and approves or rejects (with a reason emailed to the student) |
| QR verification | Every verified document gets a QR code. Scanning it opens a public page showing **Verified ✓** without logging in |
| Verify by file | Anyone can drop a file on the public verifier page; its SHA-256 fingerprint is compared with the vault |
| Compressed export by email | Choose Original / Medium / **Small KB**. Files are compressed into an **AES-256 password-protected ZIP** and **emailed** – never downloaded in the browser. The password is shown on screen only, never in the email. ZIPs over 18 MB are sent as a one-time 15-minute link |
| Front + back upload | Aadhaar and Driving Licence take both sides; they are merged into one file and both sides are checked |
| Camera & guidance | *Take photo* button on phones, preview before upload, and plain-language tips when a score is low ("retake in good light", "name must match") |
| Secure share links | Share one document with an employer: link expires (1 h – 7 days), max 5 views, recipient must enter an OTP sent to their email, owner is notified on every view |
| Expiry reminders | Optional expiry date → reminder email 30 days before |
| Identity checklist | Progress bar showing PAN / Aadhaar / Marksheet verification status |

### Roles
| Role | Can do |
|---|---|
| **Student** | Upload, view, share, export own documents; **approve / deny / revoke** verifier access; edit profile; delete account |
| **Verifier** | Verification queue + **student records** – opening a record needs the student's approval (24 h) |
| **Admin** | Everything above + user roles, **invite verifiers and admins by email**, unlock accounts, **reset lost 2FA**, ledger integrity check, full audit log (filter, search, CSV export) |

**Consent first:** verifiers can open *pending* documents to verify them, but a student's full record is visible only after the student approves a request (with a reason), for 24 hours. Every view is **audit-logged** and the student is **emailed**.

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

Sign out and sign in again. You can now promote other users to *verifier* from **Admin Console → Users**.

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
            OCR + PAN/Aadhaar checks ──► score ──► verifier approves ──► QR code

 View:      vault PIN ──► decrypt ──► re-hash (tamper check) ──► watermark ──► browser (no download)
 Export:    vault PIN ──► decrypt ──► compress ──► ZIP ──► email
```

## Demo script (for the viva)

1. **Register** → show the email OTP → scan the QR with Google Authenticator → save backup codes.
2. **Security page** → Vault PIN → *Set up* → walk through the steps (password → email code → Authenticator → new PIN).
3. Sign out and back in → the **vault lock screen** asks for the PIN once.
4. **Upload a PAN** card image → watch the auto-check score appear (OCR, format, name match).
5. Try an invalid PAN like `ABCXE1234F` → rejected. Try a renamed `.exe` → rejected.
6. **View** the document → it opens straight away (vault already unlocked) → point out the watermark with your email and time.
7. Log in as **admin** in another browser → Verification Queue → approve.
8. Back as student → **QR** button → scan it with a phone → public "Verified ✓" page.
9. On the public verifier, drop the original file (valid) and an edited copy (not valid).
10. **Email me a ZIP** → Small KB → show the KB reduction in the email.
11. Admin → **Student Records** → open the student → *Request access* → student approves on **Access Requests** → admin sees the record → student's Activity Log shows every view → student revokes.
12. Admin → **Ledger → Run integrity check** ✓. Then edit a file in `server/storage` → run again → **tampered** detected.
13. Set `SESSION_MINUTES=3` in `.env` → the *Stay signed in?* warning appears → let it expire → only the Authenticator code is asked.
13. Sign out → **Forgot password?** → email code + Authenticator → new password.
14. Open the site on a phone (bottom navigation, *Take photo*, front + back Aadhaar).
15. Run `npm run test:e2e` live – 105 checks pass in about a minute.

## Limitations (be honest in the report)

- PAN/Aadhaar are checked by **format, checksum and OCR**; real government lookups (NSDL / UIDAI) need licensed paid APIs, so a human verifier makes the final decision.
- OCR works on clear photos/scans; text-based PDFs are read directly, scanned PDFs are left for manual review.
- Download protection (watermark, no right-click) deters leaks but cannot stop someone photographing their screen – the watermark identifies who leaked it.
- PDF compression only repacks the file; image compression gives the big KB savings.
- The encrypted ZIP uses AES-256, which Windows Explorer cannot open – use 7-Zip, WinRAR or a phone file manager.
- The ledger lives in the same database; a full database administrator could rebuild it. Production systems anchor the latest hash externally (timestamp authority / public chain).
- One master encryption key in `.env`; production would use a key vault (AWS KMS / Azure Key Vault) with per-file keys and rotation.
- Runs locally; going live needs HTTPS hosting (e.g. Render + MongoDB Atlas) and backups.

## License

[MIT](LICENSE). See [SECURITY.md](SECURITY.md) to report a vulnerability and [CONTRIBUTING.md](CONTRIBUTING.md) to propose a change.
