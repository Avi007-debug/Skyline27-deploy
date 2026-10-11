import { badRequest } from '../middlewares/errorHandler';

/** Express 5 types params/query values as string | string[] | undefined — take the first string. */
export const str = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v)).trim();

export const optStr = (v: unknown): string | undefined => {
  const s = str(v);
  return s ? s : undefined;
};

export function requiredStr(v: unknown, field: string, maxLength = 500): string {
  const s = str(v);
  if (!s) throw badRequest(`${field} is required.`);
  if (s.length > maxLength) throw badRequest(`${field} must be at most ${maxLength} characters.`);
  return s;
}

export function optInt(v: unknown, field: string, { min, max }: { min?: number; max?: number } = {}): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw badRequest(`${field} must be a whole number.`);
  if (min !== undefined && n < min) throw badRequest(`${field} must be at least ${min}.`);
  if (max !== undefined && n > max) throw badRequest(`${field} must be at most ${max}.`);
  return n;
}

export function optNumber(v: unknown, field: string, { min }: { min?: number } = {}): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw badRequest(`${field} must be a number.`);
  if (min !== undefined && n < min) throw badRequest(`${field} must be at least ${min}.`);
  return n;
}

/** undefined = not provided, null = explicitly cleared, Date = set. */
export function optDate(v: unknown, field: string): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const raw = String(v).trim();
  // "2026-10-20T10:00" (no zone) is a floating campus wall-clock time: keep it as 10:00 whatever the server timezone.
  const floating = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const d = new Date(floating);
  if (isNaN(d.getTime())) throw badRequest(`${field} must be a valid date.`);
  return d;
}

export function optBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined {
  const s = optStr(v);
  if (s === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(s)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  }
  return s as T;
}
