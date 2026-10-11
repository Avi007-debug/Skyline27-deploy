import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import prisma from '../config/db';
import { signToken } from '../middlewares/authenticate';

export interface ApiResult<T = any> {
  status: number;
  data: T;
  text: string;
}

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
  api: (method: string, path: string, opts?: { token?: string; body?: unknown }) => Promise<ApiResult>;
}

export async function startServer(app: any): Promise<TestServer> {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const baseUrl = `http://localhost:${(server.address() as any).port}`;
  return {
    baseUrl,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
    api: async (method, path, opts = {}) => {
      const res = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      return { status: res.status, data, text };
    },
  };
}

export function createRunner(title: string) {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];
  console.log(`\n${title}`);
  return {
    test: async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
        failures.push(name);
        failed++;
      }
    },
    summary: () => {
      console.log(`\n📊 ${title}: ${passed} passed, ${failed} failed.\n`);
      if (failed > 0) process.exitCode = 1;
      return { passed, failed, failures };
    },
  };
}

export const uid = () => crypto.randomBytes(4).toString('hex');
export const PASSWORD = 'Password@123';

export async function makeUser(prefix: string, role: Role = Role.STUDENT, clubId: string | null = null, password = PASSWORD) {
  const id = `t_${prefix}_${uid()}`;
  const profile = await prisma.profile.create({
    data: {
      id,
      email: `${id}@test.skyline`.toLowerCase(),
      fullName: `Test ${prefix}`,
      password: await bcrypt.hash(password, 4),
      role,
      clubId,
    },
  });
  return { profile, token: signToken(id), id, email: profile.email };
}

export async function seeded(email: string) {
  const profile = await prisma.profile.findUniqueOrThrow({ where: { email } });
  return { profile, token: signToken(profile.id), id: profile.id, email: profile.email, clubId: profile.clubId };
}

export const clubByEmail = (email: string) => prisma.club.findUniqueOrThrow({ where: { email } });

export function futureDate(days: number, hours = 0) {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

export function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    name: `Test Event ${uid()}`,
    description: 'Created by automated tests',
    venue: 'Test Hall',
    eventType: 'Solo',
    fee: 0,
    registrationLimit: 50,
    eventDate: futureDate(10).toISOString(),
    ...overrides,
  };
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function eq<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
