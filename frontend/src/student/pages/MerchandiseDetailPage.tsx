import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fetchProduct, placeOrder, formatPaise, type Product } from '@/student/api/merch';
import { useAuthStore } from '@/student/store/authStore';
import { loginUrl } from '@/student/utils/redirect';
import { PageLoader } from '@/student/components/ui/LoadingSpinner';
import { ErrorState } from '@/student/components/ui/States';
import { availabilityStyle } from './MerchandisePage';

const MAX_QTY = 10;

/** Anyone can view a product; choosing "Buy" without an account sends the visitor to login and back here. */
export default function MerchandiseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const p = await fetchProduct(id);
    setProduct(p);
    setVariantId((cur) => cur || p?.variants.find((v) => v.available)?.id || '');
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !product) return <PageLoader />;
  if (!product) return <ErrorState message="This product is not available." onRetry={load} />;

  const variant = product.variants.find((v) => v.id === variantId);
  const maxQty = Math.min(MAX_QTY, variant?.stock ?? 1);
  const unit = variant?.yourPricePaise ?? variant?.pricePaise ?? product.pricePaise;
  const regular = variant?.pricePaise ?? product.pricePaise;
  const memberOff = (product.memberDiscountPercent ?? 0) > 0;
  const a = availabilityStyle(product.availability);

  const buy = async () => {
    if (!isAuthenticated) {
      navigate(loginUrl(`/merch/${product.id}`));
      return;
    }
    if (!variant) {
      toast.error('Please choose a size.');
      return;
    }
    setBuying(true);
    try {
      const order = await placeOrder({ productId: product.id, variantId: variant.id, quantity });
      toast.success(order.status === 'PAID' ? 'Order confirmed!' : 'Order placed. Complete the payment to confirm it.');
      navigate(`/orders/${order.id}`);
    } catch (e) {
      toast.error(String(e).replace('Error: ', ''));
      load(); // stock may have changed
    } finally {
      setBuying(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--subtext)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
        <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--border)', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🛍️'}
        </div>

        <div>
          {product.club && <div style={{ color: 'var(--color-crimson)', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{product.club.name}</div>}
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{product.name}</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 16 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{unit === 0 ? 'Free' : formatPaise(unit)}</span>
            {product.isMember && memberOff && unit < regular && (
              <span style={{ marginLeft: 10, fontSize: 14, color: 'var(--subtext)', textDecoration: 'line-through' }}>{formatPaise(regular)}</span>
            )}
            {memberOff && (
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                {product.isMember ? `Member price · ${product.memberDiscountPercent}% off` : `Members get ${product.memberDiscountPercent}% off`}
              </span>
            )}
            <span style={{ color: a.color, fontWeight: 700, fontSize: 13 }}>{a.label}</span>
          </div>
          {product.description && <p style={{ color: 'var(--subtext)', lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{product.description}</p>}

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--subtext)', marginBottom: 8, letterSpacing: '0.6px' }}>SIZE / VARIANT</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  disabled={!v.available}
                  onClick={() => { setVariantId(v.id); setQuantity(1); }}
                  aria-pressed={variantId === v.id}
                  title={v.available ? `${v.stock} available` : 'Sold out'}
                  style={{
                    minWidth: 52, padding: '9px 14px', borderRadius: 12, border: '1.5px solid',
                    borderColor: variantId === v.id ? 'var(--color-crimson)' : 'var(--border)',
                    background: variantId === v.id ? 'var(--color-crimson-dim)' : 'var(--surface)',
                    color: v.available ? 'var(--text)' : 'var(--subtext)', fontWeight: 600, cursor: v.available ? 'pointer' : 'not-allowed',
                    textDecoration: v.available ? 'none' : 'line-through', opacity: v.available ? 1 : 0.55, fontFamily: 'var(--font-sans)',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {variant?.lowStock && <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 8 }}>Only {variant.stock} left in this size</div>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--subtext)', letterSpacing: '0.6px' }}>QUANTITY</span>
            <button aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} style={qtyBtn}><Minus size={16} /></button>
            <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{quantity}</span>
            <button aria-label="Increase quantity" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} style={qtyBtn}><Plus size={16} /></button>
          </div>

          <button
            onClick={buy}
            disabled={buying || !product.purchasable || (isAuthenticated && !variant)}
            className="btn-primary"
            style={{ width: '100%', height: 52, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {buying ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            {!product.purchasable ? 'Sold out' : !isAuthenticated ? 'Sign in to buy' : `Buy · ${unit * quantity === 0 ? 'Free' : formatPaise(unit * quantity)}`}
          </button>
          <p style={{ color: 'var(--subtext)', fontSize: 12, marginTop: 10 }}>The final price is confirmed by the server when you place the order.</p>
        </div>
      </div>
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
