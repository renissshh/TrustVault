// End-to-end test of every TrustVault feature against a real server + MongoDB.
// Safe to run any time: it starts its OWN server on port 5056 with a temporary data folder,
// a separate database (trustvault_e2e) and no SMTP, then deletes everything when done.
//   npm run test:e2e        (needs MongoDB running and internet for HIBP / Disify / OCR data)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { authenticator } from 'otplib';
import sharp from 'sharp';
import mongoose from 'mongoose';

const PORT = 5056;
const BASE = `http://localhost:${PORT}/api`;
const MONGO = process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/trustvault_e2e';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'trustvault-e2e-'));
const MAIL = path.join(DATA, 'dev-mail');
const PASSWORD = 'Vault-Demo-2026-q7x';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- tiny test runner ----------
let pass = 0;
let fail = 0;
let skipped = 0;
const ok = (cond, label, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  -> ${extra}` : ''}`);
};
// A check that depends on an outside service is skipped (not failed) when that service cannot be reached.
const skip = (label, why) => { skipped++; console.log(`SKIP  ${label}  -> ${why}`); };
const reachable = (url) => fetch(url, { signal: AbortSignal.timeout(2500) }).then((res) => res.ok, () => false);

// ---------- start an isolated server ----------
const env = {
  ...process.env, PORT: String(PORT), MONGO_URI: MONGO, DATA_DIR: DATA, APP_URL: `http://localhost:${PORT}`,
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), VAULT_KEY: crypto.randomBytes(32).toString('hex'), AUTH_RATE_LIMIT: '1000',
  FACULTY_CODE: 'FAC-TEST-CODE', ADMIN_CODE: 'ADM-TEST-CODE-XYZ',
};
delete env.SMTP_USER; delete env.BREVO_API_KEY; delete env.FILE_STORE; // never send real email from tests; files on disk
const server = spawn(process.execPath, ['src/index.js'], { cwd: path.join(import.meta.dirname, '..'), env });
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });
for (let i = 0; i < 50 && !serverLog.includes('running on'); i++) await sleep(200);
if (!serverLog.includes('No SMTP set')) {
  console.error('Test server did not start in dev-mail mode:\n', serverLog);
  server.kill();
  process.exit(1);
}
await mongoose.connect(MONGO);
const db = mongoose.connection.db;
await db.dropDatabase();

// ---------- helpers ----------
function client() {
  const jar = {};
  const call = async (p, { method = 'GET', body, form } = {}) => {
    const res = await fetch(BASE + p, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 e2e',
      },
      body: form ?? (body && JSON.stringify(body)),
    });
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      if (v) jar[k] = v; else delete jar[k];
    }
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, type, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  return { call, jar };
}

