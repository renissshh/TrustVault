// Shows the current Google Authenticator code for every demo account, refreshing every second.
// Run from the project folder: npm run demo:codes   (reads demo-accounts.json written by npm run demo)
import fs from 'node:fs';
import path from 'node:path';
import { authenticator } from 'otplib';

const file = path.join(import.meta.dirname, '..', '..', 'demo-accounts.json');
if (!fs.existsSync(file)) { console.error('No demo-accounts.json yet - run "npm run demo" first.'); process.exit(1); }
const { accounts, password, pin } = JSON.parse(fs.readFileSync(file, 'utf8'));
const label = { admin: 'Administrator', verifier: 'Faculty', student: 'Student' };

function draw() {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  const lines = accounts.map((a) => `${label[a.role].padEnd(14)} ${authenticator.generate(a.secret)}   ${a.name.padEnd(18)} ${a.email}`);
  process.stdout.write(`\x1b[2J\x1b[H TrustVault demo - Authenticator codes (new codes in ${String(left).padStart(2)} s)\n Password: ${password}   Vault PIN: ${pin}   Email codes: http://localhost:5173/mailbox\n\n ${lines.join('\n ')}\n\n Ctrl+C to stop.\n`);
}
draw();
setInterval(draw, 1000);
