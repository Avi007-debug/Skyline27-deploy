import apiClient, { formatApiError } from './client';
import type { Paginated } from './pagination';

export type MembershipState = 'NONE' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

export interface ClubOffer {
  id: string;
  name: string;
  logoUrl: string | null;
  membershipFeePaise: number;
  membershipMonths: number;
  free: boolean;
  payment: { upiId: string | null; qrUrl: string | null } | null;
}

export interface MembershipStanding {
  state: MembershipState;
  isMember: boolean;
  endDate: string | null;
  daysLeft: number | null;
  pendingPayment: { id: string; createdAt: string; duesPaidPaise: number } | null;
}

export type MyMembership = MembershipStanding & { club: ClubOffer };

export type AnnouncementCategory = 'MEETING' | 'DEADLINE' | 'GENERAL';

export interface Announcement {
  id: string;
  clubId: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  createdAt: string;
  author: { id: string; fullName: string } | null;
  club?: { id: string; name: string; logoUrl: string | null };
}

export async function fetchClubOffer(clubId: string): Promise<{ club: ClubOffer; membership: MembershipStanding | null }> {
  try {
    const res = await apiClient.get(`/memberships/club/${clubId}`);
    return res.data;
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not load membership details.'));
  }
}

export async function fetchMyMemberships(): Promise<MyMembership[]> {
  try {
    const res = await apiClient.get('/memberships/mine');
    return res.data.memberships as MyMembership[];
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not load your memberships.'));
  }
}

export async function joinClub(clubId: string, transactionId: string): Promise<string> {
  try {
    const res = await apiClient.post(`/memberships/club/${clubId}/join`, { transactionId });
    return res.data.message as string;
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not submit your membership payment.'));
  }
}

export async function cancelPendingMembership(id: string): Promise<void> {
  try {
    await apiClient.delete(`/memberships/${id}`);
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not withdraw the payment.'));
  }
}

export async function fetchClubAnnouncements(clubId: string, page = 1): Promise<Paginated<Announcement>> {
  try {
    const res = await apiClient.get(`/announcements/club/${clubId}`, { params: { page, pageSize: 10 } });
    return res.data;
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not load announcements.'));
  }
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface MyTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  event: { id: string; name: string; eventDate: string; club: { id: string; name: string } | null };
}

export async function fetchMyTasks(): Promise<MyTask[]> {
  try {
    const res = await apiClient.get('/tasks/mine');
    return res.data.tasks as MyTask[];
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not load your tasks.'));
  }
}

export async function updateMyTaskStatus(id: string, status: TaskStatus): Promise<void> {
  try {
    await apiClient.put(`/tasks/${id}/status`, { status });
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not update the task.'));
  }
}
