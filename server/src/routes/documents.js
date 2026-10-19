import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import config from '../config.js';
import { Document, Export, Share } from '../models.js';
import { sha256, storeFile, removeFile, openDocument, encryptText, randomToken } from '../lib/crypto.js';
import { runChecks, normalizeNumber, numberIsValid, maskNumber, STRICT_TYPES, NUMBER_HINTS } from '../lib/verify.js';
import { sniffType, watermark, compress, zip, mergeSides } from '../lib/files.js';
import { assertDocAccess } from '../lib/access.js';
import { addBlock } from '../lib/ledger.js';
import { sendMail } from '../lib/mail.js';
import { httpError, audit, esc, maskEmail } from '../lib/util.js';
import { requireVault } from '../middleware/auth.js';

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const TYPE_LABELS = {
  pan: 'PAN Card', aadhaar: 'Aadhaar Card', license: 'Driving Licence', marksheet: 'Marksheet', certificate: 'Certificate', other: 'Other document',
};

function readNumber(type, raw) {
  const number = normalizeNumber(raw);
  if (STRICT_TYPES.includes(type) && !numberIsValid(type, number)) throw httpError(400, NUMBER_HINTS[type]);
  return number;
}

const initialStatus = (type) => (type === 'other' ? 'stored' : 'pending');

// OCR can take a few seconds, so it runs after we've replied. The page polls for the result.
function checkInBackground(doc, sources, number, duplicate) {
  runChecks({ type: doc.type, number, sources, duplicate })
    .then((autoCheck) => doc.updateOne({ autoCheck }))
    .catch((e) => {
      console.error('Auto-check failed:', e);
      return doc.updateOne({ autoCheck: { state: 'failed', score: 0, checks: [] } });
    });
}
const MAX_ATTACHMENT = 18 * 1024 * 1024; // Gmail's limit is 25 MB including encoding overhead
const kb = (n) => Math.ceil(n / 1024);
// Readable one-time ZIP password, e.g. "K7QM-2XWD-9HPR" (no 0/O/1/I to avoid typos).
const zipPassword = () => Array.from({ length: 3 }, () =>
  Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('')).join('-');

export const docView = (d) => ({
  id: d.id, type: d.type, title: d.title, numberMasked: d.numberMasked, originalName: d.originalName, mime: d.mime, sides: d.sides,
  size: d.size, sha256: d.sha256, status: d.status, autoCheck: d.autoCheck, reviewNote: d.reviewNote, reviewedAt: d.reviewedAt,
  verifyCode: d.status === 'verified' ? d.verifyCode : undefined, expiryDate: d.expiryDate, tampered: d.tampered, createdAt: d.createdAt,
});

const r = Router();

r.get('/', async (req, res) => {
  const docs = await Document.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json(docs.map(docView));
});

// "file" = front (or the only page); optional "back" = back side of a card.
r.post('/', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'back', maxCount: 1 }]), async (req, res) => {
  const front = req.files?.file?.[0];
  const back = req.files?.back?.[0];
  const sources = [front, back].filter(Boolean).map((f) => ({ buf: f.buffer, mime: sniffType(f.buffer), name: f.originalname }));
  if (!front || sources.some((s) => !s.mime)) throw httpError(400, 'Upload a PDF, JPG, PNG or WEBP file (max 10 MB).');
  const { type, title, expiryDate } = req.body;
  if (!TYPE_LABELS[type]) throw httpError(400, 'Choose a document type.');
  const number = readNumber(type, req.body.number);

  const { buf, mime } = back ? await mergeSides(sources[0].buf, sources[0].mime, sources[1].buf, sources[1].mime) : sources[0];
  const hash = sha256(buf);
  if (await Document.exists({ owner: req.user._id, sha256: hash })) throw httpError(409, 'You already uploaded this exact file.');
  const duplicate = await Document.exists({ sha256: { $in: [hash, ...sources.map((s) => sha256(s.buf))] } });

  const doc = await Document.create({
    owner: req.user._id, type, title: title?.trim() || TYPE_LABELS[type],
    numberEnc: number ? encryptText(number) : undefined, numberMasked: maskNumber(type, number),
    originalName: sources.map((s) => s.name).join(' + '), sides: sources.length, mime, size: buf.length,
    storedName: await storeFile(buf), sha256: hash, expiryDate: expiryDate || undefined, status: initialStatus(type),
  });
  await addBlock('upload', doc._id, hash);
  await audit(req, 'document.upload', `${doc.title} (${TYPE_LABELS[type]}${back ? ', front + back' : ''})`);
  res.status(201).json(docView(doc));
  checkInBackground(doc, sources, number, duplicate);
});

// Re-file a document under the right type (e.g. an "Other" upload that is really a PAN card).
r.patch('/:id/type', async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
  if (!doc) throw httpError(404, 'Document not found.');
  if (doc.status === 'verified') throw httpError(400, 'Verified documents cannot change type. Upload a new copy instead.');
  const { type } = req.body ?? {};
  if (!TYPE_LABELS[type]) throw httpError(400, 'Choose a document type.');
  const number = readNumber(type, req.body.number);
  const buf = await openDocument(doc);
  const from = TYPE_LABELS[doc.type];

  if (doc.title === from) doc.title = TYPE_LABELS[type];
  Object.assign(doc, {
    type, numberEnc: number ? encryptText(number) : undefined, numberMasked: maskNumber(type, number),
    status: initialStatus(type), reviewNote: undefined, autoCheck: { state: 'running', checks: [] },
  });
  await doc.save();
  await audit(req, 'document.retype', `${doc.title}: ${from} -> ${TYPE_LABELS[type]}`);
  res.json(docView(doc));
  const duplicate = await Document.exists({ sha256: doc.sha256, _id: { $ne: doc._id } });
  checkInBackground(doc, [{ buf, mime: doc.mime }], number, duplicate);
});

