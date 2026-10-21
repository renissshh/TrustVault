// UI test: drives the real site in headless Chrome.
//   npm run test:ui            (needs MongoDB running and Chrome or Edge installed; CHROME_PATH overrides the search)
// It starts its OWN API (port 5057, database trustvault_uitest, temp data folder, no SMTP) and its own site (port 5177),
// seeds a student and an admin, then:
//   1. opens every page as a guest, the student and the admin, in dark and light, at three screen sizes,
//      and fails on script errors, failed API calls, sideways scrolling or blank pages;
//   2. clicks the main interactions (quick search, top menu, wallet card, upload window, landing demo, the 3D vault, the kinetic heading, admin tabs);
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
const STUDENT = 'rahul@demo.test'; const ADMIN = 'admin@demo.test'; const FACULTY = 'faculty@demo.test';
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
    JWT_SECRET: crypto.randomBytes(32).toString('hex'), VAULT_KEY: crypto.randomBytes(32).toString('hex'), AUTH_RATE_LIMIT: '100000', API_RATE_LIMIT: '1000000',
    FACULTY_CODE: 'FAC-TEST-CODE', ADMIN_CODE: 'ADM-TEST-CODE-XYZ' };
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
  const student = client(); const admin = client(); const faculty = client();
  await signUp(student, 'Rahul Sharma', STUDENT, { studentId: '23MX101' });
  await signUp(admin, 'Asha Admin', ADMIN, { role: 'admin', code: 'ADM-TEST-CODE-XYZ' });
  await signUp(faculty, 'Priya Raman', FACULTY, { role: 'faculty', code: 'FAC-TEST-CODE' });
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
  r = await faculty.call('/records/batch-request', { method: 'POST', body: { group: '23MX', types: ['pan', 'class10', 'class12'], reason: 'Placement document check for campus drive' } });
  await student.call('/auth/vault/unlock', { method: 'POST', body: { pin: PIN } });
  const roles = [(await admin.call('/auth/me')).data.user?.role, (await faculty.call('/auth/me')).data.user?.role];
  ok(docs.length === 3 && r.data.sent === 1 && roles.join() === 'admin,verifier', 'demo data seeded (student with 3 documents, faculty batch request, admin)', JSON.stringify({ roles, r: r.data }));
  ok(docs.find((d) => d.type === 'pan')?.status === 'verified', 'PAN verified automatically (every check passed)', docs.find((d) => d.type === 'pan')?.status);
  return { secrets, studentCookies: student.jar, adminCookies: admin.jar, facultyCookies: faculty.jar };
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
  // keep the page "in front": Edge can open its own startup tab, and a background tab gets no animation frames
  await b.send('Page.bringToFront'); await b.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return b;
}

