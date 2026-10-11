// Bookmarked events. Signed-in users' bookmarks live on the server (they follow the account across
// devices); visitors keep them in this browser and they are merged into the account on sign-in.

import { create } from 'zustand';
import apiClient from '@/student/api/client';
import { getToken, subscribeSession } from '@/shared/session';

const SAVED_KEY = 'saved_event_ids';

function loadLocal(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function storeLocal(ids: Set<string>) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

interface SavedEventsState {
  savedIds: Set<string>;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Load the account's bookmarks (merging any made before signing in). */
  sync: () => Promise<void>;
}

export const useSavedEventsStore = create<SavedEventsState>((set, get) => ({
  savedIds: loadLocal(),

  isSaved: (id: string) => get().savedIds.has(id),

  toggle: (id: string) => {
    const before = get().savedIds;
    const next = new Set(before);
    const saving = !next.has(id);
    if (saving) next.add(id);
    else next.delete(id);
    set({ savedIds: next });
    storeLocal(next);
    if (!getToken()) return;
    const call = saving ? apiClient.put(`/profiles/me/saved/${id}`) : apiClient.delete(`/profiles/me/saved/${id}`);
    call.catch(() => {
      // Put it back if the server refused, so the screen never lies.
      set({ savedIds: before });
      storeLocal(before);
    });
  },

  sync: async () => {
    if (!getToken()) return;
    try {
      const local = [...loadLocal()];
      const res = local.length
        ? await apiClient.post('/profiles/me/saved/sync', { eventIds: local })
        : await apiClient.get('/profiles/me/saved');
      const ids = new Set<string>(res.data.eventIds as string[]);
      set({ savedIds: ids });
      storeLocal(ids);
    } catch { /* keep what we have */ }
  },
}));

// Follow sign-in / sign-out anywhere on the site.
subscribeSession(() => {
  if (getToken()) void useSavedEventsStore.getState().sync();
  else {
    storeLocal(new Set());
    useSavedEventsStore.setState({ savedIds: new Set() });
  }
});
if (getToken()) void useSavedEventsStore.getState().sync();
