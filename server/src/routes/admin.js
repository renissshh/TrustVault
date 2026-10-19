import { Router } from 'express';
import { User, Document, Block, Audit, Session, Invite, AccessRequest } from '../models.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { addBlock, checkIntegrity } from '../lib/ledger.js';
import { sendMail } from '../lib/mail.js';
import { httpError, audit, esc } from '../lib/util.js';
import { requireRole } from '../middleware/auth.js';
import { docView } from './documents.js';
import config from '../config.js';

const r = Router();
const staff = requireRole('verifier', 'admin');
const admin = requireRole('admin');

r.get('/stats', staff, async (req, res) => {
  const [users, docs, logins, blocks] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Document.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Session.countDocuments({ createdAt: { $gt: new Date(Date.now() - 864e5) } }),
    Block.countDocuments(),
  ]);
  const obj = (rows) => Object.fromEntries(rows.map((x) => [x._id, x.n]));
  res.json({ users: obj(users), documents: obj(docs), logins24h: logins, blocks, tampered: await Document.countDocuments({ tampered: true }) });
});

r.get('/users', admin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, studentId: u.studentId, totpEnabled: u.totpEnabled,
    locked: u.lockedUntil > new Date() || u.pinLockedUntil > new Date(), createdAt: u.createdAt,
  })));
});

r.patch('/users/:id', admin, async (req, res) => {
  const { role } = req.body ?? {};
  if (!['student', 'verifier', 'admin'].includes(role)) throw httpError(400, 'Unknown role.');
  if (req.params.id === req.user.id) throw httpError(400, 'You cannot change your own role.');
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) throw httpError(404, 'User not found.');
  await audit(req, 'user.role', `${user.email} -> ${role}`, user._id);
  res.json({ ok: true });
});

r.post('/users/:id/unlock', admin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { lockedUntil: null, pinLockedUntil: null, failedLogins: 0, pinFails: 0 });
  if (!user) throw httpError(404, 'User not found.');
  await audit(req, 'user.unlock', user.email, user._id);
  res.json({ ok: true });
});

// For a user who lost both their phone and backup codes: they set up Google Authenticator again at next sign-in.
r.post('/users/:id/reset-2fa', admin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, {
    totpEnabled: false, totpSecret: null, backupCodes: [], lastTotp: null, $inc: { trustVersion: 1 },
  });
  if (!user) throw httpError(404, 'User not found.');
  await Session.updateMany({ user: user._id }, { revoked: true });
  await audit(req, 'user.reset-2fa', user.email, user._id);
  sendMail({
    to: user.email, subject: 'Your two-factor authentication was reset', title: 'Google Authenticator reset',
    body: `<p>An administrator reset your Google Authenticator. Next time you sign in you will scan a new QR code.</p>
      <p>If you did not ask for this, contact your administrator immediately.</p>`,
  }).catch((e) => console.error(e.message));
  res.json({ ok: true });
});

// ---------- Invitations: bring in a verifier or another admin by email ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_HOURS = 48;
const inviteView = (i) => ({
  id: i.id, email: i.email, role: i.role, invitedBy: i.invitedBy?.name, createdAt: i.createdAt, expiresAt: i.expiresAt,
  status: i.usedAt ? 'used' : i.revoked ? 'revoked' : i.expiresAt < new Date() ? 'expired' : 'pending',
});

r.get('/invites', admin, async (req, res) => {
  res.json((await Invite.find().sort({ createdAt: -1 }).limit(50).populate('invitedBy', 'name')).map(inviteView));
});

r.post('/invites', admin, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const { role } = req.body ?? {};
  if (!EMAIL.test(email)) throw httpError(400, 'Enter a valid email address.');
  if (!['verifier', 'admin'].includes(role)) throw httpError(400, 'An invitation must be for a verifier or an admin.');
  if (await User.exists({ email })) throw httpError(409, 'This person already has an account. Change their role in the Users list instead.');
  await Invite.updateMany({ email, usedAt: null, revoked: false }, { revoked: true }); // only the newest link works
  const token = randomToken(32);
  const invite = await Invite.create({ email, role, tokenHash: sha256(token), invitedBy: req.user._id, expiresAt: new Date(Date.now() + INVITE_HOURS * 36e5) });
  await audit(req, 'invite.create', `${email} as ${role}`);
  const link = `${config.appUrl}/register?invite=${token}`;
  await sendMail({
    to: email, subject: `You are invited to TrustVault as ${role === 'admin' ? 'an admin' : 'a verifier'}`, title: 'You have been invited',
    body: `<p><b>${esc(req.user.name)}</b> invited you to join TrustVault as ${role === 'admin' ? 'an <b>admin</b>' : 'a <b>verifier</b>'}.</p>
      <p><a href="${link}">Create your account</a></p>
      <p style="color:#6b7280;font-size:13px">This link works once, only for ${esc(email)}, and expires in ${INVITE_HOURS} hours. You will set a password and Google Authenticator.</p>`,
  });
  res.status(201).json(inviteView(await invite.populate('invitedBy', 'name')));
});

r.delete('/invites/:id', admin, async (req, res) => {
  const invite = await Invite.findOneAndUpdate({ _id: req.params.id, usedAt: null }, { revoked: true });
  if (!invite) throw httpError(404, 'Invitation not found or already used.');
  await audit(req, 'invite.revoke', invite.email);
  res.json({ ok: true });
});

r.get('/audit', admin, async (req, res) => {
  res.json(await Audit.find().sort({ createdAt: -1 }).limit(200).populate('user', 'name role').populate('subject', 'name'));
});

// Every document request faculty sent and how students answered, newest first.
r.get('/requests', admin, async (req, res) => {
  const list = await AccessRequest.find().sort({ createdAt: -1 }).limit(300)
    .populate('verifier', 'name email').populate('student', 'name email studentId');
  res.json(list.map((a) => ({
    id: a.id, faculty: a.verifier && { name: a.verifier.name, email: a.verifier.email },
    student: a.student && { name: a.student.name, email: a.student.email, studentId: a.student.studentId },
    types: a.types, granted: a.granted, opened: a.opened.length, reason: a.reason,
    status: a.status === 'approved' && a.expiresAt < new Date() ? 'expired' : a.status, requestedAt: a.createdAt, updatedAt: a.updatedAt,
  })));
});

r.get('/ledger', admin, async (req, res) => res.json(await Block.find().sort({ index: -1 }).limit(100)));

r.post('/integrity', admin, async (req, res) => {
  const result = await checkIntegrity();
  await audit(req, 'ledger.check', result.ok ? 'All records intact' : `${result.problems.length} problem(s)`);
  res.json(result);
});

export default r;
