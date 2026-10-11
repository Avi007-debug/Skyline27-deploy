import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Package, Plus, Search, ShoppingBag, X } from "lucide-react";
import { request, sanitizeErrorMessage } from "../api";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

interface Variant { id: string; label: string; stock: number }
interface Product {
  id: string; name: string; description: string; imageUrl: string | null; pricePaise: number; memberDiscountPercent?: number;
  isPublished: boolean; isArchived: boolean; variants: Variant[]; availability: "IN_STOCK" | "LOW_STOCK" | "SOLD_OUT";
}
interface Order {
  id: string; productName: string; variantLabel: string; quantity: number; unitPricePaise: number; totalPaise: number;
  status: "PENDING_PAYMENT" | "PAYMENT_SUBMITTED" | "PAID" | "CANCELLED" | "REJECTED";
  transactionId: string | null; buyerName: string; buyerEmail: string; createdAt: string;
}
interface Pagination { page: number; pageSize: number; totalItems: number; totalPages: number }

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const STATUS_LABEL: Record<Order["status"], string> = {
  PENDING_PAYMENT: "Awaiting payment", PAYMENT_SUBMITTED: "Verify payment", PAID: "Paid", CANCELLED: "Cancelled", REJECTED: "Rejected",
};

interface Props { clubId?: string; getToken: () => Promise<string | null>; isDark: boolean }

/**
 * Merchandise for the signed-in club only. The server scopes every call to the
 * caller's own club, so another club's products and orders are never returned.
 */
export default function MerchandiseManager({ getToken, isDark }: Props) {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const card = { background: isDark ? "rgba(255,255,255,0.015)" : "#ffffff", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)" } as const;
  const text = isDark ? "#fff" : "#1e1b26";
  const sub = isDark ? "#94a3b8" : "#64748b";

  return (
    <div className="p-4 sm:p-8 space-y-6" style={{ fontFamily: FB }}>
      <div>
        <p className="text-[11px] tracking-[0.5em] uppercase mb-1.5" style={{ color: sub, fontFamily: FM }}>Club store</p>
        <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: text }}>Merchandise</h1>
      </div>
      <div className="flex gap-2">
        {([["products", "Products", ShoppingBag], ["orders", "Orders", Package]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
            style={{ background: tab === id ? "#F03D4E" : "transparent", color: tab === id ? "#fff" : sub, border: tab === id ? "1px solid #F03D4E" : isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)" }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
      {tab === "products" ? <Products getToken={getToken} card={card} text={text} sub={sub} isDark={isDark} /> : <Orders getToken={getToken} card={card} text={text} sub={sub} isDark={isDark} />}
    </div>
  );
}

interface PanelProps { getToken: () => Promise<string | null>; card: React.CSSProperties; text: string; sub: string; isDark: boolean }

function usePaged<T>(path: string, extra: Record<string, string>, getToken: () => Promise<string | null>) {
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [extraData, setExtraData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const key = JSON.stringify(extra);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: "10", ...(search ? { search } : {}), ...JSON.parse(key) });
      const data = await request(`${path}?${q}`, {}, (await getToken()) ?? undefined);
      if (id !== latest.current) return;
      if (data.items.length === 0 && data.pagination.page > 1) { setPage(data.pagination.totalPages); return; }
      setItems(data.items);
      setPagination(data.pagination);
      setExtraData(data);
    } catch (e) {
      if (id === latest.current) setError(sanitizeErrorMessage(e, "Could not load data."));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [path, page, search, key, getToken]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [key]);

  return { items, pagination, extraData, page, setPage, searchInput, setSearchInput, search, loading, error, reload: load };
}

function Pager({ p, onPage }: { p: Pagination | null; onPage: (n: number) => void }) {
  if (!p || p.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-5 text-xs" style={{ fontFamily: FM }}>
      <button disabled={p.page <= 1} onClick={() => onPage(p.page - 1)} className="px-3 py-1.5 rounded-full border border-white/10 disabled:opacity-40 cursor-pointer">Prev</button>
      <span>Page {p.page} of {p.totalPages} · {p.totalItems}</span>
      <button disabled={p.page >= p.totalPages} onClick={() => onPage(p.page + 1)} className="px-3 py-1.5 rounded-full border border-white/10 disabled:opacity-40 cursor-pointer">Next</button>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, isDark }: { value: string; onChange: (v: string) => void; placeholder: string; isDark: boolean }) {
  return (
    <div className="relative max-w-sm w-full">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
        style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#e9ecf2", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", color: isDark ? "#fff" : "#1e1b26" }} />
    </div>
  );
}

