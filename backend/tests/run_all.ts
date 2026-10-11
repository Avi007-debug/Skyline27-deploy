import { spawnSync } from 'child_process';
import path from 'path';

/**
 * Runs every suite in its own process against the database selected by
 * DB_MODE / LOCAL_DATABASE_URL (use a seeded disposable database):
 *
 *   npm run db:deploy && npm run db:constraints && npm run db:seed && npm test
 *
 * Tests clean up the rows they create, but ledger entries are append-only by
 * design (database trigger), so re-seed periodically with `npm run db:seed`.
 */
const suites = [
  'integration_test.ts',
  'rbac.test.ts',
  'events.test.ts',
  'auth.test.ts',
  'merch.test.ts',
  'schema.test.ts',
  'membership.test.ts',
  'student_fixes.test.ts',
  'ledger.test.ts',
  'expenses_finance.test.ts',
  'reports_audit.test.ts',
];

process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';

const results: Array<{ suite: string; ok: boolean }> = [];
for (const suite of suites) {
  console.log(`\n━━━ ${suite} ━━━`);
  const run = spawnSync(process.execPath, [require.resolve('tsx/cli'), path.join(__dirname, suite)], { stdio: 'inherit', env: process.env });
  results.push({ suite, ok: run.status === 0 });
}

console.log('\n══════ Summary ══════');
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.suite}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
