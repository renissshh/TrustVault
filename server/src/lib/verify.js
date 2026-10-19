// Automatic document checks: number formats, Aadhaar checksum, OCR text matching,
// originality (editing-software traces, PDF edits, digital signatures) and type detection.
// Real PAN/Aadhaar/DL lookups need licensed government APIs (NSDL / UIDAI / Parivahan), so a
// verifier still approves each identity document after reading this report.
import path from 'node:path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import config from '../config.js';

// Verhoeff checksum tables - the algorithm UIDAI uses for the last Aadhaar digit.
const D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export const verhoeff = (num) => [...num].reverse().reduce((c, ch, i) => D[c][P[i % 8][+ch]], 0) === 0;

// Indian state / UT codes used at the start of driving licence numbers.
const STATES = new Set('AN AP AR AS BR CG CH CT DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TG TN TR TS UA UK UP WB'.split(' '));

export const STRICT_TYPES = ['pan', 'aadhaar', 'license']; // need a valid number to upload
export const NUMBER_HINTS = {
  pan: 'PAN must look like ABCDE1234F.',
  aadhaar: 'This Aadhaar number is not valid (12 digits, checksum failed).',
  license: 'Driving licence number must look like MH12 20110012345 (state, RTO, year, 7 digits).',
};

export const normalizeNumber = (n = '') => String(n).toUpperCase().replace(/[^A-Z0-9]/g, '');

export function numberIsValid(type, n) {
  // PAN: 5 letters, 4 digits, 1 letter. 4th letter = holder type (P = person, C = company, ...).
  if (type === 'pan') return /^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/.test(n);
  if (type === 'aadhaar') return /^[2-9]\d{11}$/.test(n) && verhoeff(n);
  if (type === 'license') {
    const m = /^([A-Z]{2})\d{2}((?:19|20)\d{2})\d{7}$/.exec(n);
    return Boolean(m && STATES.has(m[1]) && +m[2] <= new Date().getFullYear());
  }
  return true;
}

export function maskNumber(type, n) {
  if (!n) return '';
  if (type === 'aadhaar') return `XXXX XXXX ${n.slice(-4)}`;
  if (type === 'license') return `${n.slice(0, 4)} ${'*'.repeat(n.length - 7)}${n.slice(-3)}`;
  return n.slice(0, 2) + '*'.repeat(Math.max(n.length - 4, 0)) + n.slice(-2);
}

let worker;
async function readText(buf, mime) {
  if (mime === 'application/pdf') return (await pdfParse(buf)).text;
  worker ??= createWorker('eng', 1, { cachePath: path.join(config.dataDir, '.ocr-cache') });
  const image = await sharp(buf).rotate().greyscale().png().toBuffer();
  return (await (await worker).recognize(image)).data.text;
}

const KEYWORDS = {
  pan: ['INCOME TAX', 'PERMANENT ACCOUNT', 'GOVT'],
  aadhaar: ['AADHAAR', 'GOVERNMENT OF INDIA', 'UNIQUE IDENTIFICATION', 'UIDAI', 'ENROLMENT'],
  license: ['DRIVING', 'LICENCE', 'LICENSE', 'TRANSPORT', 'MOTOR VEHICLE', 'UNION OF INDIA'],
  marksheet: ['MARKS', 'GRADE', 'UNIVERSITY', 'BOARD', 'CGPA', 'SGPA', 'RESULT', 'SEMESTER'],
  certificate: ['CERTIFICATE', 'CERTIFY', 'AWARDED', 'COMPLETION'],
};

// Guess what a document really is from its text (so "Other" uploads can be re-filed correctly).
export function detectType(text) {
  const flat = text.replace(/[^A-Z0-9]/g, '');
  const score = Object.fromEntries(Object.entries(KEYWORDS).map(([t, words]) => [t, words.filter((w) => text.includes(w)).length]));
  if (/[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]/.test(flat)) score.pan += 1;
  if ((text.match(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g) ?? []).some((n) => verhoeff(n.replace(/\s/g, '')))) score.aadhaar += 2;
  const [best, hits] = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return hits >= 2 ? best : null;
}

const EDITORS = /photoshop|gimp|canva|picsart|snapseed|pixlr|paint\.net|illustrator|inkscape|affinity|lightroom|ilovepdf|smallpdf|sejda|pdfescape|pdffiller|dochub|pdf-xchange editor|phantompdf/i;

// "Is this file original?" - looks for traces left by editing tools inside the file itself.
async function originalityChecks(buf, mime, add) {
  if (mime === 'application/pdf') {
    const raw = buf.toString('latin1');
    const signed = /\/ByteRange\s*\[/.test(raw) && /\/Type\s*\/Sig\b/.test(raw);
    const producers = [...raw.matchAll(/\/(?:Producer|Creator)\s*\(([^)]{0,120})\)/g)].map((m) => m[1]).join(' ');
    const editor = producers.match(EDITORS)?.[0];
    const revisions = (raw.match(/%%EOF/g) ?? []).length - (/\/Linearized/.test(raw) ? 1 : 0);
    if (signed) add('Digitally signed PDF (e.g. e-PAN / e-Aadhaar / DigiLocker)', true);
    add('No editing software in PDF metadata', !editor, editor ? `made with ${editor}` : producers.trim().slice(0, 60) || 'no producer info');
    add('PDF not modified after it was created', signed || revisions <= 1, `${Math.max(revisions, 1)} revision(s)`);
    return;
  }
  const meta = await sharp(buf).metadata();
  const traces = `${meta.exif?.toString('latin1') ?? ''} ${meta.xmp?.toString('latin1') ?? ''}`;
  const editor = traces.match(EDITORS)?.[0];
  add('No editing software in image metadata', !editor, editor ? `edited with ${editor}` : 'no editor traces found');
  add('Image resolution good enough to read', Math.min(meta.width, meta.height) >= 400, `${meta.width}x${meta.height}px`);
}

