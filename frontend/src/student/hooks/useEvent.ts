import { useEffect, useState } from 'react';
import { fetchEventById } from '@/student/api/events';
import { useEventsStore } from '@/student/store/eventsStore';
import type { EventModel } from '@/student/types/event';

/**
 * One event by id: the cached copy if the store has it, otherwise fetched from the
 * server. Always refreshes in the background so registration state is current.
 */
export function useEvent(id: string | undefined): { event: EventModel | null; loading: boolean } {
  const cached = useEventsStore((s) => s.events.find((e) => e.id === id)) ?? null;
  const [fetched, setFetched] = useState<EventModel | null>(null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchEventById(id).then((e) => {
      if (cancelled) return;
      setFetched(e);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { event: fetched ?? cached, loading: loading && !cached };
}
