import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import shareRoutes from './routes/shares.js';
import recordRoutes from './routes/records.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import accessRoutes from './routes/access.js';
import devMailRoutes from './routes/devmail.js';
import { startJobs } from './jobs.js';

const app = express();
app.set('trust proxy', config.trustProxy);
app.use(helmet({
  contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'frame-src': ["'self'", 'blob:'], 'object-src': ["'self'", 'blob:'] } },
}));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
// 1000 requests per 15 minutes per address. API_RATE_LIMIT raises it for automated test runs only.
app.use('/api', rateLimit({ windowMs: 15 * 60e3, limit: Number(process.env.API_RATE_LIMIT || 1000), message: { error: 'Too many requests. Wait a few minutes and try again.' } }));

app.use('/api/auth', authRoutes);
app.use('/api/documents', requireAuth, documentRoutes);
app.use('/api/shares', requireAuth, shareRoutes);
app.use('/api/records', requireAuth, requireRole('verifier', 'admin'), recordRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/access', requireAuth, accessRoutes);
app.use('/api/public', publicRoutes);
if (config.demoMailbox) app.use('/api/dev/mail', devMailRoutes);
app.get('/api/dev/mailbox', (req, res) => res.json({ enabled: config.demoMailbox }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// After "npm run build", the same server also serves the React website.
const web = path.join(import.meta.dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(web)) {
  app.use(express.static(web));
  app.use((req, res) => res.sendFile(path.join(web, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB.' : err.message });
  }
  if (err.name === 'CastError') return res.status(404).json({ error: 'Not found.' });
  if (err.code === 'EAUTH') {
    console.error('Email sending failed:', err.message);
    return res.status(502).json({ error: 'The server could not send email. Check the email settings (SMTP_USER and SMTP_PASS, or BREVO_API_KEY and MAIL_FROM).' });
  }
  if (!err.status) console.error(err);
  res.status(err.status || 500).json(err.status ? { error: err.message, code: err.code } : { error: 'Something went wrong on the server.' });
});

try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
} catch {
  console.error(`Cannot connect to MongoDB at ${config.mongoUri}. Is the MongoDB service running?`);
  process.exit(1);
}
app.listen(config.port, () => {
  console.log(`TrustVault API running on http://localhost:${config.port}`);
  if (!config.smtp.user && !config.brevoKey) console.log('No SMTP set: emails (and OTP codes) are printed here and saved in server/dev-mail/');
});
startJobs();
