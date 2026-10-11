import { Router, Request, Response } from 'express';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { requireRole, requireClubManager, assertClubAccess, currentUser, isSuperAdmin, resolveClubScope } from '../../middlewares/authorize';
import { badRequest, conflict, forbidden, notFound } from '../../middlewares/errorHandler';
import { sensitiveLimiter } from '../../middlewares/rateLimit';
import { optionalAuth } from '../../middlewares/authenticate';
import { isActiveMember, memberClubIds } from '../memberships/membership.service';
import { deleteImage, uploadBase64Image } from '../../utils/storage';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake, searchAny } from '../../utils/pagination';
import { oneOf, optBool, optInt, optStr, requiredStr, str } from '../../utils/params';
import { toCsv } from '../../utils/csv';
import { audit } from '../../utils/audit';
import {
  PUBLIC_PRODUCT_WHERE,
  orderInclude,
  placeOrder,
  productInclude,
  releaseOrder,
  submitOrderPayment,
  toOrder,
  toProduct,
  verifyOrderPayment,
} from './merchandise.service';

/**
 * Merchandise. Browsing is public. Buying requires a STUDENT login; management
 * is for the owning club's head (their club only) and Super Admin (every club).
 */
const router = Router();

const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'CANCELLED', 'REJECTED'] as const;
const requireStudent = requireRole(Role.STUDENT);

const pricePaise = (v: unknown, field = 'pricePaise'): number => {
  const n = optInt(v, field, { min: 0, max: 10_000_000 });
  if (n === undefined) throw badRequest(`${field} is required.`);
  return n;
};

const discountPercent = (v: unknown): number | undefined => optInt(v, 'memberDiscountPercent', { min: 0, max: 100 });

// ─── Public catalogue ─────────────────────────────────────────────────────────

router.get('/', optionalAuth, async (req: Request, res: Response): Promise<any> => {
  const params = parsePaginationParams(req, { pageSize: 12 });
  const { skip, take } = prismaSkipTake(params);
  const clubId = optStr(req.query.clubId);
  const where: Prisma.ProductWhereInput = {
    AND: [PUBLIC_PRODUCT_WHERE, clubId ? { clubId } : {}, searchAny(params.search, ['name', 'description', 'club.name']) ?? {}],
  };
  const [totalItems, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, include: productInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  const memberOf = req.user ? await memberClubIds(req.user.id, products.map(p => p.clubId)) : new Set<string>();
  return res.status(200).json(buildPaginatedResult(products.map(p => toProduct(p, !!p.clubId && memberOf.has(p.clubId))), totalItems, params));
});

// ─── Student: orders (login required) ─────────────────────────────────────────

router.post('/orders', requireStudent, sensitiveLimiter, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  // Only identifiers and quantity are read from the client — never a price.
  const order = await placeOrder(user, {
    productId: requiredStr(req.body.productId, 'productId', 64),
    variantId: requiredStr(req.body.variantId, 'variantId', 64),
    quantity: Number(req.body.quantity ?? 1),
  });
  return res.status(201).json({ order: toOrder(order, { includePayment: true }) });
});

router.get('/orders/mine', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const status = oneOf(req.query.status, ORDER_STATUSES, 'status');
  const where: Prisma.OrderWhereInput = {
    userId: user.id,
    ...(status ? { status } : {}),
    ...(params.search ? { productName: { contains: params.search, mode: 'insensitive' } } : {}),
  };
  const [totalItems, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: orderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return res.status(200).json(buildPaginatedResult(orders.map(o => toOrder(o, { includePayment: true })), totalItems, params));
});

router.get('/orders/:id', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const order = await prisma.order.findFirst({ where: { id: str(req.params.id), userId: user.id }, include: orderInclude });
  if (!order) throw notFound('Order not found.');
  return res.status(200).json({ order: toOrder(order, { includePayment: true }) });
});

