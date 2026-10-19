import { Audit } from '../models.js';

export const httpError = (status, message, code) => Object.assign(new Error(message), { status, ...(code && { code }) });

export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const maskEmail = (email) =>
  email.replace(/^(.)(.*)(@.*)$/, (_, first, rest, domain) => first + '*'.repeat(Math.min(rest.length, 6)) + domain);

export const audit = (req, action, detail = '', subject = req.user?._id) =>
  Audit.create({ user: req.user?._id, subject, action, detail, ip: req.ip });

// MCA roll numbers: 2-digit joining year + "MX" + 3-digit number, e.g. 23MX347 (joined 2023, number 347).
// Only these students may sign up; the year cannot be in the future. Returns the cleaned number or throws a 400.
export function rollNumber(value) {
  const roll = String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
  const m = /^(\d{2})MX(\d{3})$/.exec(roll);
  if (!m) throw httpError(400, 'Enter your MCA roll number, like 23MX347: the 2-digit year you joined, MX, then your 3-digit number.');
  if (+m[1] > new Date().getFullYear() % 100) throw httpError(400, `The year in ${roll} is in the future. Check your roll number.`);
  return roll;
}

export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  studentId: u.studentId,
  avatarV: u.avatarV || 0,
  memberSince: u.createdAt,
  hasVaultPin: Boolean(u.vaultPinHash),
  backupCodesLeft: u.backupCodes?.length ?? 0,
});
