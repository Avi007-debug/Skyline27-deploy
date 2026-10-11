process.env.MAIL_TRANSPORT = 'memory';
process.env.SUPABASE_SERVICE_ROLE_KEY = ''; // never touch real storage from tests
import crypto from 'crypto';
import prisma from '../config/db';
import app from '../index';
import { outbox } from '../utils/mailer';
import { hashToken } from '../utils/crypto';
import { check, createRunner, eq, eventBody, makeUser, seeded, startServer, uid } from './helpers';

/** Registration keys, sign-in, password recovery, uploads and account-takeover guards. */
async function main() {
  const srv = await startServer(app);
  const { test, summary } = createRunner('🔑 Auth: registration keys, recovery, sign-in hardening');
  const { api } = srv;

  const admin = await seeded('admin@skyline.local');
  const head = await seeded('aarav.gdg@college.edu');
  const student = await makeUser('authstudent');
  const clubsToClean: string[] = [];
  const profilesToClean: string[] = [student.id];
  const keysToClean: string[] = [];

  const genKey = async (body: Record<string, unknown> = {}) => {
    const r = await api('POST', '/admin/registration-keys/generate', { token: admin.token, body });
    if (r.status === 201) keysToClean.push(r.data.key.id);
    return r;
  };
  const newClubBody = (key: string) => ({ name: `KeyClub ${uid()}`, email: `keyclub_${uid()}@test.skyline`, password: 'Password1', registrationKey: key });

  try {
    // ── Registration keys ────────────────────────────────────────────────────
    await test('generated key response IS the stored key (what the UI displays is what exists)', async () => {
      const r = await genKey();
      eq(r.status, 201, 'status');
      const shown = r.data.key;
      check(/^SKYLINE-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(shown.code), `unexpected format ${shown.code}`);
      const row = await prisma.registrationKey.findUniqueOrThrow({ where: { id: shown.id } });
      eq(row.code, shown.code, 'DB code equals response code');
      eq(shown.status, 'AVAILABLE', 'status');
      eq(row.createdById, admin.id, 'creator recorded');
      // A second generation must return a different key, not an older one.
      const r2 = await genKey();
      check(r2.data.key.code !== shown.code && r2.data.key.id !== shown.id, 'second key must be new');
      const listed = await api('GET', `/admin/registration-keys?search=${r2.data.key.code}`, { token: admin.token });
      eq(listed.data.items[0].code, r2.data.key.code, 'list shows the newly generated key');
    });

    await test('keys come from a CSPRNG: 200 keys are unique and the source has no Math.random', async () => {
      const { generateRegistrationKey } = await import('../utils/crypto');
      const set = new Set(Array.from({ length: 200 }, () => generateRegistrationKey()));
      eq(set.size, 200, 'unique');
      const src = (await import('fs')).readFileSync(require.resolve('../utils/crypto'), 'utf8');
      check(!/Math\.random\s*\(/.test(src), 'Math.random() used for keys');
    });

    await test('only the super admin can generate, list or revoke keys', async () => {
      for (const token of [student.token, head.token]) {
        eq((await api('POST', '/admin/registration-keys/generate', { token, body: {} })).status, 403, 'generate');
        eq((await api('GET', '/admin/registration-keys', { token })).status, 403, 'list');
        eq((await api('DELETE', '/admin/registration-keys/whatever', { token })).status, 403, 'revoke');
      }
      eq((await api('POST', '/admin/registration-keys/generate', { body: {} })).status, 401, 'anonymous generate');
      // The old shared-secret header no longer grants anything.
      const legacy = await fetch(`${srv.baseUrl}/api/clubs/registration-keys/generate`, { method: 'POST', headers: { 'x-admin-secret': process.env.ADMIN_SECRET || 'x' } });
      eq(legacy.status, 404, 'legacy endpoint removed');
    });

    await test('custom codes are validated and cannot collide', async () => {
      const code = `CUSTOM-${uid().toUpperCase()}`;
      eq((await genKey({ customCode: code })).status, 201, 'custom ok');
      eq((await genKey({ customCode: code })).status, 409, 'duplicate');
      eq((await genKey({ customCode: 'a b' })).status, 400, 'bad characters');
    });

    await test('a key creates exactly one club, is then consumed, and the new club head is scoped to it', async () => {
      const key = (await genKey()).data.key;
      eq((await api('POST', '/clubs/verify-key', { body: { key: key.code } })).status, 200, 'verify');
      const body = newClubBody(key.code);
      const r = await api('POST', '/clubs', { body });
      eq(r.status, 201, 'create club');
      clubsToClean.push(r.data.club.id);
      check(!('password' in r.data.club), 'password leaked');
      const used = await prisma.registrationKey.findUniqueOrThrow({ where: { id: key.id } });
      eq(used.isUsed, true, 'consumed');
      eq(used.usedByClubId, r.data.club.id, 'linked to club');
      eq((await api('POST', '/clubs/verify-key', { body: { key: key.code } })).status, 400, 'verify after use');
      eq((await api('POST', '/clubs', { body: newClubBody(key.code) })).status, 400, 'second club with same key');
      const login = await api('POST', '/auth/club-login', { body: { email: body.email, password: body.password } });
      eq(login.status, 200, 'club login');
      eq(login.data.profile.role, 'CLUB_HEAD', 'role');
      eq(login.data.profile.clubId, r.data.club.id, 'club');
      eq((await api('DELETE', `/admin/registration-keys/${key.id}`, { token: admin.token })).status, 400, 'used key cannot be revoked');
      profilesToClean.push(login.data.profile.id);
    });

    await test('two simultaneous sign-ups cannot redeem the same key', async () => {
      const key = (await genKey()).data.key;
      const rs = await Promise.all(Array.from({ length: 5 }, () => api('POST', '/clubs', { body: newClubBody(key.code) })));
      eq(rs.filter(r => r.status === 201).length, 1, 'exactly one club created');
      for (const r of rs) if (r.status === 201) clubsToClean.push(r.data.club.id);
      const created = await prisma.club.count({ where: { registrationKeys: { some: { id: key.id } } } });
      eq(created, 1, 'one club linked to the key');
    });

    await test('expired and revoked keys are refused', async () => {
      const key = (await genKey({ expiresInDays: 1 })).data.key;
      check(key.expiresAt, 'expiry stored');
      await prisma.registrationKey.update({ where: { id: key.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      eq((await api('POST', '/clubs/verify-key', { body: { key: key.code } })).status, 400, 'verify expired');
      eq((await api('POST', '/clubs', { body: newClubBody(key.code) })).status, 400, 'create with expired');
      const listed = await api('GET', `/admin/registration-keys?status=EXPIRED&search=${key.code}`, { token: admin.token });
      eq(listed.data.items.length, 1, 'listed as expired');
      const fresh = (await genKey()).data.key;
      eq((await api('DELETE', `/admin/registration-keys/${fresh.id}`, { token: admin.token })).status, 200, 'revoke unused');
      eq((await api('POST', '/clubs/verify-key', { body: { key: fresh.code } })).status, 400, 'revoked key invalid');
    });

    // ── Sign-in hardening ────────────────────────────────────────────────────
    await test('login errors do not reveal whether an account exists', async () => {
      const wrongPw = await api('POST', '/auth/login', { body: { email: student.email, password: 'WrongPass1' } });
      const noUser = await api('POST', '/auth/login', { body: { email: `nobody_${uid()}@test.skyline`, password: 'WrongPass1' } });
      eq(wrongPw.status, 401, 'wrong password');
      eq(noUser.status, 401, 'unknown user');
      eq(wrongPw.data.error, noUser.data.error, 'identical message');
    });

    await test('each login endpoint accepts only its own role', async () => {
      eq((await api('POST', '/auth/login', { body: { email: 'aarav.gdg@college.edu', password: 'Password@123' } })).status, 401, 'club head on student login');
      eq((await api('POST', '/auth/login', { body: { email: 'admin@skyline.local', password: 'Password@123' } })).status, 401, 'admin on student login');
      eq((await api('POST', '/auth/club-login', { body: { email: 'admin@skyline.local', password: 'Password@123' } })).status, 401, 'admin on club login');
      eq((await api('POST', '/auth/admin-login', { body: { email: 'gdg@college.edu', password: 'Password@123' } })).status, 401, 'club on admin login');
      eq((await api('POST', '/auth/admin-login', { body: { email: student.email, password: 'Password@123' } })).status, 401, 'student on admin login');
      eq((await api('POST', '/auth/admin-login', { body: { email: 'admin@skyline.local', password: 'Password@123' } })).status, 200, 'admin on admin login');
    });

    await test('/auth/sync ignores a client-supplied email, so it cannot be used to take over another account', async () => {
      const before = await prisma.profile.findUniqueOrThrow({ where: { id: admin.id } });
      const r = await api('POST', '/auth/sync', { token: student.token, body: { email: 'admin@skyline.local', name: 'Mallory' } });
      check([200, 404].includes(r.status), `unexpected ${r.status}`);
      const after = await prisma.profile.findUniqueOrThrow({ where: { id: admin.id } });
      eq(after.email, before.email, 'admin email unchanged');
      eq(after.role, before.role, 'admin role unchanged');
      const me = await api('GET', '/profiles/me', { token: student.token });
      eq(me.data.profile.id, student.id, 'caller still themselves');
      eq(me.data.profile.role, 'STUDENT', 'caller still a student');
    });

    await test('change-password enforces old password and strength', async () => {
      const u = await makeUser('chg');
      profilesToClean.push(u.id);
      eq((await api('POST', '/auth/change-password', { token: u.token, body: { oldPassword: 'nope', newPassword: 'NewPass123' } })).status, 401, 'wrong old');
      eq((await api('POST', '/auth/change-password', { token: u.token, body: { oldPassword: 'Password@123', newPassword: 'short' } })).status, 400, 'weak new');
      eq((await api('POST', '/auth/change-password', { token: u.token, body: { oldPassword: 'Password@123', newPassword: 'NewPass123' } })).status, 200, 'ok');
      eq((await api('POST', '/auth/login', { body: { email: u.email, password: 'NewPass123' } })).status, 200, 'new password works');
    });

    // ── Forgot / reset password ──────────────────────────────────────────────
    await test('forgot-password answers identically for existing and unknown emails', async () => {
      const u = await makeUser('forgot');
      profilesToClean.push(u.id);
      outbox.length = 0;
      const known = await api('POST', '/auth/forgot-password', { body: { email: u.email } });
      const unknown = await api('POST', '/auth/forgot-password', { body: { email: `ghost_${uid()}@test.skyline` } });
      eq(known.status, 200, 'known status');
      eq(unknown.status, 200, 'unknown status');
      eq(known.data, unknown.data, 'identical bodies');
      eq(outbox.filter(m => m.to === u.email).length, 1, 'one email to the real user');
      eq(outbox.length, 1, 'no email for unknown address');
      eq((await api('POST', '/auth/forgot-password', { body: {} })).status, 400, 'missing email');
    });

    await test('full reset: emailed link works once, token is stored hashed, new password logs in, old does not', async () => {
      const u = await makeUser('reset');
      profilesToClean.push(u.id);
      outbox.length = 0;
      await api('POST', '/auth/forgot-password', { body: { email: u.email } });
      const mail = outbox.find(m => m.to === u.email)!;
      const token = /token=([a-f0-9]{64})/.exec(mail.text)?.[1];
      check(token, 'reset link contains a 256-bit token');
      check(mail.text.includes('/reset-password?token='), 'links to the app reset page');
      const row = await prisma.profile.findUniqueOrThrow({ where: { id: u.id } });
      check(row.passwordResetToken !== token, 'raw token must not be stored');
      eq(row.passwordResetToken, hashToken(token!), 'hash stored');
      check(row.passwordResetExpiry && row.passwordResetExpiry > new Date(), 'expiry in the future');

      eq((await api('POST', '/auth/validate-reset-token', { body: { token, email: u.email } })).data.valid, true, 'token valid');
      eq((await api('POST', '/auth/validate-reset-token', { body: { token: 'f'.repeat(64), email: u.email } })).data.valid, false, 'wrong token');
      eq((await api('POST', '/auth/reset-password', { body: { token, email: u.email, newPassword: 'short' } })).status, 400, 'weak password');
      eq((await api('POST', '/auth/reset-password', { body: { token, email: 'someone@else.test', newPassword: 'BrandNew123' } })).status, 400, 'wrong email for token');
      eq((await api('POST', '/auth/reset-password', { body: { token, email: u.email, newPassword: 'BrandNew123' } })).status, 200, 'reset');
      eq((await api('POST', '/auth/login', { body: { email: u.email, password: 'BrandNew123' } })).status, 200, 'new password logs in');
      eq((await api('POST', '/auth/login', { body: { email: u.email, password: 'Password@123' } })).status, 401, 'old password rejected');
      eq((await api('POST', '/auth/reset-password', { body: { token, email: u.email, newPassword: 'Another1234' } })).status, 400, 'token is single-use');
    });

    await test('expired reset links are rejected; a second request invalidates the first', async () => {
      const u = await makeUser('expire');
      profilesToClean.push(u.id);
      outbox.length = 0;
      await api('POST', '/auth/forgot-password', { body: { email: u.email } });
      const t1 = /token=([a-f0-9]{64})/.exec(outbox[0].text)![1];
      await api('POST', '/auth/forgot-password', { body: { email: u.email } });
      const t2 = /token=([a-f0-9]{64})/.exec(outbox[1].text)![1];
      check(t1 !== t2, 'new token each time');
      eq((await api('POST', '/auth/reset-password', { body: { token: t1, email: u.email, newPassword: 'BrandNew123' } })).status, 400, 'older link superseded');
      await prisma.profile.update({ where: { id: u.id }, data: { passwordResetExpiry: new Date(Date.now() - 1000) } });
      const r = await api('POST', '/auth/reset-password', { body: { token: t2, email: u.email, newPassword: 'BrandNew123' } });
      eq(r.status, 400, 'expired');
      check(/expired|invalid/i.test(r.data.error), 'clear message');
    });

    await test('club head reset also updates the club password used by club-login', async () => {
      const email = `rc_${uid()}@test.skyline`;
      const c = await api('POST', '/admin/clubs', { token: admin.token, body: { name: `ResetClub ${uid()}`, email, password: 'Password1' } });
      clubsToClean.push(c.data.club.id);
      outbox.length = 0;
      await api('POST', '/auth/forgot-password', { body: { email } });
      const token = /token=([a-f0-9]{64})/.exec(outbox[0].text)![1];
      check(outbox[0].text.includes('/reset-password'), 'link present');
      eq((await api('POST', '/auth/reset-password', { body: { token, email, newPassword: 'ClubNew1234' } })).status, 200, 'reset');
      eq((await api('POST', '/auth/club-login', { body: { email, password: 'ClubNew1234' } })).status, 200, 'club login with new password');
      eq((await api('POST', '/auth/club-login', { body: { email, password: 'Password1' } })).status, 401, 'old club password');
    });

    await test('recovery endpoints are rate limited', async () => {
      process.env.DISABLE_RATE_LIMIT = 'false';
      try {
        const codes: number[] = [];
        for (let i = 0; i < 7; i++) codes.push((await api('POST', '/auth/forgot-password', { body: { email: `rl_${uid()}@test.skyline` } })).status);
        check(codes.includes(429), `expected a 429 in ${codes.join(',')}`);
      } finally {
        process.env.DISABLE_RATE_LIMIT = 'true';
      }
    });

    // ── Upload validation ────────────────────────────────────────────────────
    await test('uploads are validated server-side: type, content and size', async () => {
      const post = (bannerUrl: string) => api('POST', '/events', { token: head.token, body: eventBody({ bannerUrl }) });
      const b64 = (buf: Buffer) => buf.toString('base64');
      eq((await post(`data:image/svg+xml;base64,${b64(Buffer.from('<svg onload=alert(1)/>'))}`)).status, 400, 'svg refused');
      eq((await post(`data:text/html;base64,${b64(Buffer.from('<script>1</script>'))}`)).status, 400, 'html refused');
      eq((await post(`data:image/png;base64,${b64(Buffer.from('this is not a png'))}`)).status, 400, 'png header mismatch');
      const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(6 * 1024 * 1024)]);
      eq((await post(`data:image/png;base64,${b64(big)}`)).status, 400, 'over 5 MB refused');
      eq((await post('javascript:alert(1)')).status, 400, 'non-http url refused');
    });
  } finally {
    await prisma.registrationKey.deleteMany({ where: { id: { in: keysToClean } } }).catch(() => {});
    await prisma.profile.deleteMany({ where: { OR: [{ id: { in: profilesToClean } }, { clubId: { in: clubsToClean } }] } }).catch(() => {});
    await prisma.club.deleteMany({ where: { id: { in: clubsToClean } } }).catch(() => {});
    await srv.close();
    summary();
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
