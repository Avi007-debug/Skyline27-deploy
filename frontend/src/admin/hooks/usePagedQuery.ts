import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/http';
import type { Paginated, Pagination } from '../types/api';

type Filters = Record<string, string | number | boolean | undefined>;

interface Options<T> {
  fetcher: (query: { page: number; pageSize: number; search: string } & Filters) => Promise<Paginated<T>>;
  initialFilters?: Filters;
  pageSize?: number;
}

/**
 * Server-driven list state: search (debounced), filters, page and page size all
 * go to the API, so results always cover the whole dataset. Changing the search
 * or any filter returns to page 1; out-of-order responses are discarded.
 */
export function usePagedQuery<T>({ fetcher, initialFilters = {}, pageSize: initialPageSize = 10 }: Options<T>) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFiltersState] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current({ page, pageSize, search, ...filters });
      if (id !== latest.current) return;
      // If the last item on a page was removed, step back instead of showing an empty page.
      if (result.items.length === 0 && result.pagination.page > 1 && result.pagination.totalPages > 0) {
        setPage(result.pagination.totalPages);
        return;
      }
      setItems(result.items);
      setPagination(result.pagination);
    } catch (e) {
      if (id !== latest.current) return;
      setError(errorMessage(e, 'Could not load data.'));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [page, pageSize, search, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = useCallback((key: string, value: string | number | boolean | undefined) => {
    setFiltersState(prev => ({ ...prev, [key]: value === '' ? undefined : value }));
    setPage(1);
  }, []);

  const setPageSize = useCallback((n: number) => {
    setPageSizeState(n);
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setFiltersState(initialFilters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters = !!search || Object.entries(filters).some(([k, v]) => v !== undefined && v !== initialFilters[k]);

  return { items, pagination, loading, error, page, pageSize, searchInput, setSearchInput, search, filters, setFilter, setPage, setPageSize, reset, hasActiveFilters, refresh: load };
}
