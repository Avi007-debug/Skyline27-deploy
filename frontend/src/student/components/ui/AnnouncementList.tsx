import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Megaphone, Users } from 'lucide-react';
import { fetchClubAnnouncements } from '@/student/api/memberships';
import type { Announcement } from '@/student/api/memberships';

const CATEGORY = {
  MEETING: { label: 'Meeting', color: '#2563eb', Icon: Users },
  DEADLINE: { label: 'Deadline', color: '#dc2626', Icon: CalendarClock },
  GENERAL: { label: 'Update', color: '#6b7280', Icon: Megaphone },
} as const;

/** A club's official announcement timeline (public), newest first. */
export default function AnnouncementList({ clubId }: { clubId: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const r = await fetchClubAnnouncements(clubId, p);
        setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items]));
        setPages(r.pagination.totalPages);
        setPage(p);
        setFailed(false);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [clubId]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  if (!loading && !failed && items.length === 0) return null;

  return (
    <section aria-label="Announcements" style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Announcements</h2>
      {failed && <p style={{ color: 'var(--subtext)', fontSize: 14 }}>Announcements could not be loaded right now.</p>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {items.map((a) => {
          const c = CATEGORY[a.category] ?? CATEGORY.GENERAL;
          return (
            <li key={a.id} className="spotlight-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: c.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <c.Icon size={13} /> {c.label}
                </span>
                <time dateTime={a.createdAt} style={{ color: 'var(--subtext)', fontSize: 12 }}>
                  {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </time>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{a.title}</div>
              <p style={{ margin: 0, color: 'var(--subtext)', fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.content}</p>
            </li>
          );
        })}
      </ol>
      {page < pages && (
        <button
          onClick={() => load(page + 1)}
          disabled={loading}
          style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
        >
          {loading ? 'Loading…' : 'Show older'}
        </button>
      )}
    </section>
  );
}
