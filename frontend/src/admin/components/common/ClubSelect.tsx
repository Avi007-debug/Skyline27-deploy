import { useEffect, useState } from 'react';
import { get } from '../../services/http';
import type { ClubRow, Paginated } from '../../types/api';

let cache: { at: number; clubs: Pick<ClubRow, 'id' | 'name'>[] } | null = null;

/** Clubs for dropdowns (up to 100 active clubs, cached briefly). */
export function useClubOptions() {
  const [clubs, setClubs] = useState<Pick<ClubRow, 'id' | 'name'>[]>(cache?.clubs ?? []);
  useEffect(() => {
    if (cache && Date.now() - cache.at < 30_000) return;
    let cancelled = false;
    get<Paginated<ClubRow>>('/admin/clubs', { pageSize: 100, archived: false })
      .then(r => {
        cache = { at: Date.now(), clubs: r.items.map(c => ({ id: c.id, name: c.name })) };
        if (!cancelled) setClubs(cache.clubs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return clubs;
}

export function invalidateClubOptions() {
  cache = null;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  className?: string;
  label?: string;
}

export function ClubSelect({ value, onChange, allLabel = 'All clubs', className = '!w-auto', label = 'Club' }: Props) {
  const clubs = useClubOptions();
  return (
    <select className={`ad-field ${className}`} aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {clubs.map(c => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
