// Creates server/.env from the example and fills in fresh random secret keys.
import fs from 'node:fs';
import crypto from 'node:crypto';

const target = new URL('../server/.env', import.meta.url);
// Readable secret codes like FAC-K7QM-2XWD (no 0/O/1/I to avoid typos).
const code = (prefix, groups) => `${prefix}-${Array.from({ length: groups }, () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('')).join('-')}`;
if (fs.existsSync(target)) {
  console.log('server/.env already exists - keeping it.');
} else {
  const text = fs.readFileSync(new URL('../server/.env.example', import.meta.url), 'utf8')
    .replace('JWT_SECRET=', `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`)
    .replace('VAULT_KEY=', `VAULT_KEY=${crypto.randomBytes(32).toString('hex')}`)
    .replace('FACULTY_CODE=', `FACULTY_CODE=${code('FAC', 2)}`)
    .replace('ADMIN_CODE=', `ADMIN_CODE=${code('ADM', 3)}`);
  fs.writeFileSync(target, text);
  console.log('Created server/.env with fresh secret keys.');
}
