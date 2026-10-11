import app from '../index';
import http from 'http';

async function runApiIntegrationTests() {
  console.log('\n🧪 Starting API Integration Tests against PostgreSQL...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  };

  try {
    // 1. Health Check
    await test('GET /api/health returns 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      const data = await res.json();
      if (data.status !== 'success') throw new Error(`Expected status "success"`);
    });

    // 2. Clubs Route
    let gdgClubId = '';
    await test('GET /api/clubs returns seeded clubs (GDG, Rotaract, IEEE)', async () => {
      const res = await fetch(`${baseUrl}/api/clubs`);
      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      const data = await res.json();
      const clubs = data.clubs || data;
      if (!Array.isArray(clubs) || clubs.length < 3) throw new Error(`Expected >= 3 clubs, got ${clubs?.length}`);
      const gdg = clubs.find((c: any) => c.name.includes('GDG'));
      if (!gdg) throw new Error('GDG club not found');
      gdgClubId = gdg.id;
    });

    // 3. Events Route
    let eventId = '';
    await test('GET /api/events returns seeded events', async () => {
      const res = await fetch(`${baseUrl}/api/events`);
      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      const data = await res.json();
      const events = data.events || data;
      if (!Array.isArray(events) || events.length < 3) throw new Error(`Expected >= 3 events, got ${events?.length}`);
      eventId = events[0].id;
    });

    // 4. Single Event Details
    await test('GET /api/events/:id returns event with club relation', async () => {
      const res = await fetch(`${baseUrl}/api/events/${eventId}`);
      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      const data = await res.json();
      const ev = data.event || data;
      if (!ev || (!ev.title && !ev.name)) throw new Error('Event not returned');
      if (!ev.club && !ev.clubId) throw new Error('Event club relation missing');
    });

    // 5. Auth Login for Student
    let authToken = '';
    await test('POST /api/auth/login authenticates seeded student user', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'priya.nair@college.edu', password: 'Password@123' }),
      });
      if (res.status !== 200) {
        const txt = await res.text();
        throw new Error(`Login failed with status ${res.status}: ${txt}`);
      }
      const data = await res.json();
      if (!data.token && !data.accessToken) throw new Error('No token returned');
      authToken = data.token || data.accessToken;
    });

    // 6. Auth Login for Club
    await test('POST /api/auth/club-login authenticates GDG club admin', async () => {
      const res = await fetch(`${baseUrl}/api/auth/club-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'gdg@college.edu', password: 'Password@123' }),
      });
      if (res.status !== 200) {
        const txt = await res.text();
        throw new Error(`Club login failed with status ${res.status}: ${txt}`);
      }
      const data = await res.json();
      if (!data.token) throw new Error('No club token returned');
    });

    // 7. Super Admin login (replaces the old shared admin-secret passcode)
    await test('POST /api/auth/admin-login authenticates the Super Admin and rejects students', async () => {
      const ok = await fetch(`${baseUrl}/api/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@skyline.local', password: 'Password@123' }),
      });
      if (ok.status !== 200) throw new Error(`Expected 200, got ${ok.status}`);
      const data = await ok.json();
      if (data.profile?.role !== 'SUPER_ADMIN' || !data.token) throw new Error('Expected a SUPER_ADMIN session');
      const bad = await fetch(`${baseUrl}/api/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'priya.nair@college.edu', password: 'Password@123' }),
      });
      if (bad.status !== 401) throw new Error(`Student must not use admin login, got ${bad.status}`);
    });

    console.log(`\n📊 API Integration Test Summary: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runApiIntegrationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
