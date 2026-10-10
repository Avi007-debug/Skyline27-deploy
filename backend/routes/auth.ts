import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/db';
import { signToken, requireAuth } from '../middlewares/auth';
import { generateSecureToken, hashToken } from '../utils/crypto';

// Supabase Auth forgot/recovery option + console fallback
async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      // Trigger Supabase Auth recovery email via Supabase Auth API
      const res = await fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          redirect_to: resetUrl,
        }),
      });
      if (res.ok) {
        console.log(`[Supabase Auth] Recovery email triggered successfully for: ${email}`);
      } else {
        const text = await res.text();
        console.warn(`[Supabase Auth] Recovery email trigger status ${res.status}:`, text);
      }
    } catch (err) {
      console.error('[Supabase Auth] Recover fetch failed:', err);
    }
  }

  // Development logging: token reset link
  console.log(`[Password Reset] Secure Reset URL for ${email}: ${resetUrl}`);
}


const router = Router();
const SALT_ROUNDS = 10;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '614014299614-n10khe2om4g50ehpqb6h82tdtumkh5ot.apps.googleusercontent.com';
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function isBcryptHash(value: string): boolean {
  return value.startsWith('$2b$') || value.startsWith('$2a$');
}

function getPreferredName(existingName: string | null | undefined, incomingName: string | null | undefined): string {
  const isPlaceholder = (n: string) => 
    !n || 
    n.toLowerCase() === 'skylineos user' || 
    n.toLowerCase() === 'spotlight user' || 
    n.toLowerCase() === 'club admin' || 
    n.includes('@');

  if (existingName && !isPlaceholder(existingName)) {
    return existingName;
  }
  if (incomingName && !isPlaceholder(incomingName)) {
    return incomingName;
  }
  return existingName || incomingName || 'SkylineOS User';
}

async function checkPassword(
  plain: string,
  stored: string,
  upgradeId: string
): Promise<boolean> {
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored);
  }

  const match = plain === stored;
  if (match) {

    const hashed = await bcrypt.hash(plain, SALT_ROUNDS);
    await prisma.profile.update({ where: { id: upgradeId }, data: { password: hashed } });
  }
  return match;
}

