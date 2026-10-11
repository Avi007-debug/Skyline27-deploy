import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ClubSelect } from '../../components/common/ClubSelect';
import { useToast } from '../../components/common/Toast';
import { Badge, PageHeader } from '../../components/common/ui';
import type { Tone } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { get } from '../../services/http';
import type { EventRow, Paginated } from '../../types/api';
import { formatEventTime, formatRupees, titleCase } from '../../utils/format';
import { EventFormModal } from './EventForm';

export const stateTone: Record<EventRow['registrationState'], Tone> = { OPEN: 'ok', UPCOMING: 'info', CLOSED: 'warn', SOLD_OUT: 'bad', ENDED: 'neutral', UNPUBLISHED: 'neutral' };

export function visibilityBadge(e: Pick<EventRow, 'isArchived' | 'isPublished'>) {
  return e.isArchived ? <Badge tone="warn">Archived</Badge> : e.isPublished ? <Badge tone="ok">Published</Badge> : <Badge>Draft</Badge>;
}

export function EventsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const q = usePagedQuery<EventRow>({
    fetcher: params => get<Paginated<EventRow>>('/events/manage/list', params),
    initialFilters: { clubId: undefined, visibility: undefined, status: undefined },
  });

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Every club's events, drafts and archives."
        actions={
          <button className="ad-btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New event
          </button>
        }
      />
      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search events, venues or clubs…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <ClubSelect value={(q.filters.clubId as string) ?? ''} onChange={v => q.setFilter('clubId', v)} />
          <select className="ad-field !w-auto" aria-label="Visibility" value={(q.filters.visibility as string) ?? ''} onChange={e => q.setFilter('visibility', e.target.value)}>
            <option value="">Published and drafts</option>
            <option value="published">Published</option>
            <option value="unpublished">Drafts</option>
            <option value="archived">Archived</option>
            <option value="all">Everything</option>
          </select>
          <select className="ad-field !w-auto" aria-label="Timing" value={(q.filters.status as string) ?? ''} onChange={e => q.setFilter('status', e.target.value)}>
            <option value="">Any time</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live now</option>
            <option value="past">Past</option>
            <option value="open">Registration open</option>
            <option value="closed">Registration closed</option>
          </select>
        </Toolbar>
        <DataTable
          columns={[
            {
              header: 'Event',
              cell: e => (
                <div>
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-xs text-ad-faint">{e.club?.name ?? '—'} · {e.venue}</div>
                </div>
              ),
            },
            { header: 'Starts', cell: e => formatEventTime(e.eventDate) },
            { header: 'Fee', cell: e => formatRupees(e.fee) },
            { header: 'Registered', cell: e => `${e.registrationCount} / ${e.registrationLimit}` },
            { header: 'Registration', cell: e => <Badge tone={stateTone[e.registrationState]}>{titleCase(e.registrationState)}</Badge> },
            { header: 'Visibility', cell: e => visibilityBadge(e) },
          ]}
          rows={q.items}
          rowKey={e => e.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          onRowClick={e => navigate(`/admin/events/${e.id}`)}
          emptyTitle="No events yet"
          emptyHint="Events created by club heads appear here."
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>

      <EventFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={e => {
          toast.success(`"${e.name}" created.`);
          q.refresh();
          navigate(`/admin/events/${e.id}`);
        }}
      />
    </>
  );
}
