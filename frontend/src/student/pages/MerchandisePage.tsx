import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, X } from 'lucide-react';
import { fetchProducts, formatPaise, type Product } from '@/student/api/merch';
import type { Pagination as PaginationMeta } from '@/student/api/pagination';
import Pagination from '@/student/components/common/Pagination';
import { PageLoader } from '@/student/components/ui/LoadingSpinner';
import { ErrorState, EmptyState } from '@/student/components/ui/States';

const PAGE_SIZE = 12;

export const availabilityStyle = (a: Product['availability']): { label: string; color: string } =>
  a === 'SOLD_OUT' ? { label: 'Sold out', color: 'var(--sk-danger)' } : a === 'LOW_STOCK' ? { label: 'Low stock', color: '#f59e0b' } : { label: 'In stock', color: '#22c55e' };

/** Public merchandise catalogue — browsable without an account; buying needs login. */
export default function MerchandisePage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProducts({ page, pageSize: PAGE_SIZE, search });
      if (id !== requestId.current) return;
      setProducts(result.items);
      setPagination(result.pagination);
    } catch {
      if (id !== requestId.current) return;
      setError('We could not load merchandise right now. Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 20, letterSpacing: '-0.3px' }}>Merchandise</h1>

      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--subtext)', pointerEvents: 'none' }} />
        <input type="search" aria-label="Search merchandise" placeholder="Search products or clubs…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="input-field" style={{ paddingLeft: 40 }} />
      </div>

      {loading && products.length === 0 && !error ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : products.length === 0 ? (
        <EmptyState
          svgSrc="/svg/empty_saved.svg"
          title={search ? `No products match "${search}"` : 'No merchandise yet'}
          description={search ? 'Try a different search.' : 'Clubs have not published any merchandise yet. Check back soon!'}
          action={search ? <button className="btn-primary" onClick={() => { setSearchInput(''); setSearch(''); }}><X size={14} /> Clear search</button> : undefined}
        />
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1 }} aria-busy={loading}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
            {products.map((p) => {
              const a = availabilityStyle(p.availability);
              return (
                <article
                  key={p.id}
                  onClick={() => navigate(`/merch/${p.id}`)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', cursor: 'pointer' }}
                >
                  <div style={{ aspectRatio: '1 / 1', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🛍️'}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                    {p.club && <div style={{ color: 'var(--subtext)', fontSize: 12, marginBottom: 8 }}>{p.club.name}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text)' }}>
                        {p.pricePaise === 0 ? 'Free' : formatPaise(p.isMember && (p.memberDiscountPercent ?? 0) > 0 ? Math.round((p.pricePaise * (100 - (p.memberDiscountPercent ?? 0))) / 100) : p.pricePaise)}
                        {!p.isMember && (p.memberDiscountPercent ?? 0) > 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>Members {p.memberDiscountPercent}% off</span>}
                        {p.isMember && (p.memberDiscountPercent ?? 0) > 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>Member price</span>}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination pagination={pagination} onPage={setPage} disabled={loading} />
        </div>
      )}
    </div>
  );
}
