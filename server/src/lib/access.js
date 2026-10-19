// Consent rules: only faculty (role "verifier") can open a student's documents, and only through an approved request
// that covers the document's type. Each shared document opens ONE time per request (within 24 hours); then the
// faculty member asks again. Administrators manage accounts but never open students' files.
import { AccessRequest, Document } from '../models.js';
import { httpError } from './util.js';

export const STAFF = ['verifier'];
export const GRANT_HOURS = 24;

// Approved, unexpired requests from this faculty member to this student.
export const activeGrants = (viewer, studentId) =>
  AccessRequest.find({ verifier: viewer._id, student: studentId, status: 'approved', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });

// The grant (if any) that still allows opening this document once.
export const grantFor = (grants, doc) => grants.find((g) => g.granted.includes(doc.type) && !g.opened.some((id) => id.equals(doc._id)));

// Returns the grant to mark as used once the document has been shown (null for verification duty).
export async function assertDocAccess(viewer, doc) {
  if (!STAFF.includes(viewer.role)) throw httpError(403, 'You cannot open this document.');
  const grants = await activeGrants(viewer, doc.owner._id);
  const grant = grantFor(grants, doc);
  if (grant) return grant;
  if (await AccessRequest.exists({ verifier: viewer._id, student: doc.owner._id, opened: doc._id })) {
    throw httpError(403, 'You already opened this document once. Send a new request to see it again.');
  }
  throw httpError(403, 'The student has not given you access to this document. Send a request for it.');
}

// After a document was shown: remember it, and close the request once every approved document was opened.
export async function useGrant(grant, doc) {
  grant.opened.push(doc._id);
  const left = await Document.countDocuments({ owner: grant.student, type: { $in: grant.granted }, _id: { $nin: grant.opened } });
  if (!left) grant.status = 'used';
  await grant.save();
}
