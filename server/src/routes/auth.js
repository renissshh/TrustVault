// Sign-in flow: password -> email OTP -> Google Authenticator -> 60-minute session.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import { authenticator } from 'otplib';
import config from '../config.js';
import { User, Session, Audit, AccessRequest, Document, Share, Otp, Invite } from '../models.js';
import { sha256, encryptText, decryptText, removeFile } from '../lib/crypto.js';
import { addBlock } from '../lib/ledger.js';
import { sendMail } from '../lib/mail.js';
import { isPwned, isDisposableEmail, sendOtp, checkOtp } from '../lib/security.js';
import { httpError, maskEmail, publicUser, audit, esc, rollNumber } from '../lib/util.js';
import { requireAuth, startSession, requireStepUp, checkPin, STEP_UP_MINUTES, REAUTH_COOKIE } from '../middleware/auth.js';

authenticator.options = { window: 1 }; // accept the previous/next 30-second code for clock drift

const r = Router();
r.use(rateLimit({ windowMs: 15 * 60e3, limit: Number(process.env.AUTH_RATE_LIMIT || 60), skip: (req) => req.method === 'GET', message: { error: 'Too many attempts. Wait 15 minutes.' } }));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const sign = (payload, expiresIn) => jwt.sign(payload, config.jwtSecret, { expiresIn });

function readTicket(ticket, ...stages) {
  try {
    const p = jwt.verify(String(ticket ?? ''), config.jwtSecret);
    if (stages.includes(p.stage)) return p;
  } catch {}
  throw httpError(401, 'This sign-in step expired. Please start again.');
}

const otpStep = async (user, stage) => {
  await sendOtp({ key: `${stage}:${user._id}`, to: user.email, name: user.name });
  return { next: stage === 'verify' ? 'verify-email' : 'otp', ticket: sign({ uid: user.id, stage }, '15m'), email: maskEmail(user.email) };
};

// Either asks for the Authenticator code, or (first time) returns a QR code to scan.
async function totpStep(user, fullLogin = false) {
  const ticket = sign({ uid: user.id, stage: 'totp', full: fullLogin }, '10m');
  if (user.totpEnabled) return { next: 'totp', ticket };
  const secret = authenticator.generateSecret();
  await user.updateOne({ totpSecret: encryptText(secret) });
  const qr = await QRCode.toDataURL(authenticator.keyuri(user.email, 'TrustVault', secret));
  return { next: 'totp-setup', ticket, qr, secret };
}

// Accepts a 6-digit Authenticator code or a one-time backup code (XXXX-XXXX).
async function checkSecondFactor(user, input) {
  const code = String(input ?? '').trim().toUpperCase();
  if (/^\d{6}$/.test(code)) {
    if (!user.totpSecret || code === user.lastTotp) return false;
    if (!authenticator.check(code, decryptText(user.totpSecret))) return false;
    user.lastTotp = code;
    await user.save();
    return true;
  }
  const i = user.backupCodes.indexOf(sha256(code));
  if (i === -1 || !user.totpEnabled) return false;
  user.backupCodes.splice(i, 1);
  await user.save();
  return true;
}

const TRUST_COOKIE = 'tv_td';
const deviceKey = (req) => sha256(req.get('user-agent') ?? '');
function isTrustedDevice(req, user) {
  try {
    const p = jwt.verify(req.cookies[TRUST_COOKIE], config.jwtSecret);
    return p.uid === user.id && p.v === user.trustVersion && p.dk === deviceKey(req);
  } catch {
    return false;
  }
}

const newBackupCodes = () => Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-'));

