import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { Principal } from '../../middlewares/authenticate';
import { HttpError, badRequest, conflict, notFound } from '../../middlewares/errorHandler';
import { postLedger } from '../finance/ledger.service';
import { isActiveMember, productUnitPaise } from '../memberships/membership.service';

export const MAX_ORDER_QUANTITY = 10;
export const LOW_STOCK_THRESHOLD = 5;

/** Products anyone may see. */
export const PUBLIC_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  isPublished: true,
  isArchived: false,
  OR: [{ clubId: null }, { club: { isArchived: false } }],
};

const productInclude = {
  club: { select: { id: true, name: true, logoUrl: true } },
  variants: { where: { isActive: true }, orderBy: [{ label: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ProductInclude;
export { productInclude };

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Public/management product shape. Prices are integer paise; the server is the only price authority. */
export function toProduct(p: ProductRow, member = false) {
  const variants = p.variants.map(v => {
    const pricePaise = v.pricePaiseOverride ?? p.pricePaise;
    return {
      id: v.id,
      label: v.label,
      pricePaise,
      memberPricePaise: productUnitPaise(pricePaise, p.memberDiscountPercent, true),
      yourPricePaise: productUnitPaise(pricePaise, p.memberDiscountPercent, member),
      stock: v.stock,
      available: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= LOW_STOCK_THRESHOLD,
    };
  });
  const totalStock = variants.reduce((n, v) => n + v.stock, 0);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    pricePaise: p.pricePaise,
    memberDiscountPercent: p.memberDiscountPercent,
    isMember: member,
    isPublished: p.isPublished,
    isArchived: p.isArchived,
    club: p.club,
    clubId: p.clubId,
    variants,
    inStock: totalStock > 0,
    availability: totalStock === 0 ? 'SOLD_OUT' : totalStock <= LOW_STOCK_THRESHOLD ? 'LOW_STOCK' : 'IN_STOCK',
    purchasable: p.isPublished && !p.isArchived && totalStock > 0,
  };
}

const orderInclude = {
  club: { select: { id: true, name: true, upiId: true, qrUrl: true } },
  product: { select: { id: true, imageUrl: true } },
} satisfies Prisma.OrderInclude;
export { orderInclude };

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrder(o: OrderRow, { includePayment = false, includeBuyer = false } = {}) {
  const awaitingPayment = o.status === 'PENDING_PAYMENT';
  return {
    id: o.id,
    productId: o.productId,
    productName: o.productName,
    variantLabel: o.variantLabel,
    imageUrl: o.product?.imageUrl ?? null,
    quantity: o.quantity,
    unitPricePaise: o.unitPricePaise,
    isMemberPrice: o.isMemberPrice,
    totalPaise: o.totalPaise,
    status: o.status,
    transactionId: o.transactionId,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
    club: o.club ? { id: o.club.id, name: o.club.name } : null,
    ...(includePayment && awaitingPayment && o.club ? { payment: { upiId: o.club.upiId, qrUrl: o.club.qrUrl } } : {}),
    ...(includeBuyer ? { buyerName: o.buyerName, buyerEmail: o.buyerEmail, userId: o.userId } : {}),
  };
}

/**
 * Create an order. Price, name and variant label are read from the database and
 * snapshotted on the order; nothing price-related is accepted from the client.
 * Stock is reserved atomically (conditional decrement), so concurrent buyers can
 * never oversell; it is released again if the order is cancelled or rejected.
 */
export async function placeOrder(user: Principal, input: { productId: string; variantId: string; quantity: number }) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_ORDER_QUANTITY) {
    throw badRequest(`Quantity must be a whole number between 1 and ${MAX_ORDER_QUANTITY}.`);
  }
  return prisma.$transaction(async tx => {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      include: { product: { include: { club: { select: { id: true, isArchived: true } } } } },
    });
    const product = variant?.product;
    if (!variant || !product || variant.productId !== input.productId) throw badRequest('That size/variant does not belong to this product.');
    if (!variant.isActive || !product.isPublished || product.isArchived || product.club?.isArchived) {
      throw badRequest('This product is not available for purchase.');
    }
    if (!product.clubId) throw badRequest('This product has no seller assigned.');

    const reserved = await tx.productVariant.updateMany({
      where: { id: variant.id, stock: { gte: input.quantity } },
      data: { stock: { decrement: input.quantity } },
    });
    if (reserved.count === 0) throw conflict('Not enough stock available for that quantity.');

    // Active members of the selling club get the member discount; the server decides, never the client.
    const member = await isActiveMember(user.id, product.clubId, tx);
    const basePaise = variant.pricePaiseOverride ?? product.pricePaise;
    const unitPricePaise = productUnitPaise(basePaise, product.memberDiscountPercent, member);
    const totalPaise = unitPricePaise * input.quantity;
    const free = totalPaise === 0;

    return tx.order.create({
      data: {
        userId: user.id,
        clubId: product.clubId,
        productId: product.id,
        variantId: variant.id,
        buyerName: user.fullName,
        buyerEmail: user.email,
        productName: product.name,
        variantLabel: variant.label,
        unitPricePaise,
        isMemberPrice: member && unitPricePaise < basePaise,
        quantity: input.quantity,
        totalPaise,
        status: free ? 'PAID' : 'PENDING_PAYMENT',
        paidAt: free ? new Date() : null,
      },
      include: orderInclude,
    });
  });
}

