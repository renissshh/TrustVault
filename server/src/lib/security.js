import crypto from 'node:crypto';
import { Otp } from '../models.js';
import { sendMail } from './mail.js';
import { sha256, randomCode } from './crypto.js';
import { esc } from './util.js';

// Loopback, private, link-local (IPv4 and IPv6) and unique-local IPv6; IPv4-mapped addresses are unwrapped first.
const PRIVATE_IP = /^(::1$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|f[cd]|fe[89ab])/i;

// Free geolocation API from the public-apis list (ip-api.com, no key needed).
export async function locate(ip = '') {
  if (PRIVATE_IP.test(ip.replace(/^::ffff:/i, ''))) return 'Local network';
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,country`, { signal: AbortSignal.timeout(2500) });
    const j = await res.json();
    return j.status === 'success' ? `${j.city}, ${j.country}` : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// Mobile Chrome, Firefox and Edge use their own tokens (CriOS, FxiOS, EdgiOS, EdgA) and also say "Safari".
export function describeDevice(ua = '') {
  const browser = /edg(a|ios)?\//i.test(ua) ? 'Edge' : /(chrome|crios)\//i.test(ua) ? 'Chrome' : /(firefox|fxios)\//i.test(ua) ? 'Firefox' : /safari\//i.test(ua) ? 'Safari' : 'Browser';
  const os = /windows/i.test(ua) ? 'Windows' : /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

// Have I Been Pwned (public-apis list). k-anonymity: only the first 5 chars of the SHA-1 leave the server.
export async function isPwned(password) {
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { signal: AbortSignal.timeout(3000) });
    return (await res.text()).split('\n').some((line) => line.startsWith(hash.slice(5)));
  } catch {
    return false;
  }
}

// Disify (public-apis list): rejects throw-away inboxes like mailinator so OTPs reach a real person.
export async function isDisposableEmail(email) {
  try {
    const res = await fetch(`https://www.disify.com/api/email/${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(3000) });
    return (await res.json()).disposable === true;
  } catch {
    return false; // API down: don't block sign-ups
  }
}

export async function sendOtp({ key, to, name }) {
  const code = randomCode();
  await Otp.deleteMany({ key });
  await Otp.create({ key, codeHash: sha256(code), expiresAt: Date.now() + 5 * 60e3 });
  await sendMail({
    to,
    subject: `${code} is your TrustVault code`,
    title: 'Your one-time code',
    body: `<p>Hi ${esc(name)},</p><p>Your code is:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:8px 0">${code}</p>
      <p>It expires in 5 minutes. Never share it with anyone, including TrustVault staff.</p>`,
  });
}

// Atomic: the code is deleted in the same query that matches it, so two parallel requests
// with the right code cannot both pass (findOne + deleteOne left a gap between read and delete).
export async function checkOtp(key, code) {
  const codeHash = sha256(String(code ?? '').trim());
  if (await Otp.findOneAndDelete({ key, codeHash, expiresAt: { $gt: new Date() } })) return true;
  const otp = await Otp.findOneAndUpdate({ key }, { $inc: { attempts: 1 } }, { new: true });
  if (otp && otp.attempts >= 5) await Otp.deleteOne({ _id: otp._id }); // 5 wrong guesses kills the code
  return false;
}
