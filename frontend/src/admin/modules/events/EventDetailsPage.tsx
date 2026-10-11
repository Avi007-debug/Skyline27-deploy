import { ArrowLeft, Check, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, ErrorState, PageHeader, PageLoader } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { del, errorMessage, get, post, put } from '../../services/http';
import type { EventRow, Paginated } from '../../types/api';
import { formatEventTime, formatRupees, titleCase } from '../../utils/format';
import { EventFormModal } from './EventForm';
import { stateTone, visibilityBadge } from './EventsPage';

interface EventReg {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  transaction_id: string | null;
  created_at: string;
  checkedInAt: string | null;
  user: { id: string; name: string; email: string; usn: string | null; phone: string | null } | null;
  team: { id: string; name: string } | null;
}

type Dialog = 'edit' | 'close' | 'reopen' | 'publish' | 'unpublish' | 'archive' | 'restore' | 'delete' | 'purge' | null;

export function EventDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(() => {
    setError(null);
    get<{ event: EventRow }>(`/events/${id}`)
      .then(r => setEvent(r.event))
      .catch(e => setError(errorMessage(e, 'Could not load this event.')));
  }, [id]);
  useEffect(load, [load]);

  const regs = usePagedQuery<EventReg>({
    fetcher: params => get<Paginated<EventReg>>(`/events/${id}/registrations`, params),
    initialFilters: { status: undefined },
  });

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!event) return <PageLoader />;

  const transition = (path: string, message: string) => async () => {
    await post(`/events/${event.id}/${path}`);
    toast.success(message);
    load();
  };
  const review = async (regId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await put(`/registrations/${regId}/approve`);
      else await del(`/registrations/${regId}/reject`);
      toast.success(action === 'approve' ? 'Registration approved.' : 'Registration rejected.');
      regs.refresh();
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async () => {
    const res = await del<{ archived?: boolean; deleted?: boolean; message: string }>(`/events/${event.id}`);
    toast.success(res.message);
    if (res.deleted) navigate('/admin/events', { replace: true });
    else load();
  };
  const purge = async () => {
    await del(`/events/${event.id}?force=true`, { confirm: event.name });
    toast.success('Event permanently deleted.');
    navigate('/admin/events', { replace: true });
  };

  const stats = event.registrationStats;

  return (
    <>
      <Link to="/admin/events" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ad-muted hover:text-ad-fg">
        <ArrowLeft size={15} /> All events
      </Link>
      <PageHeader
        title={event.name}
        subtitle={`${event.club?.name ?? ''} · ${event.venue}`}
        actions={
          <>
            <button className="ad-btn-ghost" onClick={() => setDialog('edit')}>Edit</button>
            {event.registrationClosedManually ? (
              <button className="ad-btn-ghost" onClick={() => setDialog('reopen')} disabled={event.isArchived}>Reopen registration</button>
            ) : (
              <button className="ad-btn-ghost" onClick={() => setDialog('close')} disabled={event.isArchived}>Close registration</button>
            )}
            {event.isPublished ? <button className="ad-btn-ghost" onClick={() => setDialog('unpublish')}>Unpublish</button> : <button className="ad-btn-ghost" onClick={() => setDialog('publish')} disabled={event.isArchived}>Publish</button>}
            {event.isArchived ? <button className="ad-btn-ghost" onClick={() => setDialog('restore')}>Restore</button> : <button className="ad-btn-ghost" onClick={() => setDialog('archive')}>Archive</button>}
            <button className="ad-btn-danger" onClick={() => setDialog('delete')}>Delete</button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {visibilityBadge(event)}
        <Badge tone={stateTone[event.registrationState]}>Registration: {titleCase(event.registrationState)}</Badge>
        {event.registrationClosedManually && <Badge tone="warn">Closed manually</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ad-card p-5 lg:col-span-1" aria-label="Event details">
          <dl className="space-y-3 text-sm">
            <Row label="Starts">{formatEventTime(event.eventDate)}</Row>
            <Row label="Ends">{formatEventTime(event.eventEndDate)}</Row>
            <Row label="Registration opens">{event.registrationOpensAt ? formatEventTime(event.registrationOpensAt) : 'Immediately'}</Row>
            <Row label="Registration closes">{event.registrationDeadline ? formatEventTime(event.registrationDeadline) : 'No fixed deadline'}</Row>
            <Row label="Fee">{formatRupees(event.fee)}</Row>
            <Row label="Type">{event.eventType}{event.eventType === 'Team' && event.teamSizeLimit ? ` (${event.minTeamSize ?? 1}–${event.teamSizeLimit})` : ''}</Row>
            <Row label="Capacity">{event.registrationCount} / {event.registrationLimit}</Row>
            {stats && <Row label="Confirmed · Pending · Rejected">{stats.CONFIRMED} · {stats.PENDING} · {stats.REJECTED}</Row>}
          </dl>
          {event.description && <p className="mt-5 whitespace-pre-wrap border-t border-ad-line pt-4 text-sm text-ad-muted">{event.description}</p>}
        </section>

        <section className="ad-card lg:col-span-2" aria-label="Registrations">
          <h2 className="border-b border-ad-line px-5 py-4 font-bold">Registrations</h2>
          <Toolbar searchValue={regs.searchInput} onSearch={regs.setSearchInput} placeholder="Search name, email, USN or team…" hasActiveFilters={regs.hasActiveFilters} onReset={regs.reset}>
            <select className="ad-field !w-auto" aria-label="Status" value={(regs.filters.status as string) ?? ''} onChange={e => regs.setFilter('status', e.target.value)}>
              <option value="">Any status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </Toolbar>
          <DataTable
            columns={[
              { header: 'Student', cell: r => (<div><div className="font-semibold">{r.user?.name ?? '—'}</div><div className="text-xs text-ad-faint">{r.user?.email}{r.user?.usn ? ` · ${r.user.usn}` : ''}</div></div>) },
              { header: 'Team', cell: r => r.team?.name ?? <span className="text-ad-faint">Solo</span> },
              { header: 'Payment ref.', cell: r => r.transaction_id ?? <span className="text-ad-faint">—</span> },
              { header: 'Status', cell: r => <Badge tone={r.status === 'CONFIRMED' ? 'ok' : r.status === 'REJECTED' ? 'bad' : 'warn'}>{titleCase(r.status)}</Badge> },
              {
                header: 'Review',
                cell: r => (
                  <div className="flex gap-1.5">
                    {r.status !== 'CONFIRMED' && <button className="ad-btn-ghost ad-btn-sm" onClick={() => review(r.id, 'approve')} aria-label="Approve"><Check size={14} /></button>}
                    {r.status !== 'REJECTED' && <button className="ad-btn-ghost ad-btn-sm" onClick={() => review(r.id, 'reject')} aria-label="Reject"><X size={14} /></button>}
                  </div>
                ),
              },
            ]}
            rows={regs.items}
            rowKey={r => r.id}
            loading={regs.loading}
            error={regs.error}
            onRetry={regs.refresh}
            emptyTitle="No registrations yet"
            hasActiveFilters={regs.hasActiveFilters}
            onReset={regs.reset}
          />
          <Pager pagination={regs.pagination} onPage={regs.setPage} pageSize={regs.pageSize} onPageSize={regs.setPageSize} loading={regs.loading} />
        </section>
      </div>

      <EventFormModal open={dialog === 'edit'} event={event} onClose={() => setDialog(null)} onSaved={() => { toast.success('Event saved.'); load(); }} />

      <ConfirmDialog open={dialog === 'close'} onClose={() => setDialog(null)} title="Close registration?" message="New registrations are blocked. The event stays visible to the public with a 'registration closed' label. You can reopen it any time." confirmLabel="Close registration" onConfirm={transition('close-registration', 'Registration closed.')} />
      <ConfirmDialog open={dialog === 'reopen'} onClose={() => setDialog(null)} title="Reopen registration?" message="Students can register again (subject to the dates and capacity)." confirmLabel="Reopen" onConfirm={transition('reopen-registration', 'Registration reopened.')} />
      <ConfirmDialog open={dialog === 'publish'} onClose={() => setDialog(null)} title="Publish event?" message="The event becomes visible to everyone." confirmLabel="Publish" onConfirm={transition('publish', 'Event published.')} />
      <ConfirmDialog open={dialog === 'unpublish'} onClose={() => setDialog(null)} title="Unpublish event?" message="The event is hidden from the public. Existing registrations are kept." confirmLabel="Unpublish" danger onConfirm={transition('unpublish', 'Event unpublished.')} />
      <ConfirmDialog open={dialog === 'archive'} onClose={() => setDialog(null)} title="Archive event?" message="Hidden from the public and from the club's active lists. Registrations and finance history are preserved." confirmLabel="Archive" danger onConfirm={transition('archive', 'Event archived.')} />
      <ConfirmDialog open={dialog === 'restore'} onClose={() => setDialog(null)} title="Restore event?" message="The event returns as an unpublished draft. Publish it to make it public again." confirmLabel="Restore" onConfirm={transition('restore', 'Event restored as a draft.')} />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete event?"
        message={<>If the event has registrations or payments it is <strong>archived</strong> so history is preserved; otherwise it is removed. <button type="button" className="mt-2 block text-ad-brand underline" onClick={() => setDialog('purge')}>Permanently delete including all registrations…</button></>}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
      />
      <ConfirmDialog open={dialog === 'purge'} onClose={() => setDialog(null)} title="Permanently delete event?" message="This removes the event and all of its registrations and teams for good. Ledger entries are kept. It cannot be undone." confirmLabel="Delete permanently" danger requireText={event.name} onConfirm={purge} />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ad-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
