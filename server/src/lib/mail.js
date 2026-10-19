import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import config from '../config.js';

const { host, port, user, pass } = config.smtp;
const transport = user && nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
const devDir = path.join(config.dataDir, 'dev-mail');
// The app icon travels inside each email (cid:) so it shows even when remote images are blocked.
const logoPath = path.join(import.meta.dirname, '..', '..', '..', 'client', 'public', 'icon-192.png');
const logo = await fs.access(logoPath).then(() => ({ filename: 'trustvault.png', path: logoPath, cid: 'tv-logo' }), () => null);

const layout = (title, body, logo) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px">
  <table role="presentation" style="margin:0 0 14px;border-collapse:collapse"><tr>
    ${logo ? '<td style="padding:0 10px 0 0"><img src="cid:tv-logo" width="40" height="40" alt="" style="display:block;border-radius:10px"></td>' : ''}
    <td style="font-size:22px;color:#111;letter-spacing:-0.5px">Trust<b style="color:#7c3aed">Vault</b></td>
  </tr></table>
  <h3 style="margin:0 0 16px;color:#111">${title}</h3>
  ${body}
  <p style="color:#6b7280;font-size:12px;margin-top:24px">If this wasn't you, change your password and contact your administrator.</p>
</div>`;

// Demo accounts (@trustvault.demo) cannot receive real email, so their mail stays on this computer
// (server/dev-mail/) and "npm run demo:codes" shows their sign-in codes.
const demoAddress = (to) => /@trustvault\.demo$/i.test(to);

export async function sendMail({ to, subject, title = subject, body, attachments = [] }) {
  if (config.brevoKey && !demoAddress(to)) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': config.brevoKey, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ sender: { name: 'TrustVault', email: config.mailFrom }, to: [{ email: to }], subject, htmlContent: layout(title, body),
        ...(attachments.length && { attachment: attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') })) }) }),
    });
    if (!res.ok) throw Object.assign(new Error(`Brevo answered ${res.status}: ${(await res.text()).slice(0, 200)}`), { code: 'EAUTH' });
    return;
  }
  const html = layout(title, body, logo);
  if (transport && !demoAddress(to)) return transport.sendMail({ from: `"TrustVault" <${user}>`, to, subject, html, attachments: logo ? [...attachments, logo] : attachments });

  // Dev mode (no SMTP configured): "deliver" the email into server/dev-mail/ so the app still works.
  await fs.mkdir(devDir, { recursive: true });
  const stamp = Date.now();
  await fs.writeFile(path.join(devDir, `${stamp}-${to}.html`), `<p><b>To:</b> ${to}<br><b>Subject:</b> ${subject}</p>${html}`);
  for (const a of attachments) await fs.writeFile(path.join(devDir, `${stamp}-${a.filename}`), a.content);
  console.log(`\n[dev mail] to ${to}: ${subject}${attachments.length ? ` (+${attachments.length} attachment saved in server/dev-mail)` : ''}\n`);
}
