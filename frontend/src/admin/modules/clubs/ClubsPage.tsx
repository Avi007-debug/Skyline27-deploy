import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { invalidateClubOptions } from '../../components/common/ClubSelect';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, Field, PageHeader, Spinner } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { errorMessage, get, post } from '../../services/http';
import type { ClubRow, Paginated } from '../../types/api';

export function ClubsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const q = usePagedQuery<ClubRow>({
    fetcher: params => get<Paginated<ClubRow>>('/admin/clubs', params),
    initialFilters: { archived: undefined },
  });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Clubs"
        subtitle="Create, review and manage every club."
        actions={
          <button className="ad-btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New club
          </button>
        }
      />
      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search club name or email…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <select className="ad-field !w-auto" aria-label="Archive state" value={q.filters.archived === undefined ? '' : String(q.filters.archived)} onChange={e => q.setFilter('archived', e.target.value)}>
            <option value="">Active and archived</option>
            <option value="false">Active only</option>
            <option value="true">Archived only</option>
          </select>
        </Toolbar>
        <DataTable
          columns={[
            {
              header: 'Club',
              cell: c => (
                <div className="flex items-center gap-3">
                  {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-lg bg-ad-raised text-xs font-bold text-ad-muted">{c.name.slice(0, 2).toUpperCase()}</div>}
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-ad-faint">{c.email}</div>
                  </div>
                </div>
              ),
            },
            { header: 'Heads', cell: c => (c.admins.length ? c.admins.map(a => a.fullName).join(', ') : <span className="text-ad-faint">None</span>) },
            { header: 'Events', cell: c => c._count.events },
            { header: 'Products', cell: c => c._count.products },
            { header: 'Status', cell: c => <Badge tone={c.isArchived ? 'warn' : 'ok'}>{c.isArchived ? 'Archived' : 'Active'}</Badge> },
          ]}
          rows={q.items}
          rowKey={c => c.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          onRowClick={c => navigate(`/admin/clubs/${c.id}`)}
          emptyTitle="No clubs yet"
          emptyHint="Create a club here, or generate a registration key so a club can register itself."
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>

      <NewClubModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          invalidateClubOptions();
          toast.success('Club created.');
          q.refresh();
        }}
      />
    </>
  );
}

function NewClubModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', upiId: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Club name is required.');
    setBusy(true);
    setError(null);
    try {
      await post('/admin/clubs', form);
      setForm({ name: '', email: '', password: '', upiId: '' });
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New club" footer={<><button className="ad-btn-ghost" onClick={onClose}>Cancel</button><button className="ad-btn-primary" form="new-club" disabled={busy}>{busy && <Spinner size={16} />} Create club</button></>}>
      <form id="new-club" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Club name"><input className="ad-field" value={form.name} onChange={set('name')} /></Field>
        <Field label="Club email (login)"><input className="ad-field" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Initial password" hint="At least 8 characters with a letter and a number."><input className="ad-field" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
        <Field label="UPI ID (optional)"><input className="ad-field" value={form.upiId} onChange={set('upiId')} /></Field>
        {error && <p role="alert" className="text-sm text-ad-brand sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