r.post('/register', async (req, res) => {
  const { name, email, password, studentId, consent, invite: inviteToken } = req.body ?? {};
  if (!name?.trim() || !EMAIL.test(email ?? '')) throw httpError(400, 'Enter your name and a valid email.');
  // An invitation link gives the new account its role. It must be unused, unexpired and sent to this exact email.
  const invite = inviteToken && await Invite.findOne({ tokenHash: sha256(String(inviteToken)), usedAt: null, revoked: false, expiresAt: { $gt: new Date() } });
  if (inviteToken && !invite) throw httpError(400, 'This invitation is not valid any more. Ask the admin to send a new one.');
  if (invite && invite.email !== email.toLowerCase()) throw httpError(400, 'This invitation was sent to a different email address.');
  if (!consent) throw httpError(400, 'Please accept the privacy policy to create an account.');
  if (!STRONG.test(password ?? '')) throw httpError(400, 'Password needs at least 8 characters, with letters and numbers.');
  if (await isPwned(password)) throw httpError(400, 'This password appeared in a known data breach. Please choose a different one.');
  if (await isDisposableEmail(email)) throw httpError(400, 'Temporary / disposable email addresses are not allowed. Use your real email.');
  if (await User.exists({ email: email.toLowerCase() })) throw httpError(409, 'An account with this email already exists.');
  // Students must give a valid MCA roll number, one account per number. Invited staff (verifiers, admins) don't need one.
  const roll = invite ? undefined : rollNumber(studentId);
  if (roll && await User.exists({ studentId: roll })) throw httpError(409, `Roll number ${roll} already has an account. Contact your administrator if that is not you.`);
  // claim the invitation first (atomically), so one link can never create two accounts
  if (invite && !(await Invite.findOneAndUpdate({ _id: invite._id, usedAt: null, revoked: false }, { usedAt: new Date() }))) {
    throw httpError(400, 'This invitation was already used.');
  }
  const user = await User.create({ name, email, studentId: roll, passwordHash: await bcrypt.hash(password, 12), consentAt: new Date(), ...(invite && { role: invite.role }) })
    .catch(async (err) => { // the account was not created: hand the invitation back so the link still works
      if (invite) await Invite.updateOne({ _id: invite._id }, { usedAt: null });
      throw err;
    });
  await Audit.create({ user: user._id, subject: user._id, action: 'register', ip: req.ip });
  if (invite) await Audit.create({ user: user._id, subject: user._id, action: 'invite.accept', detail: `Joined as ${invite.role}`, ip: req.ip });
  res.status(201).json(await otpStep(user, 'verify'));
});

r.post('/verify-email', async (req, res) => {
  const { uid } = readTicket(req.body?.ticket, 'verify');
  if (!(await checkOtp(`verify:${uid}`, req.body.code))) throw httpError(400, 'Wrong or expired code.');
  const user = await User.findByIdAndUpdate(uid, { emailVerified: true }, { new: true });
  res.json(await totpStep(user, true)); // password + email proven, go straight to Authenticator setup
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await User.findOne({ email: String(email ?? '').toLowerCase() });
  if (user?.lockedUntil > new Date()) {
    throw httpError(423, `Account locked after too many failed attempts. Try again in ${Math.ceil((user.lockedUntil - Date.now()) / 60e3)} min.`);
  }
  if (!user || !(await bcrypt.compare(String(password ?? ''), user.passwordHash))) {
    if (user) {
      user.failedLogins += 1;
      if (user.failedLogins >= 5) {
        user.failedLogins = 0;
        user.lockedUntil = new Date(Date.now() + 15 * 60e3);
        sendMail({ to: user.email, subject: 'TrustVault account locked', title: 'Account temporarily locked',
          body: `<p>5 wrong passwords were entered for your account from IP ${esc(req.ip)}. Sign-in is locked for 15 minutes.</p>` })
          .catch((e) => console.error(e.message));
      }
      await user.save();
      await Audit.create({ subject: user._id, action: 'login.failed', detail: 'Wrong password', ip: req.ip });
    }
    throw httpError(401, 'Wrong email or password.');
  }
  // A device trusted in the last 30 days skips the email code: password + Authenticator is still 2 factors.
  if (user.emailVerified && user.totpEnabled && isTrustedDevice(req, user)) return res.json({ ...(await totpStep(user)), trusted: true });
  res.json(await otpStep(user, user.emailVerified ? 'otp' : 'verify'));
});

// ---- Forgot password: email code + Google Authenticator (or a backup code) ----
r.post('/forgot', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) throw httpError(400, 'Enter a valid email.');
  const user = await User.findOne({ email });
  if (user) await sendOtp({ key: `reset:${user._id}`, to: user.email, name: user.name });
  // Same answer whether or not the account exists, so nobody can probe which emails are registered.
  res.json({ ticket: sign({ email, stage: 'reset' }, '15m'), email: maskEmail(email) });
});