// Owner, or staff with the student's consent (logged + the student is emailed). Needs the viewer's vault unlocked.
r.post('/:id/view', async (req, res) => {
  const doc = await Document.findById(req.params.id).populate('owner', 'name email');
  if (!doc) throw httpError(404, 'Document not found.');
  const own = doc.owner._id.equals(req.user._id);
  if (!own) await assertDocAccess(req.user, doc);
  await requireVault(req);

  const buf = await openDocument(doc);
  const label = `${req.user.email} | ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC | TrustVault`;
  const out = await watermark(buf, doc.mime, label);
  await audit(req, own ? 'document.view' : 'record.view', doc.title, doc.owner._id);
  if (!own) {
    sendMail({
      to: doc.owner.email, subject: 'Your document was viewed', title: 'Your record was accessed',
      body: `<p>${esc(req.user.name)} (${req.user.role}) viewed your document <b>${esc(doc.title)}</b> at ${new Date().toUTCString()}.</p>
        <p>You can see every access on your Activity page.</p>`,
    }).catch((e) => console.error(e.message));
  }
  res.set({ 'Content-Type': doc.mime, 'Cache-Control': 'no-store', 'Content-Disposition': 'inline' }).send(out);
});

r.get('/:id/qr', async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id, status: 'verified' });
  if (!doc) throw httpError(404, 'Only verified documents have a QR code.');
  const url = `${config.appUrl}/verify/${doc.verifyCode}`;
  res.json({ url, qr: await QRCode.toDataURL(url, { width: 320, margin: 1 }) });
});

r.delete('/:id', async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
  if (!doc) throw httpError(404, 'Document not found.');
  await removeFile(doc.storedName);
  await Share.deleteMany({ doc: doc._id });
  await doc.deleteOne();
  await addBlock('delete', doc._id, doc.sha256);
  await audit(req, 'document.delete', doc.title);
  res.json({ ok: true });
});

// Compress -> ZIP -> email. Nothing is downloaded in the browser.
r.post('/export', async (req, res) => {
  const { ids = [], quality = 'medium' } = req.body ?? {};
  if (!['original', 'medium', 'small'].includes(quality)) throw httpError(400, 'Choose a size: original, medium or small.');
  await requireVault(req);
  const docs = await Document.find({ owner: req.user._id, ...(ids.length && { _id: { $in: ids } }) });
  if (!docs.length) throw httpError(400, 'No documents selected.');

  let before = 0;
  const entries = [];
  for (const [i, doc] of docs.entries()) {
    const buf = await openDocument(doc);
    before += buf.length;
    const { buf: out, ext } = await compress(buf, doc.mime, quality);
    const base = doc.title.replace(/[^\w\- ]+/g, '').trim() || 'document';
    entries.push({ name: `${i + 1}-${base}.${ext}`, buf: out });
  }
  // The password is shown on screen only - never emailed - so a hacked inbox alone can't open the ZIP.
  const password = zipPassword();
  const archive = await zip(entries, password);
  const summary = `${docs.length} file(s): ${kb(before)} KB reduced to ${kb(archive.length)} KB (${quality} quality)`;
  const howToOpen = `<p>The ZIP is <b>password-protected (AES-256)</b>. The password was shown on screen when you requested it - it is not in this email.</p>
    <p><b>Windows' own "Extract All" cannot open it.</b> Use the free <a href="https://www.7-zip.org/">7-Zip</a>, WinRAR, or your phone's file manager:</p>
    <ol><li>Save the ZIP.</li><li>Right-click it and choose <b>7-Zip &rarr; Extract Here</b> (on Windows 11, click <b>Show more options</b> first).</li><li>Type the password.</li></ol>`;

  if (archive.length <= MAX_ATTACHMENT) {
    await sendMail({
      to: req.user.email, subject: 'Your TrustVault documents', title: 'Your documents are attached',
      body: `<p>${summary}.</p>${howToOpen}`,
      attachments: [{ filename: `trustvault-${new Date().toISOString().slice(0, 10)}.zip`, content: archive }],
    });
  } else {
    const token = randomToken();
    await Export.create({ user: req.user._id, tokenHash: sha256(token), storedName: await storeFile(archive), expiresAt: Date.now() + 15 * 60e3 });
    await sendMail({
      to: req.user.email, subject: 'Your TrustVault documents are ready', title: 'Download link (one-time, 15 minutes)',
      body: `<p>${summary}. The ZIP is too large to attach, so use this one-time link. It expires in 15 minutes:</p>
        <p><a href="${config.appUrl}/api/public/export/${token}">Download my documents</a></p>${howToOpen}`,
    });
  }
  await audit(req, 'document.export', summary);
  res.json({ sentTo: maskEmail(req.user.email), summary, before, after: archive.length, zipPassword: password });
});

export default r;
