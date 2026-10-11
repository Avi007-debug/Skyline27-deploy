/**
 * The single browser session shared by every part of the site (public/student
 * pages, club dashboard, admin console). One token, one cached profile.
 *
 * The cached profile is only for fast first paint: AuthProvider re-reads the
 * role from the server (GET /auth/me) on load, and every API call is authorised
 * by the server again.
 */
export type Role = 'STUDENT' | 'CLUB_HEAD' | 'SUPER_ADMIN';

export interface SessionProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  clubId: string | null;
  [key: string]: unknown;
}

// Keys kept from the original club dashboard so existing sessions survive the merge.
const TOKEN_KEY = 'spotlight_token';
const PROFILE_KEY = 'spotlight_profile';
const EVENT = 'skyline:session';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return read(TOKEN_KEY);
}

export function getStoredProfile(): SessionProfile | null {
  const raw = read(PROFILE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return p && typeof p.id === 'string' && typeof p.role === 'string' ? (p as SessionProfile) : null;
  } catch {
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

export function setSession(token: string, profile: SessionProfile): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable (private mode): the session lasts until reload */
  }
  notify();
}

export function updateStoredProfile(profile: SessionProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
  notify();
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
    // Legacy keys from the former separate apps.
    for (const k of ['auth_token', 'userId', 'skyline_admin_token', 'cached_user_profile_json', 'cached_user_tickets_json']) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  notify();
}

/**
 * Sign out from anywhere and return to the landing page, where the visitor can pick a different role.
 * A full page load is deliberate: it also discards everything held in memory (stores, cached lists),
 * so the next person on a shared computer never sees the previous user's data.
 */
export function signOutToLanding(): void {
  try {
    document.body.style.overflow = '';
  } catch {
    /* ignore */
  }
  clearSession();
  window.location.replace(import.meta.env.BASE_URL || '/');
}

/** Subscribe to session changes in this tab and others. Returns an unsubscribe function. */
export function subscribeSession(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY || e.key === PROFILE_KEY || e.key === null) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Where each role lands after signing in. */
export function homeFor(role: Role | undefined | null): string {
  if (role === 'SUPER_ADMIN') return '/admin';
  if (role === 'CLUB_HEAD') return '/club';
  return '/home';
}

/**
 * Only same-site absolute paths are accepted as post-login destinations, so a
 * crafted ?redirect= link can never send someone to another website.
 */
export function safeRedirect(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (/^\/(login|signup|forgot-password|reset-password|admin\/login|club\/auth)(\/|\?|$)/.test(raw)) return fallback;
  return raw;
}

/**
 * Each role has its own sign-in: students at /login, club heads at /club/auth,
 * admins at /admin/login. A protected page sends the visitor to the right one.
 */
export function loginUrl(path: string): string {
  const q = `?redirect=${encodeURIComponent(path)}`;
  if (path === '/admin' || path.startsWith('/admin/')) return `/admin/login${q}`;
  if (path === '/club' || path.startsWith('/club/')) return `/club/auth${q}`;
  return `/login${q}`;
}

/**
 * Where to send someone after sign-in: the page they were heading to, unless it
 * belongs to an area their role cannot open, in which case their own home.
 */
export function destinationFor(role: Role, requested: string | null | undefined): string {
  const wanted = safeRedirect(requested, '');
  if (!wanted) return homeFor(role);
  if (wanted.startsWith('/admin') && role !== 'SUPER_ADMIN') return homeFor(role);
  if ((wanted === '/club' || wanted.startsWith('/club/')) && role !== 'CLUB_HEAD') return homeFor(role);
  return wanted;
}
