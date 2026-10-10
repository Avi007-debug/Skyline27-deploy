import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbMode = (process.env.DB_MODE || process.env.DB_ENV || '').toLowerCase().trim();

let connectionString = process.env.DATABASE_URL || '';
if (dbMode === 'local' && process.env.LOCAL_DATABASE_URL) {
  connectionString = process.env.LOCAL_DATABASE_URL;
} else if ((dbMode === 'supabase' || !dbMode) && process.env.SUPABASE_DATABASE_URL) {
  connectionString = process.env.SUPABASE_DATABASE_URL;
}

console.log(`[Database] Active mode: "${dbMode || 'default'}" -> connecting to ${connectionString.includes('localhost') ? 'Local PostgreSQL' : 'Supabase PostgreSQL'}`);

// Automatically enable SSL for Supabase, Neon, Render, or cloud PostgreSQL instances
const isCloudPostgres =
  connectionString.includes('supabase.co') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('render.com') ||
  connectionString.includes('sslmode=require');

// Strip ?sslmode=require from the URI so pg driver doesn't override rejectUnauthorized
const sanitizedConnectionString = isCloudPostgres
  ? connectionString.replace(/[?&]sslmode=[^&]+/g, '')
  : connectionString;

const pool = new Pool({
  connectionString: sanitizedConnectionString,
  ssl: isCloudPostgres ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'],
});

export default prisma;
