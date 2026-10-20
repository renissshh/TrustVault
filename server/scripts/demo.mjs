// Laptop demo: WIPES the local database, stored files and demo emails, then creates
//   1 administrator, 2 faculty and 10 MCA students, each student with SPECIMEN documents
//   (PAN, Aadhaar, 10th, 12th, college certificate, some with a driving licence),
//   real automatic checks, some approvals, and faculty requests in every state.
// Run from the project folder:  npm run demo        (refuses to touch anything but a local database)
// Accounts and Authenticator secrets are written to DEMO-ACCOUNTS.md and demo-accounts.json (both git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import mongoose from 'mongoose';
import { authenticator } from 'otplib';
import config from '../src/config.js';
import { User, Document, AccessRequest, Audit } from '../src/models.js';
import { sha256, storeFile, encryptText, decryptText } from '../src/lib/crypto.js';
import { runChecks, maskNumber, verhoeff } from '../src/lib/verify.js';
import { addBlock } from '../src/lib/ledger.js';
import { TYPE_LABELS, UNCHECKED } from '../src/routes/documents.js';
import { GRANT_HOURS } from '../src/lib/access.js';

const ROOT = path.join(import.meta.dirname, '..', '..');
const PASSWORD = 'TrustVault@2026';
const PIN = '482915';
const local = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(config.mongoUri);
if (!local && !process.argv.includes('--yes-online')) {
  console.error(`Refusing: MONGO_URI is not a local database (${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}). This script deletes everything.`);
  process.exit(1);
}

// ---------- people ----------
// Staff get their own ID documents too (no school or college papers); `holder` is the name printed on their cards.
const ADMIN = { name: 'Admin Office', holder: 'Kavitha Subramanian', email: 'admin@trustvault.demo', role: 'admin', sex: 'F', city: 'Coimbatore', state: 'TN', dob: '12/06/1984' };
const FACULTY = [
  { name: 'Dr. Priya Raman', holder: 'Priya Raman', email: 'priya.raman@trustvault.demo', role: 'verifier', sex: 'F', city: 'Coimbatore', state: 'TN', dob: '21/02/1986' },
  { name: 'Prof. Arun Kumar', holder: 'Arun Kumar', email: 'arun.kumar@trustvault.demo', role: 'verifier', sex: 'M', city: 'Palakkad', state: 'KL', dob: '09/11/1981' },
];
const STUDENTS = [
  ['Rahul Sharma', '23MX301', 'M', 'Chennai', 'TN'], ['Ananya Iyer', '23MX302', 'F', 'Coimbatore', 'TN'],
  ['Karthik Raja', '23MX303', 'M', 'Madurai', 'TN'], ['Divya Nair', '23MX304', 'F', 'Kochi', 'KL'],
  ['Vikram Singh', '23MX305', 'M', 'Jaipur', 'RJ'], ['Meera Krishnan', '23MX306', 'F', 'Salem', 'TN'],
  ['Arjun Reddy', '24MX307', 'M', 'Hyderabad', 'TG'], ['Sneha Patel', '24MX308', 'F', 'Ahmedabad', 'GJ'],
  ['Mohammed Faiz', '24MX309', 'M', 'Bengaluru', 'KA'], ['Lakshmi Venkat', '24MX310', 'F', 'Tiruppur', 'TN'],
].map(([name, roll, sex, city, state], i) => ({
  name, roll, sex, city, state, role: 'student', email: `${name.split(' ')[0].toLowerCase()}.${roll.toLowerCase()}@trustvault.demo`,
  dob: `${String(3 + i * 2).padStart(2, '0')}/${String((i % 12) + 1).padStart(2, '0')}/${2002 - (i % 2)}`,
}));

