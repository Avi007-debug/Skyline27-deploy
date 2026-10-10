import { Request } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/**
 * Parse and validate pagination parameters from an Express request.
 */
export function parsePaginationParams(req: Request): PaginationParams {
  let page = parseInt(String(req.query.page || '1'), 10);
  let pageSize = parseInt(String(req.query.pageSize || req.query.limit || String(DEFAULT_PAGE_SIZE)), 10);
  const search = String(req.query.search || '').trim() || undefined;

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize, search };
}

/**
 * Build a paginated result object from a count + items array.
 */
export function buildPaginatedResult<T>(
  items: T[],
  totalItems: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    items,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / params.pageSize),
    },
  };
}

/**
 * Build Prisma skip/take values from pagination params.
 */
export function prismaSkipTake(params: PaginationParams): { skip: number; take: number } {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}
