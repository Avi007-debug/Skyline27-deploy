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

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/**
 * Parse and validate pagination parameters. Page sizes are clamped to
 * [1, MAX_PAGE_SIZE]; search is trimmed and capped at 100 characters.
 */
export function parsePaginationParams(req: Request, defaults: { pageSize?: number } = {}): PaginationParams {
  const q = req.query as Record<string, unknown>;
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

  let page = parseInt(String(first(q.page) ?? '1'), 10);
  let pageSize = parseInt(String(first(q.pageSize) ?? first(q.limit) ?? defaults.pageSize ?? DEFAULT_PAGE_SIZE), 10);
  const search = String(first(q.search) ?? '').trim().slice(0, 100) || undefined;

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize, search };
}

export function buildPaginatedResult<T>(items: T[], totalItems: number, params: PaginationParams): PaginatedResult<T> {
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

export function prismaSkipTake(params: PaginationParams): { skip: number; take: number } {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}

/** Run a filtered count + page query together. `where` must already include role/ownership filters. */
export async function paginate<T, W>(
  params: PaginationParams,
  where: W,
  count: (args: { where: W }) => Promise<number>,
  findMany: (args: { where: W; skip: number; take: number }) => Promise<T[]>
): Promise<PaginatedResult<T>> {
  const { skip, take } = prismaSkipTake(params);
  const [totalItems, items] = await Promise.all([count({ where }), findMany({ where, skip, take })]);
  return buildPaginatedResult(items, totalItems, params);
}

/** Case-insensitive `contains` across several fields, for Prisma `OR` search clauses. */
export function searchAny(search: string | undefined, fields: string[]): { OR: any[] } | undefined {
  if (!search) return undefined;
  return {
    OR: fields.map(path => {
      const parts = path.split('.');
      let clause: any = { contains: search, mode: 'insensitive' };
      for (let i = parts.length - 1; i >= 0; i--) clause = { [parts[i]]: clause };
      return clause;
    }),
  };
}
