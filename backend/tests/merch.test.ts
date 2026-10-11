process.env.MAIL_TRANSPORT = 'memory';
process.env.SUPABASE_SERVICE_ROLE_KEY = ''; // never touch real storage from tests
import prisma from '../config/db';
import app from '../index';
import { check, clubByEmail, createRunner, eq, makeUser, seeded, startServer, uid } from './helpers';

/** Merchandise: public browsing, login-gated purchase, stock integrity, price snapshots, payment idempotency. */
async function main() {
  const srv = await startServer(app);
  const { test, summary } = createRunner('🛍️ Merchandise: browse, purchase, stock, payments');
  const { api } = srv;

  const admin = await seeded('admin@skyline.local');
  const gdgHead = await seeded('aarav.gdg@college.edu');
  const ieeeHead = await seeded('ieee.head@college.edu');
  const gdg = await clubByEmail('gdg@college.edu');
  const tag = uid();
  const users: string[] = [];
  const products: string[] = [];
  const student = async (p: string) => {
    const u = await makeUser(p);
    users.push(u.id);
    return u;
  };
  const newProduct = async (overrides: Record<string, unknown> = {}) => {
    const r = await api('POST', '/merchandise/manage/products', {
      token: gdgHead.token,
      body: { name: `TEST-${tag}-${uid()}`, description: 'test', pricePaise: 25000, isPublished: true, variants: [{ label: 'M', stock: 5 }, { label: 'L', stock: 0 }], ...overrides },
    });
    check(r.status === 201, `product create failed: ${r.status} ${r.text}`);
    products.push(r.data.product.id);
    return r.data.product as any;
  };

  try {
    // ── Public browsing ──────────────────────────────────────────────────────
    await test('anonymous visitors can browse published products with sizes, price and availability', async () => {
      const r = await api('GET', '/merchandise');
      eq(r.status, 200, 'status');
      check(r.data.items.length >= 2, 'seeded products visible');
      const hoodie = r.data.items.find((p: any) => p.name === 'GDG Developer Hoodie');
      check(hoodie, 'seeded hoodie listed');
      check(hoodie.imageUrl && hoodie.pricePaise === 45000, 'image + price');
      check(hoodie.variants.length >= 3 && hoodie.variants.every((v: any) => 'label' in v && 'stock' in v && 'available' in v), 'variants with stock');
      eq(hoodie.variants.find((v: any) => v.label === 'XL').available, false, 'sold-out size flagged');
      eq(hoodie.purchasable, true, 'purchasable');
      eq(hoodie.club.name.includes('GDG'), true, 'club shown');
    });

    await test('drafts, archived products and archived clubs\' products are not public', async () => {
      check(!(await api('GET', '/merchandise?search=Rotaract Tote')).data.items.length, 'draft hidden');
      const draft = await newProduct({ isPublished: false });
      eq((await api('GET', `/merchandise/${draft.id}`)).status, 404, 'draft detail hidden');
      await api('POST', `/merchandise/manage/products/${draft.id}/publish`, { token: gdgHead.token });
      eq((await api('GET', `/merchandise/${draft.id}`)).status, 200, 'visible after publish');
      await api('POST', `/merchandise/manage/products/${draft.id}/archive`, { token: gdgHead.token });
      eq((await api('GET', `/merchandise/${draft.id}`)).status, 404, 'hidden after archive');
    });

    await test('product list paginates and searches across pages', async () => {
      for (let i = 0; i < 5; i++) await newProduct({ name: `PAGE-${tag}-${i}` });
      const p1 = await api('GET', `/merchandise?search=PAGE-${tag}&pageSize=2&page=1`);
      const p3 = await api('GET', `/merchandise?search=PAGE-${tag}&pageSize=2&page=3`);
      eq(p1.data.pagination, { page: 1, pageSize: 2, totalItems: 5, totalPages: 3 }, 'meta');
      eq(p3.data.items.length, 1, 'last page');
    });

    // ── Purchase ─────────────────────────────────────────────────────────────
    await test('login is required to buy; staff accounts cannot buy as students', async () => {
      const p = await newProduct();
      const body = { productId: p.id, variantId: p.variants[0].id, quantity: 1 };
      eq((await api('POST', '/merchandise/orders', { body })).status, 401, 'anonymous');
      eq((await api('POST', '/merchandise/orders', { token: gdgHead.token, body })).status, 403, 'club head');
      eq((await api('GET', '/merchandise/orders/mine')).status, 401, 'order history needs login');
    });

    await test('the server decides the price: client-supplied prices are ignored and the price is snapshotted', async () => {
      const p = await newProduct({ pricePaise: 30000 });
      const u = await student('price');
      const v = p.variants.find((x: any) => x.label === 'M');
      const r = await api('POST', '/merchandise/orders', { token: u.token, body: { productId: p.id, variantId: v.id, quantity: 2, pricePaise: 1, unitPricePaise: 1, totalPaise: 2 } });
      eq(r.status, 201, 'order');
      eq(r.data.order.unitPricePaise, 30000, 'unit price from DB');
      eq(r.data.order.totalPaise, 60000, 'total from DB');
      eq(r.data.order.status, 'PENDING_PAYMENT', 'awaiting payment');
      // Later price/name changes do not rewrite history.
      await api('PUT', `/merchandise/manage/products/${p.id}`, { token: gdgHead.token, body: { pricePaise: 99900, name: 'Renamed' } });
      const mine = await api('GET', '/merchandise/orders/mine', { token: u.token });
      const o = mine.data.items.find((x: any) => x.id === r.data.order.id);
      eq(o.unitPricePaise, 30000, 'historical unit price');
      eq(o.totalPaise, 60000, 'historical total');
      check(o.productName.startsWith('TEST-'), 'historical product name');
      check(o.payment, 'payment instructions are returned for unpaid orders');
    });

    await test('invalid variants, quantities and sold-out sizes are rejected', async () => {
      const p = await newProduct();
      const other = await newProduct();
      const u = await student('invalid');
      const M = p.variants.find((x: any) => x.label === 'M').id;
      const L = p.variants.find((x: any) => x.label === 'L').id;
      const send = (b: any) => api('POST', '/merchandise/orders', { token: u.token, body: b });
      eq((await send({ productId: p.id, variantId: other.variants[0].id, quantity: 1 })).status, 400, 'variant of another product');
      eq((await send({ productId: p.id, variantId: 'nonexistent', quantity: 1 })).status, 400, 'unknown variant');
      eq((await send({ productId: p.id, variantId: M, quantity: 0 })).status, 400, 'zero qty');
      eq((await send({ productId: p.id, variantId: M, quantity: -3 })).status, 400, 'negative qty');
      eq((await send({ productId: p.id, variantId: M, quantity: 1.5 })).status, 400, 'fractional qty');
      eq((await send({ productId: p.id, variantId: M, quantity: 999 })).status, 400, 'absurd qty');
      eq((await send({ productId: p.id, variantId: M, quantity: 6 })).status, 409, 'more than stock');
      eq((await send({ productId: p.id, variantId: L, quantity: 1 })).status, 409, 'sold-out size');
      eq((await prisma.productVariant.findUniqueOrThrow({ where: { id: M } })).stock, 5, 'stock untouched by failures');
    });

    await test('concurrent buyers can never oversell: 12 buyers, 4 in stock → exactly 4 orders, stock 0', async () => {
      const p = await newProduct({ variants: [{ label: 'One', stock: 4 }] });
      const vid = p.variants[0].id;
      const buyers = await Promise.all(Array.from({ length: 12 }, (_, i) => student(`rush${i}`)));
      const rs = await Promise.all(buyers.map(b => api('POST', '/merchandise/orders', { token: b.token, body: { productId: p.id, variantId: vid, quantity: 1 } })));
      eq(rs.filter(r => r.status === 201).length, 4, 'orders created');
      eq(rs.filter(r => r.status === 409).length, 8, 'refused');
      eq((await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } })).stock, 0, 'stock exhausted exactly');
      eq(await prisma.order.count({ where: { variantId: vid } }), 4, 'order rows');
    });

    await test('cancelling an unpaid order releases the reserved stock exactly once', async () => {
      const p = await newProduct({ variants: [{ label: 'One', stock: 3 }] });
      const vid = p.variants[0].id;
      const u = await student('cancel');
      const o = (await api('POST', '/merchandise/orders', { token: u.token, body: { productId: p.id, variantId: vid, quantity: 2 } })).data.order;
      eq((await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } })).stock, 1, 'reserved');
      const rs = await Promise.all([1, 2, 3].map(() => api('POST', `/merchandise/orders/${o.id}/cancel`, { token: u.token })));
      eq(rs.filter(r => r.status === 200).length, 1, 'cancelled once');
      eq((await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } })).stock, 3, 'stock restored once');
      const stranger = await student('stranger');
      eq((await api('POST', `/merchandise/orders/${o.id}/cancel`, { token: stranger.token })).status, 404, "cannot touch someone else's order");
    });

    // ── Payment & ledger ─────────────────────────────────────────────────────
    await test('payment: unique reference, verification by the owning club only, duplicate verification adds no second ledger record', async () => {
      const p = await newProduct({ pricePaise: 45000, variants: [{ label: 'M', stock: 10 }] });
      const vid = p.variants[0].id;
      const a = await student('payA');
      const b = await student('payB');
      const oa = (await api('POST', '/merchandise/orders', { token: a.token, body: { productId: p.id, variantId: vid, quantity: 1 } })).data.order;
      const ob = (await api('POST', '/merchandise/orders', { token: b.token, body: { productId: p.id, variantId: vid, quantity: 1 } })).data.order;
      const utr = `UTR${uid()}${uid()}`.toUpperCase();

      eq((await api('POST', `/merchandise/manage/orders/${oa.id}/verify`, { token: gdgHead.token })).status, 409, 'cannot verify before payment is submitted');
      eq((await api('PUT', `/merchandise/orders/${oa.id}/payment`, { token: a.token, body: { transactionId: 'x' } })).status, 400, 'bad reference');
      eq((await api('PUT', `/merchandise/orders/${oa.id}/payment`, { token: b.token, body: { transactionId: utr } })).status, 404, "other student's order");
      eq((await api('PUT', `/merchandise/orders/${oa.id}/payment`, { token: a.token, body: { transactionId: utr } })).status, 200, 'submit');
      eq((await api('PUT', `/merchandise/orders/${oa.id}/payment`, { token: a.token, body: { transactionId: utr } })).status, 200, 'same reference again is idempotent');
      eq((await api('PUT', `/merchandise/orders/${ob.id}/payment`, { token: b.token, body: { transactionId: utr } })).status, 409, 'reference reuse across orders');

      eq((await api('POST', `/merchandise/manage/orders/${oa.id}/verify`, { token: ieeeHead.token })).status, 404, 'other club cannot verify');
      const results = await Promise.all([1, 2, 3, 4].map(() => api('POST', `/merchandise/manage/orders/${oa.id}/verify`, { token: gdgHead.token })));
      check(results.every(r => r.status === 200), `verify statuses ${results.map(r => r.status)}`);
      eq(results.filter(r => !r.data.alreadyVerified).length, 1, 'exactly one real verification');
      eq((await prisma.order.findUniqueOrThrow({ where: { id: oa.id } })).status, 'PAID', 'paid');

      const entries = await prisma.ledgerEntry.findMany({ where: { refType: 'order', refId: oa.id } });
      eq(entries.length, 1, 'exactly one ledger record');
      eq(entries[0].amountPaise, 45000, 'amount');
      eq(entries[0].category, 'MERCH', 'category');
      eq(entries[0].clubId, gdg.id, 'club');
      eq((await api('POST', `/merchandise/orders/${oa.id}/cancel`, { token: a.token })).status, 409, 'paid order cannot be cancelled');
    });

    await test('rejecting a submitted payment releases stock; a paid order cannot be rejected', async () => {
      const p = await newProduct({ variants: [{ label: 'One', stock: 2 }] });
      const vid = p.variants[0].id;
      const u = await student('rej');
      const o = (await api('POST', '/merchandise/orders', { token: u.token, body: { productId: p.id, variantId: vid, quantity: 1 } })).data.order;
      await api('PUT', `/merchandise/orders/${o.id}/payment`, { token: u.token, body: { transactionId: `UTR${uid()}${uid()}` } });
      eq((await api('POST', `/merchandise/manage/orders/${o.id}/reject`, { token: gdgHead.token, body: { reason: 'no money received' } })).status, 200, 'reject');
      eq((await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } })).stock, 2, 'stock back');
      eq((await api('POST', `/merchandise/manage/orders/${o.id}/reject`, { token: gdgHead.token })).status, 409, 'already rejected');
    });

    await test('free products are fulfilled immediately without any ledger entry', async () => {
      const p = await newProduct({ pricePaise: 0, variants: [{ label: 'One', stock: 2 }] });
      const u = await student('free');
      const r = await api('POST', '/merchandise/orders', { token: u.token, body: { productId: p.id, variantId: p.variants[0].id, quantity: 1 } });
      eq(r.data.order.status, 'PAID', 'status');
      eq(await prisma.ledgerEntry.count({ where: { refId: r.data.order.id } }), 0, 'no ledger record for ₹0');
    });

    // ── Management scoping ───────────────────────────────────────────────────
    await test('club heads manage only their own products and orders; super admin manages all', async () => {
      const p = await newProduct();
      eq((await api('PUT', `/merchandise/manage/products/${p.id}`, { token: ieeeHead.token, body: { name: 'hijack' } })).status, 403, 'edit foreign product');
      eq((await api('POST', `/merchandise/manage/products/${p.id}/variants`, { token: ieeeHead.token, body: { label: 'XXL', stock: 5 } })).status, 403, 'add variant to foreign product');
      eq((await api('POST', `/merchandise/manage/products/${p.id}/archive`, { token: ieeeHead.token })).status, 403, 'archive foreign product');
      const list = await api('GET', '/merchandise/manage/products?pageSize=100', { token: ieeeHead.token });
      check(list.data.items.every((x: any) => x.clubId !== gdg.id), 'foreign products leaked');
      eq((await api('GET', `/merchandise/manage/orders?clubId=${gdg.id}`, { token: ieeeHead.token })).status, 403, 'foreign orders');
      eq((await api('PUT', `/merchandise/manage/products/${p.id}`, { token: admin.token, body: { description: 'admin edit' } })).status, 200, 'admin edit');
      const all = await api('GET', '/merchandise/manage/orders?pageSize=100', { token: admin.token });
      eq(all.status, 200, 'admin orders');
      check(all.data.summary && 'grossSalesPaise' in all.data.summary, 'sales summary (gross revenue, not profit)');
    });

    await test('order CSV export is club scoped and neutralises spreadsheet formulas', async () => {
      const p = await newProduct({ name: `=HYPERLINK("http://evil")-${tag}`, variants: [{ label: 'One', stock: 2 }] });
      const u = await student('csv');
      await api('POST', '/merchandise/orders', { token: u.token, body: { productId: p.id, variantId: p.variants[0].id, quantity: 1 } });
      const res = await fetch(`${srv.baseUrl}/api/merchandise/manage/orders.csv?search=${tag}`, { headers: { Authorization: `Bearer ${gdgHead.token}` } });
      eq(res.status, 200, 'status');
      const csv = await res.text();
      check(csv.includes(`'=HYPERLINK`), 'formula prefixed with a quote');
      check(!/(^|,)=HYPERLINK/m.test(csv), 'no raw formula cell');
      const foreign = await fetch(`${srv.baseUrl}/api/merchandise/manage/orders.csv?clubId=${gdg.id}`, { headers: { Authorization: `Bearer ${ieeeHead.token}` } });
      eq(foreign.status, 403, 'foreign club export');
    });
  } finally {
    await prisma.order.deleteMany({ where: { productId: { in: products } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: products } } }).catch(() => {});
    await prisma.profile.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    await srv.close();
    summary();
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
