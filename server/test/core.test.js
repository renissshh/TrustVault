import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-secret';
process.env.VAULT_KEY ||= '11'.repeat(32);
const { numberIsValid, maskNumber, normalizeNumber, detectType } = await import('../src/lib/verify.js');
const { encrypt, decrypt, sha256 } = await import('../src/lib/crypto.js');
const { sniffType } = await import('../src/lib/files.js');

test('PAN format', () => {
  assert.equal(numberIsValid('pan', 'ABCPE1234F'), true);
  assert.equal(numberIsValid('pan', 'ABCXE1234F'), false); // X is not a valid holder type
  assert.equal(numberIsValid('pan', 'ABC1234567'), false);
});

test('Aadhaar Verhoeff checksum', () => {
  assert.equal(numberIsValid('aadhaar', '234123412346'), true);
  assert.equal(numberIsValid('aadhaar', '234123412347'), false); // last digit changed
  assert.equal(numberIsValid('aadhaar', '123412341234'), false); // cannot start with 0 or 1
});

test('Driving licence format', () => {
  assert.equal(numberIsValid('license', 'MH1220110012345'), true);
  assert.equal(numberIsValid('license', 'XX1220110012345'), false); // unknown state code
  assert.equal(numberIsValid('license', 'MH1230990012345'), false); // impossible issue year
  assert.equal(numberIsValid('license', 'MH12201100123'), false); // too short
  assert.equal(maskNumber('license', 'MH1220110012345'), 'MH12 ********345');
});

test('document type is detected from its text', () => {
  assert.equal(detectType('INCOME TAX DEPARTMENT GOVT. OF INDIA ABCPS1234F'), 'pan');
  assert.equal(detectType('UNION OF INDIA DRIVING LICENCE TRANSPORT DEPARTMENT'), 'license');
  assert.equal(detectType('GOVERNMENT OF INDIA AADHAAR 2341 2341 2346'), 'aadhaar');
  assert.equal(detectType('GROCERY BILL TOTAL 450'), null);
});

test('numbers are normalized and masked', () => {
  assert.equal(normalizeNumber('2341 2341-2346'), '234123412346');
  assert.equal(maskNumber('aadhaar', '234123412346'), 'XXXX XXXX 2346');
  assert.equal(maskNumber('pan', 'ABCPE1234F'), 'AB******4F');
});

test('AES-256-GCM round trip and tamper detection', () => {
  const data = Buffer.from('secret document');
  const enc = encrypt(data);
  assert.deepEqual(decrypt(enc), data);
  enc[enc.length - 1] ^= 1; // flip one bit
  assert.throws(() => decrypt(enc));
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('file type is detected from content, not the name', () => {
  assert.equal(sniffType(Buffer.from('%PDF-1.7 hello world')), 'application/pdf');
  assert.equal(sniffType(Buffer.from('MZ fake.exe renamed.pdf')), null);
});

test('roll number: 2-digit year, MX, 3 digits, year not in the future', async () => {
  const { rollNumber } = await import('../src/lib/util.js');
  assert.equal(rollNumber(' 23mx-347 '), '23MX347');
  assert.throws(() => rollNumber('23MX34'), { status: 400 });
  assert.throws(() => rollNumber('MX23347'), { status: 400 });
  assert.throws(() => rollNumber(undefined), { status: 400 });
  const next = String((new Date().getFullYear() + 1) % 100).padStart(2, '0');
  assert.throws(() => rollNumber(`${next}MX001`), /future/);
});
