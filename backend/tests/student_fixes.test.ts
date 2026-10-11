process.env.MAIL_TRANSPORT = 'memory';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
import { Role } from '@prisma/client';
import prisma from '../config/db';
import app from '../index';
import { campusNow } from '../utils/time';
import { check, clubByEmail, createRunner, eq, eventBody, makeUser, seeded, startServer, uid } from './helpers';

/** Deadlines in campus time, team-code retirement, saved events, club profile, profile counts. */
async function main() {
  const srv = await startServer(app);
  const { test, summary } = createRunner('🧾 Student fixes: deadlines, team codes, saved events, club profile');
  const { api } = srv;
  const head = await seeded('aarav.gdg@college.edu');
  const otherHead = await seeded('ieee.head@college.edu');
  const gdg = await clubByEmail('gdg@college.edu');
  const users: string[] = [];
  const events: string[] = [];
  const student = async (p: string) => { const u = await makeUser(p); users.push(u.id); return u; };
  const mkEvent = async (o: Record<string, unknown> = {}) => {
    const r = await api('POST', '/events', { token: head.token, body: eventBody({ name: `FIX-${uid()}`, ...o }) });
    check(r.status === 201, `create event: ${r.status} ${r.text}`);
    events.push(r.data.event.id);
    return r.data.event;
  };
  // "Wall clock" strings like the club form sends (no timezone), relative to campus time.
  const wall = (minutesFromNow: number) => new Date(campusNow().getTime() + minutesFromNow * 60000).toISOString().slice(0, 16);

  try {
    await test('a deadline that has passed on the campus clock closes registration', async () => {
      const ev = await mkEvent({ eventDate: wall(3 * 24 * 60), registrationDeadline: wall(-30) });
      const u = await student('late');
      const r = await api('POST', '/register', { token: u.token, body: { eventId: ev.id } });
      eq(r.status, 400, 'registration refused');
      check(/closed/i.test(r.data.error), `message says closed: ${r.data.error}`);
      eq((await api('GET', `/events/${ev.id}`)).data.event.registrationState, 'CLOSED', 'state is CLOSED');
      const open = await mkEvent({ eventDate: wall(3 * 24 * 60), registrationDeadline: wall(60) });
      eq((await api('POST', '/register', { token: u.token, body: { eventId: open.id } })).status, 201, 'still open an hour before the deadline');
    });

    await test('a team join code is retired once the team is full', async () => {
      const ev = await mkEvent({ eventType: 'Team', teamSizeLimit: 3, minTeamSize: 1 });
      const [l, a, b, c] = await Promise.all([student('tl'), student('ta'), student('tb'), student('tc')]);
      const t = await api('POST', '/teams/create', { token: l.token, body: { eventId: ev.id, teamName: 'Full house' } });
      eq(t.status, 201, 'team created');
      const code = t.data.passkey;
      check(code, 'free team gets a code');
      eq((await api('POST', '/teams/join', { token: a.token, body: { eventId: ev.id, passkey: code } })).status, 201, 'second member');
      check((await prisma.team.findUniqueOrThrow({ where: { id: t.data.teamId } })).passkey, 'code still valid with space left');
      eq((await api('POST', '/teams/join', { token: b.token, body: { eventId: ev.id, passkey: code } })).status, 201, 'third member fills the team');
      eq((await prisma.team.findUniqueOrThrow({ where: { id: t.data.teamId } })).passkey, null, 'code retired');
      eq((await api('POST', '/teams/join', { token: c.token, body: { eventId: ev.id, passkey: code } })).status, 404, 'old code no longer works');
    });

    await test('rejecting the team leader retires the code (club and admin paths)', async () => {
      const admin = await seeded('admin@skyline.local');
      for (const path of ['club', 'admin'] as const) {
        const ev = await mkEvent({ eventType: 'Team', teamSizeLimit: 4, fee: 100 });
        const l = await student(`rl${path}`);
        const t = await api('POST', '/teams/create', { token: l.token, body: { eventId: ev.id, teamName: `T-${path}` } });
        const reg = await prisma.registration.findFirstOrThrow({ where: { eventId: ev.id, userId: l.id } });
        await api('PUT', `/registrations/${reg.id}/payment`, { token: l.token, body: { transactionId: `UTR${uid()}${uid()}` } });
        check((await prisma.team.findUniqueOrThrow({ where: { id: t.data.teamId } })).passkey, 'paid team has a code');
        const r = path === 'club'
          ? await api('DELETE', `/registrations/${reg.id}/reject`, { token: head.token })
          : await api('PUT', `/admin/registrations/${reg.id}/status`, { token: admin.token, body: { status: 'REJECTED' } });
        eq(r.status, 200, `${path} reject`);
        eq((await prisma.team.findUniqueOrThrow({ where: { id: t.data.teamId } })).passkey, null, `${path}: code retired`);
      }
    });

    await test('saved events live on the server and count in the profile', async () => {
      const u = await student('saver');
      const [e1, e2] = await Promise.all([mkEvent(), mkEvent()]);
      eq((await api('PUT', `/profiles/me/saved/${e1.id}`, { token: u.token })).status, 200, 'save');
      eq((await api('PUT', `/profiles/me/saved/${e1.id}`, { token: u.token })).status, 200, 'save twice is fine');
      const synced = await api('POST', '/profiles/me/saved/sync', { token: u.token, body: { eventIds: [e2.id, 'does-not-exist'] } });
      eq(synced.data.eventIds.sort(), [e1.id, e2.id].sort(), 'browser bookmarks merged, unknown ids ignored');
      eq((await api('GET', `/profiles/${u.id}/stats`, { token: u.token })).data.savedCount, 2, 'profile saved count');
      await api('DELETE', `/profiles/me/saved/${e2.id}`, { token: u.token });
      eq((await api('GET', '/profiles/me/saved', { token: u.token })).data.eventIds, [e1.id], 'unsave');
      eq((await api('GET', '/profiles/me/saved')).status, 401, 'needs sign-in');
    });

    await test('profile counts are live: registrations and clubs follow the data', async () => {
      const u = await student('counts');
      const before = (await api('GET', `/profiles/${u.id}/stats`, { token: u.token })).data;
      eq([before.registrationsCount, before.clubsCount], [0, 0], 'starts empty');
      const evs = await Promise.all([mkEvent(), mkEvent(), mkEvent()]);
      for (const e of evs) await api('POST', '/register', { token: u.token, body: { eventId: e.id } });
      const after = (await api('GET', `/profiles/${u.id}/stats`, { token: u.token })).data;
      eq([after.registrationsCount, after.clubsCount], [3, 1], 'three registrations at one club');
    });

    await test('a club head can read their own club profile including the email; nobody else can', async () => {
      const r = await api('GET', `/clubs/${gdg.id}/profile`, { token: head.token });
      eq([r.status, r.data.club.email], [200, 'gdg@college.edu'], 'own club');
      eq((await api('GET', `/clubs/${gdg.id}/profile`, { token: otherHead.token })).status, 403, 'other club head');
      eq((await api('GET', `/clubs/${gdg.id}/profile`)).status, 401, 'anonymous');
      check(!('email' in ((await api('GET', '/clubs')).data.clubs[0] ?? {})), 'public list still hides emails');
      const upd = await api('PUT', `/clubs/${gdg.id}`, { token: head.token, body: { name: gdg.name, upiId: 'gdg@okaxis' } });
      eq(upd.status, 200, 'settings save works');
    });
  } finally {
    await prisma.event.deleteMany({ where: { id: { in: events } } }).catch(() => {});
    await prisma.profile.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    await srv.close();
    summary();
    await prisma.$disconnect();
  }
}
main().catch(err => { console.error('Fatal test error:', err); process.exit(1); });