router.post('/signup', async (req: Request, res: Response): Promise<any> => {
  const { email, password, name, usn, branch, phone, year, sem } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, Password, and Name are required.' });
  }

  try {
    const existing = await prisma.profile.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const existingClub = await prisma.club.findUnique({ where: { email: email.toLowerCase() } });
    if (existingClub) {
      return res.status(400).json({ error: 'This email is registered to a club account.' });
    }

    if (usn) {
      const existingUsn = await prisma.profile.findUnique({ where: { usn: usn.trim() } });
      if (existingUsn) {
        return res.status(400).json({ error: 'An account with this USN already exists.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = `user_${crypto.randomBytes(6).toString('hex')}`;

    const profile = await prisma.profile.create({
      data: {
        id: userId,
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName: name,
        usn: usn || null,
        branch: branch || null,
        phone: phone || null,
        year: year ? parseInt(year, 10) : null,
        sem: sem ? parseInt(sem, 10) : null,
      }
    });

    const token = signToken(userId);
    console.log(`New user signed up: ${profile.email}`);

    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(201).json({ message: 'Account created successfully', profile: safeProfile, token });
  } catch (error: any) {
    console.error('Signup Error:', error);
    return res.status(500).json({ error: 'Failed to create account: ' + error.message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and Password are required.' });
  }

  try {
    let profile = await prisma.profile.findFirst({
      where: {
        email: email.toLowerCase(),
        clubId: null
      }
    });

    if (!profile) {
      return res.status(404).json({ error: 'No student account found with this email. Please sign up first.' });
    }

    if (!profile.password) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Please use the Google button.' });
    }

    const match = await checkPassword(password, profile.password, profile.id);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = signToken(profile.id);
    console.log(`User logged in: ${profile.email}`);

    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(200).json({ message: 'Logged in successfully', profile: safeProfile, token });
  } catch (error: any) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

router.post('/club-login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and Password are required.' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const club = await prisma.club.findUnique({ where: { email: cleanEmail } });
    if (!club) {
      const existingProfile = await prisma.profile.findFirst({ where: { email: cleanEmail } });
      if (!existingProfile) {
        return res.status(404).json({ error: 'No account exists with this email address.' });
      } else {
        return res.status(404).json({ error: 'No club exists with this email address. Please register your club first.' });
      }
    }

    if (!club.password) {
      return res.status(400).json({ error: 'This club account uses social sign-in. Please use the Google button.' });
    }

    const isMatch = await bcrypt.compare(password, club.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please check your password and try again.' });
    }

    let profile = await prisma.profile.findFirst({ where: { clubId: club.id } });
    if (!profile) {
      const userId = `user_${crypto.randomBytes(6).toString('hex')}`;
      profile = await prisma.profile.create({
        data: {
          id: userId,
          email: email.toLowerCase(),
          password: club.password,
          fullName: `${club.name} Admin`,
          clubId: club.id,
        }
      });
      console.log(`Auto-created profile ${profile.email} during direct club login`);
    }

    const token = signToken(profile.id);
    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(200).json({ message: 'Logged in successfully', profile: safeProfile, token });
  } catch (error: any) {
    console.error('Club Login Error:', error);
    return res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

router.post('/google', async (req: Request, res: Response): Promise<any> => {
  const { credential, access_token, registrationKey, clubName } = req.body;

  if (!credential && !access_token) {
    return res.status(400).json({ error: 'Google credential or access token is required.' });
  }

  try {
    let payload: any = null;
    if (credential) {
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (verifyErr) {
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (tokenInfoRes.ok) {
          payload = await tokenInfoRes.json();
        }
      }
    }

    if (!payload && req.body.access_token) {
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${req.body.access_token}` },
      });
      if (userResponse.ok) {
        const userInfo = await userResponse.json() as any;
        payload = {
          email: userInfo.email,
          name: userInfo.name,
          given_name: userInfo.given_name,
          picture: userInfo.picture,
          sub: userInfo.sub,
        };
      }
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google credential or missing email address.' });
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || payload.given_name || clubName || 'SkylineOS User';
    const googleUserId = `google_${payload.sub || crypto.createHash('md5').update(email).digest('hex')}`;

    let club = await prisma.club.findUnique({ where: { email } });
    let profile = await prisma.profile.findFirst({ where: { email } });

    if (!club && registrationKey) {
      const cleanKey = registrationKey.trim().toUpperCase();
      const keyRecord = await prisma.registrationKey.findFirst({
        where: { code: cleanKey, isUsed: false },
      });

      if (!keyRecord) {
        return res.status(400).json({ error: 'Invalid or expired registration key.' });
      }

      club = await prisma.$transaction(async (tx) => {
        const createdClub = await tx.club.create({
          data: {
            name: clubName?.trim() || name,
            email: email,
            logoUrl: payload.picture || null,
          }
        });

        const createdProfile = await tx.profile.upsert({
          where: { id: googleUserId },
          update: {
            fullName: name,
            email: email,
            clubId: createdClub.id,
          },
          create: {
            id: googleUserId,
            fullName: name,
            email: email,
            clubId: createdClub.id,
          }
        });

        await tx.registrationKey.update({
          where: { id: keyRecord.id },
          data: {
            isUsed: true,
            usedByClubId: createdClub.id,
            usedAt: new Date(),
          }
        });

        profile = createdProfile;
        return createdClub;
      });
    }

    if (!club) {
      return res.status(404).json({ error: 'No club exists with this email address. Please register your club first.' });
    }

    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          id: googleUserId,
          fullName: name,
          email: email,
          clubId: club.id,
        }
      });
    } else if (profile.clubId !== club.id) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: { clubId: club.id }
      });
    }

    const token = signToken(profile.id);
    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(200).json({
      message: 'Google login successful',
      profile: safeProfile,
      club,
      token
    });
  } catch (error: any) {
    console.error('Google Auth Error:', error);
    return res.status(500).json({ error: 'Google authentication failed: ' + error.message });
  }
});

router.post('/verify-password', requireAuth, async (req: Request, res: Response): Promise<any> => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'userId and password are required.' });
  }

  if (req.auth!.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden: You cannot verify password for another user.' });
  }

  try {
    const profile = await prisma.profile.findUnique({ where: { id: userId } });

    if (!profile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!profile.password) {

      return res.status(200).json({ valid: true });
    }

    const match = await checkPassword(password, profile.password, userId);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    return res.status(200).json({ valid: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/change-password', requireAuth, async (req: Request, res: Response): Promise<any> => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required.' });
  }

  try {
    const userId = req.auth!.userId;
    const profile = await prisma.profile.findUnique({ where: { id: userId } });

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    let targetPasswordHash: string | null = null;
    let club = null;

    if (profile.clubId) {
      club = await prisma.club.findUnique({ where: { id: profile.clubId } });
      if (!club) {
        return res.status(404).json({ error: 'Club associated with this profile not found.' });
      }
      targetPasswordHash = club.password;
    } else {
      targetPasswordHash = profile.password;
    }

    if (!targetPasswordHash) {
      return res.status(400).json({ error: 'No password is set for this account.' });
    }

    let match = false;
    if (profile.clubId && club) {
      match = await bcrypt.compare(oldPassword, targetPasswordHash);
    } else {
      match = await checkPassword(oldPassword, targetPasswordHash, userId);
    }

    if (!match) {
      return res.status(401).json({ error: 'Incorrect old password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.profile.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    if (profile.clubId) {
      await prisma.club.update({
        where: { id: profile.clubId },
        data: { password: hashedPassword }
      });
      console.log(`Updated password for club: ${profile.clubId}`);
    }

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error: any) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/sync', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const clerkUserId = req.auth!.userId;
    const { email, name, usn, branch, phone } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required to sync profile.' });
    }

    let profile = await prisma.profile.findUnique({ where: { email: email.toLowerCase() } });
    if (profile) {
      if (profile.id !== clerkUserId) {
        console.log(`[Sync] Profile with email ${email} already exists under different ID: ${profile.id}. Merging to new Clerk ID: ${clerkUserId}`);

        const targetProfile = await prisma.profile.findUnique({ where: { id: clerkUserId } });

        const existingClubId = targetProfile?.clubId || profile.clubId;
        const finalUsn = usn || targetProfile?.usn || profile.usn;
        const finalBranch = branch || targetProfile?.branch || profile.branch;
        const finalPhone = phone || targetProfile?.phone || profile.phone;
        const year = targetProfile?.year || profile.year;
        const sem = targetProfile?.sem || profile.sem;
        const passwordVal = targetProfile?.password || profile.password;

        profile = await prisma.$transaction(async (tx) => {

          await tx.profile.update({
            where: { id: profile!.id },
            data: {
              email: `${profile!.id}@temp.local`,
              usn: null,
            }
          });

          const newProfile = await tx.profile.upsert({
            where: { id: clerkUserId },
            update: {
              fullName: getPreferredName(targetProfile?.fullName || profile!.fullName, name),
              email: email.toLowerCase(),
              clubId: existingClubId,
              usn: finalUsn,
              branch: finalBranch,
              phone: finalPhone,
              year,
              sem,
              password: passwordVal,
            },
            create: {
              id: clerkUserId,
              fullName: getPreferredName(targetProfile?.fullName || profile!.fullName, name),
              email: email.toLowerCase(),
              clubId: existingClubId,
              usn: finalUsn,
              branch: finalBranch,
              phone: finalPhone,
              year,
              sem,
              password: passwordVal,
            }
          });

          await tx.registration.updateMany({
            where: { userId: profile!.id },
            data: { userId: clerkUserId }
          });

          await tx.notification.updateMany({
            where: { userId: profile!.id },
            data: { userId: clerkUserId }
          });

          await tx.team.updateMany({
            where: { leaderId: profile!.id },
            data: { leaderId: clerkUserId }
          });

          await tx.profile.delete({ where: { id: profile!.id } });

          return newProfile;
        });
      } else {

        profile = await prisma.profile.update({
          where: { id: clerkUserId },
          data: { fullName: getPreferredName(profile.fullName, name) },
        });
      }
    } else {

      const existingProfileById = await prisma.profile.findUnique({ where: { id: clerkUserId } });
      profile = await prisma.profile.upsert({
        where: { id: clerkUserId },
        update: { 
          fullName: getPreferredName(existingProfileById?.fullName, name), 
          email: email || undefined 
        },
        create: { 
          id: clerkUserId, 
          fullName: getPreferredName(null, name), 
          email: email || '' 
        },
      });
    }

    if (!profile.clubId) {
      const existingClub = await prisma.club.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingClub) {

        profile = await prisma.profile.update({
          where: { id: clerkUserId },
          data: { 
            clubId: existingClub.id,
            fullName: getPreferredName(profile.fullName, existingClub.name),
          },
        });
        console.log(`Auto-linked user ${profile.email} to existing club ID: ${existingClub.id}`);
      }
    }

    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(200).json({ message: 'Profile synced', profile: safeProfile });
  } catch (error: any) {
    console.error('Profile Sync Error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

router.post('/forgot-password', async (req: Request, res: Response): Promise<any> => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  // Always return the same message to prevent account enumeration
  const GENERIC_MESSAGE = 'If an account with that email exists, a password reset link has been sent.';

  try {
    const profile = await prisma.profile.findFirst({
      where: { email: email.toLowerCase().trim(), clubId: null },
      select: { id: true, email: true, password: true },
    });

    if (!profile || !profile.password) {
      // Don't reveal whether the account exists
      return res.status(200).json({ message: GENERIC_MESSAGE });
    }

    // Generate secure token (plaintext returned to user, hashed stored in DB)
    const rawToken = generateSecureToken(32);
    const hashedToken = hashToken(rawToken);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: expiry,
      } as any,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(profile.email)}`;

    await sendPasswordResetEmail(profile.email, resetUrl);

    return res.status(200).json({ message: GENERIC_MESSAGE });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    // Still return generic message on error to prevent enumeration
    return res.status(200).json({ message: GENERIC_MESSAGE });
  }
});

// ─── Reset Password ───────────────────────────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response): Promise<any> => {
  const { token, email, newPassword } = req.body;

  if (!token || !email || !newPassword) {
    return res.status(400).json({ error: 'Token, email, and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const hashedToken = hashToken(String(token));
    const now = new Date();

    const profile = await prisma.profile.findFirst({
      where: {
        email: String(email).toLowerCase().trim(),
        clubId: null,
        passwordResetToken: hashedToken,
        passwordResetExpiry: { gte: now },
      } as any,
    });

    if (!profile) {
      return res.status(400).json({ error: 'Invalid or expired password reset link. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      } as any,
    });

    console.log(`[Auth] Password reset successful for: ${profile.email}`);
    return res.status(200).json({ message: 'Password updated successfully. You can now log in with your new password.' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ─── Validate Reset Token ─────────────────────────────────────────────────────

router.post('/validate-reset-token', async (req: Request, res: Response): Promise<any> => {
  const { token, email } = req.body;
  if (!token || !email) {
    return res.status(400).json({ valid: false, error: 'Token and email are required.' });
  }

  try {
    const hashedToken = hashToken(String(token));
    const now = new Date();

    const profile = await prisma.profile.findFirst({
      where: {
        email: String(email).toLowerCase().trim(),
        clubId: null,
        passwordResetToken: hashedToken,
        passwordResetExpiry: { gte: now },
      } as any,
      select: { id: true },
    });

    if (!profile) {
      return res.status(200).json({ valid: false, error: 'Invalid or expired link.' });
    }

    return res.status(200).json({ valid: true });
  } catch (error: any) {
    return res.status(500).json({ valid: false, error: 'Validation failed.' });
  }
});

export default router;

