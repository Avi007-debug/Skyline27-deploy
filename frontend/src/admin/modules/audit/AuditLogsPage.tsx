import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { get } from '../../services/http';
import type { AuditRow, Paginated } from '../../types/api';
import { formatDateTime, titleCase } from '../../utils/format';

const ENTITIES = ['Profile', 'Club', 'Event', 'Registration', 'RegistrationKey', 'Product', 'Order', 'ExpenseClaim', 'Report'];

function prettyDetails(details: string | null): string {
  if (!details) return 'No additional details.';
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

export function AuditLogsPage() {
  const q = usePagedQuery<AuditRow>({
    fetcher: params => get<Paginated<AuditRow>>('/admin/audit-logs', params),
    initialFilters: { entityType: undefined },
    pageSize: 25,
  });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Who changed what, across the platform. Entries cannot be edited." />
      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search action, record ID or actor email…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <select className="ad-field !w-auto" aria-label="Record type" value={(q.filters.entityType as string) ?? ''} onChange={e => q.setFilter('entityType', e.target.value)}>
            <option value="">All record types</option>
            {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </Toolbar>
        <DataTable
          columns={[
            {
              header: '',
              className: 'w-8',
              cell: l => (
                <button className="rounded p-1 text-ad-muted hover:bg-ad-raised" aria-label={open === l.id ? 'Hide details' : 'Show details'} aria-expanded={open === l.id} onClick={e => { e.stopPropagation(); setOpen(o => (o === l.id ? null : l.id)); }}>
                  {open === l.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
              ),
            },
            {
              header: 'Action',
              cell: l => (
                <div>
                  <div className="font-semibold">{titleCase(l.action)}</div>
                  {open === l.id && <pre className="mt-2 max-w-xl overflow-x-auto whitespace-pre-wrap rounded-lg bg-ad-raised p-3 font-mono text-xs text-ad-muted">{prettyDetails(l.details)}</pre>}
                </div>
              ),
            },
            { header: 'Record', cell: l => (<div><div>{l.entityType}</div><div className="max-w-[180px] truncate font-mono text-xs text-ad-faint" title={l.entityId}>{l.entityId}</div></div>) },
            { header: 'By', cell: l => (l.actor ? <div><div>{l.actor.fullName}</div><div className="text-xs text-ad-faint">{l.actor.email}</div></div> : <span className="text-ad-faint">System</span>) },
            { header: 'When', cell: l => formatDateTime(l.createdAt) },
          ]}
          rows={q.items}
          rowKey={l => l.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          emptyTitle="No activity recorded yet"
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>
    </>
  );
}
