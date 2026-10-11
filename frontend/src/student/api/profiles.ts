// Ported from spotlight_flutter/lib/core/api_service.dart — profile methods

import apiClient, { formatApiError } from './client';
import { userFromJson, UserModel } from '@/student/types/user';

export async function getProfile(userId: string): Promise<UserModel | null> {
  try {
    const res = await apiClient.get(`/profiles/${userId}`);
    return userFromJson(res.data.profile as Record<string, unknown>);
  } catch {
    return null;
  }
}

export interface ProfileStats {
  /** Active registrations (pending + confirmed) on events that still exist. Not the number of public events. */
  registrationsCount: number;
  confirmedCount: number;
  upcomingRegistrationsCount: number;
  clubsCount: number;
  savedCount: number;
  ordersCount: number;
}

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const empty: ProfileStats = { registrationsCount: 0, confirmedCount: 0, upcomingRegistrationsCount: 0, clubsCount: 0, savedCount: 0, ordersCount: 0 };
  try {
    const res = await apiClient.get(`/profiles/${userId}/stats`);
    const d = res.data;
    return {
      registrationsCount: (d.registrationsCount ?? d.eventsCount ?? 0) as number,
      confirmedCount: (d.confirmedCount ?? 0) as number,
      upcomingRegistrationsCount: (d.upcomingRegistrationsCount ?? 0) as number,
      clubsCount: (d.clubsCount ?? 0) as number,
      savedCount: (d.savedCount ?? 0) as number,
      ordersCount: (d.ordersCount ?? 0) as number,
    };
  } catch {
    return empty;
  }
}

export async function updateProfile(params: {
  clerkUserId: string;
  usn: string;
  branch: string;
  phone: string;
}): Promise<UserModel> {
  try {
    const res = await apiClient.put('/profiles/update', params);
    return userFromJson(res.data.profile as Record<string, unknown>);
  } catch (e) {
    throw new Error(formatApiError(e, 'Failed to update profile.'));
  }
}

export async function editProfile(params: {
  userId: string;
  name?: string;
  usn?: string;
  branch?: string;
  phone?: string;
  year?: string;
  sem?: string;
}): Promise<UserModel> {
  try {
    const res = await apiClient.put('/profiles/edit', {
      userId: params.userId,
      full_name: params.name,
      usn: params.usn,
      branch: params.branch,
      phone: params.phone,
      year: params.year,
      sem: params.sem,
    });
    return userFromJson(res.data.profile as Record<string, unknown>);
  } catch (e) {
    throw new Error(formatApiError(e, 'Failed to update profile.'));
  }
}
