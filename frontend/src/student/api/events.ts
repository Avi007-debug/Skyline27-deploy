// Ported from spotlight_flutter/lib/core/api_service.dart — events methods
// GET /events

import apiClient, { formatApiError } from './client';
import { eventFromJson, EventModel } from '@/student/types/event';
import type { Paginated } from './pagination';

export interface EventQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** upcoming | live | past | open | closed */
  status?: string;
  /** Solo | Team */
  type?: string;
  clubId?: string;
}

/** Server-side search + pagination across the whole catalogue (never just the loaded page). */
export async function fetchEventsPage(query: EventQuery): Promise<Paginated<EventModel>> {
  const res = await apiClient.get('/events', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 12,
      search: query.search || undefined,
      status: query.status || undefined,
      type: query.type || undefined,
      clubId: query.clubId || undefined,
    },
  });
  return {
    items: (res.data.items as unknown[]).map((e) => eventFromJson(e as Record<string, unknown>)),
    pagination: res.data.pagination,
  };
}

export async function fetchEventById(id: string): Promise<EventModel | null> {
  try {
    const res = await apiClient.get(`/events/${id}`);
    return eventFromJson(res.data.event as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function fetchEvents(): Promise<EventModel[]> {
  try {
    const res = await apiClient.get('/events');
    const data = res.data;
    let eventsJson: unknown[] = [];
    if (Array.isArray(data)) {
      eventsJson = data;
    } else if (data?.events && Array.isArray(data.events)) {
      eventsJson = data.events;
    }
    return eventsJson.map((e) => eventFromJson(e as Record<string, unknown>));
  } catch (e) {
    throw e;
  }
}

export async function fetchPublicStats(): Promise<{
  totalEvents: number;
  clubs: number;
  totalStudents: number;
}> {
  try {
    const res = await apiClient.get('/public/stats');
    return res.data;
  } catch (e) {
    return { totalEvents: 0, clubs: 0, totalStudents: 0 };
  }
}
