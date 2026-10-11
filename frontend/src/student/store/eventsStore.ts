// Replaces Flutter EventsProvider

import { create } from 'zustand';
import { EventModel } from '@/student/types/event';
import { fetchEvents } from '@/student/api/events';

interface EventsState {
  events: EventModel[];
  isLoading: boolean;
  error: string | null;
  loadEvents: () => Promise<void>;
}

export const useEventsStore = create<EventsState>((set) => ({
  events: [],
  isLoading: false,
  error: null,

  loadEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const events = await fetchEvents();
      set({ events, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },
}));
