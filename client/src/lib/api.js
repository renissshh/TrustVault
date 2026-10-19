// Small fetch wrapper: JSON in/out, cookies included, readable errors.
export async function api(path, { method = 'GET', body, form, raw } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body && JSON.stringify(body)),
  });
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.code === 'SESSION_EXPIRED') window.dispatchEvent(new Event('session-expired'));
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { code: data.code, status: res.status });
  }
  return data;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '-');
export const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
export const TYPE_LABELS = {
  pan: 'PAN Card', aadhaar: 'Aadhaar Card', license: 'Driving Licence', class10: '10th Marksheet', class12: '12th Marksheet',
  marksheet: 'Semester Marksheet', certificate: 'College Certificate', other: 'Other',
};
// The role is stored as "verifier"; people call it faculty.
export const ROLE_LABELS = { student: 'Student', verifier: 'Faculty', admin: 'Administrator' };

// Activity-log codes -> plain words for people.
const ACTIONS = {
  register: 'Account created', login: 'Signed in', 'login.failed': 'Failed sign-in attempt', 'password.change': 'Password changed',
  'password.reset': 'Password reset', 'profile.update': 'Profile updated', 'profile.photo': 'Profile photo', 'stepup': 'Security check passed', 'stepup.failed': 'Security check failed', 'vault.unlock': 'Vault unlocked', 'vault.pin': 'Vault PIN set', 'session.revoke': 'Device signed out',
  'backup-codes.regenerate': 'New backup codes', 'devices.forget': 'Trusted devices forgotten', 'account.delete': 'Account deleted',
  'document.upload': 'Document uploaded', 'document.view': 'Document viewed', 'document.delete': 'Document deleted',
  'document.retype': 'Document type changed', 'document.export': 'Documents emailed', 'document.verified': 'Document verified',
  'document.rejected': 'Document rejected', 'record.view': 'Viewed by a verifier', 'record.open': 'Record opened by a verifier',
  'share.create': 'Share link sent', 'share.view': 'Shared link opened', 'share.revoke': 'Share link revoked',
  'access.request': 'Access requested', 'access.approved': 'Access approved', 'access.denied': 'Access denied', 'access.revoked': 'Access revoked',
  'user.role': 'Role changed', 'user.unlock': 'Account unlocked', 'user.reset-2fa': 'Authenticator reset', 'invite.create': 'Invitation sent', 'invite.revoke': 'Invitation cancelled', 'invite.accept': 'Invitation accepted', 'ledger.check': 'Integrity check run',
};
export const actionLabel = (code) => ACTIONS[code] ?? code;
// "PAN Card (PAN Card)" -> "PAN Card"; "Aadhaar Card (Aadhaar Card, front + back)" -> "Aadhaar Card, front + back"
export const cleanDetail = (s = '') => s.replace(' | ', ' · ').replace(/^(.+?) \((.+)\)$/, (m, a, b) => (b.startsWith(a) ? a + b.slice(a.length) : m));

export const SECTIONS = [
  { title: 'Identity documents', types: ['pan', 'aadhaar', 'license'], note: 'Checked automatically, then verified by an authorized verifier.' },
  { title: 'School marksheets', types: ['class10', 'class12'], note: 'Stored safely as they are. Not checked or sent for verification.' },
  { title: 'College documents', types: ['marksheet', 'certificate'], note: 'Checked automatically, then verified by an authorized verifier.' },
  { title: 'Other documents', types: ['other'], note: 'Stored securely and checked for originality only - not sent for official verification.' },
];

export const NUMBER_FIELD = {
  pan: { label: 'PAN number', placeholder: 'ABCDE1234F', required: true },
  aadhaar: { label: 'Aadhaar number', placeholder: '1234 5678 9012', required: true },
  license: { label: 'Driving licence number', placeholder: 'MH12 20110012345', required: true },
  class10: { label: 'Register number (optional)', placeholder: '' },
  class12: { label: 'Register number (optional)', placeholder: '' },
  marksheet: { label: 'Roll / register number (optional)', placeholder: '' },
  certificate: { label: 'Certificate number (optional)', placeholder: '' },
  other: { label: 'Reference number (optional)', placeholder: '' },
};