router.put('/orders/:id/payment', requireStudent, sensitiveLimiter, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const transactionId = requiredStr(req.body.transactionId, 'Transaction ID', 64);
  if (!/^[A-Za-z0-9-]{6,64}$/.test(transactionId)) throw badRequest('Transaction ID must be 6–64 letters, digits or dashes.');
  await submitOrderPayment(user.id, str(req.params.id), transactionId);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: str(req.params.id) }, include: orderInclude });
  return res.status(200).json({ order: toOrder(order) });
});

router.post('/orders/:id/cancel', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const id = str(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) throw notFound('Order not found.');
  if (existing.status === 'PAYMENT_SUBMITTED') throw conflict('Payment has been submitted; ask the club to reject the order if you want a refund.');
  await prisma.$transaction(tx => releaseOrder(tx, id, 'CANCELLED'));
  return res.status(200).json({ message: 'Order cancelled.' });
});

// ─── Club Head / Super Admin: catalogue management ────────────────────────────

async function loadManagedProduct(req: Request) {
  const user = currentUser(req);
  const product = await prisma.product.findUnique({ where: { id: str(req.params.id) }, include: { ...productInclude, variants: { orderBy: [{ label: 'asc' }, { id: 'asc' }] } } });
  if (!product) throw notFound('Product not found.');
  assertClubAccess(user, product.clubId);
  return { user, product };
}

router.get('/manage/products', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const clubId = resolveClubScope(user, optStr(req.query.clubId));
  const state = optStr(req.query.state); // published | unpublished | archived
  const where: Prisma.ProductWhereInput = {
    AND: [
      clubId ? { clubId } : {},
      state === 'archived' ? { isArchived: true } : { isArchived: false, ...(state === 'published' ? { isPublished: true } : state === 'unpublished' ? { isPublished: false } : {}) },
      searchAny(params.search, ['name', 'description']) ?? {},
    ],
  };
  const [totalItems, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { ...productInclude, variants: { orderBy: [{ label: 'asc' }, { id: 'asc' }] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take,
    }),
  ]);
  return res.status(200).json(buildPaginatedResult(products.map(p => toProduct(p)), totalItems, params));
});

router.post('/manage/products', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const clubId = isSuperAdmin(user) ? requiredStr(req.body.clubId, 'clubId', 64) : user.clubId!;
  assertClubAccess(user, clubId);
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club || club.isArchived) throw notFound('Club not found.');

  const variants: Array<{ label: string; stock: number; pricePaiseOverride?: number }> = Array.isArray(req.body.variants) ? req.body.variants : [{ label: 'Standard', stock: Number(req.body.stock ?? 0) }];
  if (variants.length === 0 || variants.length > 30) throw badRequest('Provide between 1 and 30 variants.');
  const labels = new Set<string>();
  const cleanVariants = variants.map(v => {
    const label = requiredStr(v.label, 'Variant label', 40);
    if (labels.has(label.toLowerCase())) throw badRequest(`Duplicate variant label "${label}".`);
    labels.add(label.toLowerCase());
    const stock = optInt(v.stock, 'stock', { min: 0, max: 100000 });
    return { label, stock: stock ?? 0, pricePaiseOverride: v.pricePaiseOverride === undefined ? null : pricePaise(v.pricePaiseOverride, 'pricePaiseOverride') };
  });

  const imageUrl = req.body.imageUrl ? await uploadBase64Image(String(req.body.imageUrl), 'merch/products') : null;
  const product = await prisma.product.create({
    data: {
      clubId,
      name: requiredStr(req.body.name, 'Product name', 120),
      description: str(req.body.description).slice(0, 5000),
      pricePaise: pricePaise(req.body.pricePaise),
      memberDiscountPercent: discountPercent(req.body.memberDiscountPercent) ?? 0,
      imageUrl,
      isPublished: optBool(req.body.isPublished) ?? false,
      variants: { create: cleanVariants },
    },
    include: { ...productInclude, variants: { orderBy: [{ label: 'asc' }, { id: 'asc' }] } },
  });
  await audit(user.id, 'CREATE_PRODUCT', 'Product', product.id, { name: product.name, clubId });
  return res.status(201).json({ product: toProduct(product) });
});