r.post('/reset', async (req, res) => {
  const { email } = readTicket(req.body?.ticket, 'reset');
  const { code, totp, password } = req.body;
  if (!STRONG.test(password ?? '')) throw httpError(400, 'New password needs at least 8 characters, with letters and numbers.');
  const user = await User.findOne({ email });
  if (!user || !(await checkOtp(`reset:${user._id}`, code))) throw httpError(400, 'Wrong or expired email code.');
  if (user.totpEnabled && !(await checkSecondFactor(user, totp))) {
    throw httpError(400, 'Wrong Google Authenticator or backup code. Request a new email code and try again. Lost your phone and backup codes? Ask your administrator to reset your 2FA.');
  }
  if (await isPwned(password)) throw httpError(400, 'This password appeared in a known data breach. Please choose a different one.');
  Object.assign(user, { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: undefined, trustVersion: user.trustVersion + 1 });
  await user.save();
  await Session.updateMany({ user: user._id }, { revoked: true });
  await Audit.create({ user: user._id, subject: user._id, action: 'password.reset', ip: req.ip });
  sendMail({ to: user.email, subject: 'Your TrustVault password was reset', title: 'Password changed',
    body: `<p>Your password was reset from IP ${esc(req.ip)} and all devices were signed out.</p>` }).catch((e) => console.error(e.message));
  res.json({ ok: true });
});

r.post('/login/resend', async (req, res) => {
  const { uid, stage } = readTicket(req.body?.ticket, 'otp', 'verify');
  res.json(await otpStep(await User.findById(uid), stage));
});

r.post('/login/otp', async (req, res) => {
  const { uid } = readTicket(req.body?.ticket, 'otp');
  if (!(await checkOtp(`otp:${uid}`, req.body.code))) throw httpError(400, 'Wrong or expired code.');
  res.json(await totpStep(await User.findById(uid), true));
});

r.post('/login/totp', async (req, res) => {
  const { uid, full } = readTicket(req.body?.ticket, 'totp');
  const user = await User.findById(uid);
  if (!(await checkSecondFactor(user, req.body.code))) throw httpError(400, 'Wrong Google Authenticator code.');
  const body = {};
  if (!user.totpEnabled) {
    user.totpEnabled = true;
    body.backupCodes = newBackupCodes();
    user.backupCodes = body.backupCodes.map(sha256);
  }
  await startSession(req, res, user, { fullLogin: full });
  if (req.body.remember) {
    res.cookie(TRUST_COOKIE, jwt.sign({ uid: user.id, v: user.trustVersion, dk: deviceKey(req) }, config.jwtSecret, { expiresIn: '30d' }),
      { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 30 * 864e5, path: '/api/auth' });
  }
  res.json(body);
});

// After the 60-minute session ends: who is waiting to re-enter their Authenticator code?
r.get('/reauth', async (req, res) => {
  const { uid } = readTicket(req.cookies[REAUTH_COOKIE.name], 'reauth');
  const user = await User.findById(uid);
  if (!user) throw httpError(401, 'Please sign in.');
  res.json({ name: user.name, email: maskEmail(user.email) });
});

// Also used by "Stay signed in" before the hour runs out: the old session is closed, a new 60-minute one starts.
r.post('/reauth', async (req, res) => {
  const { uid } = readTicket(req.cookies[REAUTH_COOKIE.name], 'reauth');
  const user = await User.findById(uid);
  if (!user || !(await checkSecondFactor(user, req.body?.code))) throw httpError(400, 'Wrong Google Authenticator code.');
  try {
    await Session.updateOne({ _id: jwt.verify(req.cookies.tv_sid, config.jwtSecret).sid }, { revoked: true });
  } catch {}
  await startSession(req, res, user);
  res.json({ ok: true });
});

r.post('/logout', async (req, res) => {
  try {
    const { sid } = jwt.verify(req.cookies.tv_sid, config.jwtSecret);
    await Session.updateOne({ _id: sid }, { revoked: true });
  } catch {}
  res.clearCookie('tv_sid').clearCookie(REAUTH_COOKIE.name, { path: REAUTH_COOKIE.path }).json({ ok: true });
});

// ---- Signed-in account management ----
r.use(requireAuth);

r.get('/me', async (req, res) => res.json({
  user: publicUser(req.user),
  expiresAt: req.sess.expiresAt,
  vaultUnlocked: req.sess.vaultUnlocked,
  elevatedUntil: req.sess.elevatedUntil > new Date() ? req.sess.elevatedUntil : null,
  pendingAccess: await AccessRequest.countDocuments({ student: req.user._id, status: 'pending' }),
}));

