export const formatDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Server amounts for merchandise and ledger are integer paise. */
export const formatPaise = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

/** Event fees are stored as rupees. */
export const formatRupees = (rupees: number): string => (rupees > 0 ? `₹${rupees.toLocaleString('en-IN')}` : 'Free');

export const formatNumber = (n: number): string => n.toLocaleString('en-IN');

/**
 * Event times are "floating" wall-clock values (the same convention the club and
 * student apps use): 10:00 entered is 10:00 everywhere, so they are read from the
 * UTC fields without converting to the viewer's timezone.
 */
export const formatEventDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

export const formatEventTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '—';

/** `datetime-local` input value for a floating event time. */
export const toLocalInput = (iso?: string | null): string => (iso ? iso.slice(0, 16) : '');

/** Sent as-is: a zone-less value is stored as the same wall-clock time. Empty means "not set". */
export const fromLocalInput = (value: string): string | null => (value ? value : null);

export const titleCase = (s: string): string => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
