import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const profile = await prisma.profile.findUnique({ where: { id } });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(200).json({ profile: safeProfile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/update', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.auth!.userId;
    const { usn, branch, phone } = req.body;

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { usn, branch, phone }
    });

    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(200).json({ message: 'Profile updated successfully', profile: safeProfile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/edit', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.auth!.userId;
    const { full_name, usn, branch, phone, year, sem } = req.body;

    const currentProfile = await prisma.profile.findUnique({ where: { id: userId } });
    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    let finalUsn = currentProfile.usn;
    if (!finalUsn && usn && typeof usn === 'string' && usn.trim()) {
      const cleanUsn = usn.trim();
      const existing = await prisma.profile.findUnique({ where: { usn: cleanUsn } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'This USN is already registered to another account.' });
      }
      finalUsn = cleanUsn;
    }

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: {
        fullName: full_name !== undefined ? (full_name ? String(full_name).trim() : null) : undefined,
        usn: finalUsn !== undefined ? (finalUsn ? String(finalUsn).trim() : null) : undefined,
        branch: branch !== undefined ? (branch ? String(branch).trim() : null) : undefined,
        phone: phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
        year: year !== undefined && year !== '' ? parseInt(String(year), 10) : undefined,
        sem: sem !== undefined && sem !== '' ? parseInt(String(sem), 10) : undefined,
      }
    });

    const { password: _pw, ...safeProfile } = profile as any;
    safeProfile.hasPassword = !!profile.password;
    return res.status(200).json({ message: 'Profile updated successfully', profile: safeProfile });
  } catch (error: any) {
    console.error('Profile edit error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/stats', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.id as string;

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { role: true, clubId: true },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const isClubHead = !!profile.clubId;

    if (isClubHead && profile.clubId) {
      // Club Head: return events they manage
      const eventsCount = await prisma.event.count({
        where: { clubId: profile.clubId, isArchived: false },
      });
      const upcomingCount = await prisma.event.count({
        where: {
          clubId: profile.clubId,
          isArchived: false,
          eventDate: { gte: new Date() },
        },
      });
      const registrationsCount = await prisma.registration.count({
        where: { event: { clubId: profile.clubId! } },
      });

      return res.status(200).json({
        eventsCount,
        upcomingEventsCount: upcomingCount,
        registrationsCount,
        clubsCount: 1,
        role: 'CLUB_HEAD',
      });
    } else {
      // Student: return their own registration activity
      const registrationCount = await prisma.registration.count({
        where: { userId },
      });

      const confirmedCount = await prisma.registration.count({
        where: { userId, status: 'CONFIRMED' },
      });

      const registrations = await prisma.registration.findMany({
        where: { userId },
        include: { event: { select: { clubId: true } } },
      });

      const uniqueClubIds = new Set(
        registrations
          .map(r => r.event?.clubId)
          .filter((id): id is string => id != null)
      );

      return res.status(200).json({
        eventsCount: registrationCount,        // Number of events registered for
        confirmedCount,                         // Confirmed registrations
        clubsCount: uniqueClubIds.size,        // Unique clubs participated in
        role: 'STUDENT',
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
