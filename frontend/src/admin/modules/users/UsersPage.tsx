import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Field, PageHeader, Spinner } from '../../components/common/ui';
import type { Tone } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { errorMessage, get, post } from '../../services/http';
import type { Paginated, Role, UserRow } from '../../types/api';
import { formatDate, titleCase } from '../../utils/format';

export const roleTone: Record<Role, Tone> = { SUPER_ADMIN: 'bad', CLUB_HEAD: 'info', STUDENT: 'neutral' };

export function UsersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const q = usePagedQuery<UserRow>({
    fetcher: params => get<Paginated<UserRow>>('/admin/users', params),
    initialFilters: { role: undefined, active: undefined },
  });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Every account on the platform."
        actions={
          <button className="ad-btn-primary" onClick={() => setCreating(true)}>
            <UserPlus size={16} /> New super admin
          </button>
        }
      />
      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search name, email or USN…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <select className="ad-field !w-auto" aria-label="Role" value={(q.filters.role as string) ?? ''} onChange={e => q.setFilter('role', e.target.value)}>
            <option value="">All roles</option>
            <option value="STUDENT">Student</option>
            <option value="CLUB_HEAD">Club head</option>
            <option value="SUPER_ADMIN">Super admin</option>
          </select>
          <select className="ad-field !w-auto" aria-label="Status" value={q.filters.active === undefined ? '' : String(q.filters.active)} onChange={e => q.setFilter('active', e.target.value)}>
            <option value="">Any status</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select>
        </Toolbar>
        <DataTable
          columns={[
            {
              header: 'Name',
              cell: u => (
                <div>
                  <div className="font-semibold">{u.fullName}</div>
                  <div className="text-xs text-ad-faint">{u.email}</div>
                </div>
              ),
            },
            { header: 'Role', cell: u => <Badge tone={roleTone[u.role]}>{titleCase(u.role)}</Badge> },
            { header: 'Club', cell: u => u.club?.name ?? <span className="text-ad-faint">—</span> },
            { header: 'USN', cell: u => u.usn ?? <span className="text-ad-faint">—</span> },
            { header: 'Status', cell: u => <Badge tone={u.isActive === false ? 'warn' : 'ok'}>{u.isActive === false ? 'Deactivated' : 'Active'}</Badge> },
            { header: 'Joined', cell: u => formatDate(u.createdAt) },
          ]}
          rows={q.items}
          rowKey={u => u.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          onRowClick={u => navigate(`/admin/users/${u.id}`)}
          emptyTitle="No users yet"
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>

      <NewAdminModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          toast.success('Super admin created.');
          q.refresh();
        }}
      />
    </>
  );
}

function NewAdminModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await post('/admin/users/super-admin', { name, email, password });
      setName('');
      setEmail('');
      setPassword('');
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New super admin"
      width="sm"
      footer={
        <>
          <button className="ad-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="ad-btn-primary" form="new-admin" disabled={busy}>
            {busy && <Spinner size={16} />} Create
          </button>
        </>
      }
    >
      <form id="new-admin" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name">
          <input className="ad-field" value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="ad-field" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Initial password" hint="At least 8 characters with a letter and a number.">
          <input className="ad-field" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-ad-brand">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
