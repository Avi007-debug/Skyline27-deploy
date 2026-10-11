import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../config/db';
import { SALT_ROUNDS, validateEmail, validatePassword } from '../modules/auth/auth.service';

/**
 * Create (or promote) the first Super Admin.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='S3cure-pass' ADMIN_NAME='Your Name' npm run admin:create
 *
 * Credentials come from the environment so they never appear in shell history
 * or the repository. Re-running resets that admin's password.
 */
async function main() {
  const email = validateEmail(process.env.ADMIN_EMAIL);
  const password = validatePassword(process.env.ADMIN_PASSWORD);
  const name = (process.env.ADMIN_NAME || 'Super Admin').trim();

  if (await prisma.club.findUnique({ where: { email } })) {
    throw new Error('That email belongs to a club account. Use a different email for the Super Admin.');
  }
  const existing = await prisma.profile.findUnique({ where: { email } });
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = existing
    ? await prisma.profile.update({ where: { id: existing.id }, data: { role: Role.SUPER_ADMIN, clubId: null, password: hashed, isActive: true } })
    : await prisma.profile.create({ data: { id: `user_${crypto.randomBytes(6).toString('hex')}`, email, fullName: name, password: hashed, role: Role.SUPER_ADMIN } });

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: existing ? 'PROMOTE_SUPER_ADMIN' : 'CREATE_SUPER_ADMIN', entityType: 'Profile', entityId: admin.id, details: JSON.stringify({ via: 'script' }) },
  });
  console.log(`${existing ? 'Updated' : 'Created'} Super Admin: ${admin.email}`);
}

main()
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
