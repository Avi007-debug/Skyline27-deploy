import { useNavigate } from 'react-router';
import { Bookmark, Calendar, MapPin } from 'lucide-react';
import { EventModel, isEventLive, isEventPast, isEventFull, getEventStartDate } from '@/student/types/event';
import { formatEventHeaderDate, formatDeadline } from '@/student/utils/dateUtils';
import { useSavedEventsStore } from '@/student/store/savedEventsStore';

interface EventCardProps {
  event: EventModel;
  compact?: boolean;
}

/** Event tile used in lists. Colours come from the design tokens, so it reads in both themes. */
export default function EventCard({ event, compact = false }: EventCardProps) {
  const navigate = useNavigate();
  const { isSaved, toggle } = useSavedEventsStore();
  const saved = isSaved(event.id);
  const live = isEventLive(event);
  const past = isEventPast(event);
  const full = isEventFull(event);

  // Event times are campus wall-clock values: format them as local wall-clock strings, never via UTC.
  const wall = (d?: Date | null) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null;
  const dateStr = wall(event.eventDate) ?? event.date ?? null;
  const endDateStr = wall(event.eventEndDate);
  const start = getEventStartDate(event);
  const day = start ? start.getDate() : null;
  const month = start ? start.toLocaleString('en-US', { month: 'short' }) : null;

  const deadline = event.registrationDeadline
    ? event.registrationDeadline instanceof Date ? event.registrationDeadline : new Date(event.registrationDeadline)
    : null;
  const deadlineSoon = deadline && !isNaN(deadline.getTime()) && deadline.getTime() - Date.now() < 3 * 86400000 && deadline.getTime() > Date.now();
  const memberDeal = event.isMember && (event.normalPrice ?? 0) > event.price;
  const memberOffer = !event.isMember && event.memberFee != null && event.memberFee < (event.normalPrice ?? event.price);

  const status = live ? { text: 'Happening now', tone: 'var(--sk-ok)' } : full && !past ? { text: 'Full', tone: 'var(--sk-muted)' } : past ? { text: 'Ended', tone: 'var(--sk-faint)' } : null;

  return (
    <article
      className="spotlight-card"
      onClick={() => navigate(`/events/${event.id}`)}
      style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', opacity: past ? 0.7 : 1 }}
    >
      <div style={{ position: 'relative', aspectRatio: compact ? '16 / 9' : '16 / 9', background: 'var(--raised)' }}>
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--sk-faint)' }}>
            <Calendar size={28} />
          </div>
        )}
        {day && month && (
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 10, left: 10, minWidth: 44, padding: '5px 8px', borderRadius: 8,
              background: 'var(--surface)', color: 'var(--text)', textAlign: 'center', lineHeight: 1.05,
              boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sk-brand)' }}>{month}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{day}</div>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(event.id); }}
          aria-label={saved ? 'Remove bookmark' : 'Bookmark event'}
          aria-pressed={saved}
          style={{
            position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 8, border: 'none',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            background: 'var(--surface)', color: saved ? 'var(--sk-brand)' : 'var(--subtext)', boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
          }}
        >
          <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div style={{ padding: compact ? 14 : 16, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--subtext)', minWidth: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.clubName || 'SkylineOS'}</span>
          {(event.eventType || event.category) && <span aria-hidden>·</span>}
          {(event.eventType || event.category) && <span style={{ flexShrink: 0 }}>{event.eventType || event.category}</span>}
          {status && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: status.tone, fontWeight: 600, flexShrink: 0 }}>
              {live && <span style={{ width: 6, height: 6, borderRadius: 99, background: 'currentColor' }} />}
              {status.text}
            </span>
          )}
        </div>

        <h3
          style={{
            fontSize: 16, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, letterSpacing: '-0.01em',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0,
            minHeight: '2.6em', // always reserve two lines so every card is the same height
          }}
        >
          {event.title}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--subtext)', minWidth: 0 }}>
          <Calendar size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dateStr ? formatEventHeaderDate(dateStr, endDateStr) : 'Date to be announced'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--subtext)', minWidth: 0 }}>
          <MapPin size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.venue && event.venue !== 'TBD' && event.venue !== 'No Venue' ? event.venue : 'Venue to be announced'}</span>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {event.price > 0 ? `₹${event.price}` : 'Free'}
            {memberDeal && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 400, color: 'var(--sk-faint)', textDecoration: 'line-through' }}>₹{event.normalPrice}</span>}
            {memberDeal && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: 'var(--sk-ok)' }}>Member price</span>}
            {memberOffer && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 400, color: 'var(--subtext)' }}>Members {event.memberFee! > 0 ? `₹${event.memberFee}` : 'free'}</span>}
          </span>
          <span style={{ fontSize: 12, color: deadlineSoon ? 'var(--sk-warn)' : 'var(--sk-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {deadline && !isNaN(deadline.getTime()) && !past ? `Closes ${formatDeadline(deadline)}` : `${event.registrationCount ?? 0} going`}
          </span>
        </div>
      </div>
    </article>
  );
}