router.put('/manage/products/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, product } = await loadManagedProduct(req);
  const data: Prisma.ProductUpdateInput = {};
  if (req.body.name !== undefined) data.name = requiredStr(req.body.name, 'Product name', 120);
  if (req.body.description !== undefined) data.description = str(req.body.description).slice(0, 5000);
  if (req.body.pricePaise !== undefined) data.pricePaise = pricePaise(req.body.pricePaise);
  if (req.body.memberDiscountPercent !== undefined) data.memberDiscountPercent = discountPercent(req.body.memberDiscountPercent) ?? 0;
  if (req.body.imageUrl !== undefined) {
    data.imageUrl = req.body.imageUrl ? await uploadBase64Image(String(req.body.imageUrl), 'merch/products') : null;
    if (product.imageUrl && product.imageUrl !== data.imageUrl) deleteImage(product.imageUrl).catch(() => {});
  }
  const updated = await prisma.product.update({ where: { id: product.id }, data, include: { ...productInclude, variants: { orderBy: [{ label: 'asc' }, { id: 'asc' }] } } });
  await audit(user.id, 'UPDATE_PRODUCT', 'Product', product.id, { fields: Object.keys(data) });
  return res.status(200).json({ product: toProduct(updated) });
});

for (const [path, data, action] of [
  ['publish', { isPublished: true }, 'PUBLISH_PRODUCT'],
  ['unpublish', { isPublished: false }, 'UNPUBLISH_PRODUCT'],
  ['archive', { isArchived: true, isPublished: false }, 'ARCHIVE_PRODUCT'],
  ['restore', { isArchived: false }, 'RESTORE_PRODUCT'],
] as const) {
  router.post(`/manage/products/:id/${path}`, requireClubManager, async (req: Request, res: Response): Promise<any> => {
    const { user, product } = await loadManagedProduct(req);
    if (path === 'publish' && product.isArchived) throw badRequest('Restore the product before publishing it.');
    const updated = await prisma.product.update({ where: { id: product.id }, data, include: { ...productInclude, variants: { orderBy: [{ label: 'asc' }, { id: 'asc' }] } } });
    await audit(user.id, action, 'Product', product.id, { name: product.name });
    return res.status(200).json({ product: toProduct(updated) });
  });
}

router.post('/manage/products/:id/variants', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, product } = await loadManagedProduct(req);
  const label = requiredStr(req.body.label, 'Variant label', 40);
  if (product.variants.some(v => v.label.toLowerCase() === label.toLowerCase())) throw conflict('A variant with this label already exists.');
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      label,
      stock: optInt(req.body.stock, 'stock', { min: 0, max: 100000 }) ?? 0,
      pricePaiseOverride: req.body.pricePaiseOverride === undefined ? null : pricePaise(req.body.pricePaiseOverride, 'pricePaiseOverride'),
    },
  });
  await audit(user.id, 'ADD_VARIANT', 'Product', product.id, { label });
  return res.status(201).json({ variant });
});

router.put('/manage/products/:id/variants/:variantId', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, product } = await loadManagedProduct(req);
  const variant = product.variants.find(v => v.id === str(req.params.variantId));
  if (!variant) throw notFound('Variant not found.');
  const data: Prisma.ProductVariantUpdateInput = {};
  if (req.body.label !== undefined) data.label = requiredStr(req.body.label, 'Variant label', 40);
  if (req.body.stock !== undefined) data.stock = optInt(req.body.stock, 'stock', { min: 0, max: 100000 });
  if (req.body.pricePaiseOverride !== undefined) data.pricePaiseOverride = req.body.pricePaiseOverride === null ? null : pricePaise(req.body.pricePaiseOverride, 'pricePaiseOverride');
  const active = optBool(req.body.isActive);
  if (active !== undefined) data.isActive = active;
  const updated = await prisma.productVariant.update({ where: { id: variant.id }, data });
  await audit(user.id, 'UPDATE_VARIANT', 'Product', product.id, { variantId: variant.id, fields: Object.keys(data) });
  return res.status(200).json({ variant: updated });
});

// ─── Club Head / Super Admin: orders ──────────────────────────────────────────

