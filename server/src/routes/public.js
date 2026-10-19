// No login needed: site stats, invitations, share links, export download links.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Document, Share, Export, Block, Invite } from '../models.js';
import { sha256, openDocument, readFile, removeFile } from '../lib/crypto.js';
import { sendOtp, checkOtp } from '../lib/security.js';
import { watermark } from '../lib/files.js';
import { sendMail } from '../lib/mail.js';
import { httpError, audit, esc, maskEmail } from '../lib/util.js';
import { upload, TYPE_LABELS } from './documents.js';

const r = Router();
r.use(rateLimit({ windowMs: 15 * 60e3, limit: 100, message: { error: 'Too many requests. Wait a few minutes.' } }));

r.get('/stats', async (req, res) => {
  const [verified, documents, blocks] = await Promise.all([
    Document.countDocuments({ status: 'verified' }), Document.countDocuments(), Block.countDocuments(),
  ]);
  res.json({ verified, documents, blocks });
});

// The sign-up page asks who an invitation is for, so it can show the role and lock the email field.
r.get('/invite/:token', async (req, res) => {
  const invite = await Invite.findOne({ tokenHash: sha256(req.params.token), usedAt: null, revoked: false, expiresAt: { $gt: new Date() } }).populate('invitedBy', 'name');
  if (!invite) throw httpError(404, 'This invitation is not valid any more. Ask the admin to send a new one.');
  res.json({ email: invite.email, role: invite.role, invitedBy: invite.invitedBy?.name, expiresAt: invite.expiresAt });
});

async function findShare(token) {
  const share = await Share.findOne({ tokenHash: sha256(String(token)) }).populate('doc').populate('owner', 'name email');
  if (!share?.doc || share.revoked) throw httpError(404, 'This share link is invalid or was revoked.');
  if (share.expiresAt < new Date()) throw httpError(410, 'This share link has expired.');
  if (share.views >= share.maxViews) throw httpError(410, 'This share link reached its view limit.');
  return share;
}

r.get('/share/:token', async (req, res) => {
  const s = await findShare(req.params.token);
  res.json({ title: s.doc.title, status: s.doc.status, owner: s.owner.name, recipient: maskEmail(s.recipient), expiresAt: s.expiresAt, viewsLeft: s.maxViews - s.views });
});

r.post('/share/:token/otp', async (req, res) => {
  const s = await findShare(req.params.token);
  await sendOtp({ key: `share:${s.id}`, to: s.recipient, name: s.recipient });
  res.json({ ok: true });
});

r.post('/share/:token/view', async (req, res) => {
  const s = await findShare(req.params.token);
  if (!(await checkOtp(`share:${s.id}`, req.body?.code))) throw httpError(400, 'Wrong or expired code.');
  const buf = await openDocument(s.doc);
  const out = await watermark(buf, s.doc.mime, `Shared with ${s.recipient} | ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  s.views += 1;
  await s.save();
  await audit(req, 'share.view', `${s.doc.title} viewed by ${s.recipient}`, s.owner._id);
  sendMail({ to: s.owner.email, subject: 'Your shared document was opened', title: 'Shared document opened',
    body: `<p>${esc(s.recipient)} opened <b>${esc(s.doc.title)}</b> (${s.views}/${s.maxViews} views).</p>` }).catch((e) => console.error(e.message));
  res.set({ 'Content-Type': s.doc.mime, 'Cache-Control': 'no-store', 'Content-Disposition': 'inline' }).send(out);
});

// One-time link for ZIPs that were too large to attach to the email.
r.get('/export/:token', async (req, res) => {
  const exp = await Export.findOneAndDelete({ tokenHash: sha256(req.params.token), expiresAt: { $gt: new Date() } });
  if (!exp) return res.status(410).send('This download link has expired or was already used.');
  const buf = await readFile(exp.storedName);
  await removeFile(exp.storedName);
  res.attachment('trustvault-documents.zip').set('Cache-Control', 'no-store').send(buf);
});

export default r;
