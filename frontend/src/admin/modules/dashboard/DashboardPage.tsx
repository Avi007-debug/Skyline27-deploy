import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ErrorState, PageHeader, PageLoader, StatCard } from '../../components/common/ui';
import { errorMessage, get } from '../../services/http';
import type { AuditRow, PlatformStats } from '../../types/api';
import { formatDateTime, formatNumber, formatPaise, titleCase } from '../../utils/format';

/** Every number here comes from GET /admin/stats, computed from the database on each load. */
export function DashboardPage() {
  const [data, setData] = useState<{ stats: PlatformStats; recentAuditLogs: AuditRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    get<{ stats: PlatformStats; recentAuditLogs: AuditRow[] }>('/admin/stats')
      .then(setData)
      .catch(e => setError(errorMessage(e, 'Could not load the overview.')));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <PageLoader />;
  const { stats: s, recentAuditLogs } = data;

  return (
    <>
      <PageHeader title="Overview" subtitle="Live platform totals across every club." />

      <section aria-label="Platform totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard to="/admin/users" label="Registered users" value={formatNumber(s.users.total)} sub={`${s.users.students} students · ${s.users.clubHeads} club heads · ${s.users.superAdmins} admins`} />
        <StatCard to="/admin/clubs" label="Clubs" value={formatNumber(s.clubs.total)} sub={`${s.clubs.active} active · ${s.clubs.archived} archived`} />
        <StatCard to="/admin/events" label="Events" value={formatNumber(s.events.total)} sub={`${s.events.published} published · ${s.events.unpublished} unpublished · ${s.events.upcoming} upcoming`} />
        <StatCard to="/admin/registrations" label="Active registrations" value={formatNumber(s.registrations.active)} sub={`${s.registrations.confirmed} confirmed · ${s.registrations.pending} pending · ${s.registrations.rejected} rejected`} />
        <StatCard to="/admin/keys" label="Registration keys" value={formatNumber(s.keys.available)} sub={`available of ${s.keys.total} generated`} />
        <StatCard to="/admin/merchandise" label="Products" value={formatNumber(s.merchandise.products)} sub="Live in the catalogue" />
        <StatCard to="/admin/orders" label="Merchandise sales" value={formatPaise(s.merchandise.paidSalesPaise)} sub={`${s.merchandise.orders.PAID?.count ?? 0} paid orders · gross revenue`} />
        <StatCard to="/admin/reports" label="Ticket sales" value={formatPaise(s.ticketSalesPaise)} sub="Gross, from verified paid registrations" />
      </section>

      <section className="ad-card mt-8" aria-label="Recent administrative activity">
        <div className="flex items-center justify-between border-b border-ad-line px-5 py-4">
          <h2 className="font-bold">Recent administrative activity</h2>
          <Link to="/admin/audit-logs" className="text-sm font-semibold text-ad-brand">
            View all
          </Link>
        </div>
        {recentAuditLogs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ad-muted">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-ad-line/60">
            {recentAuditLogs.map(l => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  <strong>{titleCase(l.action)}</strong> <span className="text-ad-muted">on {l.entityType}</span>
                </span>
                <span className="text-xs text-ad-faint">
                  {l.actor?.fullName ?? 'System'} · {formatDateTime(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