// ---------- 4. every page, every role, both themes, four sizes (desktop, laptop, tablet, phone) ----------
const PUBLIC = ['/welcome', '/login', '/login?as=faculty', '/login?as=admin', '/register', '/register?as=faculty', '/register?as=admin', '/privacy', '/tutorial', '/no-such-page'];
const STUDENT_PAGES = ['/', '/documents', '/documents?upload=aadhaar', '/documents?upload=class10', '/access', '/shares', '/activity', '/security', '/security?tab=devices'];
const ADMIN_PAGES = ['/', '/activity', '/security', '/admin'];
const FACULTY_PAGES = ['/', '/records', '/records?batch=23MX', '/documents', '/activity', '/security?tab=personal'];
const SIZES = [[1900, 940], [1366, 700], [768, 1024], [390, 844]];
const wait = (ms) => `await new Promise((r) => setTimeout(r, ${ms}));`;
const CLICKS = {
  'quick search opens (Ctrl+K)': ['/', `(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); ${wait(500)} return !!document.querySelector('[role=listbox] [role=option]'); })()`],
  'top menu drops down': ['/', `(async () => { const l = [...document.querySelectorAll('nav[aria-label=Main] a')].find((a) => a.textContent.trim().startsWith('Vault')); l?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); ${wait(600)} return !!document.querySelector('.mega [role=menuitem]'); })()`],
  'wallet card flips': ['/', `(async () => { document.querySelector('.wl-card.front')?.click(); ${wait(500)} return !!document.querySelector('.wl-card.front.flipped'); })()`],
  'upload window opens from a link': ['/documents?upload=aadhaar', `(async () => { ${wait(300)} return !!document.querySelector('[role=dialog] input[name=number]'); })()`],
  'vault status shows the 4 required documents': ['/documents', `(async () => { ${wait(600)} return document.querySelectorAll('.vs-step').length === 4 && !!document.querySelector('.vs-ring'); })()`],
  'a missing document in the status panel opens upload for that type': ['/documents', `(async () => { ${wait(600)} const b = document.querySelector('.vs-step.missing button'); if (!b) return true; b.click(); ${wait(400)} return !!document.querySelector('[role=dialog] input[name=number], [role=dialog] [role=combobox]'); })()`],
  'dropping a file on an empty slot opens upload with that type and file': ['/documents', `(async () => { ${wait(600)} const slot = document.querySelector('[data-drop-type]'); if (!slot) return false; const dt = new DataTransfer(); dt.items.add(new File(['demo'], 'dropped-file.png', { type: 'image/png' })); slot.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true })); ${wait(300)} const overlay = !!document.querySelector('.vd-drop'); slot.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); ${wait(600)} return overlay && !document.querySelector('.vd-drop') && !!document.querySelector('[role=dialog]')?.innerText.includes('dropped-file.png'); })()`],
  'security tabs open one section at a time': ['/security', `(async () => { ${wait(400)} const tiles = document.querySelectorAll('.sec-tile').length; [...document.querySelectorAll('nav[aria-label="Settings sections"] a')].find((a) => a.textContent.includes('Your devices'))?.click(); ${wait(600)} return tiles === 5 && location.search === '?tab=devices' && !!document.getElementById('devices') && !document.getElementById('personal') && !document.querySelector('.sec-tile'); })()`],
  'home shows recent activity as a short column': ['/', `(async () => { ${wait(500)} const n = document.querySelectorAll('.ra-list li').length; return n > 0 && n <= 6; })()`],
  'activity filter changes': ['/activity', `(async () => { const b = [...document.querySelectorAll('[role=group] button')].find((x) => x.textContent.includes('Documents')); b?.click(); ${wait(400)} return b?.getAttribute('aria-pressed') === 'true'; })()`],
};
const ADMIN_CLICKS = {
  'admin tabs all show content': ['/admin', `(async () => { for (const t of ['Users', 'Requests', 'Invitations', 'Ledger', 'Audit log']) { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)?.click(); ${wait(700)} if (!document.querySelector('table, form')) return false; } return true; })()`],
};
const FACULTY_CLICKS = {
  'typing "23" shows batch 23MX as profile cards with the ask form': ['/records', `(async () => { const i = document.querySelector('input[aria-label="Batch"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '23'); i.dispatchEvent(new Event('input', { bubbles: true })); ${wait(1200)} return location.search === '?batch=23MX' && document.querySelector('.rc-chip.on')?.textContent.includes('23MX') && document.querySelectorAll('.rc-card').length === 1 && !!document.querySelector('.rc-ask'); })()`],
  'a batch with nobody in it says so and suggests real batches': ['/records?batch=26', `(async () => { ${wait(900)} return document.body.innerText.includes('No students in 26MX yet') && [...document.querySelectorAll('button')].some((b) => b.textContent.includes('23MX')); })()`],
  'All shows every student and no ask form': ['/records', `(async () => { ${wait(900)} return document.querySelector('.rc-chip.on')?.textContent.includes('All') && document.querySelectorAll('.rc-card').length >= 1 && !document.querySelector('.rc-ask'); })()`],
};
const GUEST_CLICKS = {
  'sign-up asks for the faculty code': ['/register?as=faculty', `(async () => { ${wait(300)} return !!document.querySelector('input[name=code]') && !document.querySelector('input[name=studentId]'); })()`],
  // without WebGL 2 the page starts with the hero instead; with it the 3D vault comes first and its controls work
  '3D vault opens the page and answers its controls': ['/welcome', `(async () => { const s = document.querySelector('.lp-3d'); if (!s) return document.querySelector('main').firstElementChild.classList.contains('lp-hero'); for (let i = 0; i < 100 && !s.querySelector('.tv-loading.done'); i++) ${wait(200)} if (document.querySelector('main').firstElementChild !== s || !s.querySelector('.tv-loading.done')) return false; s.querySelector('[data-mode=document]').click(); ${wait(300)} const followed = s.querySelector('[data-mode=document]').getAttribute('aria-pressed') === 'true' && s.querySelector('.tv-journey').classList.contains('visible'); s.querySelector('[data-camera=top]').click(); const top = window.__trustvaultDebug.getState().camera === 'top'; s.querySelector('[data-tv=tamper]').click(); window.__trustvaultDebug.advance(1); ${wait(600)} const broken = s.querySelector('[data-tv=status-text]').textContent.startsWith('Chain broken'); const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }); s.querySelector('canvas').dispatchEvent(wheel); return followed && top && broken && !wheel.defaultPrevented; })()`],
  'the heading shows each check one by one in its pill': ['/welcome', `(async () => { const h = document.querySelector('.kt'); for (let i = 0; i < 50 && !h.classList.contains('kt-live'); i++) ${wait(100)} if (!h.seekForTest) return false; const shown = () => [...h.querySelectorAll('.kt-label')].filter((l) => getComputedStyle(l).visibility === 'visible').map((l) => l.textContent); h.seekForTest(1); const w = h.querySelector('.kt-word'); const rest = Math.abs(w.getBoundingClientRect().width - w.offsetWidth) < 1 && !shown().length; h.seekForTest(5.9); const one = shown().join() === 'Number match' && h.querySelector('.kt-pill').offsetWidth > 3 * h.querySelector('.kt-slot').offsetWidth; h.seekForTest(7.6); const done = shown().join() === 'Verified'; return rest && one && done && h.querySelector('.sr-only').textContent === 'Every check, one by one.'; })()`],
  'landing demo runs to VERIFIED': ['/welcome', `(async () => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Scan the sample'))?.click(); ${wait(5600)} return !!document.querySelector('.demo[data-state=done] .demo-stamp'); })()`],
};

