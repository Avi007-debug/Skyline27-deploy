import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ClubSelect } from '../../components/common/ClubSelect';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Badge, Field, PageHeader, Spinner } from '../../components/common/ui';
import type { Tone } from '../../components/common/ui';
import { DataTable, Pager, Toolbar } from '../../components/tables/DataTable';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { errorMessage, get, post, put } from '../../services/http';
import type { Paginated, ProductRow } from '../../types/api';
import { formatPaise, titleCase } from '../../utils/format';

const availTone: Record<ProductRow['availability'], Tone> = { IN_STOCK: 'ok', LOW_STOCK: 'warn', SOLD_OUT: 'bad' };

export function ProductsPage() {
  const toast = useToast();
  const q = usePagedQuery<ProductRow>({
    fetcher: params => get<Paginated<ProductRow>>('/merchandise/manage/products', params),
    initialFilters: { clubId: undefined, state: undefined },
  });
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [archiving, setArchiving] = useState<ProductRow | null>(null);

  const act = async (p: ProductRow, path: string, message: string) => {
    try {
      await post(`/merchandise/manage/products/${p.id}/${path}`);
      toast.success(message);
      q.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Merchandise"
        subtitle="Products, sizes and stock across all clubs."
        actions={<button className="ad-btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> New product</button>}
      />
      <div className="ad-card">
        <Toolbar searchValue={q.searchInput} onSearch={q.setSearchInput} placeholder="Search products…" hasActiveFilters={q.hasActiveFilters} onReset={q.reset}>
          <ClubSelect value={(q.filters.clubId as string) ?? ''} onChange={v => q.setFilter('clubId', v)} />
          <select className="ad-field !w-auto" aria-label="State" value={(q.filters.state as string) ?? ''} onChange={e => q.setFilter('state', e.target.value)}>
            <option value="">Live and drafts</option>
            <option value="published">Published</option>
            <option value="unpublished">Drafts</option>
            <option value="archived">Archived</option>
          </select>
        </Toolbar>
        <DataTable
          columns={[
            {
              header: 'Product',
              cell: p => (
                <div className="flex items-center gap-3">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-lg bg-ad-raised">🛍️</div>}
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-ad-faint">{p.club?.name ?? '—'}</div>
                  </div>
                </div>
              ),
            },
            { header: 'Price', cell: p => (p.pricePaise === 0 ? 'Free' : formatPaise(p.pricePaise)) },
            { header: 'Stock by size', cell: p => <div className="flex flex-wrap gap-1.5">{p.variants.map(v => <span key={v.id} className={`rounded-md border px-1.5 py-0.5 text-xs ${v.stock === 0 ? 'border-ad-brand/30 text-ad-brand' : 'border-ad-line text-ad-muted'}`}>{v.label}: {v.stock}</span>)}</div> },
            { header: 'Availability', cell: p => <Badge tone={availTone[p.availability]}>{titleCase(p.availability)}</Badge> },
            { header: 'Visibility', cell: p => (p.isArchived ? <Badge tone="warn">Archived</Badge> : p.isPublished ? <Badge tone="ok">Published</Badge> : <Badge>Draft</Badge>) },
            {
              header: '',
              cell: p => (
                <div className="flex justify-end gap-1.5">
                  <button className="ad-btn-ghost ad-btn-sm" onClick={() => setEditing(p)}>Edit</button>
                  {p.isArchived ? (
                    <button className="ad-btn-ghost ad-btn-sm" onClick={() => act(p, 'restore', 'Product restored.')}>Restore</button>
                  ) : (
                    <>
                      {p.isPublished ? <button className="ad-btn-ghost ad-btn-sm" onClick={() => act(p, 'unpublish', 'Product unpublished.')}>Unpublish</button> : <button className="ad-btn-ghost ad-btn-sm" onClick={() => act(p, 'publish', 'Product published.')}>Publish</button>}
                      <button className="ad-btn-danger ad-btn-sm" onClick={() => setArchiving(p)}>Archive</button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          rows={q.items}
          rowKey={p => p.id}
          loading={q.loading}
          error={q.error}
          onRetry={q.refresh}
          emptyTitle="No products yet"
          emptyHint="Create a product to start selling club merchandise."
          hasActiveFilters={q.hasActiveFilters}
          onReset={q.reset}
        />
        <Pager pagination={q.pagination} onPage={q.setPage} pageSize={q.pageSize} onPageSize={q.setPageSize} loading={q.loading} />
      </div>

      <ProductModal
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          toast.success('Product saved.');
          q.refresh();
        }}
      />
      <ConfirmDialog
        open={!!archiving}
        onClose={() => setArchiving(null)}
        title="Archive product?"
        message="It disappears from the catalogue. Existing orders keep their details and can still be processed."
        confirmLabel="Archive"
        danger
        onConfirm={async () => {
          if (!archiving) return;
          await post(`/merchandise/manage/products/${archiving.id}/archive`);
          toast.success('Product archived.');
          q.refresh();
        }}
      />
    </>
  );
}

interface VariantDraft {
  id?: string;
  label: string;
  stock: string;
}

function ProductModal({ target, onClose, onSaved }: { target: ProductRow | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const isNew = target === 'new';
  const product = target && target !== 'new' ? target : null;
  const [clubId, setClubId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [published, setPublished] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([{ label: 'Standard', stock: '10' }]);
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setError(null);
    setImage(undefined);
    if (product) {
      setName(product.name);
      setDescription(product.description);
      setPrice(String(product.pricePaise / 100));
      setVariants(product.variants.map(v => ({ id: v.id, label: v.label, stock: String(v.stock) })));
    } else {
      setClubId('');
      setName('');
      setDescription('');
      setPrice('0');
      setPublished(false);
      setVariants([{ label: 'Standard', stock: '10' }]);
    }
  }, [target, product]);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return setError('Images must be PNG, JPEG, WebP or GIF.');
    if (file.size > 5 * 1024 * 1024) return setError('The image must be 5 MB or smaller.');
    const r = new FileReader();
    r.onload = () => setImage(String(r.result));
    r.readAsDataURL(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const rupees = Number(price);
    if (!name.trim()) return setError('Product name is required.');
    if (!(rupees >= 0)) return setError('Enter a price of 0 or more.');
    if (isNew && !clubId) return setError('Choose the club that sells this product.');
    const clean = variants.map(v => ({ ...v, label: v.label.trim(), stockN: Number(v.stock) }));
    if (clean.some(v => !v.label)) return setError('Every size/variant needs a label.');
    if (new Set(clean.map(v => v.label.toLowerCase())).size !== clean.length) return setError('Variant labels must be unique.');
    if (clean.some(v => !Number.isInteger(v.stockN) || v.stockN < 0)) return setError('Stock must be a whole number, 0 or more.');

    setBusy(true);
    try {
      const pricePaise = Math.round(rupees * 100);
      if (isNew) {
        await post('/merchandise/manage/products', {
          clubId, name: name.trim(), description, pricePaise, isPublished: published, imageUrl: image ?? undefined,
          variants: clean.map(v => ({ label: v.label, stock: v.stockN })),
        });
      } else if (product) {
        await put(`/merchandise/manage/products/${product.id}`, { name: name.trim(), description, pricePaise, ...(image !== undefined ? { imageUrl: image } : {}) });
        for (const v of clean) {
          if (v.id) {
            const before = product.variants.find(x => x.id === v.id);
            if (before && (before.label !== v.label || before.stock !== v.stockN)) await put(`/merchandise/manage/products/${product.id}/variants/${v.id}`, { label: v.label, stock: v.stockN });
          } else {
            await post(`/merchandise/manage/products/${product.id}/variants`, { label: v.label, stock: v.stockN });
          }
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} width="lg" title={isNew ? 'New product' : 'Edit product'} footer={<><button className="ad-btn-ghost" onClick={onClose}>Cancel</button><button className="ad-btn-primary" form="product-form" disabled={busy}>{busy && <Spinner size={16} />} Save</button></>}>
      <form id="product-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {isNew && <div className="sm:col-span-2"><Field label="Club"><ClubSelect value={clubId} onChange={setClubId} allLabel="Select a club…" className="" label="Club" /></Field></div>}
        <Field label="Name"><input className="ad-field" value={name} onChange={e => setName(e.target.value)} maxLength={120} /></Field>
        <Field label="Price (₹)" hint="Applies to every size unless set per size later."><input className="ad-field" type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea className="ad-field min-h-20" value={description} onChange={e => setDescription(e.target.value)} /></Field></div>

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-ad-muted">Sizes / variants and stock</span>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={v.id ?? i} className="flex items-center gap-2">
                <input className="ad-field" aria-label="Label" placeholder="Label (e.g. M)" value={v.label} onChange={e => setVariants(vs => vs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="ad-field !w-28" aria-label="Stock" type="number" min={0} value={v.stock} onChange={e => setVariants(vs => vs.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))} />
                {!v.id && <button type="button" className="ad-btn-ghost ad-btn-sm" aria-label="Remove variant" onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))} disabled={variants.length === 1}><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
          <button type="button" className="ad-btn-ghost ad-btn-sm mt-2" onClick={() => setVariants(vs => [...vs, { label: '', stock: '0' }])}><Plus size={14} /> Add size</button>
        </div>

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-ad-muted">Image</span>
          <div className="flex items-center gap-4">
            {(image ?? product?.imageUrl) && <img src={(image ?? product?.imageUrl) as string} alt="Preview" className="h-16 w-16 rounded-xl object-cover" />}
            <label className="ad-btn-ghost ad-btn-sm cursor-pointer">Choose image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => pickImage(e.target.files?.[0])} /></label>
            {(image ?? product?.imageUrl) && <button type="button" className="ad-btn-ghost ad-btn-sm" onClick={() => setImage(null)}>Remove</button>}
          </div>
        </div>
        {isNew && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> Publish immediately
          </label>
        )}
        {error && <p role="alert" className="text-sm text-ad-brand sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
