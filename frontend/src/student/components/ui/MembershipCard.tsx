import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clock, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/student/store/authStore';
import { cancelPendingMembership, fetchClubOffer, joinClub } from '@/student/api/memberships';
import type { ClubOffer, MembershipStanding } from '@/student/api/memberships';
import { useNavigate } from 'react-router';
import { loginUrl } from '@/shared/session';

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/**
 * Membership panel for one club: what dues cost, the student's standing, and the join / renew flow
 * (pay by UPI, submit the reference, the club verifies it). Students only; club heads and admins
 * manage memberships from their own dashboards.
 */
export default function MembershipCard({ clubId, clubName }: { clubId: string; clubName: string }) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const [offer, setOffer] = useState<ClubOffer | null>(null);
  const [standing, setStanding] = useState<MembershipStanding | null>(null);
  const [paying, setPaying] = useState(false);
  const [txn, setTxn] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetchClubOffer(clubId);
      setOffer(r.club);
      setStanding(r.membership);
    } catch {
      setOffer(null);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load, isAuthenticated]);

  if (!offer || (isAuthenticated && role !== 'STUDENT')) return null;

  const state = standing?.state ?? 'NONE';
  const canJoin = state === 'NONE' || state === 'EXPIRED' || state === 'EXPIRING';
  const label = state === 'NONE' ? 'Join' : 'Renew';

  const start = () => {
    if (!isAuthenticated) {
      navigate(loginUrl(`/clubs/${clubId}`));
      return;
    }
    if (offer.free) void submit();
    else setPaying(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const message = await joinClub(clubId, txn.trim());
      toast.success(message);
      setPaying(false);
      setTxn('');
      await load();
    } catch (e) {
      toast.error(String(e).replace('Error: ', ''));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!standing?.pendingPayment) return;
    try {
      await cancelPendingMembership(standing.pendingPayment.id);
      toast.success('Payment withdrawn.');
      await load();
    } catch (e) {
      toast.error(String(e).replace('Error: ', ''));
    }
  };

  const tone = state === 'ACTIVE' ? '#16a34a' : state === 'EXPIRING' ? '#d97706' : state === 'EXPIRED' ? '#dc2626' : 'var(--subtext)';

  return (
    <section className="spotlight-card" style={{ padding: 18, marginBottom: 24 }} aria-label="Club membership">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ color: tone }}>{state === 'ACTIVE' || state === 'EXPIRING' ? <BadgeCheck size={26} /> : <Users size={26} />}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 15 }}>
              {state === 'ACTIVE' && `Member of ${clubName}`}
              {state === 'EXPIRING' && `Your ${clubName} membership ends soon`}
              {state === 'EXPIRED' && `Your ${clubName} membership has expired`}
              {state === 'NONE' && `Become a member of ${clubName}`}
            </div>
            <div style={{ color: 'var(--subtext)', fontSize: 13 }}>
              {state === 'ACTIVE' || state === 'EXPIRING'
                ? `Valid until ${day(standing!.endDate)}${standing!.daysLeft !== null && state === 'EXPIRING' ? ` (${standing!.daysLeft} day${standing!.daysLeft === 1 ? '' : 's'} left)` : ''}`
                : state === 'EXPIRED'
                  ? `Ended ${day(standing!.endDate)}. Renew to get member prices again.`
                  : `${offer.free ? 'Free' : rupees(offer.membershipFeePaise)} for ${offer.membershipMonths} month${offer.membershipMonths === 1 ? '' : 's'} · discounted event tickets and merchandise`}
            </div>
          </div>
        </div>

        {standing?.pendingPayment ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#d97706', fontWeight: 600 }}>
            <Clock size={16} /> Payment awaiting review
            <button onClick={withdraw} style={{ background: 'none', border: 'none', color: 'var(--subtext)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
              Withdraw
            </button>
          </div>
        ) : (
          canJoin &&
          !paying && (
            <button
              onClick={start}
              disabled={busy}
              style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'var(--color-crimson)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : `${label}${offer.free ? '' : ` · ${rupees(offer.membershipFeePaise)}`}`}
            </button>
          )
        )}
      </div>

      {paying && offer.payment && (
        <div style={{ marginTop: 16, display: 'grid', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p style={{ margin: 0, color: 'var(--subtext)', fontSize: 13 }}>
            Pay {rupees(offer.membershipFeePaise)} by UPI{offer.payment.upiId ? ` to ${offer.payment.upiId}` : ''}, then enter the transaction reference.
          </p>
          {offer.payment.qrUrl && <img src={offer.payment.qrUrl} alt={`${clubName} payment QR code`} style={{ width: 160, height: 160, objectFit: 'contain', borderRadius: 12, background: '#fff', padding: 6 }} />}
          <input
            value={txn}
            onChange={(e) => setTxn(e.target.value)}
            placeholder="UPI transaction reference"
            aria-label="UPI transaction reference"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={submit}
              disabled={busy || txn.trim().length < 6}
              style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'var(--color-crimson)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: busy || txn.trim().length < 6 ? 0.6 : 1 }}
            >
              {busy ? 'Submitting…' : 'Submit payment'}
            </button>
            <button onClick={() => setPaying(false)} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
