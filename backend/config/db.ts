import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || '';

// Automatically enable SSL for Supabase, Neon, Render, or cloud PostgreSQL instances
const isCloudPostgres =
  connectionString.includes('supabase.co') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('render.com') ||
  connectionString.includes('sslmode=require');

const pool = new Pool({
  connectionString,
  ssl: isCloudPostgres ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'],
});

export default prisma;