/** Release an unpaid order's reserved stock. Conditional on status, so it is safe to call twice. */
export async function releaseOrder(tx: Prisma.TransactionClient, orderId: string, to: 'CANCELLED' | 'REJECTED') {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Order not found.');
  const changed = await tx.order.updateMany({
    where: { id: orderId, status: { in: ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'] } },
    data: { status: to },
  });
  if (changed.count === 0) throw conflict(`This order is already ${order.status.toLowerCase().replace('_', ' ')}.`);
  if (order.variantId) {
    await tx.productVariant.updateMany({ where: { id: order.variantId }, data: { stock: { increment: order.quantity } } });
  }
  return order;
}

/** Record a payment reference. Idempotent for the same order + reference; references are unique across orders. */
export async function submitOrderPayment(userId: string, orderId: string, transactionId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw notFound('Order not found.');
  if (order.status === 'PAYMENT_SUBMITTED' && order.transactionId === transactionId) return order;
  if (order.status !== 'PENDING_PAYMENT') throw badRequest(`This order is ${order.status.toLowerCase().replace('_', ' ')}; payment cannot be submitted.`);

  const reused = await prisma.order.findFirst({ where: { transactionId, id: { not: orderId } }, select: { id: true } });
  if (reused) throw conflict('This transaction ID has already been used for another order.');

  try {
    const changed = await prisma.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { transactionId, status: 'PAYMENT_SUBMITTED' },
    });
    if (changed.count === 0) throw conflict('This order was just updated. Refresh and try again.');
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict('This transaction ID has already been used for another order.');
    throw err;
  }
  return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
}

/**
 * Seller confirms the money arrived. Status flip and ledger write share one
 * transaction; the ledger key (refType, refId, type) plus the conditional status
 * update make duplicate confirmations a no-op instead of a second financial record.
 */
export async function verifyOrderPayment(actor: Principal, orderId: string) {
  return prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw notFound('Order not found.');
    if (actor.role !== Role.SUPER_ADMIN && order.clubId !== actor.clubId) throw notFound('Order not found.');
    if (order.status === 'PAID') return { order, duplicate: true };

    const changed = await tx.order.updateMany({
      where: { id: orderId, status: 'PAYMENT_SUBMITTED' },
      data: { status: 'PAID', paidAt: new Date(), verifiedById: actor.id },
    });
    if (changed.count === 0) {
      // Lost a race with another verification of the same order: report it as already verified.
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (current?.status === 'PAID') return { order: current, duplicate: true };
      throw new HttpError(409, `Only orders with a submitted payment can be verified (this one is ${(current?.status ?? order.status).toLowerCase().replace('_', ' ')}).`);
    }

    await postLedger(
      {
        clubId: order.clubId ?? undefined,
        type: 'IN',
        category: 'MERCH',
        amountPaise: order.totalPaise,
        refType: 'order',
        refId: order.id,
        memo: `Merch: ${order.productName} (${order.variantLabel}) x${order.quantity}`,
        actorId: actor.id,
      },
      tx
    );
    return { order: await tx.order.findUniqueOrThrow({ where: { id: orderId } }), duplicate: false };
  });
}