// `sources` = the original uploaded file(s): [front] or [front, back].
// Printed on most cards, so they say nothing about whose card it is.
const COMMON = new Set(`GOVERNMENT INDIA INCOME TAX DEPARTMENT PERMANENT ACCOUNT NUMBER CARD NAME FATHER FATHERS MOTHER DATE BIRTH DOB
  MALE FEMALE AADHAAR UNIQUE IDENTIFICATION AUTHORITY ENROLMENT DRIVING LICENCE LICENSE UNION TRANSPORT VALID TILL ADDRESS
  DEMO SAMPLE SPECIMEN NOT REAL DOCUMENT CLASS VEHICLE ISSUE ISSUED HOLDER SIGNATURE GOVT THE AND FOR WITH FROM HELP
  MOTOR GEAR LIGHT BLOOD GROUP MARKS STATEMENT ROLL CERTIFICATE UNIVERSITY BOARD SEMESTER RESULT GRADE COLLEGE
  THIS THAT CERTIFY CERTIFIED HAS HAVE YEAR YEARS PASSED EXAMINATION REGISTER NUMBER OFFICE PIN CODE STATE CITY GENDER
  TOTAL PROGRAMME DEPARTMENT COMPUTER APPLICATIONS`.split(/\s+/));
// Distinctive words (names, places) read from a document.
// Same word, allowing one misread letter in longer words (OCR often reads I as L, O as 0...).
const near = (a, b) => a === b || (a.length >= 4 && a.length === b.length && [...a].filter((c, i) => c !== b[i]).length === 1);
// The entered number is somewhere in the OCR text, allowing one misread, extra or missing character
// (OCR reads the space in "KL07 2021…" as O, or 0 as O). Format and checksum are still checked exactly.
function textHasNumber(flat, number) {
  if (flat.includes(number)) return true;
  if (number.length < 10) return false;
  const within1 = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
  };
  for (let start = 0; start + number.length - 1 <= flat.length; start++) {
    for (const len of [number.length - 1, number.length, number.length + 1]) if (within1(flat.slice(start, start + len), number)) return true;
  }
  return false;
}
const wordsOf = (text) => [...new Set((text.match(/[A-Z]{3,}/g) ?? []).filter((w) => !COMMON.has(w)))].slice(0, 400);

// Checks look only at documents. The TrustVault account name is never compared: people may sign up under any
// display name. Instead a document is compared with the owner's OTHER documents (`others`): a PAN, an Aadhaar and a
// licence of the same person share the holder's name.
export async function runChecks({ type, number, sources, duplicate, others = [] }) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

  add('File is unique (not uploaded by another account)', !duplicate);
  for (const [i, { buf, mime }] of sources.entries()) {
    const side = sources.length > 1 ? (i ? 'Back: ' : 'Front: ') : '';
    await originalityChecks(buf, mime, (name, ok, detail) => add(side + name, ok, detail))
      .catch((e) => add(`${side}File structure readable`, false, e.message));
  }

  if (type === 'pan') {
    add('PAN format is valid (ABCDE1234F)', numberIsValid('pan', number));
  }
  if (type === 'aadhaar') add('Aadhaar format + Verhoeff checksum valid', numberIsValid('aadhaar', number));
  if (type === 'license') add('Licence number valid (state code, RTO, issue year)', numberIsValid('license', number), number.slice(0, 2));

  let text = '';
  for (const { buf, mime } of sources) {
    try {
      text += `${await readText(buf, mime)}\n`.toUpperCase();
    } catch (e) {
      console.warn('OCR failed:', e.message);
    }
  }
  const flat = text.replace(/[^A-Z0-9]/g, '');
  add('Text is readable (OCR)', flat.length >= 20, `${flat.length} characters read`);

  // "Other" documents only get originality checks - nothing official to match against.
  if (type !== 'other') {
    if (number) add('Entered number appears in the document', textHasNumber(flat, number));
    if (KEYWORDS[type]) add('Official keywords present', KEYWORDS[type].some((k) => text.includes(k)));
  }

  const words = wordsOf(text);
  if (type !== 'other' && others.length && words.length) {
    const mine = new Set(words);
    const best = others.map((o) => ({ ...o, shared: o.words.filter((w) => mine.has(w) || words.some((m) => near(m, w))) })).sort((a, b) => b.shared.length - a.shared.length)[0];
    add('Matches your other documents', best.shared.length >= 2,
      best.shared.length ? `shares ${best.shared.slice(0, 4).join(' ')} with your ${best.label}` : 'no name or detail in common with your other documents');
  }

  const detected = detectType(text);
  return {
    state: 'done',
    score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100),
    checks,
    detectedType: detected && detected !== type ? detected : undefined,
    words,
  };
}
