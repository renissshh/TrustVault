import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  studentId: { type: String, trim: true },
  passwordHash: String,
  role: { type: String, enum: ['student', 'verifier', 'admin'], default: 'student' },
  emailVerified: { type: Boolean, default: false },
  totpSecret: String, // AES-encrypted
  totpEnabled: { type: Boolean, default: false },
  lastTotp: String, // blocks replaying the same code
  backupCodes: [String], // SHA-256 hashes
  vaultPinHash: String,
  pinFails: { type: Number, default: 0 },
  pinLockedUntil: Date,
  failedLogins: { type: Number, default: 0 },
  lockedUntil: Date,
  knownDevices: [String],
  trustVersion: { type: Number, default: 0 }, // bump to forget all "trusted for 30 days" devices
  consentAt: Date, // when the user accepted the privacy policy
  avatar: { type: Buffer, select: false }, // 256 px WebP profile photo
  avatarV: { type: Number, default: 0 }, // 0 = no photo; otherwise changes on every upload (cache-busting)
}, { timestamps: true }));

// A faculty member (role "verifier") ticks the document types they need and asks the student.
// The student approves all or some of them. Each approved document can then be opened ONE time by that
// faculty member (within 24 hours); after that they have to ask again.
export const AccessRequest = model('AccessRequest', new Schema({
  verifier: { ...ref('User'), index: true },
  student: { ...ref('User'), index: true },
  reason: String,
  types: [String], // document types asked for
  granted: [String], // document types the student approved
  opened: [Schema.Types.ObjectId], // documents already opened (one-time access)
  status: { type: String, enum: ['pending', 'approved', 'denied', 'revoked', 'used'], default: 'pending' },
  expiresAt: Date,
}, { timestamps: true }));

// An admin invites someone to join as a verifier or admin. The emailed link carries a one-time token;
// only its hash is stored, it works for that email address only, and it expires after 48 hours.
export const Invite = model('Invite', new Schema({
  email: { type: String, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['verifier', 'admin'] },
  tokenHash: { type: String, index: true },
  invitedBy: ref('User'),
  expiresAt: Date,
  usedAt: Date,
  revoked: { type: Boolean, default: false },
}, { timestamps: true }));

export const Otp = model('Otp', new Schema({
  key: { type: String, index: true },
  codeHash: String,
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, expires: 0 }, // MongoDB deletes it automatically
}));

export const Session = model('Session', new Schema({
  user: ref('User'),
  ip: String,
  device: String,
  location: String,
  expiresAt: Date,
  revoked: { type: Boolean, default: false },
  vaultUnlocked: { type: Boolean, default: false }, // vault PIN entered once this session
  elevatedUntil: Date, // security check (password + email code + Authenticator) passed - sensitive changes allowed until then
}, { timestamps: true }));

const check = new Schema({ name: String, ok: Boolean, detail: String }, { _id: false });

export const Document = model('Document', new Schema({
  owner: { ...ref('User'), index: true },
  type: { type: String, enum: ['pan', 'aadhaar', 'license', 'class10', 'class12', 'marksheet', 'certificate', 'other'] },
  title: String,
  numberEnc: String,
  numberMasked: String,
  originalName: String,
  sides: { type: Number, default: 1 }, // 2 = front + back merged into one file
  mime: String,
  size: Number,
  storedName: String,
  sha256: { type: String, index: true },
  // "stored" = Other documents: kept safely and checked for originality, but not sent for official verification.
  status: { type: String, enum: ['pending', 'verified', 'rejected', 'stored'], default: 'pending' },
  autoCheck: { state: { type: String, default: 'running' }, score: Number, checks: [check], detectedType: String },
  wordsEnc: String, // encrypted list of words read from the document, used to cross-check the owner's other documents
  reviewNote: String,
  reviewedBy: ref('User'),
  reviewedAt: Date,
  verifyCode: { type: String, index: true },
  expiryDate: Date,
  reminded: Boolean,
  tampered: { type: Boolean, default: false },
}, { timestamps: true }));

// Hash-chained ledger: every block stores the hash of the previous one.
export const Block = model('Block', new Schema({
  index: { type: Number, unique: true },
  action: String,
  docId: Schema.Types.ObjectId,
  fileHash: String,
  prevHash: String,
  hash: String,
  at: Date,
}));

export const Audit = model('Audit', new Schema({
  user: ref('User'), // who did it
  subject: { ...ref('User'), index: true }, // whose data it was
  action: String,
  detail: String,
  ip: String,
}, { timestamps: true }));

export const Share = model('Share', new Schema({
  doc: ref('Document'),
  owner: ref('User'),
  recipient: String,
  tokenHash: { type: String, index: true },
  expiresAt: Date,
  maxViews: { type: Number, default: 5 },
  views: { type: Number, default: 0 },
  revoked: { type: Boolean, default: false },
}, { timestamps: true }));

export const Export = model('Export', new Schema({
  user: ref('User'),
  tokenHash: { type: String, index: true },
  storedName: String,
  expiresAt: Date,
}));
