import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Ticket, RefreshCw, Calendar, MapPin, Copy, Users, Check } from 'lucide-react';
import { fetchUserTickets } from '@/student/api/registrations';
import { TicketModel, isTicketUpcoming, isTicketConfirmed, ticketStage, TICKET_STAGE_LABEL } from '@/student/types/event';
import { useSavedEventsStore } from '@/student/store/savedEventsStore';
import { useEventsStore } from '@/student/store/eventsStore';
import EventCard from '@/student/components/ui/EventCard';
import { PageLoader } from '@/student/components/ui/LoadingSpinner';
import { ErrorState, EmptyState } from '@/student/components/ui/States';
import { formatEventHeaderDate } from '@/student/utils/dateUtils';

const TABS = ['Upcoming', 'Saved', 'Past'] as const;
type TabType = typeof TABS[number];

export default function TicketsPage() {
  const navigate = useNavigate();
  const { savedIds } = useSavedEventsStore();
  const { events, loadEvents } = useEventsStore();
  const [tickets, setTickets] = useState<TicketModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('Upcoming');

  useEffect(() => {
    loadTickets();
    if (events.length === 0) {
      loadEvents();
    }
  }, []);

  const loadTickets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserTickets();
      setTickets(data);
    } catch (e) {
      setError(String(e).replace('Error: ', ''));
    } finally {
      setIsLoading(false);
    }
  };

  const upcomingTickets = tickets.filter((t) => isTicketUpcoming(t));
  const pastTickets = tickets.filter((t) => !isTicketUpcoming(t));
  const savedEvents = events.filter((e) => savedIds.has(e.id));
  const savedCount = savedIds.size;

  const displayed: TicketModel[] =
    activeTab === 'Upcoming' ? upcomingTickets : activeTab === 'Past' ? pastTickets : [];

  if (isLoading) return <PageLoader />;

  return (
    <div style={{ padding: '24px 20px', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>
          My Events
        </h1>
        <button
          onClick={loadTickets}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--subtext)',
            transition: 'all 0.15s ease',
          }}
          aria-label="Refresh"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {/* Stats line */}
      <p style={{ fontSize: 13, color: 'var(--subtext)', marginBottom: 20, fontWeight: 500 }}>
        {upcomingTickets.length} upcoming · {savedCount} saved · {pastTickets.length} past
      </p>

      {/* Tab switcher — pill style */}
      <div
        style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 50,
          padding: '4px',
          marginBottom: 24,
          width: '100%',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '9px 0',
              borderRadius: 50,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 14,
              background: activeTab === tab ? 'var(--surface)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--subtext)',
              boxShadow: activeTab === tab ? 'var(--sk-shadow)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={loadTickets} />}

      {/* Saved tab */}
      {activeTab === 'Saved' && (
        savedEvents.length === 0 ? (
          <EmptyState
            svgSrc="/svg/empty_saved.svg"
            title="No Saved Events Yet"
            description="Tap the bookmark icon on any event to save it to your list"
            action={
              <button onClick={() => navigate('/home')} className="btn-primary">
                Browse Events
              </button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {savedEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )
      )}

      {activeTab !== 'Saved' && displayed.length === 0 && !error && (
        <EmptyState
          svgSrc={activeTab === 'Upcoming' ? '/svg/empty_upcoming.svg' : '/svg/empty_past.svg'}
          title={activeTab === 'Upcoming' ? 'No Upcoming Events' : 'No Past Events'}
          description={
            activeTab === 'Upcoming'
              ? 'Your registered upcoming event passes will show up here'
              : 'Events you attended previously will appear here'
          }
          action={
            activeTab === 'Upcoming' ? (
              <button onClick={() => navigate('/home')} className="btn-primary">
                Browse Events
              </button>
            ) : undefined
          }
        />
      )}

      {activeTab !== 'Saved' && displayed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {displayed.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onViewTicket={() => navigate(`/tickets/${ticket.id}`)}
              onPay={() => navigate(`/events/${ticket.event?.id}/payment?registrationId=${ticket.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, onViewTicket, onPay }: { ticket: TicketModel; onViewTicket: () => void; onPay: () => void }) {
  const [copied, setCopied] = useState(false);
  const event = ticket.event;
  const confirmed = isTicketConfirmed(ticket);
  const stage = ticketStage(ticket);

  // Campus wall-clock times: keep them local, never convert through UTC.
  const wall = (d?: Date | null) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null;
  const dateStr = wall(event?.eventDate) ?? event?.date ?? null;
  const endDateStr = wall(event?.eventEndDate);

  // Is live?
  const live = event?.eventDate
    ? (() => {
        const start = event.eventDate!;
        const end = event.eventEndDate ?? new Date(start.getTime() + 3 * 60 * 60 * 1000);
        const now = new Date();
        return now >= start && now <= end;
      })()
    : false;

  const joinedCount =
    ticket.team?.members?.filter((m) => m.status === 'CONFIRMED' || m.status === 'JOINED').length ??
    (confirmed ? 1 : 0);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ticket.team?.passkey) {
      navigator.clipboard.writeText(ticket.team.passkey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--sk-radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Banner */}
      <div style={{ height: 180, background: 'var(--raised)', position: 'relative', overflow: 'hidden' }}>
        {event?.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event?.title ?? ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--raised)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={40} style={{ opacity: 0.15, color: 'var(--sk-faint)' }} />
          </div>
        )}

        {/* Top-left badges */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <span
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 999,
            }}
          >
            {event?.clubName || 'SkylineOS'}
          </span>

          {live && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--sk-brand-soft)',
                border: '1px solid var(--sk-brand-soft)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: 'var(--sk-brand)',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                letterSpacing: '0.4px',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--sk-brand)',
                  boxShadow: '0 0 6px var(--sk-brand)',
                }}
              />
              LIVE NOW
            </span>
          )}
        </div>

        {/* Top-right status badge */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
          }}
        >
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: 'var(--surface)',
              color: stage === 'CONFIRMED' ? 'var(--sk-ok)' : stage === 'REJECTED' ? 'var(--sk-danger)' : 'var(--sk-warn)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            {stage === 'CONFIRMED' && <Check size={13} strokeWidth={3} />}
            {TICKET_STAGE_LABEL[stage]}
          </span>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '16px 18px' }}>
        {/* Club name */}
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--subtext)', marginBottom: 3 }}>
          {event?.clubName || 'SkylineOS'}
        </p>

        {/* Title */}
        <h3
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: 12,
            letterSpacing: '-0.3px',
          }}
        >
          {event?.title ?? 'Unknown Event'}
        </h3>

        {/* Date */}
        {dateStr && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--subtext)',
              fontSize: 13,
              marginBottom: 6,
            }}
          >
            <Calendar size={14} />
            <span>{formatEventHeaderDate(dateStr, endDateStr)}</span>
          </div>
        )}

        {/* Venue */}
        {event?.venue && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--subtext)',
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            <MapPin size={14} />
            <span>{event.venue}</span>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

        {/* Team row */}
        {ticket.team ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={15} color="var(--subtext)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {ticket.team.name}
              </span>
              {ticket.team.passkey && (
                <span
                  style={{
                    background: 'var(--color-crimson)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 999,
                    letterSpacing: '1px',
                  }}
                >
                  {ticket.team.passkey}
                </span>
              )}
            </div>
            {ticket.team.passkey && (
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '6px 14px',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 14 }} />
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {ticket.team && (
              <>
                <p style={{ fontSize: 11, color: 'var(--subtext)', fontWeight: 500, marginBottom: 2 }}>
                  Team Members
                </p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--sk-ok)' }}>
                  {joinedCount} Joined
                </p>
              </>
            )}
          </div>

          {stage === 'CONFIRMED' ? (
            <button onClick={onViewTicket} className="btn-primary" style={{ borderRadius: 999 }}>View ticket</button>
          ) : stage === 'PAYMENT_DUE' ? (
            <button onClick={onPay} className="btn-primary" style={{ borderRadius: 999 }}>Complete payment</button>
          ) : (
            <button disabled aria-disabled className="btn-secondary" style={{ borderRadius: 999, cursor: 'not-allowed', opacity: 0.8 }}>
              {stage === 'REJECTED' ? 'Not approved' : 'Awaiting approval'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
