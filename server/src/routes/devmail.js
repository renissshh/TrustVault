// Demo mailbox for running TrustVault on a laptop without real email: lists the emails saved in dev-mail/.
// Only mounted when DEMO_MAILBOX=1 and no email service is configured (see config.js), never on a real server.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import config from '../config.js';
import { httpError } from '../lib/util.js';

const r = Router();
const dir = path.join(config.dataDir, 'dev-mail');
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

r.get('/', async (req, res) => {
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.html')).sort().reverse().slice(0, 200);
  const mails = await Promise.all(files.map(async (file) => {
    const head = (await fs.readFile(path.join(dir, file), 'utf8')).slice(0, 600);
    const [, to = '', subject = ''] = head.match(/<b>To:<\/b> (.*?)<br><b>Subject:<\/b> (.*?)<\/p>/) ?? [];
    return { file, to, subject: unescape(subject), at: new Date(Number(file.split('-')[0])) };
  }));
  res.json(mails);
});

r.get('/:file', async (req, res) => {
  const file = path.basename(req.params.file);
  if (!file.endsWith('.html')) throw httpError(404, 'Not found');
  const html = await fs.readFile(path.join(dir, file), 'utf8').catch(() => null);
  if (html == null) throw httpError(404, 'Not found');
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).send(html);
});

export default r;