const lastMail = (email) => {
  const f = fs.readdirSync(MAIL).filter((n) => n.includes(email) && n.endsWith('.html')).sort().pop();
  return fs.readFileSync(path.join(MAIL, f), 'utf8');
};
const lastCode = (email) => lastMail(email).match(/Subject:<\/b> (\d{6})/)[1];
// Some emails are sent in the background after the response: wait up to 3 s for one that matches.
async function mailArrives(email, pattern) {
  for (let i = 0; i < 30; i++) {
    try { if (pattern.test(lastMail(email))) return true; } catch { /* no mail yet */ }
    await sleep(100);
  }
  return false;
}
const used = new Map(); // secret -> last code, so we never replay one
async function totp(secret) {
  while (authenticator.generate(secret) === used.get(secret)) await sleep(1000);
  const code = authenticator.generate(secret);
  used.set(secret, code);
  return code;
}
const card = (lines) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720"><rect width="100%" height="100%" fill="white"/>
  <g font-family="Arial" font-weight="bold" fill="#111">${lines.map(([t, size, y]) => `<text x="60" y="${y}" font-size="${size}">${t}</text>`).join('')}</g></svg>`)).png().toBuffer();
const upload = (c, fields, files) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const [k, [buf, name]] of Object.entries(files)) form.set(k, new Blob([buf]), name);
  return c.call('/documents', { method: 'POST', form });
};
async function waitChecks(c) {
  for (let i = 0; i < 90; i++) {
    const docs = (await c.call('/documents')).data;
    if (docs.every((d) => d.autoCheck.state !== 'running')) return docs;
    await sleep(2000);
  }
  return (await c.call('/documents')).data;
}
// Security check before sensitive changes: password -> email code -> Authenticator.
async function stepUp(c, password, secret, email) {
  let r = await c.call('/auth/step-up/password', { method: 'POST', body: { password } });
  r = await c.call('/auth/step-up/otp', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode(email) } });
  return c.call('/auth/step-up/totp', { method: 'POST', body: { ticket: r.data.ticket, code: await totp(secret) } });
}

async function signUp(c, name, email, extra = {}) {
  let r = await c.call('/auth/register', { method: 'POST', body: { name, email, password: PASSWORD, consent: true, ...extra } });
  r = await c.call('/auth/verify-email', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode(email) } });
  const { secret, ticket } = r.data;
  r = await c.call('/auth/login/totp', { method: 'POST', body: { ticket, code: await totp(secret), remember: true } });
  return { secret, backupCodes: r.data.backupCodes };
}

const PAN = await card([['INCOME TAX DEPARTMENT', 48, 110], ['GOVT. OF INDIA', 40, 180], ['Permanent Account Number Card', 36, 300],
  ['ABCPS1234F', 64, 390], ['RAHUL SHARMA', 44, 500], ['DEMO SAMPLE - NOT A REAL CARD', 32, 580]]);

try {
  const student = client();
  const admin = client();
  const faculty = client();

  // ===== Sign-up =====
  let r = await student.call('/auth/register', { method: 'POST', body: { name: 'Rahul Sharma', email: 'rahul@demo.test', password: PASSWORD } });
  ok(r.status === 400 && /privacy/.test(r.data.error), 'sign-up without privacy consent is refused');
  // These two rely on public APIs. The app lets sign-ups through when they are down (by design), so
  // test them only when they answer - and never leave a half-made account behind for the next steps.
  if (await reachable('https://api.pwnedpasswords.com/range/CBFDA')) {
    r = await student.call('/auth/register', { method: 'POST', body: { name: 'Rahul Sharma', email: 'rahul@demo.test', password: 'password123', consent: true } });
    if (r.status === 201) { skip('breached password blocked (Have I Been Pwned)', 'the service timed out during the check'); await db.collection('users').deleteMany({ email: 'rahul@demo.test' }); }
    else ok(r.status === 400 && /breach/.test(r.data.error), 'breached password blocked (Have I Been Pwned)');
  } else skip('breached password blocked (Have I Been Pwned)', 'api.pwnedpasswords.com not reachable');
  if (await reachable('https://www.disify.com/api/email/x1@mailinator.com')) {
    r = await student.call('/auth/register', { method: 'POST', body: { name: 'Temp', email: 'x1@mailinator.com', password: PASSWORD, consent: true } });
    if (r.status === 201) { skip('disposable email blocked (Disify)', 'the service timed out during the check'); await db.collection('users').deleteMany({ email: 'x1@mailinator.com' }); }
    else ok(r.status === 400 && /disposable/i.test(r.data.error), 'disposable email blocked (Disify)');
  } else skip('disposable email blocked (Disify)', 'disify.com not reachable');

  r = await client().call('/auth/register', { method: 'POST', body: { name: 'Rahul Sharma', email: 'other@demo.test', studentId: '22CS101', password: PASSWORD, consent: true } });
  ok(r.status === 400 && /MCA roll number/.test(r.data.error), 'sign-up refused without an MCA roll number (22CS101)');
  r = await client().call('/auth/register', { method: 'POST', body: { name: 'Rahul Sharma', email: 'other@demo.test', studentId: '99MX101', password: PASSWORD, consent: true } });
  ok(r.status === 400 && /future/.test(r.data.error), 'sign-up refused with a roll number from a future year');
  r = await student.call('/auth/register', { method: 'POST', body: { name: 'Rahul Sharma', email: 'rahul@demo.test', studentId: '23mx 101', password: PASSWORD, consent: true } });
  ok(r.status === 201 && r.data.next === 'verify-email', 'student registered, email code sent');
  ok((await db.collection('users').findOne({ email: 'rahul@demo.test' }))?.studentId === '23MX101', 'roll number saved cleaned up (23MX101)');
  const copy = await client().call('/auth/register', { method: 'POST', body: { name: 'Copy Cat', email: 'copy@demo.test', studentId: '23MX101', password: PASSWORD, consent: true } });
  ok(copy.status === 409 && /already has an account/.test(copy.data.error), 'second account with the same roll number refused');
  r = await student.call('/auth/verify-email', { method: 'POST', body: { ticket: r.data.ticket, code: '000000' } });
  ok(r.status === 400, 'wrong email code rejected');
  r = await student.call('/auth/login/resend', { method: 'POST', body: { ticket: 'forged' } });
  ok(r.status === 401, 'resend with a forged ticket is refused');
  // signing in before the email is verified goes back to the email-code step
  r = await student.call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: PASSWORD } });
  r = await student.call('/auth/verify-email', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode('rahul@demo.test') } });
  ok(r.data.next === 'totp-setup' && r.data.qr?.startsWith('data:image/png'), 'email verified -> Google Authenticator QR');
  const sSecret = r.data.secret;
  const setupTicket = r.data.ticket;
  r = await student.call('/auth/login/totp', { method: 'POST', body: { ticket: setupTicket, code: '000000' } });
  ok(r.status === 400, 'wrong Authenticator code rejected');
  r = await student.call('/auth/login/totp', { method: 'POST', body: { ticket: setupTicket, code: await totp(sSecret), remember: true } });
  ok(r.data.backupCodes?.length === 8 && student.jar.tv_sid && student.jar.tv_td, 'Authenticator accepted: session + 8 backup codes + trusted-device cookie');
  const sBackup = r.data.backupCodes;
  r = await student.call('/auth/me');
  const mins = (new Date(r.data.expiresAt) - Date.now()) / 60e3;
  ok(r.data.user?.role === 'student' && mins > 59 && mins <= 60, 'session lasts 60 minutes', `${mins.toFixed(1)} min`);

  // ===== Sign-in =====
  r = await student.call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: PASSWORD } });
  ok(r.data.next === 'totp' && r.data.trusted, 'trusted device skips the email code (password + Authenticator)');
  r = await student.call('/auth/login/totp', { method: 'POST', body: { ticket: r.data.ticket, code: sBackup[0] } });
  ok(r.status === 200, 'backup code works instead of Authenticator');
  r = await student.call('/auth/me');
  ok(r.data.user.backupCodesLeft === 7, 'used backup code is spent', `${r.data.user.backupCodesLeft} left`);

  const other = client();
  r = await other.call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: 'wrong-pass-1' } });
  ok(r.status === 401, 'wrong password rejected');
  r = await other.call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: PASSWORD } });
  ok(r.data.next === 'otp', 'new device must enter the email code', r.data.email);
  r = await other.call('/auth/login/otp', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode('rahul@demo.test') } });
  r = await other.call('/auth/login/totp', { method: 'POST', body: { ticket: r.data.ticket, code: used.get(sSecret) } });
  ok(r.status === 400, 'an Authenticator code cannot be replayed');

  // ===== Vault PIN + uploads =====
  const phone = client(); // a second, fully signed-in device
  r = await phone.call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: PASSWORD } });
  r = await phone.call('/auth/login/otp', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode('rahul@demo.test') } });
  r = await phone.call('/auth/login/totp', { method: 'POST', body: { ticket: r.data.ticket, code: await totp(sSecret) } });
  ok(r.status === 200, 'second device signed in');
  r = await student.call('/auth/vault-pin', { method: 'POST', body: { pin: '482915' } });
  ok(r.status === 403 && r.data.code === 'STEP_UP', 'setting a PIN needs a security check first');
  r = await student.call('/auth/step-up/password', { method: 'POST', body: { password: 'not-my-password' } });
  ok(r.status === 403, 'security check: wrong password stops at step 1');
  r = await student.call('/auth/step-up/password', { method: 'POST', body: { password: PASSWORD } });
  const stepTicket = r.data.ticket;
  r = await student.call('/auth/step-up/otp', { method: 'POST', body: { ticket: stepTicket, code: '000000' } });
  ok(r.status === 400, 'security check: wrong email code stops at step 2');
  r = await phone.call('/auth/step-up/otp', { method: 'POST', body: { ticket: stepTicket, code: lastCode('rahul@demo.test') } });
  ok(r.status === 401, 'security check ticket cannot be used from another session');
  r = await stepUp(student, PASSWORD, sSecret, 'rahul@demo.test');
  ok(r.status === 200 && new Date(r.data.elevatedUntil) > new Date(), 'security check passed: password + email code + Authenticator');
  r = await student.call('/auth/vault-pin', { method: 'POST', body: { pin: '123456' } });
  ok(r.status === 400, 'an easy-to-guess PIN is refused');
  r = await student.call('/auth/vault-pin', { method: 'POST', body: { pin: '482915' } });
  ok(r.data.user?.hasVaultPin, 'vault PIN set');

  r = await upload(student, { type: 'pan', number: 'ABCXS1234F' }, { file: [PAN, 'pan.png'] });
  ok(r.status === 400, 'invalid PAN format rejected', r.data.error);
  r = await upload(student, { type: 'pan', number: 'abcps 1234 f' }, { file: [PAN, 'pan.png'] });
  ok(r.status === 201 && r.data.numberMasked === 'AB******4F', 'PAN uploaded, number masked', r.data.numberMasked);
  const panId = r.data.id;
  r = await upload(student, { type: 'pan', number: 'ABCPS1234F' }, { file: [PAN, 'pan.png'] });
  ok(r.status === 409, 'duplicate upload blocked');
  r = await upload(student, { type: 'marksheet' }, { file: [Buffer.from('MZ this is really an exe file'), 'evil.pdf'] });
  ok(r.status === 400, 'renamed .exe rejected (real file type check)');

  const aFront = await card([['GOVERNMENT OF INDIA', 44, 110], ['RAHUL SHARMA', 44, 220], ['DOB: 01/01/2003', 34, 300], ['2341 2341 2346', 60, 420], ['AADHAAR - DEMO SAMPLE', 30, 520]]);
  const aBack = await card([['UNIQUE IDENTIFICATION AUTHORITY OF INDIA', 36, 120], ['Address: 12 Demo Street, Chennai', 34, 240], ['2341 2341 2346', 50, 380]]);
  r = await upload(student, { type: 'aadhaar', number: '2341 2341 2346' }, { file: [aFront, 'front.png'], back: [aBack, 'back.png'] });
  ok(r.status === 201 && r.data.sides === 2 && r.data.mime === 'image/jpeg', 'Aadhaar front + back merged into one file', r.data.originalName);
  r = await upload(student, { type: 'license', number: 'MH12 20110012345' }, { file: [PAN, 'a.png'], back: [Buffer.from('%PDF-1.4 fake'), 'b.pdf'] });
  ok(r.status === 400, 'mixing a photo and a PDF for two sides is refused', r.data.error);

  const dlCard = await card([['UNION OF INDIA', 44, 100], ['DRIVING LICENCE', 52, 180], ['TRANSPORT DEPARTMENT MAHARASHTRA', 34, 260], ['MH12 20110012345', 60, 370], ['RAHUL SHARMA', 44, 470]]);
  r = await upload(student, { type: 'other' }, { file: [dlCard, 'scan-001.png'] });
  ok(r.status === 201 && r.data.status === 'stored', '"Other" upload is stored, not sent for verification');
  const otherId = r.data.id;

  let docs = await waitChecks(student);
  const pan = docs.find((d) => d.id === panId);
  const aadhaar = docs.find((d) => d.type === 'aadhaar');
  const otherDoc = docs.find((d) => d.id === otherId);
  ok(pan.autoCheck.score >= 80, `PAN auto-check ${pan.autoCheck.score}%`, pan.autoCheck.checks.filter((c) => !c.ok).map((c) => c.name).join('; '));
  ok(aadhaar.autoCheck.checks.some((c) => c.name.startsWith('Front:')) && aadhaar.autoCheck.checks.some((c) => c.name.startsWith('Back:')), 'both Aadhaar sides checked for originality');
  ok(otherDoc.autoCheck.detectedType === 'license', '"Other" upload recognised as a Driving Licence');
  ok(pan.status === 'verified', 'PAN verified automatically because every check passed', pan.status);
  ok(otherDoc.status === 'stored', '"Other" stays stored (never verified)');
  r = await upload(student, { type: 'pan', number: 'ABDPS9876K' }, { file: [await card([['INCOME TAX DEPARTMENT', 48, 110], ['ABCPS1234F', 64, 300], ['RAHUL SHARMA', 44, 420]]), 'other-pan.png'] });
  const wrongPan = r.data.id;
  docs = await waitChecks(student);
  const wrong = docs.find((d) => d.id === wrongPan);
  ok(wrong.status === 'rejected' && /Entered number appears in the document/.test(wrong.reviewNote), 'a failed check means NOT verified, with the reason', wrong.reviewNote);
  await student.call(`/documents/${wrongPan}`, { method: 'DELETE' });

  // ===== Viewing =====
  await student.call('/auth/vault/lock', { method: 'POST' });
  r = await student.call(`/documents/${panId}/view`, { method: 'POST', body: {} });
  ok(r.status === 403 && r.data.code === 'VAULT_LOCKED', 'locked vault asks for the PIN');
  r = await student.call(`/documents/${panId}/view`, { method: 'POST', body: { pin: '111111' } });
  ok(r.status === 403 && /4 attempt/.test(r.data.error), 'wrong vault PIN rejected', r.data.error);
  r = await student.call('/auth/vault/unlock', { method: 'POST', body: { pin: '482915' } });
  ok(r.data.vaultUnlocked && (await student.call('/auth/me')).data.vaultUnlocked, 'PIN entered once unlocks the vault for the session');
  r = await student.call(`/documents/${panId}/view`, { method: 'POST', body: {} });
  ok(r.status === 200 && r.type === 'image/png' && r.data.length > 1000, 'unlocked vault -> watermarked image with no PIN prompt');
  r = await phone.call(`/documents/${panId}/view`, { method: 'POST', body: {} });
  ok(r.status === 403 && r.data.code === 'VAULT_LOCKED', 'the unlock does not carry over to another device');
  r = await student.call('/admin/queue');
  ok(r.status === 404, 'there is no human verification queue any more');
  r = await student.call('/records/students');
  ok(r.status === 403, 'student blocked from student records');

  // ===== Faculty and administrator sign-up with secret codes =====
  r = await client().call('/auth/register', { method: 'POST', body: { name: 'Fake Teacher', email: 'fake@demo.test', password: PASSWORD, consent: true, role: 'faculty', code: 'WRONG' } });
  ok(r.status === 403 && /faculty code/.test(r.data.error), 'faculty sign-up refused with a wrong faculty code');
  r = await client().call('/auth/register', { method: 'POST', body: { name: 'Fake Admin', email: 'fake@demo.test', password: PASSWORD, consent: true, role: 'admin', code: 'FAC-TEST-CODE' } });
  ok(r.status === 403 && /administrator code/.test(r.data.error), 'the faculty code does not create an administrator');
  await signUp(faculty, 'Priya Raman', 'faculty@demo.test', { role: 'faculty', code: 'fac-test-code' });
  ok((await db.collection('users').findOne({ email: 'faculty@demo.test' }))?.role === 'verifier', 'faculty account created with the faculty code (any letter case)');
  await signUp(admin, 'Priya Admin', 'admin@demo.test', { role: 'admin', code: 'ADM-TEST-CODE-XYZ' });
  ok((await db.collection('users').findOne({ email: 'admin@demo.test' }))?.role === 'admin', 'administrator account created with the admin code');
  r = await admin.call('/auth/vault-pin', { method: 'POST', body: { pin: '135790' } });
  ok(r.data.user?.hasVaultPin, 'a full sign-in (password + email + Authenticator) counts as the security check');
  r = await faculty.call('/auth/vault-pin', { method: 'POST', body: { pin: '135790' } });
  r = await admin.call('/records/students');
  ok(r.status === 403, 'administrators cannot open student records (only faculty can)');
  r = await admin.call(`/documents/${panId}/view`, { method: 'POST', body: { pin: '135790' } });
  ok(r.status === 403, 'administrators cannot open students\' files');

  // ===== Consent before record access =====
  r = await faculty.call(`/documents/${panId}/view`, { method: 'POST', body: { pin: '135790' } });
  ok(r.status === 403, 'verified record is closed without the student\'s consent');
  const sid = (await faculty.call('/records/students?q=23MX1')).data[0]?.id;
  r = await faculty.call(`/records/students/${sid}`);
  ok(r.data.documents.length === 0 && !r.data.access, 'record detail hidden before consent');
  r = await faculty.call(`/records/students/${sid}/request`, { method: 'POST', body: { reason: 'Placement document check' } });
  ok(r.status === 400, 'a request must tick at least one document type');
  r = await faculty.call(`/records/students/${sid}/request`, { method: 'POST', body: { types: ['pan', 'aadhaar', 'nonsense'], reason: 'Placement document check' } });
  ok(r.status === 201, 'faculty asked for PAN + Aadhaar');
  ok(await mailArrives('rahul@demo.test', /asking for your documents/), 'student emailed about the request');
  r = await student.call('/auth/me');
  ok(r.data.pendingAccess === 1, 'student sees 1 pending request');
  let mine = (await student.call('/access')).data[0];
  ok(mine.types.join() === 'pan,aadhaar', 'unknown document types are dropped from the request');
  const reqId = mine.id;
  r = await student.call(`/access/${reqId}`, { method: 'POST', body: { decision: 'approve', types: ['pan'] } });
  ok(r.status === 200, 'student approved only the PAN');
  r = await faculty.call(`/records/students/${sid}`);
  ok(r.data.documents.length === 1 && r.data.documents[0].type === 'pan' && r.data.documents[0].canOpen, 'faculty sees only the approved PAN, ready to open once');
  r = await faculty.call(`/documents/${otherId}/view`, { method: 'POST', body: { pin: '135790' } });
  ok(r.status === 403, 'a document type the student did not approve stays closed');
  r = await faculty.call(`/documents/${panId}/view`, { method: 'POST', body: { pin: '135790' } });
  ok(r.status === 200, 'faculty views the verified PAN with consent');
  r = await faculty.call(`/documents/${panId}/view`, { method: 'POST', body: { pin: '135790' } });
  ok(r.status === 403 && /one time|once/i.test(r.data.error), 'second view of the same document refused (one-time access)');
  mine = (await student.call('/access')).data.find((a) => a.id === reqId);
  ok(mine.status === 'used' && mine.opened === 1, 'request closes once every approved document was opened');
  r = await student.call('/auth/activity');
  ok(r.data.some((a) => a.action === 'record.view' && a.user?.name === 'Priya Raman'), 'student sees the access in the activity log');
  r = await faculty.call(`/records/students/${sid}/request`, { method: 'POST', body: { types: ['pan'] } });
  const again = (await student.call('/access')).data.find((a) => a.status === 'pending').id;
  r = await student.call(`/access/${again}`, { method: 'POST', body: { decision: 'approve' } });
  r = await student.call(`/access/${again}`, { method: 'POST', body: { decision: 'revoke' } });
  r = await faculty.call(`/documents/${panId}/view`, { method: 'POST', body: { pin: '135790' } });
  ok(r.status === 403, 'access revoked by the student');
  r = await admin.call('/admin/requests');
  ok(r.data.length >= 2 && r.data.some((a) => a.status === 'used' && a.granted.join() === 'pan'), 'administrator sees every request and answer');
  r = await faculty.call('/records/batch-request', { method: 'POST', body: { group: '23mx', types: ['class10', 'class12'] } });
  ok(r.status === 201 && r.data.sent === 1, 'batch request sent to every student of batch 23MX', JSON.stringify(r.data));
  r = await faculty.call('/records/batch-request', { method: 'POST', body: { group: '23MX', types: ['class10'] } });
  ok(r.status === 201 && r.data.sent === 0 && r.data.skipped === 1, 'a student who already has a waiting request is not asked twice');
  r = await faculty.call('/records/batch-request', { method: 'POST', body: { group: '2023', types: ['pan'] } });
  ok(r.status === 400, 'a batch must look like 26MX');
  ok((await faculty.call('/records/batch/23MX')).data.students === 1, 'faculty can see how many students are in a batch');
  r = await client().call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: PASSWORD, as: 'faculty' } });
  ok(r.status === 403 && /student account/.test(r.data.error), 'a student cannot use the faculty sign-in');
  r = await client().call('/auth/login', { method: 'POST', body: { email: 'admin@demo.test', password: PASSWORD, as: 'student' } });
  ok(r.status === 403 && /administrator account/.test(r.data.error), 'an administrator cannot use the student sign-in');

  // ===== Re-file "Other" =====
  r = await student.call(`/documents/${otherId}/type`, { method: 'PATCH', body: { type: 'license', number: 'ZZ12 20110012345' } });
  ok(r.status === 400, 'invalid licence state code rejected');
  r = await student.call(`/documents/${otherId}/type`, { method: 'PATCH', body: { type: 'license', number: 'MH12 20110012345' } });
  ok(r.data.type === 'license' && r.data.status === 'pending', '"Other" re-filed as Driving Licence, now pending');

  // ===== No public QR check any more =====
  r = await student.call(`/documents/${panId}/qr`);
  ok(r.status === 404, 'there are no QR codes any more');
  r = await client().call('/public/verify/anything');
  ok(r.status === 404, 'the public QR check is gone');
  r = await client().call('/public/stats');
  ok(r.data.documents === 3 && r.data.verified >= 1, 'public stats', JSON.stringify(r.data));

  // ===== Export: compressed + AES-encrypted ZIP by email =====
  r = await student.call('/documents/export', { method: 'POST', body: { quality: 'small', pin: '482915' } });
  ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.data.zipPassword ?? ''), 'ZIP password shown on screen', r.data.summary);
  const zipFile = fs.readdirSync(MAIL).find((n) => n.endsWith('.zip'));
  const zipBuf = fs.readFileSync(path.join(MAIL, zipFile));
  ok((zipBuf.readUInt16LE(6) & 1) === 1 && !lastMail('rahul@demo.test').includes(r.data.zipPassword), 'emailed ZIP is encrypted and the password is NOT in the email');
  r = await student.call('/documents/export', { method: 'POST', body: { targetKB: 5, pin: '482915' } });
  ok(r.status === 400, 'a size limit below 20 KB is refused');
  r = await student.call('/documents/export', { method: 'POST', body: { targetKB: 40, ids: [panId, aadhaar.id], pin: '482915' } });
  ok(r.status === 200 && r.data.sizes.length === 2 && r.data.sizes.every((x) => +x.match(/(\d+) KB$/)[1] <= 40), 'files shrunk to fit a 40 KB limit', r.data.sizes?.join('; '));

  // ===== 10th / 12th marksheets: stored, no checks =====
  r = await upload(student, { type: 'class10' }, { file: [await card([['SECONDARY SCHOOL CERTIFICATE', 40, 140], ['RAHUL SHARMA', 44, 260]]), '10th.png'] });
  ok(r.status === 201 && r.data.status === 'stored', '10th marksheet stored without verification');
  const tenthId = r.data.id;

  // ===== Documents are compared with each other, never with the account name =====
  r = await upload(student, { type: 'certificate' }, { file: [await card([['BONAFIDE CERTIFICATE', 44, 140], ['THIS IS TO CERTIFY THAT', 34, 240], ['RAHUL SHARMA', 48, 340], ['DEMO COLLEGE CHENNAI', 34, 440]]), 'cert.png'] });
  const certId = r.data.id;
  r = await upload(student, { type: 'certificate' }, { file: [await card([['COURSE COMPLETION CERTIFICATE', 40, 140], ['AWARDED TO', 34, 240], ['ANITA VERMA', 48, 340], ['KOLKATA', 34, 440]]), 'cert2.png'] });
  const strangerId = r.data.id;
  docs = await waitChecks(student);
  const match = (id) => docs.find((d) => d.id === id).autoCheck;
  ok(match(tenthId).state === 'skipped' && !match(tenthId).checks.length, '10th marksheet is not checked');
  ok(match(certId).checks.some((c) => c.name === 'Matches your other documents' && c.ok), "certificate matches the student's other documents", match(certId).checks.find((c) => c.name.startsWith('Matches'))?.detail);
  ok(match(strangerId).checks.some((c) => c.name === 'Matches your other documents' && !c.ok), "a certificate in someone else's name is flagged", match(strangerId).checks.find((c) => c.name.startsWith('Matches'))?.detail);
  ok(!match(certId).checks.some((c) => /holder name|5th letter/i.test(c.name)), 'no check compares the document with the account name');

  // ===== Share link =====
  r = await student.call('/shares', { method: 'POST', body: { docId: panId, email: 'hr@company.test', hours: 24, pin: '482915' } });
  ok(r.status === 201, 'share link sent');
  const token = lastMail('hr@company.test').match(/\/share\/([a-f0-9]+)/)[1];
  const guest = client();
  r = await guest.call(`/public/share/${token}`);
  ok(r.data.owner === 'Rahul Sharma', 'recipient opens the share page');
  await guest.call(`/public/share/${token}/otp`, { method: 'POST' });
  r = await guest.call(`/public/share/${token}/view`, { method: 'POST', body: { code: lastCode('hr@company.test') } });
  ok(r.status === 200 && r.type === 'image/png', 'recipient views it after the email code');

  // ===== Ledger & tamper detection =====
  r = await admin.call('/admin/integrity', { method: 'POST' });
  ok(r.data.ok, `integrity check clean (${r.data.blocks} blocks)`);
  const stored = (await db.collection('documents').findOne({ type: 'pan' })).storedName;
  const file = path.join(DATA, 'storage', stored);
  const original = fs.readFileSync(file);
  const hacked = Buffer.from(original); hacked[hacked.length - 5] ^= 0xff;
  fs.writeFileSync(file, hacked);
  r = await admin.call('/admin/integrity', { method: 'POST' });
  ok(!r.data.ok && r.data.tampered === 1, 'tampered file detected');
  r = await student.call(`/documents/${panId}/view`, { method: 'POST', body: { pin: '482915' } });
  ok(r.status === 409, 'tampered file refused on view');
  fs.writeFileSync(file, original);
  const block0 = await db.collection('blocks').findOne({ index: 0 });
  await db.collection('blocks').updateOne({ index: 0 }, { $set: { fileHash: 'f'.repeat(64) } });
  r = await admin.call('/admin/integrity', { method: 'POST' });
  ok(!r.data.ok, 'edited ledger block detected', r.data.problems?.[0]);
  await db.collection('blocks').updateOne({ index: 0 }, { $set: { fileHash: block0.fileHash } });

  // ===== Session expiry -> Authenticator only =====
  await db.collection('sessions').updateMany({ user: new mongoose.Types.ObjectId(sid) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  r = await student.call('/documents');
  ok(r.status === 401 && r.data.code === 'SESSION_EXPIRED', 'expired session blocked');
  r = await student.call('/auth/reauth');
  ok(r.data.name === 'Rahul Sharma', 're-auth screen knows the user');
  r = await student.call('/auth/reauth', { method: 'POST', body: { code: await totp(sSecret) } });
  ok(r.data.ok && (await student.call('/documents')).status === 200, 'new 60-minute session with the Authenticator code only');

  // ===== Forgot password =====
  r = await client().call('/auth/forgot', { method: 'POST', body: { email: 'nobody@demo.test' } });
  ok(r.status === 200 && r.data.ticket, 'forgot-password does not reveal whether an email is registered');
  r = await client().call('/auth/forgot', { method: 'POST', body: { email: 'rahul@demo.test' } });
  let ticket = r.data.ticket;
  r = await client().call('/auth/reset', { method: 'POST', body: { ticket, code: lastCode('rahul@demo.test'), totp: '000000', password: 'New-Vault-2026-zz' } });
  ok(r.status === 400, 'reset refused without the Authenticator / backup code');
  r = await client().call('/auth/forgot', { method: 'POST', body: { email: 'rahul@demo.test' } });
  ticket = r.data.ticket;
  r = await client().call('/auth/reset', { method: 'POST', body: { ticket, code: lastCode('rahul@demo.test'), totp: sBackup[1], password: 'New-Vault-2026-zz' } });
  ok(r.data.ok, 'password reset with email code + backup code');
  r = await student.call('/documents');
  ok(r.status === 401, 'all sessions signed out after reset');
  r = await student.call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: 'New-Vault-2026-zz' } });
  ok(r.data.next === 'otp', 'new password works, and trusted devices were forgotten');

  // ===== Admin resets a lost Authenticator =====
  r = await admin.call(`/admin/users/${sid}/reset-2fa`, { method: 'POST' });
  ok(r.status === 200, 'admin reset the student\'s 2FA');
  r = await student.call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: 'New-Vault-2026-zz' } });
  r = await student.call('/auth/login/otp', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode('rahul@demo.test') } });
  ok(r.data.next === 'totp-setup', 'student scans a new QR at next sign-in');
  const newSecret = r.data.secret;
  r = await student.call('/auth/login/totp', { method: 'POST', body: { ticket: r.data.ticket, code: await totp(newSecret) } });
  const newBackup = r.data.backupCodes;
  ok(newBackup?.length === 8, 'new Authenticator + new backup codes');

  // ===== Profile & delete account =====
  r = await student.call('/auth/profile', { method: 'PATCH', body: { name: 'Rahul K Sharma', studentId: '23MX101' } });
  ok(r.data.user?.name === 'Rahul K Sharma', 'profile name updated');
  const fake = new FormData();
  fake.append('photo', new Blob(['plain text, not a picture'], { type: 'image/png' }), 'fake.png');
  r = await student.call('/auth/avatar', { method: 'PUT', form: fake });
  ok(r.status === 400, 'profile photo: a non-image is rejected');
  const pic = new FormData();
  pic.append('photo', new Blob([await sharp({ create: { width: 900, height: 600, channels: 3, background: '#7c3aed' } }).jpeg().toBuffer()], { type: 'image/jpeg' }), 'me.jpg');
  r = await student.call('/auth/avatar', { method: 'PUT', form: pic });
  ok(r.data.user?.avatarV > 0, 'profile photo uploaded');
  r = await student.call('/auth/avatar');
  const meta = await sharp(r.data).metadata();
  ok(r.type === 'image/webp' && meta.width === 256 && meta.height === 256, 'profile photo stored as a 256 px square WebP');
  r = await student.call('/auth/avatar', { method: 'DELETE' });
  ok(r.data.user?.avatarV === 0 && (await student.call('/auth/avatar')).status === 404, 'profile photo removed');
  await db.collection('sessions').updateMany({ user: new mongoose.Types.ObjectId(sid) }, { $unset: { elevatedUntil: 1 } });
  r = await student.call('/auth/delete-account', { method: 'POST', body: { confirm: 'DELETE' } });
  ok(r.status === 403 && r.data.code === 'STEP_UP', 'delete account needs a fresh security check');
  await stepUp(student, 'New-Vault-2026-zz', newSecret, 'rahul@demo.test');
  r = await student.call('/auth/delete-account', { method: 'POST', body: { confirm: 'yes' } });
  ok(r.status === 400, 'delete account needs DELETE typed');
  r = await student.call('/auth/delete-account', { method: 'POST', body: { confirm: 'DELETE' } });
  ok(r.data.ok && newBackup.length === 8, 'account deleted');
  ok(await db.collection('documents').countDocuments() === 0 && fs.readdirSync(path.join(DATA, 'storage')).length === 0, 'all documents and encrypted files erased');
  r = await client().call('/auth/login', { method: 'POST', body: { email: 'rahul@demo.test', password: 'New-Vault-2026-zz' } });
  ok(r.status === 401, 'deleted account cannot sign in');
  r = await admin.call('/admin/integrity', { method: 'POST' });
  ok(r.data.ok, 'ledger still intact after deletions');

  // ===== Invitations =====
  const invitee = client();
  r = await invitee.call('/admin/invites', { method: 'POST', body: { email: 'vera@demo.test', role: 'verifier' } });
  ok(r.status === 401, 'inviting needs a signed-in admin');
  r = await admin.call('/admin/invites', { method: 'POST', body: { email: 'vera@demo.test', role: 'student' } });
  ok(r.status === 400, 'an invitation cannot be for a student');
  r = await admin.call('/admin/invites', { method: 'POST', body: { email: 'admin@demo.test', role: 'verifier' } });
  ok(r.status === 409, 'cannot invite someone who already has an account');
  r = await admin.call('/admin/invites', { method: 'POST', body: { email: 'vera@demo.test', role: 'verifier' } });
  const inviteOld = lastMail('vera@demo.test').match(/invite=([0-9a-f]{64})/)?.[1];
  ok(r.status === 201 && r.data.status === 'pending' && inviteOld, 'admin invited a verifier, link emailed');
  r = await admin.call('/admin/invites', { method: 'POST', body: { email: 'vera@demo.test', role: 'verifier' } });
  const inviteNew = lastMail('vera@demo.test').match(/invite=([0-9a-f]{64})/)[1];
  ok((await invitee.call(`/public/invite/${inviteOld}`)).status === 404, 'a newer invitation cancels the older link');
  r = await invitee.call(`/public/invite/${inviteNew}`);
  ok(r.data.email === 'vera@demo.test' && r.data.role === 'verifier', 'invitation page shows who it is for');
  r = await invitee.call('/auth/register', { method: 'POST', body: { name: 'Mallory', email: 'mallory@demo.test', password: PASSWORD, consent: true, invite: inviteNew } });
  ok(r.status === 400 && /different email/.test(r.data.error), 'invitation refused for a different email address');
  await signUp(invitee, 'Vera Verifier', 'vera@demo.test', { invite: inviteNew });
  r = await invitee.call('/auth/me');
  ok(r.data.user?.role === 'verifier', 'invited account starts as a verifier');
  r = await client().call('/auth/register', { method: 'POST', body: { name: 'Again', email: 'vera2@demo.test', password: PASSWORD, consent: true, invite: inviteNew } });
  ok(r.status === 400, 'an invitation link works only once');
  r = await invitee.call('/admin/invites');
  ok(r.status === 403, 'a verifier cannot see or send invitations');
  r = await admin.call('/admin/invites');
  ok(r.data.some((i) => i.email === 'vera@demo.test' && i.status === 'used'), 'admin sees the invitation as used');
} catch (e) {
  fail++;
  console.error('Test crashed:', e);
} finally {
  console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped (outside service unavailable)` : ''}`);
  await db.dropDatabase();
  await mongoose.disconnect();
  server.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exitCode = fail ? 1 : 0;
}