r.patch('/profile', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (name.length < 2) throw httpError(400, 'Enter your full name.');
  const before = req.user.name;
  // students always keep a valid roll number; staff may leave it empty
  const given = String(req.body.studentId ?? '').trim();
  const roll = req.user.role === 'student' || given ? rollNumber(given) : undefined;
  if (roll && roll !== req.user.studentId && await User.exists({ studentId: roll, _id: { $ne: req.user._id } })) throw httpError(409, `Roll number ${roll} already has an account.`);
  Object.assign(req.user, { name, studentId: roll });
  await req.user.save();
  await audit(req, 'profile.update', before === name ? 'Roll number updated' : `Name: ${before} -> ${name}`);
  res.json({ user: publicUser(req.user) });
});

// Profile photo: any picture sharp can decode (JPG, PNG, WebP, GIF, TIFF, AVIF) up to 20 MB -> square 256 px
// WebP (EXIF rotation applied, metadata dropped). SVG is refused: it is a document, not a photo.
const photo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single('photo');
r.put('/avatar', photo, async (req, res) => {
  const meta = req.file && await sharp(req.file.buffer).metadata().catch(() => null);
  if (!meta || meta.format === 'svg') throw httpError(400, 'We could not read that picture. Try a JPG or PNG photo.');
  req.user.avatar = await sharp(req.file.buffer, { limitInputPixels: 100e6 }).rotate()
    .resize(256, 256, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 84 }).toBuffer();
  req.user.avatarV = Date.now();
  await req.user.save();
  await audit(req, 'profile.photo', 'Profile photo updated');
  res.json({ user: publicUser(req.user) });
});

r.delete('/avatar', async (req, res) => {
  req.user.avatar = undefined;
  req.user.avatarV = 0;
  await req.user.save();
  await audit(req, 'profile.photo', 'Profile photo removed');
  res.json({ user: publicUser(req.user) });
});

r.get('/avatar', async (req, res) => {
  const { avatar } = await User.findById(req.user._id).select('+avatar');
  if (!avatar?.length) throw httpError(404, 'No profile photo.');
  res.type('image/webp').set('Cache-Control', 'private, max-age=31536000, immutable').send(avatar); // URL carries ?v=
});

// ---- Security check before sensitive changes: password -> email code -> Google Authenticator ----
const stepTicket = (req, stage) => sign({ uid: req.user.id, sid: req.sess.id, stage }, '10m');
const readStep = (req, stage) => {
  const p = readTicket(req.body?.ticket, stage);
  if (p.sid !== req.sess.id) throw httpError(401, 'This security check belongs to another session. Start again.');
  return p;
};
r.post('/step-up/password', async (req, res) => {
  if (!(await bcrypt.compare(String(req.body?.password ?? ''), req.user.passwordHash))) {
    await audit(req, 'stepup.failed', 'Wrong password in security check');
    throw httpError(403, 'That password is not right.');
  }
  await sendOtp({ key: `stepup:${req.user._id}`, to: req.user.email, name: req.user.name });
  res.json({ ticket: stepTicket(req, 'stepup-otp'), email: maskEmail(req.user.email) });
});
r.post('/step-up/otp', async (req, res) => {
  readStep(req, 'stepup-otp');
  if (!(await checkOtp(`stepup:${req.user._id}`, req.body?.code))) throw httpError(400, 'Wrong or expired email code.');
  res.json({ ticket: stepTicket(req, 'stepup-totp') });
});
r.post('/step-up/totp', async (req, res) => {
  readStep(req, 'stepup-totp');
  if (!(await checkSecondFactor(req.user, req.body?.code))) throw httpError(400, 'Wrong Google Authenticator code.');
  req.sess.elevatedUntil = new Date(Date.now() + STEP_UP_MINUTES * 60e3);
  await req.sess.save();
  await audit(req, 'stepup', 'Security check passed');
  res.json({ elevatedUntil: req.sess.elevatedUntil });
});

// ---- Vault: the PIN is entered once per session ----
r.post('/vault/unlock', async (req, res) => {
  await checkPin(req.user, req.body?.pin);
  req.sess.vaultUnlocked = true;
  await req.sess.save();
  await audit(req, 'vault.unlock', 'Vault unlocked for this session');
  res.json({ vaultUnlocked: true });
});
r.post('/vault/lock', async (req, res) => {
  req.sess.vaultUnlocked = false;
  await req.sess.save();
  res.json({ vaultUnlocked: false });
});

r.post('/forget-devices', async (req, res) => {
  requireStepUp(req);
  req.user.trustVersion += 1;
  await req.user.save();
  await audit(req, 'devices.forget', 'All trusted devices forgotten');
  res.json({ ok: true });
});

