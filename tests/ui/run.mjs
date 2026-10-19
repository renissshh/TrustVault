// UI test: drives the real site in headless Chrome.
//   npm run test:ui            (needs MongoDB running and Chrome or Edge installed; CHROME_PATH overrides the search)
// It starts its OWN API (port 5057, database trustvault_uitest, temp data folder, no SMTP) and its own site (port 5177),
// seeds a student and an admin, then:
//   1. opens every page as a guest, the student and the admin, in dark and light, at three screen sizes,
//      and fails on script errors, failed API calls, sideways scrolling or blank pages;
//   2. clicks the main interactions (quick search, top menu, wallet card, upload window, landing demo, admin tabs);
//   3. signs in twice through the real screens: password -> email code -> Authenticator -> vault doors -> PIN -> dashboard.
// Everything it created is removed at the end.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';

const ROOT = path.join(import.meta.dirname, '..', '..');
const require = createRequire(path.join(ROOT, 'server', 'package.json'));
const { authenticator } = require('otplib'); const sharp = require('sharp'); const mongoose = require('mongoose');

const API_PORT = 5057; const WEB_PORT = 5177;
const API = `http://localhost:${API_PORT}/api`; const SITE = `http://localhost:${WEB_PORT}`;
const MONGO = process.env.UI_MONGO_URI || 'mongodb://127.0.0.1:27017/trustvault_uitest';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'trustvault-ui-')); const MAIL = path.join(DATA, 'dev-mail');
const PASSWORD = `Ui-${crypto.randomBytes(9).toString('base64url')}-7x`; const PIN = '482915';
const STUDENT = 'rahul@demo.test'; const ADMIN = 'admin@demo.test';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
let pass = 0; let fail = 0;
const ok = (cond, label, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  -> ${extra}` : ''}`); };

function findChrome() {
  const guesses = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  return guesses.find((p) => p && fs.existsSync(p));
}

// ---------- 1. isolated API + site ----------
async function startServers() {
  const env = { ...process.env, PORT: String(API_PORT), MONGO_URI: MONGO, DATA_DIR: DATA, APP_URL: SITE,
    JWT_SECRET: crypto.randomBytes(32).toString('hex'), VAULT_KEY: crypto.randomBytes(32).toString('hex'), AUTH_RATE_LIMIT: '100000', API_RATE_LIMIT: '1000000' };
  delete env.SMTP_USER; delete env.BREVO_API_KEY; delete env.FILE_STORE; // never send real email from tests; files on disk
  const api = spawn(process.execPath, ['src/index.js'], { cwd: path.join(ROOT, 'server'), env });
  children.push(api);
  let log = ''; api.stdout.on('data', (d) => { log += d; }); api.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60 && !log.includes('running on'); i++) await sleep(250);
  if (!log.includes('No SMTP set')) throw new Error(`Test API did not start in dev-mail mode:\n${log}`);
  const web = spawn(process.execPath, [path.join(ROOT, 'client', 'node_modules', 'vite', 'bin', 'vite.js'), path.join(ROOT, 'client'), '--port', String(WEB_PORT), '--strictPort'],
    { env: { ...process.env, API_URL: `http://localhost:${API_PORT}` }, stdio: 'ignore' });
  children.push(web);
  for (let i = 0; i < 80; i++) { if (await fetch(`${SITE}/welcome`).then((r) => r.ok, () => false)) return; await sleep(250); }
  throw new Error('Test site did not start');
}

