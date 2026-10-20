import path from 'node:path';

const env = process.env;
if (!env.JWT_SECRET || !env.VAULT_KEY) {
  console.error('Missing JWT_SECRET or VAULT_KEY in server/.env - run "npm run setup" in the project folder.');
  process.exit(1);
}

if (!/^[0-9a-f]{64}$/i.test(env.VAULT_KEY)) {
  console.error('VAULT_KEY must be 64 hex characters (32 random bytes).');
  process.exit(1);
}

export default {
  port: Number(env.PORT || 5000),
  mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017/trustvault',
  appUrl: env.APP_URL || 'http://localhost:5173',
  jwtSecret: env.JWT_SECRET,
  vaultKey: Buffer.from(env.VAULT_KEY, 'hex'),
  smtp: { host: env.SMTP_HOST || 'smtp.gmail.com', port: Number(env.SMTP_PORT || 465), user: env.SMTP_USER, pass: env.SMTP_PASS },
  // Hosted email over HTTPS (Brevo), for hosts that block SMTP. MAIL_FROM must be a sender verified in Brevo.
  brevoKey: env.BREVO_API_KEY,
  mailFrom: env.MAIL_FROM || env.SMTP_USER,
  // FILE_STORE=db keeps encrypted files in MongoDB, for hosts whose disk is wiped on every restart.
  filesInDb: env.FILE_STORE === 'db',
  // Number of proxies in front of the server on a hosting platform (0 = only a local one).
  trustProxy: Number(env.TRUST_PROXY) || 'loopback',
  // Laptop demos: show the saved dev emails on a Mailbox page. Off unless asked for, and never with a real email service.
  demoMailbox: env.DEMO_MAILBOX === '1' && !env.SMTP_USER && !env.BREVO_API_KEY,
  // Laptop demos: the made-up @trustvault.demo accounts cannot receive email, so they skip the email code
  // (password + Authenticator still apply). Only when asked for and only while the site runs on localhost.
  demoSkipEmail: env.DEMO_SKIP_EMAIL === '1' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(env.APP_URL || 'http://localhost:5173'),
  // Secret sign-up codes: only people who know them can create a Faculty or an Administrator account.
  facultyCode: env.FACULTY_CODE || '',
  adminCode: env.ADMIN_CODE || '',
  sessionMinutes: Number(env.SESSION_MINUTES || 60),
  // Where encrypted files, dev emails and the OCR cache live (tests point this at a temp folder).
  dataDir: env.DATA_DIR || path.join(import.meta.dirname, '..'),
};
