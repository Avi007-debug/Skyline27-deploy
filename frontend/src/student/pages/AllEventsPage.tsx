import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { fetchEventsPage } from '@/student/api/events';
import type { Pagination as PaginationMeta } from '@/student/api/pagination';
import type { EventModel } from '@/student/types/event';
import EventCard from '@/student/components/ui/EventCard';
import Pagination from '@/student/components/common/Pagination';
import { PageLoader } from '@/student/components/ui/LoadingSpinner';
import { ErrorState, EmptyState } from '@/student/components/ui/States';

const PAGE_SIZE = 12;

// Tab label -> server `status` filter. Filtering happens on the server so every page of results is searchable.
const TABS: Array<{ label: string; status: string }> = [
  { label: 'All', status: '' },
  { label: 'Upcoming', status: 'upcoming' },
  { label: 'Live', status: 'live' },
  { label: 'Past', status: 'past' },
];
const TYPES: Array<{ label: string; type: string }> = [
  { label: 'All types', type: '' },
  { label: 'Solo', type: 'Solo' },
  { label: 'Team', type: 'Team' },
];

const chip = (active: boolean, small = false): React.CSSProperties => ({
  padding: small ? '4px 12px' : '6px 14px',
  borderRadius: 99,
  border: '1px solid',
  borderColor: active ? 'var(--text)' : 'var(--border)',
  background: active ? (small ? 'var(--raised)' : 'var(--text)') : 'var(--surface)',
  color: active ? (small ? 'var(--text)' : 'var(--bg)') : 'var(--subtext)',
  fontFamily: 'var(--font-sans)',
  fontSize: small ? 12 : 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

/** Public catalogue: works without an account. Search, filters and paging all run on the server. */
export default function AllEventsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const [events, setEvents] = useState<EventModel[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Debounce typing; any change to the query resets to the first page.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEventsPage({ page, pageSize: PAGE_SIZE, search, status, type });
      if (id !== requestId.current) return; // a newer request superseded this one
      setEvents(result.items);
      setPagination(result.pagination);
    } catch {
      if (id !== requestId.current) return;
      setError('We could not load events right now. Check your connection and try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, type]);

  const changeFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  const hasFilters = !!(search || status || type);
  const reset = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setType('');
    setPage(1);
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 20, letterSpacing: '-0.3px' }}>All Events</h1>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--subtext)', pointerEvents: 'none' }} />
        <input
          type="search"
          placeholder="Search events, clubs or venues…"
          aria-label="Search events"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input-field"
          style={{ paddingLeft: 40 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }} role="tablist" aria-label="When">
        {TABS.map((t) => (
          <button key={t.label} role="tab" aria-selected={status === t.status} onClick={() => changeFilter(setStatus)(t.status)} style={chip(status === t.status)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
        {TYPES.map((t) => (
          <button key={t.label} onClick={() => changeFilter(setType)(t.type)} style={chip(type === t.type, true)}>
            {t.label}
          </button>
        ))}
        {hasFilters && (
          <button onClick={reset} style={{ ...chip(false, true), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <X size={12} /> Reset filters
          </button>
        )}
      </div>

      {loading && events.length === 0 && !error ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : events.length === 0 ? (
        <EmptyState
          svgSrc="/svg/empty_events.svg"
          title={search ? `No events match "${search}"` : hasFilters ? 'No events match these filters' : 'No events yet'}
          description={hasFilters ? 'Try a different search or clear the filters.' : 'Check back later for exciting campus events!'}
          action={hasFilters ? <button onClick={reset} className="btn-primary">Reset filters</button> : undefined}
        />
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }} aria-busy={loading}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
          <Pagination pagination={pagination} onPage={setPage} disabled={loading} />
        </div>
      )}
    </div>
  );
}
