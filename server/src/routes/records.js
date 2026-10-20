// Student records - for faculty (role "verifier") and admins, and only with the student's consent.
// Staff see who is registered. To see documents they tick the types they need and send a request; the student
// approves all or some, and each approved document can be opened one time (see lib/access.js).
import { Router } from 'express';
import { User, Document, AccessRequest } from '../models.js';
import { sendMail } from '../lib/mail.js';
import { httpError, audit, esc } from '../lib/util.js';
import { activeGrants, grantFor, GRANT_HOURS } from '../lib/access.js';
import config from '../config.js';
import { docView, TYPE_LABELS } from './documents.js';

const r = Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const accessView = (a) => a && { status: a.status, reason: a.reason, types: a.types, granted: a.granted, expiresAt: a.expiresAt, requestedAt: a.createdAt };
const labels = (types) => types.map((t) => TYPE_LABELS[t]).join(', ');

// Latest request from this verifier per student; approved ones that ran out show as "expired".
async function latestRequests(verifier, studentIds) {
  const reqs = await AccessRequest.find({ verifier, student: { $in: studentIds } }).sort({ createdAt: 1 });
  const map = Object.fromEntries(reqs.map((a) => [a.student, a]));
  for (const a of Object.values(map)) if (a.status === 'approved' && a.expiresAt < new Date()) a.status = 'expired';
  return map;
}

// ?q= searches name, email and roll number; ?batch=23MX (or 23) keeps one batch. Up to 200 students.
r.get('/students', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const match = q ? { $or: ['name', 'email', 'studentId'].map((f) => ({ [f]: new RegExp(escapeRegex(q), 'i') })) } : {};
  const batch = req.query.batch && String(req.query.batch).toUpperCase() !== 'ALL' ? { studentId: inBatch(batchOf(req.query.batch)) } : {};
  const students = await User.find({ role: 'student', ...match, ...batch }).sort({ studentId: 1, name: 1 }).limit(200);
  const ids = students.map((s) => s._id);
  const [counts, access] = await Promise.all([
    Document.aggregate([
      { $match: { owner: { $in: ids } } },
      { $group: { _id: '$owner', total: { $sum: 1 }, verified: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } } } },
    ]),
    latestRequests(req.user._id, ids),
  ]);
  const byId = Object.fromEntries(counts.map((c) => [c._id, c]));
  res.json(students.map((s) => ({
    id: s.id, name: s.name, email: s.email, studentId: s.studentId, joined: s.createdAt,
    total: byId[s.id]?.total ?? 0, verified: byId[s.id]?.verified ?? 0, access: accessView(access[s.id]),
  })));
});

r.get('/students/:id', async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: 'student' });
  if (!student) throw httpError(404, 'Student not found.');
  const grants = await activeGrants(req.user, student._id);
  const types = [...new Set(grants.flatMap((g) => g.granted))];
  const latest = (await latestRequests(req.user._id, [student._id]))[student.id];
  // only the document types the student approved; each one shows whether its one-time view is still available
  const docs = types.length ? await Document.find({ owner: student._id, type: { $in: types } }).sort({ createdAt: -1 }) : [];
  if (docs.length) await audit(req, 'record.open', `Opened record of ${student.name} (${labels(types)})`, student._id);
  res.json({
    student: { id: student.id, name: student.name, email: student.email, studentId: student.studentId, joined: student.createdAt },
    access: accessView(latest),
    documents: docs.map((d) => ({ ...docView(d), canOpen: Boolean(grantFor(grants, d)) })),
  });
});

