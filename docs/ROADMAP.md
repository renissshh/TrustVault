# TrustVault roadmap

One small change per day. The automation takes the first unchecked task, does it, and ticks it here in the same commit.
Tasks marked **[YOU]** are exercises: the automation commits a write-up in `docs/exercises/`, and SriNithish writes the code.
Full reasoning for each item: the review doc of 25 Nov 2026.

## Phase 1: Real bugs
- [x] Repository cleanup: links to renissshh, remove `client-classic/`, fix stale comments and counts (PR #2)
- [x] One-time faculty view can be opened twice: claim the grant atomically before sending (`routes/documents.js`, `lib/access.js`) + e2e test
- [ ] OTP can be used twice: `checkOtp` uses `findOneAndDelete({ key, codeHash })` (`lib/security.js`) + test
- [ ] Share link can exceed `maxViews`: atomic `$inc` with a `views < maxViews` condition (`routes/public.js`) + test
- [ ] **[YOU]** TOTP replay and backup-code reuse: make `checkSecondFactor` atomic (`routes/auth.js`)
- [ ] Documents stuck in "running" after a restart: re-run stale checks from `jobs.js` + test

## Phase 2: Security hardening
- [ ] `mongoose.set('sanitizeFilter', true)` + type-check `docId` / `ids` request fields
- [ ] Login user enumeration: dummy bcrypt compare, one message for every failure
- [ ] Admin role change requires step-up and revokes the target's sessions (`routes/admin.js`)
- [ ] **[YOU]** Lockout DoS: lock per IP + account instead of per account only
- [ ] Geolocation over HTTPS (or local GeoLite2), and say so in the privacy policy
- [ ] Remove `Export` records and files on account deletion

## Phase 3: Engineering quality
- [ ] ESLint (flat config) for server and client, run in CI
- [ ] Prettier config + format the codebase in one commit
- [ ] Structured logging with pino instead of `console.*`
- [ ] `/api/health` endpoint (DB ping), used by Render's health check
- [ ] Unit tests for `ledger.js` (chain break, edited block)
- [ ] **[YOU]** Unit tests for `lib/access.js` grant rules

## Phase 4: AWS (cloud-engineer track)
- [ ] Storage adapter interface in `lib/crypto.js` (disk / GridFS / S3), no behaviour change
- [ ] S3 storage backend (SSE-KMS), behind `FILE_STORE=s3`
- [ ] Envelope encryption: a data key per document, wrapped by an AWS KMS key; keep the old VAULT_KEY path for existing files
- [ ] **[YOU]** Key-rotation script: re-wrap data keys with a new KMS key
- [ ] OCR checks via a queue (SQS) and a separate worker process
- [ ] Ledger anchoring: daily head hash written to S3 with Object Lock
- [ ] Infrastructure as code for the AWS resources (Terraform or CDK) + a deploy doc

## Phase 5: UI refresh
- [ ] Audit pages for accessibility (labels, focus, contrast) and fix the worst issues
- [ ] Split the large pages (`Documents.jsx`, `Security.jsx`, `Login.jsx`) into components
- [ ] Code-split the landing page's three.js bundle (build warns about chunk size)
- [ ] Refresh screenshots in `docs/screenshots` after the changes