// Right to erasure (DPDP Act 2023): deletes files, shares, sessions and the account. The audit log is kept.
r.post('/delete-account', async (req, res) => {
  requireStepUp(req);
  if (req.body?.confirm !== 'DELETE') throw httpError(400, 'Type DELETE to confirm.');
  const uid = req.user._id;
  for (const doc of await Document.find({ owner: uid })) {
    await removeFile(doc.storedName);
    await addBlock('delete', doc._id, doc.sha256);
    await doc.deleteOne();
  }
  await Promise.all([
    Share.deleteMany({ owner: uid }), Session.deleteMany({ user: uid }), Otp.deleteMany({ key: new RegExp(`:${uid}$`) }),
    AccessRequest.deleteMany({ $or: [{ student: uid }, { verifier: uid }] }),
  ]);
  await audit(req, 'account.delete', `Account ${maskEmail(req.user.email)} deleted by its owner`);
  await req.user.deleteOne();
  sendMail({ to: req.user.email, subject: 'Your TrustVault account was deleted', title: 'Account deleted',
    body: '<p>Your account and all your documents were permanently deleted.</p>' }).catch((e) => console.error(e.message));
  res.clearCookie('tv_sid').clearCookie(REAUTH_COOKIE.name, { path: REAUTH_COOKIE.path }).clearCookie(TRUST_COOKIE, { path: '/api/auth' }).json({ ok: true });
});

r.get('/sessions', async (req, res) => {
  const sessions = await Session.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(15);
  res.json(sessions.map((s) => ({
    id: s.id, device: s.device, ip: s.ip, location: s.location, createdAt: s.createdAt, expiresAt: s.expiresAt,
    active: !s.revoked && s.expiresAt > new Date(), current: s.id === req.sess.id,
  })));
});

r.delete('/sessions/:id', async (req, res) => {
  await Session.updateOne({ _id: req.params.id, user: req.user._id }, { revoked: true });
  await audit(req, 'session.revoke');
  res.json({ ok: true });
});

r.get('/activity', async (req, res) => {
  const logs = await Audit.find({ $or: [{ user: req.user._id }, { subject: req.user._id }] })
    .sort({ createdAt: -1 }).limit(100).populate('user', 'name role');
  res.json(logs);
});

r.post('/vault-pin', async (req, res) => {
  requireStepUp(req);
  const { pin } = req.body ?? {};
  if (!/^\d{6}$/.test(pin ?? '')) throw httpError(400, 'The vault PIN must be exactly 6 digits.');
  if (/^(\d)\1{5}$|^(012345|123456|234567|345678|456789|987654|876543|765432|654321|543210)$/.test(pin)) throw httpError(400, 'That PIN is too easy to guess. Avoid repeated or sequential digits.');
  req.user.vaultPinHash = await bcrypt.hash(pin, 12);
  req.user.pinFails = 0;
  req.user.pinLockedUntil = undefined;
  await req.user.save();
  await Session.updateMany({ user: req.user._id, _id: { $ne: req.sess._id } }, { vaultUnlocked: false }); // other devices must use the new PIN
  req.sess.vaultUnlocked = true;
  await req.sess.save();
  await audit(req, 'vault.pin', 'Vault PIN set');
  res.json({ user: publicUser(req.user) });
});

r.post('/password', async (req, res) => {
  requireStepUp(req);
  const { next } = req.body ?? {};
  if (await bcrypt.compare(String(next ?? ''), req.user.passwordHash)) throw httpError(400, 'Choose a password you have not used here before.');
  if (!STRONG.test(next ?? '')) throw httpError(400, 'New password needs at least 8 characters, with letters and numbers.');
  if (await isPwned(next)) throw httpError(400, 'This password appeared in a known data breach. Please choose a different one.');
  req.user.passwordHash = await bcrypt.hash(next, 12);
  req.user.trustVersion += 1; // trusted devices must sign in fully again
  await req.user.save();
  await Session.updateMany({ user: req.user._id, _id: { $ne: req.sess._id } }, { revoked: true }); // sign out other devices
  await audit(req, 'password.change');
  res.json({ ok: true });
});

r.post('/backup-codes', async (req, res) => {
  requireStepUp(req);
  const codes = newBackupCodes();
  req.user.backupCodes = codes.map(sha256);
  await req.user.save();
  await audit(req, 'backup-codes.regenerate');
  res.json({ backupCodes: codes });
});

export default r;
