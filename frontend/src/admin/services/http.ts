import { API_BASE } from '@/shared/config';
import { clearSession, getToken } from '@/shared/session';

export { API_BASE };

/** The admin console shares the website's single session (see src/shared/session.ts). */
export const tokenStore = { get: getToken, clear: clearSession };

/** An HTTP failure with the server's user-facing message. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export function toQuery(params: Query = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

function friendly(status: number, serverMessage?: string): string {
  if (serverMessage) return serverMessage;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'That record was not found.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return `Request failed (${status}).`;
}

export async function request<T = any>(
  method: string,
  path: string,
  options: { body?: unknown; query?: Query; auth?: boolean } = {}
): Promise<T> {
  const token = options.auth === false ? null : tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${toQuery(options.query)}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && token) clearSession();
    throw new ApiError(res.status, friendly(res.status, data?.error));
  }
  return data as T;
}

export const get = <T = any>(path: string, query?: Query) => request<T>('GET', path, { query });
export const post = <T = any>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} });
export const put = <T = any>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} });
export const del = <T = any>(path: string, body?: unknown) => request<T>('DELETE', path, { body: body ?? {} });

/** Download an authenticated file (CSV) through a temporary object URL. */
export async function download(path: string, query: Query, filename: string): Promise<void> {
  const token = tokenStore.get();
  const res = await fetch(`${API_BASE}${path}${toQuery(query)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let msg: string | undefined;
    try {
      msg = (await res.json()).error;
    } catch {
      msg = undefined;
    }
    throw new ApiError(res.status, friendly(res.status, msg));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const errorMessage = (e: unknown, fallback = 'Something went wrong.') => (e instanceof Error && e.message ? e.message : fallback);
