import { Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ClubSelect } from '../../components/common/ClubSelect';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, PageHeader, Spinner } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { del, download, errorMessage, get, put } from '../../services/http';
import type { Paginated, RegistrationRow } from '../../types/api';
import { formatDateTime, formatRupees, titleCase } from '../../utils/format';

const payTone = { FREE: 'neutral', UNPAID: 'warn', SUBMITTED: 'info', VERIFIED: 'ok' } as const;

export function RegistrationsPage() {
  const toast = useToast();
  const q = usePagedQuery<RegistrationRow>({
    fetcher: params => get<Paginated<RegistrationRow>>('/admin/registrations', params),
    initialFilters: { status: undefined, clubId: undefined, from: undefined, to: undefined },
  });
  const [exporting, setExporting] = useState(false);
  const [removing, setRemoving] = useState<RegistrationRow | null>(null);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { page: _p, pageSize: _s, ...filters } = { page: q.page, pageSize: q.pageSize, search: q.search, ...q.filters };
      await download('/admin/reports/registrations.csv', filters, 'skyline_registrations.csv');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const setStatus = async (r: RegistrationRow, status: string) => {
    try {
      await put(`/admin/registrations/${r.id}/status`, { status });
      toast.success(`Marked ${titleCase(status)}.`);
      q.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Registrations"
        subtitle="Every registration across all events, with payment state."
        actions={
          <button className="ad-btn-ghost" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Spinner size={15} /> : <Download size={15} />} Export CSV
          </button>
        }
      />
      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search student, email, USN, event or team…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <select className="ad-field !w-auto" aria-label="Status" value={(q.filters.status as string) ?? ''} onChange={e => q.setFilter('status', e.target.value)}>
            <option value="">Any status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <ClubSelect value={(q.filters.clubId as string) ?? ''} onChange={v => q.setFilter('clubId', v)} />
          <label className="flex items-center gap-2 text-xs text-ad-muted">From <input type="date" className="ad-field !w-auto" value={(q.filters.from as string) ?? ''} onChange={e => q.setFilter('from', e.target.value)} /></label>
          <label className="flex items-center gap-2 text-xs text-ad-muted">To <input type="date" className="ad-field !w-auto" value={(q.filters.to as string) ?? ''} onChange={e => q.setFilter('to', e.target.value)} /></label>
        </Toolbar>
        <DataTable
          columns={[
            { header: 'Student', cell: r => (<div><div className="font-semibold">{r.profile?.fullName ?? '—'}</div><div className="text-xs text-ad-faint">{r.profile?.email}{r.profile?.usn ? ` · ${r.profile.usn}` : ''}</div></div>) },
            { header: 'Event', cell: r => (<div><Link to={`/admin/events/${r.event.id}`} className="font-semibold hover:text-ad-brand">{r.event.name}</Link><div className="text-xs text-ad-faint">{r.event.club.name}{r.team ? ` · Team ${r.team.teamName}` : ''}</div></div>) },
            { header: 'Fee', cell: r => formatRupees(r.event.fee) },
            { header: 'Payment', cell: r => <Badge tone={payTone[r.paymentStatus]}>{titleCase(r.paymentStatus)}</Badge> },
            { header: 'Status', cell: r => <Badge tone={r.status === 'CONFIRMED' ? 'ok' : r.status === 'REJECTED' ? 'bad' : 'warn'}>{titleCase(r.status)}</Badge> },
            { header: 'Registered', cell: r => formatDateTime(r.createdAt) },
            {
              header: 'Actions',
              cell: r => (
                <div className="flex gap-1.5">
                  <select className="ad-field !w-auto !py-1 text-xs" aria-label="Change status" value={r.status} onChange={e => setStatus(r, e.target.value)}>
                    <option value="PENDING">Pending</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <button className="ad-btn-danger ad-btn-sm" onClick={() => setRemoving(r)}>Delete</button>
                </div>
              ),
            },
          ]}
          rows={q.items}
          rowKey={r => r.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          emptyTitle="No registrations yet"
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete registration?"
        message={removing ? `${removing.profile?.fullName ?? 'This student'}'s registration for ${removing.event.name} will be removed. Prefer 'Rejected' to keep a record.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!removing) return;
          await del(`/admin/registrations/${removing.id}`);
          toast.success('Registration deleted.');
          q.refresh();
        }}
      />
    </>
  );
}
