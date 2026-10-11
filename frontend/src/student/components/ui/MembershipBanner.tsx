import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/student/store/authStore';
import { fetchMyMemberships } from '@/student/api/memberships';
import type { MyMembership } from '@/student/api/memberships';

/** Renewal alert for memberships that are about to end or have ended. Renders nothing when all is well. */
export default function MembershipBanner() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const [alerts, setAlerts] = useState<MyMembership[]>([]);

  useEffect(() => {
    if (!isAuthenticated || role !== 'STUDENT') {
      setAlerts([]);
      return;
    }
    let cancelled = false;
    fetchMyMemberships()
      .then((all) => {
        if (!cancelled) setAlerts(all.filter((m) => (m.state === 'EXPIRING' || m.state === 'EXPIRED') && !m.pendingPayment));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, role]);

  if (alerts.length === 0) return null;

  return (
    <div role="status" style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
      {alerts.map((m) => (
        <Link
          key={m.club.id}
          to={`/clubs/${m.club.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, textDecoration: 'none',
            background: m.state === 'EXPIRED' ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.12)',
            color: m.state === 'EXPIRED' ? '#dc2626' : '#b45309', fontSize: 14, fontWeight: 600,
          }}
        >
          <AlertTriangle size={18} />
          <span>
            {m.state === 'EXPIRED'
              ? `Your ${m.club.name} membership has expired. Renew to get member prices.`
              : `Your ${m.club.name} membership ends in ${m.daysLeft} day${m.daysLeft === 1 ? '' : 's'}. Renew now.`}
          </span>
        </Link>
      ))}
    </div>
  );
}
