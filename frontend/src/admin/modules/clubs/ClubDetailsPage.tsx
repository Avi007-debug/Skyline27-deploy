import { ArrowLeft, UserMinus, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { invalidateClubOptions } from '../../components/common/ClubSelect';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, ErrorState, Field, PageHeader, PageLoader, Spinner } from '../../components/common/ui';
import { del, errorMessage, get, post, put } from '../../services/http';
import type { ClubHead, ClubRow, Paginated, UserRow } from '../../types/api';
import { formatEventDate, formatNumber } from '../../utils/format';

interface ClubDetail extends Omit<ClubRow, '_count'> {
  events: Array<{ id: string; name: string; eventDate: string; isPublished: boolean; isArchived: boolean; _count: { registrations: number } }>;
  _count: { events: number; products: number; registrationKeys: number };
}
interface ClubStats {
  eventsCount: number;
  publishedEventsCount: number;
  upcomingEventsCount: number;
  registrationsCount: number;
  pendingCount: number;
}

export function ClubDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<{ club: ClubDetail; stats: ClubStats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'edit' | 'head' | 'archive' | 'delete' | { removeHead: ClubHead } | null>(null);

  const load = useCallback(() => {
    setError(null);
    get<{ club: ClubDetail; stats: ClubStats }>(`/admin/clubs/${id}`)
      .then(setData)
      .catch(e => setError(errorMessage(e, 'Could not load this club.')));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <PageLoader />;
  const { club, stats } = data;

  const toggleArchive = async () => {
    await post(`/admin/clubs/${club.id}/${club.isArchived ? 'restore' : 'archive'}`);
    invalidateClubOptions();
    toast.success(club.isArchived ? 'Club restored.' : 'Club archived and hidden from the public.');
    load();
  };
  const remove = async () => {
    await del(`/admin/clubs/${club.id}`, { confirm: club.name });
    invalidateClubOptions();
    toast.success('Club deleted.');
    navigate('/admin/clubs', { replace: true });
  };

  return (
    <>
      <Link to="/admin/clubs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ad-muted hover:text-ad-fg">
        <ArrowLeft size={15} /> All clubs
      </Link>
      <PageHeader
        title={club.name}
        subtitle={club.email}
        actions={
          <>
            <button className="ad-btn-ghost" onClick={() => setDialog('edit')}>Edit club</button>
            <button className="ad-btn-ghost" onClick={() => setDialog('archive')}>{club.isArchived ? 'Restore' : 'Archive'}</button>
            <button className="ad-btn-danger" onClick={() => setDialog('delete')}>Delete</button>
          </>
        }
      />
      {club.isArchived && <p role="status" className="mb-6 rounded-xl border border-ad-warn/30 bg-ad-warn/10 px-4 py-3 text-sm text-ad-warn">This club is archived: its events and products are hidden from the public and its heads cannot sign in.</p>}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Club statistics">
        <Mini label="Events" value={formatNumber(stats.eventsCount)} sub={`${stats.publishedEventsCount} published`} />
        <Mini label="Upcoming" value={formatNumber(stats.upcomingEventsCount)} />
        <Mini label="Active registrations" value={formatNumber(stats.registrationsCount)} sub={`${stats.pendingCount} pending`} />
        <Mini label="Products" value={formatNumber(club._count.products)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ad-card" aria-label="Club heads">
          <div className="flex items-center justify-between border-b border-ad-line px-5 py-4">
            <h2 className="font-bold">Club heads</h2>
            <button className="ad-btn-ghost ad-btn-sm" onClick={() => setDialog('head')} disabled={club.isArchived}>
              <UserPlus size={14} /> Assign head
            </button>
          </div>
          {club.admins.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ad-muted">No head assigned. Nobody can manage this club yet.</p>
          ) : (
            <ul className="divide-y divide-ad-line/60">
              {club.admins.map(h => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <Link to={`/admin/users/${h.id}`} className="font-semibold hover:text-ad-brand">{h.fullName}</Link>
                    <div className="truncate text-xs text-ad-faint">{h.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!h.isActive && <Badge tone="warn">Deactivated</Badge>}
                    <button className="ad-btn-ghost ad-btn-sm" onClick={() => setDialog({ removeHead: h })} aria-label={`Remove ${h.fullName} as head`}>
                      <UserMinus size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ad-card" aria-label="Club events">
          <h2 className="border-b border-ad-line px-5 py-4 font-bold">Events</h2>
          {club.events.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ad-muted">No events yet.</p>
          ) : (
            <ul className="divide-y divide-ad-line/60">
              {club.events.map(e => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <Link to={`/admin/events/${e.id}`} className="font-semibold hover:text-ad-brand">{e.name}</Link>
                  <span className="flex items-center gap-2 text-xs text-ad-faint">
                    {formatEventDate(e.eventDate)} · {e._count.registrations} reg.
                    {e.isArchived ? <Badge tone="warn">Archived</Badge> : !e.isPublished ? <Badge>Draft</Badge> : <Badge tone="ok">Live</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <EditClubModal open={dialog === 'edit'} club={club} onClose={() => setDialog(null)} onSaved={() => { invalidateClubOptions(); toast.success('Club saved.'); load(); }} />
      <AssignHeadModal open={dialog === 'head'} clubId={club.id} onClose={() => setDialog(null)} onAssigned={() => { toast.success('Club head assigned.'); load(); }} />
      <ConfirmDialog
        open={dialog === 'archive'}
        onClose={() => setDialog(null)}
        title={club.isArchived ? 'Restore club?' : 'Archive club?'}
        message={club.isArchived ? 'The club, its events and products become visible again.' : 'The club, all its events and products are hidden from the public and its heads cannot sign in. Nothing is deleted.'}
        confirmLabel={club.isArchived ? 'Restore' : 'Archive'}
        danger={!club.isArchived}
        onConfirm={toggleArchive}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete club permanently?"
        message="Only possible when the club has no registrations, orders or ledger entries; otherwise archive it to keep its history. Its heads become students."
        confirmLabel="Delete club"
        danger
        requireText={club.name}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={typeof dialog === 'object' && dialog !== null && 'removeHead' in dialog}
        onClose={() => setDialog(null)}
        title="Remove club head?"
        message={typeof dialog === 'object' && dialog && 'removeHead' in dialog ? `${dialog.removeHead.fullName} will become a student and lose access to this club.` : ''}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (typeof dialog === 'object' && dialog && 'removeHead' in dialog) {
            await del(`/admin/clubs/${club.id}/heads/${dialog.removeHead.id}`);
            toast.success('Club head removed.');
            load();
          }
        }}
      />
    </>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ad-card p-5">
      <div className="text-[11px] font-semibold tracking-normal text-ad-faint">{label}</div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs text-ad-muted">{sub}</div>}
    </div>
  );
}

function EditClubModal({ open, club, onClose, onSaved }: { open: boolean; club: ClubDetail; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', upiId: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ name: club.name, email: club.email, upiId: club.upiId ?? '' });
      setError(null);
    }
  }, [open, club]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await put(`/admin/clubs/${club.id}`, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Edit club" footer={<><button className="ad-btn-ghost" onClick={onClose}>Cancel</button><button className="ad-btn-primary" form="edit-club" disabled={busy}>{busy && <Spinner size={16} />} Save</button></>}>
      <form id="edit-club" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Club name"><input className="ad-field" value={form.name} onChange={set('name')} /></Field>
        <Field label="Club email"><input className="ad-field" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="UPI ID"><input className="ad-field" value={form.upiId} onChange={set('upiId')} /></Field>
        {error && <p role="alert" className="text-sm text-ad-brand">{error}</p>}
      </form>
    </Modal>
  );
}

function AssignHeadModal({ open, clubId, onClose, onAssigned }: { open: boolean; clubId: string; onClose: () => void; onAssigned: () => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      get<Paginated<UserRow>>('/admin/users', { search: term.trim(), pageSize: 8, active: true })
        .then(r => setResults(r.items.filter(u => u.role !== 'SUPER_ADMIN' && u.clubId !== clubId)))
        .catch(e => setError(errorMessage(e)))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [term, open, clubId]);

  const assign = async (u: UserRow) => {
    setAssigning(u.id);
    setError(null);
    try {
      await put(`/admin/clubs/${clubId}/assign-head`, { userId: u.id });
      onAssigned();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAssigning(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign club head" footer={<button className="ad-btn-ghost" onClick={onClose}>Close</button>}>
      <Field label="Find a user" hint="Type at least 2 characters of a name, email or USN.">
        <input className="ad-field" value={term} onChange={e => setTerm(e.target.value)} autoFocus />
      </Field>
      {error && <p role="alert" className="mt-3 text-sm text-ad-brand">{error}</p>}
      <ul className="mt-4 divide-y divide-ad-line/60" aria-live="polite">
        {searching && <li className="py-3 text-sm text-ad-muted"><Spinner size={14} /> Searching…</li>}
        {!searching && term.trim().length >= 2 && results.length === 0 && <li className="py-3 text-sm text-ad-muted">No eligible users found.</li>}
        {results.map(u => (
          <li key={u.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0">
              <div className="font-semibold">{u.fullName}</div>
              <div className="truncate text-xs text-ad-faint">{u.email}{u.club ? ` · currently heads ${u.club.name}` : ''}</div>
            </div>
            <button className="ad-btn-primary ad-btn-sm" disabled={assigning === u.id} onClick={() => assign(u)}>
              {assigning === u.id && <Spinner size={14} />} Assign
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
