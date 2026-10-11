import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ClubSelect } from '../../components/common/ClubSelect';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, ErrorState, Field, PageHeader, PageLoader, Spinner } from '../../components/common/ui';
import { useAuth } from '@/shared/AuthProvider';
import { del, errorMessage, get, put } from '../../services/http';
import type { Role, UserRow } from '../../types/api';
import { formatDate, formatDateTime, formatEventDate, formatPaise, titleCase } from '../../utils/format';
import { roleTone } from './UsersPage';

interface UserDetail extends UserRow {
  registrations: Array<{ id: string; status: string; createdAt: string; event: { id: string; name: string; eventDate: string } }>;
  orders: Array<{ id: string; productName: string; variantLabel: string; quantity: number; totalPaise: number; status: string; createdAt: string }>;
}

export function UserDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile: me } = useAuth();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'edit' | 'role' | 'status' | 'delete' | null>(null);

  const load = useCallback(() => {
    setError(null);
    get<{ user: UserDetail }>(`/admin/users/${id}`)
      .then(r => setUser(r.user))
      .catch(e => setError(errorMessage(e, 'Could not load this user.')));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!user) return <PageLoader />;
  const isMe = user.id === me?.id;
  const active = user.isActive !== false;

  const toggleStatus = async () => {
    await put(`/admin/users/${user.id}/status`, { isActive: !active });
    toast.success(active ? 'Account deactivated. They are signed out immediately.' : 'Account reactivated.');
    load();
  };
  const remove = async () => {
    await del(`/admin/users/${user.id}`, { confirm: user.email });
    toast.success('User deleted.');
    navigate('/admin/users', { replace: true });
  };

  return (
    <>
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ad-muted hover:text-ad-fg">
        <ArrowLeft size={15} /> All users
      </Link>
      <PageHeader
        title={user.fullName}
        subtitle={user.email}
        actions={
          <>
            <button className="ad-btn-ghost" onClick={() => setDialog('edit')}>
              Edit details
            </button>
            <button className="ad-btn-ghost" onClick={() => setDialog('role')} disabled={isMe} title={isMe ? 'You cannot change your own role' : undefined}>
              Change role
            </button>
            <button className="ad-btn-ghost" onClick={() => setDialog('status')} disabled={isMe}>
              {active ? 'Deactivate' : 'Reactivate'}
            </button>
            <button className="ad-btn-danger" onClick={() => setDialog('delete')} disabled={isMe || user.role === 'SUPER_ADMIN'}>
              Delete
            </button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ad-card p-5 lg:col-span-1" aria-label="Profile">
          <dl className="space-y-3 text-sm">
            <Row label="Role">
              <Badge tone={roleTone[user.role]}>{titleCase(user.role)}</Badge>
            </Row>
            <Row label="Status">
              <Badge tone={active ? 'ok' : 'warn'}>{active ? 'Active' : 'Deactivated'}</Badge>
            </Row>
            <Row label="Club">{user.club ? <Link className="text-ad-brand" to={`/admin/clubs/${user.club.id}`}>{user.club.name}</Link> : '—'}</Row>
            <Row label="USN">{user.usn ?? '—'}</Row>
            <Row label="Branch">{user.branch ?? '—'}</Row>
            <Row label="Phone">{user.phone ?? '—'}</Row>
            <Row label="Year / Sem">{user.year ?? '—'} / {user.sem ?? '—'}</Row>
            <Row label="Joined">{formatDate(user.createdAt)}</Row>
          </dl>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="ad-card" aria-label="Recent registrations">
            <h2 className="border-b border-ad-line px-5 py-4 font-bold">Recent registrations</h2>
            {user.registrations.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ad-muted">No registrations.</p>
            ) : (
              <ul className="divide-y divide-ad-line/60">
                {user.registrations.map(r => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <Link to={`/admin/events/${r.event.id}`} className="font-semibold hover:text-ad-brand">
                      {r.event.name}
                    </Link>
                    <span className="flex items-center gap-3 text-xs text-ad-faint">
                      {formatEventDate(r.event.eventDate)}
                      <Badge tone={r.status === 'CONFIRMED' ? 'ok' : r.status === 'REJECTED' ? 'bad' : 'warn'}>{titleCase(r.status)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="ad-card" aria-label="Recent orders">
            <h2 className="border-b border-ad-line px-5 py-4 font-bold">Recent orders</h2>
            {user.orders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ad-muted">No orders.</p>
            ) : (
              <ul className="divide-y divide-ad-line/60">
                {user.orders.map(o => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span>
                      <strong>{o.productName}</strong> <span className="text-ad-muted">{o.variantLabel} × {o.quantity}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-ad-faint">
                      {formatPaise(o.totalPaise)} · {formatDateTime(o.createdAt)}
                      <Badge tone={o.status === 'PAID' ? 'ok' : 'neutral'}>{titleCase(o.status)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <EditUserModal open={dialog === 'edit'} user={user} onClose={() => setDialog(null)} onSaved={() => { toast.success('Details saved.'); load(); }} />
      <RoleModal open={dialog === 'role'} user={user} onClose={() => setDialog(null)} onSaved={() => { toast.success('Role updated.'); load(); }} />
      <ConfirmDialog
        open={dialog === 'status'}
        onClose={() => setDialog(null)}
        title={active ? 'Deactivate account?' : 'Reactivate account?'}
        message={active ? `${user.fullName} will be signed out and unable to log in until reactivated. Their records are kept.` : `${user.fullName} will be able to sign in again.`}
        confirmLabel={active ? 'Deactivate' : 'Reactivate'}
        danger={active}
        onConfirm={toggleStatus}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete user permanently?"
        message="Their registrations are removed. Orders and audit entries keep a snapshot. Deactivating is usually the safer choice."
        confirmLabel="Delete user"
        danger
        requireText={user.email}
        onConfirm={remove}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ad-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function EditUserModal({ open, user, onClose, onSaved }: { open: boolean; user: UserDetail; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', usn: '', branch: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ fullName: user.fullName, email: user.email, usn: user.usn ?? '', branch: user.branch ?? '', phone: user.phone ?? '' });
      setError(null);
    }
  }, [open, user]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await put(`/admin/users/${user.id}`, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit details" footer={<><button className="ad-btn-ghost" onClick={onClose}>Cancel</button><button className="ad-btn-primary" form="edit-user" disabled={busy}>{busy && <Spinner size={16} />} Save</button></>}>
      <form id="edit-user" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Full name"><input className="ad-field" value={form.fullName} onChange={set('fullName')} /></Field>
        <Field label="Email"><input className="ad-field" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="USN"><input className="ad-field" value={form.usn} onChange={set('usn')} /></Field>
        <Field label="Branch"><input className="ad-field" value={form.branch} onChange={set('branch')} /></Field>
        <Field label="Phone"><input className="ad-field" value={form.phone} onChange={set('phone')} /></Field>
        {error && <p role="alert" className="text-sm text-ad-brand sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}

function RoleModal({ open, user, onClose, onSaved }: { open: boolean; user: UserDetail; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [clubId, setClubId] = useState(user.clubId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRole(user.role);
      setClubId(user.clubId ?? '');
      setError(null);
    }
  }, [open, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (role === 'CLUB_HEAD' && !clubId) return setError('Choose the club this person will head.');
    setBusy(true);
    setError(null);
    try {
      await put(`/admin/users/${user.id}/role`, { role, clubId: role === 'CLUB_HEAD' ? clubId : undefined });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change role" width="sm" footer={<><button className="ad-btn-ghost" onClick={onClose}>Cancel</button><button className="ad-btn-primary" form="role-form" disabled={busy}>{busy && <Spinner size={16} />} Save role</button></>}>
      <form id="role-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Role">
          <select className="ad-field" value={role} onChange={e => setRole(e.target.value as Role)}>
            <option value="STUDENT">Student</option>
            <option value="CLUB_HEAD">Club head</option>
            <option value="SUPER_ADMIN">Super admin</option>
          </select>
        </Field>
        {role === 'CLUB_HEAD' && (
          <Field label="Club">
            <ClubSelect value={clubId} onChange={setClubId} allLabel="Select a club…" className="" label="Club to head" />
          </Field>
        )}
        {role === 'SUPER_ADMIN' && <p className="text-sm text-ad-warn">Super admins can manage every club, user and key. Grant this carefully.</p>}
        {role === 'STUDENT' && user.role !== 'STUDENT' && <p className="text-sm text-ad-muted">They will lose access to any club they manage.</p>}
        {error && <p role="alert" className="text-sm text-ad-brand">{error}</p>}
      </form>
    </Modal>
  );
}