// ---------- 2. demo data through the API ----------
function client() {
  const jar = {};
  return { jar, call: async (p, { method = 'GET', body, form } = {}) => {
    const res = await fetch(API + p, { method, headers: { ...(body && { 'Content-Type': 'application/json' }), Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 ui-test' }, body: form ?? (body && JSON.stringify(body)) });
    for (const c of res.headers.getSetCookie()) { const [k, v] = c.split(';')[0].split('='); if (v) jar[k] = v; else delete jar[k]; }
    return { status: res.status, data: (res.headers.get('content-type') ?? '').includes('json') ? await res.json() : null };
  } };
}
const lastCode = (email) => { const f = fs.readdirSync(MAIL).filter((n) => n.includes(email) && n.endsWith('.html')).sort().pop(); return fs.readFileSync(path.join(MAIL, f), 'utf8').match(/Subject:<\/b> (\d{6})/)?.[1]; };
const spent = new Map(); // an Authenticator code works once: always wait for one we have not used
async function totp(secret) { while (authenticator.generate(secret) === spent.get(secret)) await sleep(1000); const c = authenticator.generate(secret); spent.set(secret, c); return c; }
const card = (lines) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720"><rect width="100%" height="100%" fill="white"/><g font-family="Arial" font-weight="bold" fill="#111">${lines.map(([t, s, y]) => `<text x="60" y="${y}" font-size="${s}">${t}</text>`).join('')}</g></svg>`)).png().toBuffer();

async function seed() {
  const secrets = {};
  const signUp = async (c, name, email, extra = {}) => {
    let r = await c.call('/auth/register', { method: 'POST', body: { name, email, password: PASSWORD, consent: true, ...extra } });
    if (!r.data?.ticket) throw new Error(`register ${email}: ${JSON.stringify(r.data)}`);
    r = await c.call('/auth/verify-email', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode(email) } });
    secrets[email] = r.data.secret;
    await c.call('/auth/login/totp', { method: 'POST', body: { ticket: r.data.ticket, code: await totp(r.data.secret) } });
  };
  const upload = (c, fields, buf, name) => { const form = new FormData(); for (const [k, v] of Object.entries(fields)) form.set(k, v); form.set('file', new Blob([buf]), name); return c.call('/documents', { method: 'POST', form }); };
  const student = client(); const first = client();
  await signUp(student, 'Rahul Sharma', STUDENT, { studentId: '23MX101' });
  await signUp(first, 'Priya Verifier', ADMIN, { studentId: '23MX900' });
  await mongoose.connection.db.collection('users').updateOne({ email: ADMIN }, { $set: { role: 'admin' } });
  // vault PIN needs the security check: password -> email code -> Authenticator
  let r = await student.call('/auth/step-up/password', { method: 'POST', body: { password: PASSWORD } });
  r = await student.call('/auth/step-up/otp', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode(STUDENT) } });
  await student.call('/auth/step-up/totp', { method: 'POST', body: { ticket: r.data.ticket, code: await totp(secrets[STUDENT]) } });
  await student.call('/auth/vault-pin', { method: 'POST', body: { pin: PIN } });
  await upload(student, { type: 'pan', number: 'ABCPS1234F', title: 'PAN Card' }, await card([['INCOME TAX DEPARTMENT', 48, 110], ['Permanent Account Number Card', 36, 300], ['ABCPS1234F', 64, 390], ['RAHUL SHARMA', 44, 500], ['DEMO SAMPLE - NOT A REAL CARD', 32, 580]]), 'pan.png');
  await upload(student, { type: 'marksheet', number: '22CS101', title: 'Semester 6 marksheet' }, await card([['STATEMENT OF MARKS', 44, 150], ['RAHUL SHARMA', 44, 300], ['Roll No 22CS101', 40, 380], ['DEMO SAMPLE', 32, 580]]), 'marks.png');
  await upload(student, { type: 'other', title: 'Hostel receipt' }, await card([['HOSTEL FEE RECEIPT', 48, 110], ['RAHUL SHARMA', 44, 300]]), 'receipt.png');
  for (let i = 0; i < 60; i++) { const d = (await student.call('/documents')).data; if (d.every((x) => x.autoCheck.state !== 'running')) break; await sleep(2000); }
  const docs = (await student.call('/documents')).data;
  const admin = client(); // sign in again so the session carries the admin role
  r = await admin.call('/auth/login', { method: 'POST', body: { email: ADMIN, password: PASSWORD } });
  if (r.data.next === 'otp') r = await admin.call('/auth/login/otp', { method: 'POST', body: { ticket: r.data.ticket, code: lastCode(ADMIN) } });
  await admin.call('/auth/login/totp', { method: 'POST', body: { ticket: r.data.ticket, code: await totp(secrets[ADMIN]) } });
  await admin.call(`/admin/documents/${docs.find((d) => d.type === 'pan').id}/review`, { method: 'POST', body: { decision: 'verified', note: '' } });
  const people = (await admin.call('/records/students?q=')).data;
  await admin.call(`/records/students/${people[0].id}/request`, { method: 'POST', body: { reason: 'Placement document check for campus drive' } });
  await student.call('/auth/vault/unlock', { method: 'POST', body: { pin: PIN } });
  ok(docs.length === 3 && (await admin.call('/auth/me')).data.user?.role === 'admin', 'demo data seeded (student with 3 documents, admin)');
  return { secrets, studentCookies: student.jar, adminCookies: admin.jar };
}