// The document types asked for, cleaned up; at least one.
function requestedTypes(body) {
  const types = [...new Set([].concat(body?.types ?? []))].filter((t) => TYPE_LABELS[t]);
  if (!types.length) throw httpError(400, 'Tick at least one document you need.');
  return types;
}
// Batch codes are the first 4 characters of a roll number: joining year + MX, e.g. 26MX.
// "26MX", "26 mx" or just "26" -> "26MX"
const batchOf = (group) => {
  let g = String(group ?? '').toUpperCase().replace(/\s/g, '');
  if (/^\d{2}$/.test(g)) g += 'MX';
  if (!/^\d{2}MX$/.test(g)) throw httpError(400, 'Type a batch like 26MX: the 2-digit joining year, then MX.');
  return g;
};
const inBatch = (group) => new RegExp('^' + group + '\\d{3}$'); // 26MX -> 26MX001 ... 26MX999
const requestMail = (req, student, types, reason) => sendMail({
  to: student.email, subject: `${req.user.name} is asking for your documents`, title: 'Document request',
  body: `<p><b>${esc(req.user.name)}</b> (faculty) is asking to see these documents:</p>
    <ul>${types.map((t) => `<li>${esc(TYPE_LABELS[t])}</li>`).join('')}</ul>
    ${reason ? `<p>Reason: <i>${esc(reason)}</i></p>` : ''}
    <p><a href="${config.appUrl}/access">Approve or deny the request</a>. You can approve only some of them.
    Each approved document can be opened <b>one time</b> within ${GRANT_HOURS} hours. Nothing is shared unless you approve.</p>`,
}).catch((e) => console.error(e.message));

// Every batch that has students, newest first: [{ group: '24MX', students: 4 }, ...]
r.get('/batches', async (req, res) => {
  const rows = await User.aggregate([
    { $match: { role: 'student', studentId: /^\d{2}MX\d{3}$/ } },
    { $group: { _id: { $substrCP: ['$studentId', 0, 4] }, n: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);
  res.json(rows.map((b) => ({ group: b._id, students: b.n })));
});

// How many students are in a batch (shown before faculty send a batch request).
r.get('/batch/:group', async (req, res) => {
  const group = batchOf(req.params.group);
  res.json({ group, students: await User.countDocuments({ role: 'student', studentId: inBatch(group) }) });
});

// Ask every student of a batch (e.g. all of 26MX) for the same documents. Each student answers for themselves.
r.post('/batch-request', async (req, res) => {
  const group = batchOf(req.body?.group);
  const types = requestedTypes(req.body);
  const reason = String(req.body?.reason ?? '').trim().slice(0, 300);
  const students = await User.find({ role: 'student', studentId: inBatch(group) });
  if (!students.length) throw httpError(404, `No students in batch ${group} yet.`);
  const waiting = new Set((await AccessRequest.find({ verifier: req.user._id, status: 'pending', student: { $in: students.map((s) => s._id) } })).map((a) => String(a.student)));
  const fresh = students.filter((s) => !waiting.has(String(s._id)));
  await AccessRequest.insertMany(fresh.map((s) => ({ verifier: req.user._id, student: s._id, reason, types })));
  for (const s of fresh) {
    await audit(req, 'access.request', `${req.user.name} asked batch ${group} for: ${labels(types)}${reason ? ` (${reason})` : ''}`, s._id);
    requestMail(req, s, types, reason);
  }
  res.status(201).json({ group, sent: fresh.length, skipped: students.length - fresh.length });
});

r.post('/students/:id/request', async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: 'student' });
  if (!student) throw httpError(404, 'Student not found.');
  const reason = String(req.body?.reason ?? '').trim().slice(0, 300);
  const types = requestedTypes(req.body);
  if (await AccessRequest.exists({ verifier: req.user._id, student: student._id, status: 'pending' })) {
    throw httpError(409, 'You already have a pending request for this student.');
  }
  await AccessRequest.create({ verifier: req.user._id, student: student._id, reason, types });
  await audit(req, 'access.request', `${req.user.name} asked for: ${labels(types)}${reason ? ` (${reason})` : ''}`, student._id);
  requestMail(req, student, types, reason);
  res.status(201).json({ ok: true });
});

export default r;
