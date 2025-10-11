import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
const SMTP_PORT = Number(process.env.ZOHO_SMTP_PORT || 465);
const SMTP_USER = process.env.ZOHO_SMTP_USER || process.env.EMAIL_USER || '';
const SMTP_PASS = process.env.ZOHO_SMTP_PASS || process.env.EMAIL_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || `no-reply@${(process.env.PUBLIC_BASE_URL||'').replace(/^https?:\/\//,'')}`;

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[email] SMTP credentials not set; emails will not be sent');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  try {
    const tx = getTransporter();
    if (!tx) {
      console.log('[email] Skipping send (no transporter):', { to, subject });
      return { skipped: true };
    }
    const info = await tx.sendMail({ from: FROM_EMAIL, to, subject, text, html });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    console.error('[email] sendMail error:', e);
    return { ok: false, error: e?.message || 'send error' };
  }
}

