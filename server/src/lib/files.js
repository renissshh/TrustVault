import sharp from 'sharp';
import archiver from 'archiver';
import zipEncrypted from 'archiver-zip-encrypted';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { esc, httpError } from './util.js';

archiver.registerFormat('zip-encrypted', zipEncrypted);

export const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Detect the real file type from its first bytes (the browser-supplied type can be faked).
export function sniffType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.subarray(1, 4).toString() === 'PNG') return 'image/png';
  if (buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

// Burns "viewer email | time" into every page/image, so a leaked screenshot shows who leaked it.
export async function watermark(buf, mime, label) {
  if (mime === 'application/pdf') {
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      for (let y = 0; y < height; y += 110) {
        for (let x = -150; x < width; x += 330) {
          page.drawText(label, { x, y, size: 13, font, color: rgb(0.85, 0, 0.3), opacity: 0.22, rotate: degrees(25) });
        }
      }
    }
    return Buffer.from(await pdf.save());
  }
  const base = await sharp(buf).rotate().toBuffer();
  const { width, height } = await sharp(base).metadata();
  const size = Math.max(14, Math.round(width / 35));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><pattern id="w" width="${Math.ceil(label.length * size * 0.62) + size * 3}" height="${size * 7}" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
      <text x="0" y="${size * 4}" font-family="Arial" font-weight="bold" font-size="${size}" fill="#e11d48" fill-opacity="0.3">${esc(label)}</text>
    </pattern></defs><rect width="100%" height="100%" fill="url(#w)"/></svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg) }]).toBuffer();
}

const QUALITY = { medium: { max: 1600, q: 70 }, small: { max: 1000, q: 45 } };

// Returns { buf, ext }. Images are resized + re-encoded as JPEG; PDFs are repacked.
export async function compress(buf, mime, level) {
  if (level !== 'original' && mime.startsWith('image/')) {
    const { max, q } = QUALITY[level];
    const out = await sharp(buf).rotate()
      .resize(max, max, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
    return { buf: out, ext: 'jpg' };
  }
  if (level !== 'original' && mime === 'application/pdf') {
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
    const out = Buffer.from(await pdf.save({ useObjectStreams: true }));
    if (out.length < buf.length) return { buf: out, ext: 'pdf' };
  }
  return { buf, ext: EXT[mime] };
}

// Shrink a file to fit under `limit` bytes (e.g. a form that says "max 200 KB").
// Photos: lower JPEG quality first, then smaller dimensions. PDFs can only be tidied, so they may stay larger
// - the caller reports that. Returns { buf, ext, fits }.
export async function compressTo(buf, mime, limit) {
  if (buf.length <= limit) return { buf, ext: EXT[mime], fits: true };
  if (mime.startsWith('image/')) {
    const img = sharp(buf).rotate().flatten({ background: '#ffffff' });
    const { width = 2000, height = 2000 } = await img.metadata();
    let max = Math.min(2400, Math.max(width, height));
    let out = buf;
    while (max >= 320) {
      for (const q of [82, 70, 58, 46, 36]) {
        out = await sharp(buf).rotate().resize(max, max, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' })
          .jpeg({ quality: q, mozjpeg: true }).toBuffer();
        if (out.length <= limit) return { buf: out, ext: 'jpg', fits: true };
      }
      max = Math.round(max * 0.75);
    }
    return { buf: out, ext: 'jpg', fits: false };
  }
  const { buf: out, ext } = await compress(buf, mime, 'small');
  return { buf: out, ext, fits: out.length <= limit };
}

// Front + back of a card become one file: two PDFs -> one PDF, two photos -> one tall image.
export async function mergeSides(front, frontMime, back, backMime) {
  if (frontMime === 'application/pdf' && backMime === 'application/pdf') {
    const out = await PDFDocument.create();
    for (const src of [front, back]) {
      const doc = await PDFDocument.load(src, { ignoreEncryption: true });
      (await out.copyPages(doc, doc.getPageIndices())).forEach((p) => out.addPage(p));
    }
    return { buf: Buffer.from(await out.save()), mime: 'application/pdf' };
  }
  if (frontMime === 'application/pdf' || backMime === 'application/pdf') throw httpError(400, 'Upload both sides as photos, or both as PDF.');
  const imgs = await Promise.all([front, back].map((b) => sharp(b).rotate().resize({ width: 1600, withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true })));
  const gap = 24;
  const width = Math.max(...imgs.map((i) => i.info.width));
  const height = imgs[0].info.height + gap + imgs[1].info.height;
  const buf = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(imgs.map((i, n) => ({ input: i.data, left: Math.round((width - i.info.width) / 2), top: n ? imgs[0].info.height + gap : 0 })))
    .jpeg({ quality: 90 }).toBuffer();
  return { buf, mime: 'image/jpeg' };
}

// AES-256 encrypted when a password is given (opens with 7-Zip, WinRAR or a phone file manager).
export function zip(entries, password) {
  return new Promise((resolve, reject) => {
    const archive = password
      ? archiver.create('zip-encrypted', { zlib: { level: 9 }, encryptionMethod: 'aes256', password })
      : archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (c) => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const e of entries) archive.append(e.buf, { name: e.name });
    archive.finalize();
  });
}
