import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

import authRouter from './modules/auth/auth.routes';
import profilesRouter from './modules/profiles/profiles.routes';
import eventsRouter from './modules/events/events.routes';
import clubsRouter from './modules/clubs/clubs.routes';
import registrationsRouter from './modules/registrations/registrations.routes';
import merchandiseRouter from './modules/merchandise/merchandise.routes';
import notificationsRouter from './modules/notifications/notifications.routes';
import expensesRouter from './modules/finance/expenses.routes';
import financeRouter from './modules/finance/finance.routes';
import adminRouter from './modules/admin/admin.routes';
import membershipsRouter from './modules/memberships/memberships.routes';
import tasksRouter from './modules/tasks/tasks.routes';
import announcementsRouter from './modules/announcements/announcements.routes';

/**
 * SkylineOS API.
 *
 *   /auth            sign-in for the three roles + password recovery
 *   /events, /clubs, /merchandise      public browsing + club-head management
 *   /register, /teams, /registrations  student participation + club review
 *   /profiles, /notifications          the signed-in user's own data
 *   /expenses, /finance                club finance (club-scoped)
 *   /memberships, /tasks, /announcements  club membership + member pricing, volunteer boards, club feed
 *   /admin                             Super Admin console (everything, guarded once)
 *
 * Authorization lives in middlewares/authorize.ts; every module declares the
 * guard it needs and the database is the only source of a user's role.
 */
export function createApp() {
  const app = express();
  if (env.isProd) app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // Bearer-token API: no cookies, so credentials are not needed. In production set CORS_ORIGINS.
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // Method and path only: query strings can contain reset tokens.
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, _res, next) => {
      console.log(`[HTTP] ${req.method} ${req.path}`);
      next();
    });
  }

  app.get(['/', '/api', '/api/health', '/health'], (_req: Request, res: Response): any =>
    res.status(200).json({ status: 'success', message: 'SkylineOS API Server is live!' })
  );

  // Mounted at /api and at / so reverse proxies that strip the prefix keep working.
  const mount = (prefix: string) => {
    app.use(`${prefix}/auth`, authRouter);
    app.use(`${prefix}/profiles`, profilesRouter);
    app.use(`${prefix}/events`, eventsRouter);
    app.use(`${prefix}/clubs`, clubsRouter);
    app.use(`${prefix}/merchandise`, merchandiseRouter);
    app.use(`${prefix}/notifications`, notificationsRouter);
    app.use(`${prefix}/expenses`, expensesRouter);
    app.use(`${prefix}/finance`, financeRouter);
    app.use(`${prefix}/memberships`, membershipsRouter);
    app.use(`${prefix}/tasks`, tasksRouter);
    app.use(`${prefix}/announcements`, announcementsRouter);
    app.use(`${prefix}/admin`, adminRouter);
    app.use(prefix || '/', registrationsRouter);
  };
  mount('/api');
  mount('');

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
export default app;
