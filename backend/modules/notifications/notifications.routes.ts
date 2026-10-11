import { Router, Request, Response } from 'express';
import { prisma } from '../../config/db';
import { requireUser, currentUser } from '../../middlewares/authorize';
import { env } from '../../config/env';
import { campusNow } from '../../utils/time';
import { forbidden } from '../../middlewares/errorHandler';

const router = Router();

router.get('/', requireUser, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = currentUser(req).id;
    const now = campusNow();

    const notifications = await prisma.notification.findMany({
      where: { 
        userId: userId,
        OR: [
          { eventId: null },
          {
            event: {
              eventDate: { gte: now }
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return res.status(200).json({ notifications, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/read', requireUser, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = currentUser(req).id;

    await prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true },
    });

    return res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id/read', requireUser, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = currentUser(req).id;
    const id = req.params.id as string;

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    if (notif.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.status(200).json({ message: 'Notification marked as read.' });
  } catch (error: any) {
    console.error(`[Notifications] PUT /:id/read error:`, error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireUser, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = currentUser(req).id;
    const id = req.params.id as string;

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    if (notif.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    await prisma.notification.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Notification deleted.' });
  } catch (error: any) {
    console.error(`[Notifications] DELETE /:id error:`, error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/event-reminders', async (req: Request, res: Response): Promise<any> => {
  try {
    // Triggered by a scheduler, not by users: requires the shared CRON_SECRET.
    if (!env.cronSecret || req.headers['x-cron-secret'] !== env.cronSecret) throw forbidden('Forbidden.');
    const today = campusNow();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));

    const todayEvents = await prisma.event.findMany({
      where: {
        eventDate: { gte: startOfDay, lte: endOfDay },
      },
      include: { club: true },
    });

    if (todayEvents.length === 0) {
      return res.status(200).json({ message: 'No events today.' });
    }

    let totalSent = 0;

    for (const event of todayEvents) {

      const registrations = await prisma.registration.findMany({
        where: { eventId: event.id, status: 'CONFIRMED' },
      });

      if (registrations.length === 0) continue;

      const eventTime = event.eventDate
        ? event.eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
        : 'today';

      const notifData = registrations
        .filter(r => r.userId)
        .map(r => ({
          userId: r.userId!,
          type: 'event_reminder',
          title: `${event.name} is Today!`,
          body: `Your event starts at ${eventTime}. Venue: ${event.venue ?? 'TBD'}.`,
          eventId: event.id,
        }));

      await prisma.notification.createMany({ data: notifData });
      totalSent += notifData.length;
    }

    return res.status(200).json({ message: `Sent ${totalSent} event reminder notifications.` });
  } catch (error: any) {
    if (error?.status) throw error;
    console.error('Event reminders error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
