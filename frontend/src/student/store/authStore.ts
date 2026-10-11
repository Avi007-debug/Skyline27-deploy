// Student-side view of the site-wide session (src/shared/session.ts).
// The token and role live in one place for the whole website; this store only
// mirrors them so existing pages can keep using `useAuthStore`.

import { create } from 'zustand';
import { clearSession, getStoredProfile, getToken, subscribeSession } from '@/shared/session';
import type { Role } from '@/shared/session';

interface AuthState {
  token: string | null;
  userId: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  logout: () => void;
  tryAutoLogin: () => boolean;
  refresh: () => void;
}

function snapshot(): Pick<AuthState, 'token' | 'userId' | 'role' | 'isAuthenticated'> {
  const token = getToken();
  const profile = token ? getStoredProfile() : null;
  return { token, userId: profile?.id ?? null, role: profile?.role ?? null, isAuthenticated: !!token && !!profile };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...snapshot(),

  logout: () => {
    clearSession();
    set(snapshot());
  },

  tryAutoLogin: () => {
    const s = snapshot();
    set(s);
    return s.isAuthenticated;
  },

  refresh: () => set(snapshot()),
}));

// Keep the store in step with sign-in/out anywhere on the site (including other tabs).
subscribeSession(() => useAuthStore.getState().refresh());
