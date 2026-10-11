import prisma from '../config/db';

/**
 * Compares every stored counter with a fresh count from the source rows and reports drift.
 *
 *   npm run db:verify-counters           report only (exit code 1 if anything has drifted)
 *   npm run db:verify-counters -- --fix  recompute and repair
 *
 * The counters are maintained by database triggers (migration 3_schema_optimization), so drift should
 * never happen. This exists as a safety net, e.g. after restoring a backup or bulk-loading data with
 * triggers disabled.
 */
const FIX = process.argv.includes('--fix');

interface Check {
  label: string;
  countSql: string; // returns a single `bad` column
  fixSql: string;
}

const checks: Check[] = [
  {
    label: 'Event pending/confirmed/rejected counts',
    countSql: `SELECT count(*)::int AS bad FROM "Event" e WHERE (e.pending_count, e.confirmed_count, e.rejected_count) IS DISTINCT FROM (
      (SELECT count(*) FROM "Registration" r WHERE r.event_id = e.id AND r.status = 'PENDING'),
      (SELECT count(*) FROM "Registration" r WHERE r.event_id = e.id AND r.status = 'CONFIRMED'),
      (SELECT count(*) FROM "Registration" r WHERE r.event_id = e.id AND r.status = 'REJECTED'))`,
    fixSql: `UPDATE "Event" e SET
      pending_count   = (SELECT count(*) FROM "Registration" r WHERE r.event_id = e.id AND r.status = 'PENDING'),
      confirmed_count = (SELECT count(*) FROM "Registration" r WHERE r.event_id = e.id AND r.status = 'CONFIRMED'),
      rejected_count  = (SELECT count(*) FROM "Registration" r WHERE r.event_id = e.id AND r.status = 'REJECTED')`,
  },
  {
    label: 'Team member_count',
    countSql: `SELECT count(*)::int AS bad FROM "Team" t WHERE t.member_count <> (SELECT count(*) FROM "Registration" r WHERE r.team_id = t.id AND r.status IN ('PENDING','CONFIRMED'))`,
    fixSql: `UPDATE "Team" t SET member_count = (SELECT count(*) FROM "Registration" r WHERE r.team_id = t.id AND r.status IN ('PENDING','CONFIRMED'))`,
  },
  {
    label: 'Registration.club_id',
    countSql: `SELECT count(*)::int AS bad FROM "Registration" r JOIN "Event" e ON e.id = r.event_id WHERE r.club_id IS DISTINCT FROM e.club_id`,
    fixSql: `UPDATE "Registration" r SET club_id = e.club_id FROM "Event" e WHERE e.id = r.event_id AND r.club_id IS DISTINCT FROM e.club_id`,
  },
  {
    label: 'Club event_count / product_count',
    countSql: `SELECT count(*)::int AS bad FROM "Club" c WHERE c.event_count <> (SELECT count(*) FROM "Event" e WHERE e.club_id = c.id AND NOT e.is_archived)
      OR c.product_count <> (SELECT count(*) FROM "Product" p WHERE p.club_id = c.id AND NOT p.is_archived)`,
    fixSql: `UPDATE "Club" c SET
      event_count   = (SELECT count(*) FROM "Event" e WHERE e.club_id = c.id AND NOT e.is_archived),
      product_count = (SELECT count(*) FROM "Product" p WHERE p.club_id = c.id AND NOT p.is_archived)`,
  },
  {
    label: 'Product total_stock',
    countSql: `SELECT count(*)::int AS bad FROM "Product" p WHERE p.total_stock <> COALESCE((SELECT sum(v.stock) FROM "ProductVariant" v WHERE v.product_id = p.id AND v.is_active), 0)`,
    fixSql: `UPDATE "Product" p SET total_stock = COALESCE((SELECT sum(v.stock) FROM "ProductVariant" v WHERE v.product_id = p.id AND v.is_active), 0)`,
  },
  {
    label: 'Profile unread_notification_count',
    countSql: `SELECT count(*)::int AS bad FROM "Profile" p WHERE p.unread_notification_count <> (SELECT count(*) FROM "Notification" n WHERE n.user_id = p.id AND NOT n.is_read)`,
    fixSql: `UPDATE "Profile" p SET unread_notification_count = (SELECT count(*) FROM "Notification" n WHERE n.user_id = p.id AND NOT n.is_read)`,
  },
];

async function main() {
  let drifted = 0;
  for (const c of checks) {
    const [{ bad }] = await prisma.$queryRawUnsafe<Array<{ bad: number }>>(c.countSql);
    const status = bad === 0 ? 'ok' : FIX ? `${bad} drifted -> fixing` : `${bad} DRIFTED`;
    console.log(`${bad === 0 ? '✅' : '⚠️ '} ${c.label.padEnd(40)} ${status}`);
    if (bad > 0) {
      drifted += bad;
      if (FIX) {
        await prisma.$executeRawUnsafe(c.fixSql);
        const [{ bad: after }] = await prisma.$queryRawUnsafe<Array<{ bad: number }>>(c.countSql);
        console.log(`   after repair: ${after} drifted`);
      }
    }
  }
  console.log(drifted === 0 ? '\nAll counters match their source rows.' : FIX ? '\nCounters repaired.' : '\nRun with --fix to repair.');
  process.exit(drifted > 0 && !FIX ? 1 : 0);
}

main()
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