// ---------- SPECIMEN card images ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function card({ band, head, sub, rows, big, photo = true }) {
  const W = 1012, H = 638;
  const lines = rows.map(([k, v], i) => `<text x="${photo ? 300 : 60}" y="${250 + i * 52}" font-size="26" fill="#555">${esc(k)}</text>
    <text x="${photo ? 520 : 330}" y="${250 + i * 52}" font-size="30" font-weight="bold" fill="#111">${esc(v)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="100%" height="100%" rx="28" fill="#fdfdf8" stroke="#bbb" stroke-width="3"/>
    <rect width="${W}" height="120" fill="${band}"/>
    <g font-family="Arial">
      <text x="${W / 2}" y="62" font-size="38" font-weight="bold" fill="#fff" text-anchor="middle">${esc(head)}</text>
      <text x="${W / 2}" y="102" font-size="24" fill="#fff" text-anchor="middle">${esc(sub)}</text>
      ${photo ? '<rect x="60" y="170" width="200" height="250" rx="12" fill="#e4e7ee" stroke="#9aa"/><circle cx="160" cy="255" r="52" fill="#b9c0cc"/><rect x="95" y="320" width="130" height="90" rx="60" fill="#b9c0cc"/>' : ''}
      ${lines}
      ${big ? `<text x="${W / 2}" y="565" font-size="52" font-weight="bold" fill="#111" text-anchor="middle" letter-spacing="1">${esc(big)}</text>` : ''}
      <text x="${W / 2}" y="${H - 22}" font-size="22" font-weight="bold" fill="#c62828" text-anchor="middle">DEMO SAMPLE - NOT A REAL DOCUMENT</text>
    </g>
    <text x="${W / 2}" y="${H / 2 + 40}" font-size="110" font-weight="bold" fill="#c62828" fill-opacity="0.12" text-anchor="middle" font-family="Arial" transform="rotate(-18 ${W / 2} ${H / 2})">SPECIMEN</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
const rnd = (n) => crypto.randomInt(n);
const digits = (n) => Array.from({ length: n }, () => rnd(10)).join('');
function aadhaarNumber() {
  for (;;) { const base = `${2 + rnd(8)}${digits(10)}`; for (let d = 0; d < 10; d++) if (verhoeff(base + d)) return base + d; }
}
const panNumber = (s) => `${String.fromCharCode(65 + rnd(26), 65 + rnd(26), 65 + rnd(26))}P${(s.holder ?? s.name).split(' ').pop()[0].toUpperCase()}${digits(4)}${String.fromCharCode(65 + rnd(26))}`;
const RTO = { TN: '38', KL: '07', RJ: '14', TG: '09', GJ: '01', KA: '05' };

function documentsFor(s) {
  const pan = panNumber(s), aad = aadhaarNumber(), dl = `${s.state}${RTO[s.state]}2021${digits(7)}`;
  const holder = s.holder ?? s.name, NAME = holder.toUpperCase();
  const list = [
    ['pan', pan, () => card({ band: '#1f4e9c', head: 'INCOME TAX DEPARTMENT', sub: 'Permanent Account Number Card - GOVT. OF INDIA', big: pan, rows: [['Name', NAME], ['Date of birth', s.dob], ['PAN', pan]] })],
    ['aadhaar', aad, () => card({ band: '#d35400', head: 'GOVERNMENT OF INDIA', sub: 'Aadhaar - demo sample', big: aad.replace(/(\d{4})(?=\d)/g, '$1 '), rows: [['Name', holder], ['Date of birth', s.dob], ['Gender', s.sex === 'F' ? 'Female' : 'Male'], ['City', s.city]] })],
    ['class10', '', () => card({ band: '#0f766e', head: 'SECONDARY SCHOOL LEAVING CERTIFICATE', sub: 'Class X - demo sample', photo: false, rows: [['Name', NAME], ['Register no.', digits(7)], ['Total', `${420 + rnd(70)} / 500`], ['Year', '2017']] })],
    ['class12', '', () => card({ band: '#6d28d9', head: 'HIGHER SECONDARY CERTIFICATE', sub: 'Class XII - demo sample', photo: false, rows: [['Name', NAME], ['Register no.', digits(7)], ['Total', `${480 + rnd(110)} / 600`], ['Year', '2019']] })],
    ['certificate', '', () => card({ band: '#b45309', head: 'BONAFIDE CERTIFICATE', sub: 'Department of Computer Applications - demo sample', photo: false, rows: [['This is to certify that', NAME], ['Roll number', s.roll], ['Programme', 'MCA'], ['City', s.city]] })],
  ];
  if (s.role !== 'student') return [list[0], list[1], ['license', dl, () => card({ band: '#1b7a4b', head: 'UNION OF INDIA - DRIVING LICENCE', sub: 'Transport Department - demo sample', big: `${dl.slice(0, 4)} ${dl.slice(4)}`, rows: [['Name', holder], ['Date of birth', s.dob], ['City', s.city]] })]];
  if (rnd(2)) list.push(['license', dl, () => card({ band: '#1b7a4b', head: 'UNION OF INDIA - DRIVING LICENCE', sub: 'Transport Department - demo sample', big: `${dl.slice(0, 4)} ${dl.slice(4)}`, rows: [['Name', holder], ['Date of birth', s.dob], ['City', s.city]] })]);
  return list;
}

// ---------- run ----------
await mongoose.connect(config.mongoUri);
await mongoose.connection.db.dropDatabase();
for (const dir of ['storage', 'dev-mail']) fs.rmSync(path.join(config.dataDir, dir), { recursive: true, force: true });
fs.mkdirSync(path.join(config.dataDir, 'storage'), { recursive: true });
console.log(`Cleared the local database (${mongoose.connection.name}), stored files and demo emails.`);

const passwordHash = await bcrypt.hash(PASSWORD, 12);
const pinHash = await bcrypt.hash(PIN, 12);
const accounts = [];
const ago = (days, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5);
async function makeUser(p, daysAgo) {
  const secret = authenticator.generateSecret();
  const u = await User.create({
    name: p.name, email: p.email, role: p.role, studentId: p.roll, passwordHash, emailVerified: true,
    totpSecret: encryptText(secret), totpEnabled: true, vaultPinHash: pinHash, consentAt: ago(daysAgo), backupCodes: [],
  });
  await User.updateOne({ _id: u._id }, { $set: { createdAt: ago(daysAgo) } }, { timestamps: false });
  await Audit.create({ user: u._id, subject: u._id, action: 'register', ip: '127.0.0.1', createdAt: ago(daysAgo) });
  accounts.push({ ...p, id: u.id, secret });
  return u;
}

const admin = await makeUser(ADMIN, 13);
const faculty = [];
for (const f of FACULTY) faculty.push(await makeUser(f, 13));
const students = [];
for (const [i, s] of STUDENTS.entries()) students.push({ ...s, user: await makeUser(s, 12 - i) });

let n = 0;
const docsByStudent = new Map();
const staff = [{ ...ADMIN, user: admin }, ...FACULTY.map((f, i) => ({ ...f, user: faculty[i] }))];
for (const [i, s] of [...students, ...staff].entries()) {
  const mine = [];
  for (const [type, printed, draw] of documentsFor(s)) {
    // one student mistypes their Aadhaar number, so the automatic check fails and it is not verified
    const number = i === 7 && type === 'aadhaar' ? aadhaarNumber() : printed;
    const buf = await draw();
    const hash = sha256(buf);
    const doc = await Document.create({
      owner: s.user._id, type, title: TYPE_LABELS[type], numberEnc: number ? encryptText(number) : undefined, numberMasked: maskNumber(type, number),
      originalName: `${type}.png`, sides: 1, mime: 'image/png', size: buf.length, storedName: await storeFile(buf), sha256: hash,
      status: UNCHECKED.includes(type) ? 'stored' : 'pending',
    });
    await addBlock('upload', doc._id, hash);
    await Audit.create({ user: s.user._id, subject: s.user._id, action: 'document.upload', detail: TYPE_LABELS[type], ip: '127.0.0.1' });
    if (UNCHECKED.includes(type)) await doc.updateOne({ autoCheck: { state: 'skipped', checks: [] } });
    else {
      const others = (await Document.find({ owner: s.user._id, _id: { $ne: doc._id }, wordsEnc: { $exists: true } }))
        .map((o) => ({ label: TYPE_LABELS[o.type], words: JSON.parse(decryptText(o.wordsEnc)) }));
      const { words, ...autoCheck } = await runChecks({ type, number, sources: [{ buf, mime: 'image/png' }], duplicate: false, others });
      // same rule as the server: verified only when every check passes
      const failed = autoCheck.checks.filter((c) => !c.ok).map((c) => c.name);
      const status = failed.length ? 'rejected' : 'verified';
      await doc.updateOne({ autoCheck, wordsEnc: encryptText(JSON.stringify(words)), status, reviewNote: failed.length ? `Not verified: ${failed.join('; ')}.` : '', reviewedAt: new Date() });
      await addBlock(status, doc._id, hash);
      await Audit.create({ user: s.user._id, subject: s.user._id, action: `document.${status}`, detail: `${TYPE_LABELS[type]} - automatic checks`, ip: '127.0.0.1' });
    }
    mine.push(doc);
    process.stdout.write(`\r${++n} documents created and checked`);
  }
  if (s.roll) docsByStudent.set(s.roll, mine);
}
console.log();

// ---------- faculty requests in every state ----------
const R = (code) => students.find((s) => s.roll === code);
async function request(fac, s, types, reason, state, grantedTypes = types) {
  const a = await AccessRequest.create({ verifier: fac._id, student: s.user._id, types, reason, createdAt: ago(rnd(4), rnd(20)) });
  await Audit.create({ user: fac._id, subject: s.user._id, action: 'access.request', detail: `${fac.name} asked for: ${types.map((t) => TYPE_LABELS[t]).join(', ')}`, ip: '127.0.0.1' });
  if (state === 'pending') return a;
  if (state === 'denied') a.status = 'denied';
  else {
    Object.assign(a, { status: 'approved', granted: grantedTypes, expiresAt: new Date(Date.now() + GRANT_HOURS * 3600e3) });
    if (state === 'used') {
      a.opened = docsByStudent.get(s.roll).filter((d) => grantedTypes.includes(d.type)).map((d) => d._id);
      a.status = 'used';
      await Audit.create({ user: fac._id, subject: s.user._id, action: 'record.view', detail: grantedTypes.map((t) => TYPE_LABELS[t]).join(', '), ip: '127.0.0.1' });
    }
  }
  await a.save();
  await Audit.create({ user: s.user._id, subject: s.user._id, action: `access.${a.status === 'used' ? 'approved' : a.status}`, detail: fac.name, ip: '127.0.0.1' });
  return a;
}
const [priya, arun] = faculty;
await request(priya, R('23MX301'), ['class10', 'class12', 'pan'], 'Infosys placement drive - document check', 'approved');
await request(priya, R('23MX302'), ['class10', 'class12', 'certificate'], 'Scholarship application', 'approved', ['class10', 'class12']);
await request(priya, R('23MX303'), ['pan', 'aadhaar'], 'Bank account for stipend', 'used');
await request(priya, R('23MX304'), ['aadhaar', 'certificate'], 'Internship letter', 'pending');
await request(priya, R('23MX305'), ['license'], 'Industrial visit transport form', 'denied');
await request(priya, R('23MX306'), ['class10', 'class12', 'pan', 'aadhaar', 'certificate'], 'TCS placement drive', 'pending');
await request(arun, R('24MX307'), ['class12', 'certificate'], 'Hackathon registration', 'approved');
await request(arun, R('24MX308'), ['pan', 'aadhaar'], 'Hostel admission', 'pending');
await request(arun, R('24MX309'), ['class10', 'class12'], 'Higher studies recommendation', 'used');
await request(arun, R('24MX310'), ['certificate', 'pan'], 'Wipro placement drive', 'approved', ['certificate']);
await request(arun, R('23MX301'), ['aadhaar'], 'ID card reprint', 'pending');

// ---------- spread the history over the last 14 days (the charts show two weeks of activity) ----------
for (const a of await Audit.find({ action: { $ne: 'register' } })) {
  await Audit.updateOne({ _id: a._id }, { $set: { createdAt: ago(rnd(14), rnd(24)) } }, { timestamps: false });
}
for (const a of await Audit.find({ action: 'register' }).populate('user', 'createdAt')) {
  await Audit.updateOne({ _id: a._id }, { $set: { createdAt: a.user.createdAt } }, { timestamps: false });
}

// ---------- the account sheet ----------
const sheet = accounts.map((a) => ({ name: a.name, email: a.email, role: a.role, roll: a.roll, secret: a.secret }));
fs.writeFileSync(path.join(ROOT, 'demo-accounts.json'), JSON.stringify({ password: PASSWORD, pin: PIN, accounts: sheet }, null, 1));
const label = { admin: 'Administrator', verifier: 'Faculty', student: 'Student' };
const md = [
  '# TrustVault demo accounts (local laptop only - never put these online)',
  '',
  `Password for every account: \`${PASSWORD}\`  ·  Vault PIN for every account: \`${PIN}\``,
  '',
  `Codes for creating new staff accounts: Faculty \`${config.facultyCode || '(FACULTY_CODE not set)'}\`  ·  Administrator \`${config.adminCode || '(ADMIN_CODE not set)'}\``,
  '',
  'Sign-in needs an email code and an Authenticator code. Demo addresses (@trustvault.demo) cannot receive real mail,',
  'so run `npm run demo:codes` in a second terminal - it shows every account\'s Authenticator code and its latest email code.',
  'Or add an account to the Google Authenticator app with its key below ("Enter a setup key", time based).',
  '',
  '| Sign in as | Name | Email | Roll no. | Authenticator key |',
  '|---|---|---|---|---|',
  ...sheet.map((a) => `| ${label[a.role]} | ${a.name} | ${a.email} | ${a.roll ?? '-'} | \`${a.secret}\` |`),
  '',
];
fs.writeFileSync(path.join(ROOT, 'DEMO-ACCOUNTS.md'), md.join('\n'));
const counts = await Document.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
console.log(`Created ${accounts.length} accounts (1 administrator, 2 faculty, 10 students) and ${n} documents (${counts.map((c) => `${c.n} ${c._id}`).join(', ')}).`);
console.log(`Faculty requests: ${await AccessRequest.countDocuments()}. Account sheet: DEMO-ACCOUNTS.md`);
await mongoose.disconnect();
process.exit(0); // the OCR engine keeps a background worker alive
