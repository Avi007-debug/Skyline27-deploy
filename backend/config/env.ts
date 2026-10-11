import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

function list(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function secret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    throw new Error(`[Config] ${name} must be set in production.`);
  }
  return devFallback;
}

// Google OAuth client IDs are public identifiers, not secrets.
const DEFAULT_GOOGLE_CLIENT_ID = '614014299614-n10khe2om4g50ehpqb6h82tdtumkh5ot.apps.googleusercontent.com';

/**
 * Centralised runtime configuration. Secrets are read only here so the rest of
 * the codebase never touches process.env directly.
 */
export const env = {
  isProd,
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: secret('JWT_SECRET', 'skyline_dev_only_jwt_secret'),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '30d') as any,
  googleClientIds: list(process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID).concat(
    process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID ? [] : [DEFAULT_GOOGLE_CLIENT_ID]
  ),
  corsOrigins: list(process.env.CORS_ORIGINS),
  /** Public address of the single SkylineOS website (used in emailed links). */
  siteUrl: (process.env.SITE_URL || process.env.CLUB_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SkylineOS <no-reply@skylineos.app>',
  },
  /** Minutes the campus clock is ahead of UTC; see utils/time.ts. */
  // Campus wall clock vs UTC, in minutes. Defaults to India (UTC+5:30); set 0 if the campus is on UTC.
  campusUtcOffsetMinutes: Number.isFinite(parseInt(process.env.CAMPUS_UTC_OFFSET_MINUTES ?? '', 10)) ? parseInt(process.env.CAMPUS_UTC_OFFSET_MINUTES as string, 10) : 330,
  cronSecret: process.env.CRON_SECRET || '',
  uploadSecret: process.env.UPLOAD_SECRET || '',
};