async function crawl(b, who, cookies, theme, pages, clicks) {
  await b.send('Network.clearBrowserCookies');
  for (const [name, value] of Object.entries(cookies ?? {})) await b.send('Network.setCookie', { name, value, url: SITE, httpOnly: true });
  // start in the chosen theme, skip the intro and the first-visit tour so they do not cover the page
  const { identifier } = await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('tv-intro','1');localStorage.setItem('tv-aurora-theme','${theme}');const g=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return String(k).startsWith('tv-tour:')?'1':g.call(this,k)};` });
  const bad = [];
  let count = 0;
  const open = async (p, [w, h]) => { b.problems = []; await b.send('Page.bringToFront'); await b.size(w, h); await b.send('Page.navigate', { url: SITE + p }); await sleep(1900); };
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
  await b.send('Network.clearBrowserCookies'); await b.send('Page.bringToFront'); await b.size(1440, 900);
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
  // "Hold to enter vault": a short press drains back, a full hold opens the vault
  if (!(await b.until(`!!document.querySelector('.hb')`, 6000))) return ok(false, `sign-in ${n}: hold-to-enter button shows`, await b.run(`document.querySelector('[role=alert]')?.innerText`));
  const [hx, hy] = await b.run(`(() => { const r = document.querySelector('.hb').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  const mouse = (type) => b.send('Input.dispatchMouseEvent', { type, x: hx, y: hy, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
  await mouse('mouseMoved'); await sleep(150); // like a person: the pointer reaches the button before pressing 
  await mouse('mousePressed'); await sleep(300); await mouse('mouseReleased'); await sleep(700);
  const early = await b.run(`!document.querySelector('.hb.is-done') && !document.querySelector('.ag')`);
  await mouse('mousePressed'); await sleep(1300); await mouse('mouseReleased');
  const doors = await b.until(`!!document.querySelector('.ag')`, 3000);
  if (!(await b.until(`location.pathname === '/' && !document.querySelector('.ag')`, 9000))) {
    return ok(false, `sign-in ${n}: reaches the dashboard`, await b.run(`JSON.stringify({ path: location.pathname, hold: document.querySelector('.hb')?.className, fill: document.querySelector('.hb')?.style.getPropertyValue('--p'), overlay: !!document.querySelector('.ag'), alert: document.querySelector('[role=alert]')?.innerText, heading: document.querySelector('h1, h2')?.textContent })`) + ' ' + b.problems.slice(0, 3).join(' | '));
  }
  if (await b.until(says('Unlock your vault'), 2500)) { await typeInto('[aria-label="Unlock your vault"] [role=group] input', PIN); await b.until(`!${says('Unlock your vault')}`, 6000); }
  const home = await b.until(`!!document.querySelector('.wl-card, .wl-empty') && !!document.querySelector('.topnav-bar')`, 8000);
  ok(tracker >= 1 && early && doors && home && !b.problems.length, `sign-in ${n}: password -> email code -> Authenticator -> hold to enter -> Access granted -> PIN -> dashboard`,
    [tracker < 1 && 'step tracker did not advance', !early && 'a short press already entered', !doors && 'Access granted did not show', !home && 'dashboard did not load', ...new Set(b.problems)].filter(Boolean).join(' | '));
}

// ---------- run ----------
let b;
try {
  await mongoose.connect(MONGO);
  await mongoose.connection.db.dropDatabase();
  await startServers();
  const { secrets, studentCookies, adminCookies, facultyCookies } = await seed();
  b = await browser();
  for (const theme of process.env.UI_ONLY === 'signin' ? [] : ['dark', 'light']) { // UI_ONLY=signin: just the sign-in checks
    await crawl(b, 'guest', null, theme, PUBLIC, GUEST_CLICKS);
    await crawl(b, 'student', studentCookies, theme, STUDENT_PAGES, CLICKS);
    await crawl(b, 'admin', adminCookies, theme, ADMIN_PAGES, ADMIN_CLICKS);
    await crawl(b, 'faculty', facultyCookies, theme, FACULTY_PAGES, FACULTY_CLICKS);
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
