import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchMyOrders, formatPaise, type Order, type OrderStatus } from '@/student/api/merch';
import type { Pagination as PaginationMeta } from '@/student/api/pagination';
import Pagination from '@/student/components/common/Pagination';
import { PageLoader } from '@/student/components/ui/LoadingSpinner';
import { ErrorState, EmptyState } from '@/student/components/ui/States';

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', color: '#f59e0b' },
  PAYMENT_SUBMITTED: { label: 'Verifying payment', color: '#3b82f6' },
  PAID: { label: 'Paid', color: '#22c55e' },
  CANCELLED: { label: 'Cancelled', color: '#71717a' },
  REJECTED: { label: 'Rejected', color: '#ef4444' },
};

const FILTERS: Array<{ label: string; status: string }> = [
  { label: 'All', status: '' },
  { label: 'To pay', status: 'PENDING_PAYMENT' },
  { label: 'Verifying', status: 'PAYMENT_SUBMITTED' },
  { label: 'Paid', status: 'PAID' },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMyOrders({ page, pageSize: 10, status });
      if (id !== requestId.current) return;
      setOrders(result.items);
      setPagination(result.pagination);
    } catch {
      if (id !== requestId.current) return;
      setError('We could not load your orders. Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>My Orders</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto' }}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => { setStatus(f.status); setPage(1); }}
            style={{
              padding: '7px 18px', borderRadius: 99, border: '1.5px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
              borderColor: status === f.status ? 'var(--color-crimson)' : 'var(--border)',
              background: status === f.status ? 'var(--color-crimson)' : 'transparent',
              color: status === f.status ? '#fff' : 'var(--subtext)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && orders.length === 0 && !error ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <EmptyState
          svgSrc="/svg/empty_saved.svg"
          title={status ? 'No orders with this status' : 'No orders yet'}
          description="Browse the merchandise to place your first order."
          action={<button className="btn-primary" onClick={() => navigate('/merch')}>Browse merchandise</button>}
        />
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.map((o) => {
              const st = ORDER_STATUS[o.status];
              return (
                <button
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  style={{ display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, cursor: 'pointer', width: '100%', fontFamily: 'var(--font-sans)' }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {o.imageUrl ? <img src={o.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🛍️'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.productName}</div>
                    <div style={{ color: 'var(--subtext)', fontSize: 12 }}>{o.variantLabel} × {o.quantity} · {new Date(o.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text)' }}>{o.totalPaise === 0 ? 'Free' : formatPaise(o.totalPaise)}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <Pagination pagination={pagination} onPage={setPage} disabled={loading} />
        </div>
      )}
    </div>
  );
}
