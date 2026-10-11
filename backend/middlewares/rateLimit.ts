import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal fixed-window, in-memory rate limiter keyed by client IP and route.
 * Good enough for a single API instance; swap for a shared store if the API
 * is ever horizontally scaled.
 */
export function rateLimit({ windowMs, max, name }: { windowMs: number; max: number; name: string }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): any => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') return next();

    const now = Date.now();
    const key = `${name}:${req.ip}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    return next();
  };
}

export const authLimiter = rateLimit({ name: 'auth', windowMs: 15 * 60 * 1000, max: 30 });
export const recoveryLimiter = rateLimit({ name: 'recovery', windowMs: 15 * 60 * 1000, max: 5 });
export const sensitiveLimiter = rateLimit({ name: 'sensitive', windowMs: 60 * 1000, max: 30 });