// ---------- 3. a small Chrome DevTools client ----------
async function browser() {
  const exe = findChrome();
  if (!exe) throw new Error('Chrome or Edge not found. Set CHROME_PATH to its location.');
  const port = 9600 + Math.floor(Math.random() * 300);
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(DATA, 'chrome')}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  children.push(proc);
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); target = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page'), () => null); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pending = new Map(); const b = { problems: [] };
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') b.problems.push(`script error: ${(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split('\n')[0].slice(0, 180)}`);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') b.problems.push(`console error: ${d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 180)}`);
    if (d.method === 'Network.responseReceived') { const r = d.params.response; if (r.status >= 500 || (r.status >= 400 && r.url.includes('/api/') && !/\/api\/auth\/(me|reauth)/.test(r.url))) b.problems.push(`api ${r.status}: ${r.url.replace(SITE, '')}`); }
  };
  b.send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  b.run = async (expression) => (await b.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
  b.until = async (expression, ms = 8000) => { for (let t = 0; t < ms; t += 200) { if (await b.run(expression)) return true; await sleep(200); } return false; };
  b.size = (w, h) => b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  b.close = () => { ws.close(); proc.kill(); };
  await b.send('Runtime.enable'); await b.send('Page.enable'); await b.send('Network.enable');
  return b;
}

// ---------- 4. every page, every role, both themes, three sizes ----------
const PUBLIC = ['/welcome', '/login', '/register', '/verify', '/privacy', '/tutorial', '/no-such-page'];
const STUDENT_PAGES = ['/', '/documents', '/documents?upload=aadhaar', '/access', '/shares', '/activity', '/security'];
const ADMIN_PAGES = ['/', '/documents', '/review', '/records', '/shares', '/activity', '/security', '/admin'];
const SIZES = [[1900, 940], [1366, 700], [390, 844]];
const wait = (ms) => `await new Promise((r) => setTimeout(r, ${ms}));`;
const CLICKS = {
  'quick search opens (Ctrl+K)': ['/', `(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); ${wait(500)} return !!document.querySelector('[role=listbox] [role=option]'); })()`],
  'top menu drops down': ['/', `(async () => { const l = [...document.querySelectorAll('nav[aria-label=Main] a')].find((a) => a.textContent.trim().startsWith('Vault')); l?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); ${wait(600)} return !!document.querySelector('.mega [role=menuitem]'); })()`],
  'wallet card flips': ['/', `(async () => { document.querySelector('.wl-card.front')?.click(); ${wait(500)} return !!document.querySelector('.wl-card.front.flipped'); })()`],
  'upload window opens from a link': ['/documents?upload=aadhaar', `(async () => { ${wait(300)} return !!document.querySelector('[role=dialog] input[name=number]'); })()`],
  'activity filter changes': ['/activity', `(async () => { const b = [...document.querySelectorAll('[role=group] button')].find((x) => x.textContent.includes('Documents')); b?.click(); ${wait(400)} return b?.getAttribute('aria-pressed') === 'true'; })()`],
};
const ADMIN_CLICKS = {
  'admin tabs all show content': ['/admin', `(async () => { for (const t of ['Users', 'Invitations', 'Ledger', 'Audit log']) { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)?.click(); ${wait(700)} if (!document.querySelector('table, form')) return false; } return true; })()`],
};
const GUEST_CLICKS = {
  'landing demo runs to VERIFIED': ['/welcome', `(async () => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Scan the sample'))?.click(); ${wait(5600)} return !!document.querySelector('.demo[data-state=done] .demo-stamp'); })()`],
};

