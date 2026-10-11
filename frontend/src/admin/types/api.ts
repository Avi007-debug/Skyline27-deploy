export type Role = 'STUDENT' | 'CLUB_HEAD' | 'SUPER_ADMIN';

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  clubId: string | null;
  isActive?: boolean;
}

export interface UserRow extends Profile {
  usn: string | null;
  branch: string | null;
  phone: string | null;
  year: number | null;
  sem: number | null;
  createdAt: string;
  club: { id: string; name: string; logoUrl: string | null } | null;
}

export interface ClubHead {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface ClubRow {
  id: string;
  name: string;
  email: string;
  logoUrl: string | null;
  upiId: string | null;
  qrUrl: string | null;
  isArchived: boolean;
  admins: ClubHead[];
  _count: { events: number; products: number };
}

export interface EventRow {
  id: string;
  clubId: string;
  name: string;
  title: string;
  description: string;
  venue: string;
  bannerUrl: string | null;
  eventType: string;
  fee: number;
  eventDate: string;
  eventEndDate: string | null;
  registrationOpensAt: string | null;
  registrationDeadline: string | null;
  registrationLimit: number;
  teamSizeLimit: number | null;
  minTeamSize: number | null;
  upiId: string | null;
  registrationCount: number;
  spotsLeft: number | null;
  registrationState: 'OPEN' | 'UPCOMING' | 'CLOSED' | 'SOLD_OUT' | 'ENDED' | 'UNPUBLISHED';
  isPublished: boolean;
  isArchived: boolean;
  registrationClosedManually: boolean;
  club: { id: string; name: string; logoUrl: string | null } | null;
  registrationStats?: { PENDING: number; CONFIRMED: number; REJECTED: number };
}

export interface RegistrationRow {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  createdAt: string;
  transactionId: string | null;
  checkedInAt: string | null;
  paymentStatus: 'FREE' | 'UNPAID' | 'SUBMITTED' | 'VERIFIED';
  profile: { id: string; fullName: string; email: string; usn: string | null; phone: string | null } | null;
  event: { id: string; name: string; fee: number; eventDate: string; club: { id: string; name: string } };
  team: { id: string; teamName: string } | null;
}

export interface KeyRow {
  id: string;
  code: string;
  isUsed: boolean;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED';
  createdAt: string;
  usedAt: string | null;
  expiresAt: string | null;
  usedByClub: { id: string; name: string; email: string } | null;
}

export interface ProductVariant {
  id: string;
  label: string;
  pricePaise: number;
  stock: number;
  available: boolean;
}

export interface ProductRow {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  pricePaise: number;
  clubId: string | null;
  club: { id: string; name: string } | null;
  isPublished: boolean;
  isArchived: boolean;
  variants: ProductVariant[];
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'SOLD_OUT';
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'PAID' | 'CANCELLED' | 'REJECTED';

export interface OrderRow {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  status: OrderStatus;
  transactionId: string | null;
  buyerName: string;
  buyerEmail: string;
  createdAt: string;
  paidAt: string | null;
  club: { id: string; name: string } | null;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
}

export interface PlatformStats {
  users: { total: number; students: number; clubHeads: number; superAdmins: number; inactive: number };
  clubs: { total: number; active: number; archived: number };
  events: { total: number; published: number; unpublished: number; archived: number; upcoming: number };
  registrations: { active: number; confirmed: number; pending: number; rejected: number };
  keys: { total: number; available: number };
  merchandise: { products: number; paidSalesPaise: number; orders: Record<string, { count: number; totalPaise: number }> };
  ticketSalesPaise: number;
}