function Products({ getToken, card, text, sub, isDark }: PanelProps) {
  const [state, setState] = useState("");
  const q = usePaged<Product>("/merchandise/manage/products", state ? { state } : {}, getToken);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (p: Product, path: string, msg: string) => {
    setError(null);
    try {
      await request(`/merchandise/manage/products/${p.id}/${path}`, { method: "POST", body: "{}" }, (await getToken()) ?? undefined);
      setNotice(msg);
      q.reload();
    } catch (e) { setError(sanitizeErrorMessage(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q.searchInput} onChange={q.setSearchInput} placeholder="Search products…" isDark={isDark} />
        <select value={state} onChange={e => setState(e.target.value)} aria-label="State" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: isDark ? "#111" : "#e9ecf2", color: text, border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)" }}>
          <option value="">Live and drafts</option><option value="published">Published</option><option value="unpublished">Drafts</option><option value="archived">Archived</option>
        </select>
        <button onClick={() => setCreating(true)} className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer" style={{ background: "#F03D4E" }}><Plus size={14} /> New product</button>
      </div>
      {notice && <p role="status" className="text-xs text-emerald-500">{notice}</p>}
      {(error || q.error) && <p role="alert" className="text-xs text-[#F03D4E]">{error || q.error}</p>}

      {q.loading && q.items.length === 0 ? <p style={{ color: sub }} className="text-sm">Loading…</p> : q.items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm" style={{ ...card, color: sub }}>{q.search || state ? "No products match." : "No products yet. Create your first one."}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={q.loading}>
          {q.items.map(p => (
            <article key={p.id} className="rounded-2xl p-5 flex flex-col gap-3" style={card}>
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: isDark ? "#161616" : "#e9ecf2" }}>
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <ShoppingBag size={22} style={{ color: sub }} />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate" style={{ color: text }}>{p.name}</h3>
                  <p className="text-sm" style={{ color: sub }}>{p.pricePaise === 0 ? "Free" : rupees(p.pricePaise)}</p>
                  <p className="text-[11px] mt-1" style={{ color: p.isArchived ? "#f59e0b" : p.isPublished ? "#22c55e" : sub, fontFamily: FM }}>{p.isArchived ? "ARCHIVED" : p.isPublished ? "PUBLISHED" : "DRAFT"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.variants.map(v => <span key={v.id} className="text-[11px] px-2 py-0.5 rounded-md border" style={{ borderColor: v.stock === 0 ? "rgba(240,61,78,0.4)" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)", color: v.stock === 0 ? "#F03D4E" : sub, fontFamily: FM }}>{v.label}: {v.stock}</span>)}
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                <button onClick={() => setEditing(p)} className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer" style={{ color: text, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)" }}>Edit / stock</button>
                {p.isArchived ? <button onClick={() => act(p, "restore", "Product restored.")} className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer" style={{ color: text, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)" }}>Restore</button> : (
                  <>
                    <button onClick={() => act(p, p.isPublished ? "unpublish" : "publish", p.isPublished ? "Unpublished." : "Published.")} className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer" style={{ color: text, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)" }}>{p.isPublished ? "Unpublish" : "Publish"}</button>
                    <button onClick={() => { if (window.confirm(`Archive "${p.name}"? It disappears from the store; existing orders are kept.`)) act(p, "archive", "Archived."); }} className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer text-[#F03D4E]" style={{ borderColor: "rgba(240,61,78,0.35)" }}>Archive</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Pager p={q.pagination} onPage={q.setPage} />
      {(creating || editing) && <ProductForm product={editing} getToken={getToken} isDark={isDark} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setNotice("Product saved."); q.reload(); }} />}
    </div>
  );
}

function ProductForm({ product, getToken, isDark, onClose, onSaved }: { product: Product | null; getToken: () => Promise<string | null>; isDark: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.pricePaise / 100) : "0");
  const [discount, setDiscount] = useState(String(product?.memberDiscountPercent ?? 0));
  const [published, setPublished] = useState(false);
  const [variants, setVariants] = useState<Array<{ id?: string; label: string; stock: string }>>(product ? product.variants.map(v => ({ id: v.id, label: v.label, stock: String(v.stock) })) : [{ label: "Standard", stock: "10" }]);
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return setError("Use a PNG, JPEG, WebP or GIF image.");
    if (file.size > 5 * 1024 * 1024) return setError("The image must be 5 MB or smaller.");
    const r = new FileReader();
    r.onload = () => setImage(String(r.result));
    r.readAsDataURL(file);
  };

  const submit = async () => {
    setError(null);
    const rupeesValue = Number(price);
    if (!name.trim()) return setError("Product name is required.");
    if (!(rupeesValue >= 0)) return setError("Enter a price of 0 or more.");
    const discountValue = Number(discount || 0);
    if (!Number.isInteger(discountValue) || discountValue < 0 || discountValue > 100) return setError("Member discount must be a whole number between 0 and 100.");
    const clean = variants.map(v => ({ ...v, label: v.label.trim(), n: Number(v.stock) }));
    if (clean.some(v => !v.label)) return setError("Every size needs a label.");
    if (new Set(clean.map(v => v.label.toLowerCase())).size !== clean.length) return setError("Size labels must be unique.");
    if (clean.some(v => !Number.isInteger(v.n) || v.n < 0)) return setError("Stock must be a whole number, 0 or more.");
    setBusy(true);
    try {
      const token = (await getToken()) ?? undefined;
      const pricePaise = Math.round(rupeesValue * 100);
      if (!product) {
        await request("/merchandise/manage/products", { method: "POST", body: JSON.stringify({ name: name.trim(), description, pricePaise, memberDiscountPercent: discountValue, isPublished: published, imageUrl: image ?? undefined, variants: clean.map(v => ({ label: v.label, stock: v.n })) }) }, token);
      } else {
        await request(`/merchandise/manage/products/${product.id}`, { method: "PUT", body: JSON.stringify({ name: name.trim(), description, pricePaise, memberDiscountPercent: discountValue, ...(image !== undefined ? { imageUrl: image } : {}) }) }, token);
        for (const v of clean) {
          const before = product.variants.find(x => x.id === v.id);
          if (v.id && before && (before.label !== v.label || before.stock !== v.n)) await request(`/merchandise/manage/products/${product.id}/variants/${v.id}`, { method: "PUT", body: JSON.stringify({ label: v.label, stock: v.n }) }, token);
          if (!v.id) await request(`/merchandise/manage/products/${product.id}/variants`, { method: "POST", body: JSON.stringify({ label: v.label, stock: v.n }) }, token);
        }
      }
      onSaved();
      onClose();
    } catch (e) { setError(sanitizeErrorMessage(e)); } finally { setBusy(false); }
  };

  const input = { background: isDark ? "rgba(255,255,255,0.03)" : "#e9ecf2", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", color: isDark ? "#fff" : "#1e1b26" } as const;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }} role="dialog" aria-modal="true" aria-label={product ? "Edit product" : "New product"}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl space-y-4" style={{ background: isDark ? "#0c0c0c" : "#f0f2f6", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.12)", color: isDark ? "#fff" : "#1e1b26", fontFamily: FB }}>
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{product ? "Edit product" : "New product"}</h2><button onClick={onClose} aria-label="Close" className="cursor-pointer"><X size={18} /></button></div>
        <label className="block text-xs font-semibold">Name<input className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm" style={input} value={name} onChange={e => setName(e.target.value)} maxLength={120} /></label>
        <label className="block text-xs font-semibold">Description<textarea className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm min-h-20" style={input} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label className="block text-xs font-semibold">Price (₹)<input type="number" min={0} step="0.01" className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm" style={input} value={price} onChange={e => setPrice(e.target.value)} /></label>
        <label className="block text-xs font-semibold">Member discount (%)<input type="number" min={0} max={100} step="1" aria-label="Member discount percent" className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm" style={input} value={discount} onChange={e => setDiscount(e.target.value)} /><span className="block mt-1 font-normal opacity-70">Active club members get this much off. 0 = no discount.</span></label>
        <div>
          <span className="text-xs font-semibold">Sizes and stock</span>
          <div className="space-y-2 mt-1">
            {variants.map((v, i) => (
              <div key={v.id ?? i} className="flex gap-2">
                <input aria-label="Label" placeholder="e.g. M" className="flex-1 rounded-xl px-3 py-2 text-sm" style={input} value={v.label} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <input aria-label="Stock" type="number" min={0} className="w-24 rounded-xl px-3 py-2 text-sm" style={input} value={v.stock} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} />
                {!v.id && variants.length > 1 && <button type="button" aria-label="Remove size" onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))} className="cursor-pointer"><X size={14} /></button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setVariants(vs => [...vs, { label: "", stock: "0" }])} className="mt-2 text-xs underline cursor-pointer">+ Add size</button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {(image ?? product?.imageUrl) && <img src={(image ?? product?.imageUrl) as string} alt="Preview" className="w-14 h-14 rounded-xl object-cover" />}
          <label className="px-3 py-2 rounded-lg border cursor-pointer" style={{ borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)" }}>Choose image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => pick(e.target.files?.[0])} /></label>
          {(image ?? product?.imageUrl) && <button type="button" onClick={() => setImage(null)} className="underline cursor-pointer">Remove</button>}
        </div>
        {!product && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> Publish immediately</label>}
        {error && <p role="alert" className="text-xs text-[#F03D4E]">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-xs rounded-full font-semibold cursor-pointer" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0" }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="px-5 py-2 text-xs rounded-full font-semibold text-white disabled:opacity-50 cursor-pointer" style={{ background: "#F03D4E" }}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function Orders({ getToken, card, text, sub, isDark }: PanelProps) {
  const [status, setStatus] = useState("");
  const q = usePaged<Order>("/merchandise/manage/orders", status ? { status } : {}, getToken);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = q.extraData?.summary as { paidOrders: number; grossSalesPaise: number } | undefined;

  const act = async (o: Order, action: "verify" | "reject") => {
    setError(null);
    setNotice(null);
    if (action === "reject" && !window.confirm(`Reject ${o.buyerName}'s order? Reserved stock goes back on sale.`)) return;
    try {
      await request(`/merchandise/manage/orders/${o.id}/${action}`, { method: "POST", body: "{}" }, (await getToken()) ?? undefined);
      setNotice(action === "verify" ? "Payment verified and recorded in the ledger." : "Order rejected and stock released.");
      q.reload();
    } catch (e) { setError(sanitizeErrorMessage(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q.searchInput} onChange={q.setSearchInput} placeholder="Search product, buyer or payment ref…" isDark={isDark} />
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: isDark ? "#111" : "#e9ecf2", color: text, border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)" }}>
          <option value="">Any status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {summary && <p className="text-xs" style={{ color: sub }}><strong style={{ color: text }}>{summary.paidOrders}</strong> paid orders · gross sales <strong style={{ color: text }}>{rupees(summary.grossSalesPaise)}</strong> (revenue before costs, not profit)</p>}
      {notice && <p role="status" className="text-xs text-emerald-500">{notice}</p>}
      {(error || q.error) && <p role="alert" className="text-xs text-[#F03D4E]">{error || q.error}</p>}
      {q.loading && q.items.length === 0 ? <p style={{ color: sub }} className="text-sm">Loading…</p> : q.items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm" style={{ ...card, color: sub }}>{q.search || status ? "No orders match." : "No orders yet."}</div>
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={card}>
          <table className="w-full min-w-[640px] text-sm" aria-busy={q.loading}>
            <thead><tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: sub, fontFamily: FM }}><th className="p-4">Order</th><th className="p-4">Buyer</th><th className="p-4">Total</th><th className="p-4">Payment ref.</th><th className="p-4">Status</th><th className="p-4" /></tr></thead>
            <tbody>
              {q.items.map(o => (
                <tr key={o.id} className="border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", color: text }}>
                  <td className="p-4"><div className="font-semibold">{o.productName}</div><div className="text-xs" style={{ color: sub }}>{o.variantLabel} × {o.quantity}</div></td>
                  <td className="p-4"><div>{o.buyerName}</div><div className="text-xs" style={{ color: sub }}>{o.buyerEmail}</div></td>
                  <td className="p-4">{o.totalPaise === 0 ? "Free" : rupees(o.totalPaise)}</td>
                  <td className="p-4 font-mono text-xs">{o.transactionId ?? "—"}</td>
                  <td className="p-4 text-xs">{STATUS_LABEL[o.status]}</td>
                  <td className="p-4 text-right whitespace-nowrap">
                    {o.status === "PAYMENT_SUBMITTED" && <button onClick={() => act(o, "verify")} className="mr-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer inline-flex items-center gap-1" style={{ background: "#F03D4E" }}><Check size={12} /> Verify</button>}
                    {(o.status === "PAYMENT_SUBMITTED" || o.status === "PENDING_PAYMENT") && <button onClick={() => act(o, "reject")} className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer text-[#F03D4E]" style={{ borderColor: "rgba(240,61,78,0.35)" }}>Reject</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager p={q.pagination} onPage={q.setPage} />
    </div>
  );
}