async function crawl(b, who, cookies, theme, pages, clicks) {
  await b.send('Network.clearBrowserCookies');
  for (const [name, value] of Object.entries(cookies ?? {})) await b.send('Network.setCookie', { name, value, url: SITE, httpOnly: true });
  // start in the chosen theme, skip the intro and the first-visit tour so they do not cover the page
  const { identifier } = await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('tv-intro','1');localStorage.setItem('tv-aurora-theme','${theme}');const g=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return String(k).startsWith('tv-tour:')?'1':g.call(this,k)};` });
  const bad = [];
  let count = 0;
  const open = async (p, [w, h]) => { b.problems = []; await b.size(w, h); await b.send('Page.navigate', { url: SITE + p }); await sleep(1900); };
  for (const size of SIZES) {
    for (const p of pages) {
      await open(p, size);
      const page = await b.run(`(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText.trim().length, heading: !!document.querySelector('h1, h2') }))()`);
      const issues = [...new Set(b.problems)];
      if (!page) issues.push('page did not respond');
      else { if (page.over > 1) issues.push(`sideways scroll of ${page.over}px`); if (page.text < 40) issues.push('almost empty'); if (!page.heading) issues.push('no heading'); }
      count++;
      if (issues.length) bad.push(`${size.join('x')} ${p}: ${issues.join(' | ')}`);
    }
  }
  ok(!bad.length, `${who}, ${theme}: ${count} page loads clean`, bad.join(' ;; '));
  for (const [label, [p, script]] of Object.entries(clicks)) { await open(p, SIZES[0]); ok(await b.run(script) === true && !b.problems.length, `${who}, ${theme}: ${label}`, [...new Set(b.problems)].join(' | ')); }
  await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
}

// ---------- 5. a full sign-in through the screens ----------
async function signIn(b, secret, n) {
  const typeInto = async (selector, text) => { await b.run(`document.querySelector('${selector}').focus()`); await b.send('Input.insertText', { text }); };
  const says = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
  b.problems = [];
  await b.send('Network.clearBrowserCookies'); await b.size(1440, 900);
  await b.send('Page.navigate', { url: `${SITE}/login` });
  if (!(await b.until(`!!document.querySelector('input[name=email]')`))) return ok(false, `sign-in ${n}: page opens`);
  await typeInto('input[name=email]', STUDENT); await typeInto('input[name=password]', PASSWORD);
  await b.run(`document.querySelector('form').requestSubmit()`);
  if (!(await b.until(`${says('We sent a 6-digit code')} || ${says('Open Google Authenticator and enter')}`))) return ok(false, `sign-in ${n}: password accepted`, await b.run(`document.querySelector('[role=alert]')?.innerText`));
  if (await b.run(says('We sent a 6-digit code'))) {
    await sleep(500);
    await typeInto('[role=group] input', lastCode(STUDENT));
    if (!(await b.until(says('Open Google Authenticator and enter')))) return ok(false, `sign-in ${n}: email code accepted`);
  }
  const tracker = await b.run(`document.querySelectorAll('.st li.done').length`);
  await typeInto('[role=group] input', await totp(secret));
  const doors = await b.until(`!!document.querySelector('.vd-in')`, 3000);
  if (!(await b.until(`location.pathname === '/' && !document.querySelector('.vd-in')`, 9000))) return ok(false, `sign-in ${n}: reaches the dashboard`, await b.run(`document.querySelector('[role=alert]')?.innerText`));
  if (await b.until(says('Unlock your vault'), 2500)) { await typeInto('[aria-label="Unlock your vault"] [role=group] input', PIN); await b.until(`!${says('Unlock your vault')}`, 6000); }
  const home = await b.until(`!!document.querySelector('.wl-card, .wl-empty') && !!document.querySelector('.topnav-bar')`, 8000);
  ok(tracker >= 1 && doors && home && !b.problems.length, `sign-in ${n}: password -> email code -> Authenticator -> doors -> PIN -> dashboard`,
    [tracker < 1 && 'step tracker did not advance', !doors && 'doors did not show', !home && 'dashboard did not load', ...new Set(b.problems)].filter(Boolean).join(' | '));
}

// ---------- run ----------
let b;
try {
  await mongoose.connect(MONGO);
  await mongoose.connection.db.dropDatabase();
  await startServers();
  const { secrets, studentCookies, adminCookies } = await seed();
  b = await browser();
  for (const theme of ['dark', 'light']) {
    await crawl(b, 'guest', null, theme, PUBLIC, GUEST_CLICKS);
    await crawl(b, 'student', studentCookies, theme, STUDENT_PAGES, CLICKS);
    await crawl(b, 'admin', adminCookies, theme, ADMIN_PAGES, ADMIN_CLICKS);
  }
  await signIn(b, secrets[STUDENT], 1);
  await signIn(b, secrets[STUDENT], 2);
} catch (e) {
  fail++;
  console.error('UI test crashed:', e);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  b?.close();
  for (const c of children) c.kill();
  await mongoose.connection.db?.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  await sleep(500); // let Chrome release its profile folder
  fs.rmSync(DATA, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  process.exitCode = fail ? 1 : 0;
}