function orderWhere(req: Request): Prisma.OrderWhereInput {
  const user = currentUser(req);
  const q = (optStr(req.query.search) ?? '').slice(0, 100);
  const status = oneOf(req.query.status, ORDER_STATUSES, 'status');
  const clubId = resolveClubScope(user, optStr(req.query.clubId));
  const from = optStr(req.query.from);
  const to = optStr(req.query.to);
  const created: Prisma.DateTimeFilter = {};
  if (from) created.gte = new Date(from);
  if (to) created.lte = new Date(to);
  if ((from && isNaN(+created.gte!)) || (to && isNaN(+created.lte!))) throw badRequest('from/to must be valid dates.');
  return {
    AND: [
      clubId ? { clubId } : {},
      status ? { status } : {},
      from || to ? { createdAt: created } : {},
      q ? { OR: [{ productName: { contains: q, mode: 'insensitive' } }, { buyerName: { contains: q, mode: 'insensitive' } }, { buyerEmail: { contains: q, mode: 'insensitive' } }, { transactionId: { contains: q, mode: 'insensitive' } }] } : {},
    ],
  };
}

router.get('/manage/orders', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const where = orderWhere(req);
  const [totalItems, orders, totals] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: orderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
    prisma.order.aggregate({ where: { AND: [where, { status: 'PAID' }] }, _sum: { totalPaise: true }, _count: { _all: true } }),
  ]);
  return res.status(200).json({
    ...buildPaginatedResult(orders.map(o => toOrder(o, { includeBuyer: true })), totalItems, params),
    // Gross sales revenue of the filtered paid orders — not profit.
    summary: { paidOrders: totals._count._all, grossSalesPaise: totals._sum.totalPaise ?? 0 },
  });
});

router.get('/manage/orders.csv', requireClubManager, sensitiveLimiter, async (req: Request, res: Response): Promise<any> => {
  const orders = await prisma.order.findMany({ where: orderWhere(req), include: orderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 10000 });
  const csv = toCsv(
    ['Order ID', 'Club', 'Product', 'Variant', 'Qty', 'Unit (INR)', 'Total (INR)', 'Status', 'Buyer', 'Email', 'Transaction ID', 'Created', 'Paid'],
    orders.map(o => [o.id, o.club?.name, o.productName, o.variantLabel, o.quantity, o.unitPricePaise / 100, o.totalPaise / 100, o.status, o.buyerName, o.buyerEmail, o.transactionId, o.createdAt.toISOString(), o.paidAt?.toISOString()])
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="skyline_orders.csv"');
  return res.status(200).send(csv);
});

router.post('/manage/orders/:id/verify', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const { order, duplicate } = await verifyOrderPayment(user, str(req.params.id));
  if (!duplicate) await audit(user.id, 'VERIFY_ORDER_PAYMENT', 'Order', order.id, { totalPaise: order.totalPaise });
  const full = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  return res.status(200).json({ order: toOrder(full, { includeBuyer: true }), alreadyVerified: duplicate });
});

router.post('/manage/orders/:id/reject', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const id = str(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing || (!isSuperAdmin(user) && existing.clubId !== user.clubId)) throw notFound('Order not found.');
  if (existing.status === 'PAID') throw forbidden('A paid order cannot be rejected here; refund handling is outside this workflow.');
  await prisma.$transaction(tx => releaseOrder(tx, id, 'REJECTED'));
  await audit(user.id, 'REJECT_ORDER', 'Order', id, { reason: str(req.body?.reason).slice(0, 300) });
  return res.status(200).json({ message: 'Order rejected and stock released.' });
});

// ─── Public product detail (kept last so it does not shadow /manage and /orders) ─

router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<any> => {
  const product = await prisma.product.findFirst({ where: { AND: [{ id: str(req.params.id) }, PUBLIC_PRODUCT_WHERE] }, include: productInclude });
  if (!product) throw notFound('Product not found.');
  const member = req.user ? await isActiveMember(req.user.id, product.clubId) : false;
  return res.status(200).json({ product: toProduct(product, member) });
});

export default router;
