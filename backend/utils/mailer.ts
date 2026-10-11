import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Captured messages when MAIL_TRANSPORT=memory (used by automated tests). */
export const outbox: OutgoingMail[] = [];

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!env.smtp.host) return null;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

/**
 * Send an email. Delivery details stay on the backend. When no SMTP server is
 * configured the message is logged in development (never in production, where
 * logging a reset link would leak it) so flows remain testable locally.
 * Returns true if the message was handed to a transport.
 */
export async function sendMail(mail: OutgoingMail): Promise<boolean> {
  if (process.env.MAIL_TRANSPORT === 'memory') {
    outbox.push(mail);
    return true;
  }
  const t = getTransporter();
  if (!t) {
    if (env.isProd) {
      console.error(`[Mail] SMTP is not configured; email "${mail.subject}" was not sent.`);
    } else {
      console.log(`[Mail:dev] To: ${mail.to} | ${mail.subject}\n${mail.text}`);
    }
    return false;
  }
  try {
    await t.sendMail({ from: env.smtp.from, ...mail });
    return true;
  } catch (err: any) {
    console.error(`[Mail] Failed to send "${mail.subject}":`, err?.message);
    return false;
  }
}
