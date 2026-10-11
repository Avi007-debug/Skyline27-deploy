import apiClient, { formatApiError } from './client';
import type { Paginated } from './pagination';

export interface ProductVariant {
  id: string;
  label: string;
  pricePaise: number;
  /** Price for active members of the selling club. */
  memberPricePaise?: number;
  /** What this visitor pays (member price when they are a member). */
  yourPricePaise?: number;
  stock: number;
  available: boolean;
  lowStock: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  pricePaise: number;
  memberDiscountPercent?: number;
  isMember?: boolean;
  club: { id: string; name: string; logoUrl: string | null } | null;
  variants: ProductVariant[];
  inStock: boolean;
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'SOLD_OUT';
  purchasable: boolean;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'PAID' | 'CANCELLED' | 'REJECTED';

export interface Order {
  id: string;
  productId: string | null;
  productName: string;
  variantLabel: string;
  imageUrl: string | null;
  quantity: number;
  unitPricePaise: number;
  isMemberPrice?: boolean;
  totalPaise: number;
  status: OrderStatus;
  transactionId: string | null;
  createdAt: string;
  club: { id: string; name: string } | null;
  payment?: { upiId: string | null; qrUrl: string | null };
}

export const formatPaise = (paise: number): string =>
  paise % 100 === 0 ? `₹${paise / 100}` : `₹${(paise / 100).toFixed(2)}`;

export async function fetchProducts(params: { page?: number; pageSize?: number; search?: string; clubId?: string }): Promise<Paginated<Product>> {
  const res = await apiClient.get('/merchandise', {
    params: { page: params.page ?? 1, pageSize: params.pageSize ?? 12, search: params.search || undefined, clubId: params.clubId || undefined },
  });
  return res.data as Paginated<Product>;
}

export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const res = await apiClient.get(`/merchandise/${id}`);
    return res.data.product as Product;
  } catch {
    return null;
  }
}

/** Only identifiers and quantity are sent; the server decides the price. */
export async function placeOrder(input: { productId: string; variantId: string; quantity: number }): Promise<Order> {
  try {
    const res = await apiClient.post('/merchandise/orders', input);
    return res.data.order as Order;
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not place your order. Please try again.'));
  }
}

export async function fetchMyOrders(params: { page?: number; pageSize?: number; status?: string }): Promise<Paginated<Order>> {
  const res = await apiClient.get('/merchandise/orders/mine', {
    params: { page: params.page ?? 1, pageSize: params.pageSize ?? 10, status: params.status || undefined },
  });
  return res.data as Paginated<Order>;
}

export async function fetchOrder(id: string): Promise<Order | null> {
  try {
    const res = await apiClient.get(`/merchandise/orders/${id}`);
    return res.data.order as Order;
  } catch {
    return null;
  }
}

export async function submitOrderPayment(orderId: string, transactionId: string): Promise<Order> {
  try {
    const res = await apiClient.put(`/merchandise/orders/${orderId}/payment`, { transactionId });
    return res.data.order as Order;
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not record your payment reference.'));
  }
}

export async function cancelOrder(orderId: string): Promise<void> {
  try {
    await apiClient.post(`/merchandise/orders/${orderId}/cancel`);
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not cancel this order.'));
  }
}
