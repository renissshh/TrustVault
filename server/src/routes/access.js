// The student's side of consent: see who asked for which documents, approve all or some / deny / revoke.
import { Router } from 'express';
import { AccessRequest } from '../models.js';
import { sendMail } from '../lib/mail.js';
import { httpError, audit, esc } from '../lib/util.js';
import { GRANT_HOURS } from '../lib/access.js';
import { TYPE_LABELS } from './documents.js';

const r = Router();
const labels = (types) => types.map((t) => TYPE_LABELS[t]).join(', ');
const shownStatus = (a) => (a.status === 'approved' && a.expiresAt < new Date() ? 'expired' : a.status);

r.get('/', async (req, res) => {
  const list = await AccessRequest.find({ student: req.user._id }).sort({ createdAt: -1 }).limit(50).populate('verifier', 'name email role');
  res.json(list.map((a) => ({
    id: a.id, verifier: a.verifier, reason: a.reason, types: a.types, granted: a.granted, opened: a.opened.length,
    requestedAt: a.createdAt, expiresAt: a.expiresAt, status: shownStatus(a),
  })));
});

// body: { decision: 'approve' | 'deny' | 'revoke', types?: [...] }  - types = the requested ones the student allows
r.post('/:id', async (req, res) => {
  const { decision } = req.body ?? {};
  if (!['approve', 'deny', 'revoke'].includes(decision)) throw httpError(400, 'Choose approve, deny or revoke.');
  const a = await AccessRequest.findOne({ _id: req.params.id, student: req.user._id }).populate('verifier', 'name email');
  if (!a) throw httpError(404, 'Request not found.');
  if (decision === 'revoke' ? a.status !== 'approved' : a.status !== 'pending') throw httpError(400, 'This request was already answered.');

  if (decision === 'approve') {
    const asked = a.types?.length ? a.types : Object.keys(TYPE_LABELS); // older requests asked for everything
    const allowed = req.body.types ? [].concat(req.body.types).filter((t) => asked.includes(t)) : asked;
    if (!allowed.length) throw httpError(400, 'Tick at least one document to share, or deny the request.');
    Object.assign(a, { granted: allowed, expiresAt: new Date(Date.now() + GRANT_HOURS * 3600e3) });
  }
  a.status = { approve: 'approved', deny: 'denied', revoke: 'revoked' }[decision];
  await a.save();
  const what = decision === 'approve' ? labels(a.granted) : labels(a.types ?? []);
  await audit(req, `access.${a.status}`, `${a.verifier.name}: ${what}`);
  sendMail({
    to: a.verifier.email, subject: `Document request ${a.status}`, title: `Your document request was ${a.status}`,
    body: decision === 'approve'
      ? `<p>${esc(req.user.name)} approved: <b>${esc(what)}</b>.</p><p>Each document can be opened <b>one time</b> within ${GRANT_HOURS} hours.</p>`
      : `<p>${esc(req.user.name)} ${a.status} your request for ${esc(what)}.</p>`,
  }).catch((e) => console.error(e.message));
  res.json({ ok: true });
});

export default r;
