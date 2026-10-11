import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination as PaginationMeta } from '@/student/api/pagination';

interface Props {
  pagination: PaginationMeta | null;
  onPage: (page: number) => void;
  disabled?: boolean;
}

const btn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 16px',
  borderRadius: 99,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: disabled ? 'var(--subtext)' : 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

/** Previous / Next with "Page X of Y". Hidden when everything fits on one page. */
export default function Pagination({ pagination, onPage, disabled }: Props) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, totalItems } = pagination;
  return (
    <nav aria-label="Pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 28, flexWrap: 'wrap' }}>
      <button type="button" style={btn(disabled || page <= 1)} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={16} /> Previous
      </button>
      <span style={{ color: 'var(--subtext)', fontSize: 13 }}>
        Page <strong style={{ color: 'var(--text)' }}>{page}</strong> of {totalPages} · {totalItems} total
      </span>
      <button type="button" style={btn(disabled || page >= totalPages)} disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>
        Next <ChevronRight size={16} />
      </button>
    </nav>
  );
}
