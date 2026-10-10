/**
 * Shared retry helper for retryable PostgreSQL serialization failures,
 * deadlocks (40001, 40P01) and Prisma transaction conflicts (P2034).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 50
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;

      const isPostgresRetryable =
        err?.code === '40001' || // serialization_failure
        err?.code === '40P01' || // deadlock_detected
        err?.code === 'P2034' || // Prisma transaction conflict
        err?.message?.includes('could not serialize access') ||
        err?.message?.includes('deadlock detected') ||
        err?.message?.includes('Transaction failed due to a write conflict');

      if (!isPostgresRetryable || attempt >= maxRetries) {
        throw err;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 30;
      const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
      console.warn(`[Retry] Retrying transient DB conflict (attempt ${attempt}/${maxRetries}) after ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
