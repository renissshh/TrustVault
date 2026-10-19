// Shows the current Google Authenticator code (and the latest email code) for every demo account, refreshing every second.
// Run from the project folder: npm run demo:codes   (reads demo-accounts.json written by npm run demo)
import fs from 'node:fs';
import path from 'node:path';
import { authenticator } from 'otplib';

const file = path.join(import.meta.dirname, '..', '..', 'demo-accounts.json');
if (!fs.existsSync(file)) { console.error('No demo-accounts.json yet - run "npm run demo" first.'); process.exit(1); }
const { accounts, password, pin } = JSON.parse(fs.readFileSync(file, 'utf8'));
const label = { admin: 'Administrator', verifier: 'Faculty', student: 'Student' };
const mailDir = path.join(import.meta.dirname, '..', 'dev-mail');

// The newest email code for each demo address, from the mail kept in server/dev-mail/ (codes last 10 minutes).
function emailCodes() {
  const codes = {};
  const files = fs.existsSync(mailDir) ? fs.readdirSync(mailDir).filter((f) => f.endsWith('.html')).sort() : [];
  for (const f of files) {
    const [stamp, ...rest] = f.slice(0, -5).split('-');
    if (Date.now() - Number(stamp) > 10 * 60e3) continue;
    const code = fs.readFileSync(path.join(mailDir, f), 'utf8').match(/letter-spacing:8px[^>]*>(\d{6})</)?.[1];
    if (code) codes[rest.join('-').toLowerCase()] = code;
  }
  return codes;
}

function draw() {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  const mail = emailCodes();
  const lines = accounts.map((a) => `${label[a.role].padEnd(14)} ${authenticator.generate(a.secret)}   ${mail[a.email] ?? '------'}   ${a.name.padEnd(18)} ${a.email}`);
  process.stdout.write(`\x1b[2J\x1b[H TrustVault demo - codes (new Authenticator codes in ${String(left).padStart(2)} s)\n Password: ${password}   Vault PIN: ${pin}\n\n ${'Role'.padEnd(14)} Authen.  Email\n ${lines.join('\n ')}\n\n Email = the latest sign-in code sent to that demo address (appears after you press Continue). Ctrl+C to stop.\n`);
}
draw();
setInterval(draw, 1000);
