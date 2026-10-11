import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';

/** An error that maps directly to an HTTP response. Throw it from any handler or service. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Unauthorized: Authentication required.') => new HttpError(401, msg);
export const forbidden = (msg = 'Forbidden: You do not have permission to perform this action.') => new HttpError(403, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Wrap an async route so thrown errors reach the error handler (Express 5 also does this, kept explicit). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): any {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A record with these details already exists.' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
    if (err.code === 'P2003') return res.status(409).json({ error: 'This record is referenced by other records.' });
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body.' });
  }

  console.error(`[Error] ${req.method} ${req.path}:`, err?.message || err);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
}

export function notFoundHandler(req: Request, res: Response): any {
  return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}
