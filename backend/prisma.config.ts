import "dotenv/config";
import { defineConfig } from "prisma/config";

const dbMode = (process.env.DB_MODE || process.env.DB_ENV || '').toLowerCase().trim();

let resolvedUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || "";
if (dbMode === 'local' && process.env.LOCAL_DATABASE_URL) {
  resolvedUrl = process.env.LOCAL_DATABASE_URL;
} else if ((dbMode === 'supabase' || !dbMode) && (process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DIRECT_URL)) {
  resolvedUrl = process.env.SUPABASE_DIRECT_URL || process.env.SUPABASE_DATABASE_URL || resolvedUrl;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx ./prisma/seed.ts",
  },
  datasource: {
    url: resolvedUrl,
  },
});
