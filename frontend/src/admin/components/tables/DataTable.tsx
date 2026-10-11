import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Pagination } from '../../types/api';
import { EmptyState, ErrorState } from '../common/ui';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRowClick?: (row: T) => void;
  emptyTitle: string;
  emptyHint?: string;
  hasActiveFilters?: boolean;
  onReset?: () => void;
}

/** Table with the four states every list needs: loading, error, empty (with or without filters), data. */
export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, onRowClick, emptyTitle, emptyHint, hasActiveFilters, onReset }: TableProps<T>) {
  if (error && rows.length === 0) return <ErrorState message={error} onRetry={onRetry} />;

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? 'No matches' : emptyTitle}
        hint={hasActiveFilters ? 'Nothing matches the current search and filters.' : emptyHint}
        action={
          hasActiveFilters && onReset ? (
            <button className="ad-btn-ghost ad-btn-sm" onClick={onReset}>
              <RotateCcw size={14} /> Reset filters
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto" aria-busy={loading}>
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-ad-line">
            {columns.map(c => (
              <th key={c.header} className={`ad-th ${c.className ?? ''}`} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={loading ? { animation: 'pulse-row 1.2s ease-in-out infinite' } : undefined}>
          {rows.map(row => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-ad-line/60 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-ad-raised/70' : ''}`}
            >
              {columns.map(c => (
                <td key={c.header} className={`ad-td ${c.className ?? ''}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ToolbarProps {
  searchValue: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  children?: ReactNode;
  hasActiveFilters: boolean;
  onReset: () => void;
}

export function Toolbar({ searchValue, onSearch, placeholder = 'Search…', children, hasActiveFilters, onReset }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-ad-line p-4">
      <div className="relative min-w-[220px] flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ad-faint" aria-hidden />
        <input type="search" aria-label={placeholder} className="ad-field pl-9" placeholder={placeholder} value={searchValue} onChange={e => onSearch(e.target.value)} />
      </div>
      {children}
      {hasActiveFilters && (
        <button className="ad-btn-ghost ad-btn-sm" onClick={onReset}>
          <RotateCcw size={14} /> Reset
        </button>
      )}
    </div>
  );
}

interface PagerProps {
  pagination: Pagination | null;
  onPage: (p: number) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  loading: boolean;
}

export function Pager({ pagination, onPage, pageSize, onPageSize, loading }: PagerProps) {
  if (!pagination || pagination.totalItems === 0) return null;
  const { page, totalPages, totalItems } = pagination;
  const from = (page - 1) * pagination.pageSize + 1;
  const to = Math.min(page * pagination.pageSize, totalItems);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ad-line px-4 py-3 text-sm text-ad-muted">
      <span>
        {from}–{to} of {totalItems}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          Rows
          <select className="ad-field !w-auto !py-1.5" value={pageSize} onChange={e => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {[10, 25, 50, 100].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button className="ad-btn-ghost ad-btn-sm" onClick={() => onPage(page - 1)} disabled={loading || page <= 1} aria-label="Previous page">
          <ChevronLeft size={15} /> Prev
        </button>
        <span className="text-xs">
          Page <strong className="text-ad-fg">{page}</strong> of {Math.max(totalPages, 1)}
        </span>
        <button className="ad-btn-ghost ad-btn-sm" onClick={() => onPage(page + 1)} disabled={loading || page >= totalPages} aria-label="Next page">
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
