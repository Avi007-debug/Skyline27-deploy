import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cancelOrder, fetchOrder, formatPaise, submitOrderPayment, type Order } from '@/student/api/merch';
import { PageLoader } from '@/student/components/ui/LoadingSpinner';
import { ErrorState } from '@/student/components/ui/States';
import { ORDER_STATUS } from './OrdersPage';

/** One order. Unpaid orders show the club's UPI details and take the payment reference. */
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setOrder(await fetchOrder(id));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !order) return <PageLoader />;
  if (!order) return <ErrorState message="Order not found." onRetry={load} />;

  const st = ORDER_STATUS[order.status];

  const submit = async () => {
    const ref = reference.trim();
    if (!/^[A-Za-z0-9-]{6,64}$/.test(ref)) {
      toast.error('Enter the 6–64 character UPI transaction reference.');
      return;
    }
    setBusy(true);
    try {
      await submitOrderPayment(order.id, ref);
      toast.success('Payment reference submitted. The club will verify it shortly.');
      await load();
    } catch (e) {
      toast.error(String(e).replace('Error: ', ''));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelOrder(order.id);
      toast.success('Order cancelled.');
      await load();
    } catch (e) {
      toast.error(String(e).replace('Error: ', ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <button onClick={() => navigate('/orders')} style={{ background: 'none', border: 'none', color: 'var(--subtext)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
        <ChevronLeft size={18} /> My orders
      </button>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{order.productName}</h1>
            <div style={{ color: 'var(--subtext)', fontSize: 13 }}>{order.variantLabel} × {order.quantity}{order.club ? ` · ${order.club.name}` : ''}</div>
          </div>
          <span style={{ color: st.color, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>{st.label}</span>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
        <Row label="Unit price (at purchase)" value={`${formatPaise(order.unitPricePaise)}${order.isMemberPrice ? " · member price" : ""}`} />
        <Row label="Quantity" value={String(order.quantity)} />
        <Row label="Total" value={order.totalPaise === 0 ? 'Free' : formatPaise(order.totalPaise)} bold />
        {order.transactionId && <Row label="Payment reference" value={order.transactionId} />}
        <Row label="Ordered" value={new Date(order.createdAt).toLocaleString()} />
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Pay {formatPaise(order.totalPaise)} via UPI</h2>
          {order.payment?.upiId && <p style={{ color: 'var(--subtext)', fontSize: 14, marginBottom: 10 }}>UPI ID: <strong style={{ color: 'var(--text)' }}>{order.payment.upiId}</strong></p>}
          {order.payment?.qrUrl && <img src={order.payment.qrUrl} alt="UPI QR code" style={{ width: 200, maxWidth: '100%', borderRadius: 12, background: 'var(--sk-surface)', padding: 8, marginBottom: 12 }} />}
          {!order.payment?.upiId && !order.payment?.qrUrl && <p style={{ color: 'var(--subtext)', fontSize: 14 }}>This club has not published payment details. Contact the club to pay.</p>}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--subtext)', margin: '14px 0 6px' }}>UPI TRANSACTION REFERENCE</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 412345678901" className="input-field" />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn-primary" disabled={busy} onClick={submit} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {busy && <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />} Submit payment
            </button>
            <button disabled={busy} onClick={cancel} style={{ padding: '0 18px', borderRadius: 50, border: '1px solid var(--border)', background: 'transparent', color: 'var(--subtext)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              Cancel order
            </button>
          </div>
        </div>
      )}
      {order.status === 'PAYMENT_SUBMITTED' && <Note>Thanks! The club is verifying your payment. You will see the status change here.</Note>}
      {order.status === 'PAID' && <Note>Payment verified. Collect your order from the club.</Note>}
      {(order.status === 'CANCELLED' || order.status === 'REJECTED') && <Note>This order is {order.status.toLowerCase()}. Reserved stock has been released.</Note>}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 14 }}>
      <span style={{ color: 'var(--subtext)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: bold ? 800 : 600, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div role="status" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, color: 'var(--subtext)', fontSize: 14 }}>{children}</div>;
}
