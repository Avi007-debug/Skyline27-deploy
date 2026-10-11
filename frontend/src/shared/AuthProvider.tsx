import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { API_BASE } from './config';
import { clearSession, getStoredProfile, getToken, signOutToLanding, subscribeSession, updateStoredProfile } from './session';
import type { SessionProfile } from './session';

interface AuthState {
  profile: SessionProfile | null;
  /** True until a stored session has been checked against the server. */
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchMe(token: string): Promise<{ status: number; profile?: SessionProfile }> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) return { status: res.status };
    const data = await res.json();
    return { status: 200, profile: data.profile as SessionProfile };
  } catch {
    return { status: 0 }; // offline / server down
  }
}

/**
 * Who is signed in. The cached profile renders immediately; the server then
 * confirms (or corrects) the role. An expired token, a deactivated account or a
 * changed role takes effect here without waiting for the next API error.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<SessionProfile | null>(() => (getToken() ? getStoredProfile() : null));
  const [loading, setLoading] = useState<boolean>(() => !!getToken());

  useEffect(
    () =>
      subscribeSession(() => {
        setProfile(getToken() ? getStoredProfile() : null);
      }),
    []
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchMe(token).then(({ status, profile: fresh }) => {
      if (cancelled) return;
      if (status === 200 && fresh) {
        updateStoredProfile(fresh);
        setProfile(fresh);
      } else if (status === 401 || status === 403) {
        clearSession();
        setProfile(null);
      }
      // status 0 (network): keep the cached session; the API will reject it if it is really invalid.
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(() => signOutToLanding(), []);
  const value = useMemo(() => ({ profile, loading, signOut }), [profile, loading, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
