// Ported from spotlight_flutter/lib/core/api_service.dart — auth methods
// POST /auth/signup, /auth/login, /auth/verify-password, /auth/change-password

import apiClient, { formatApiError } from './client';
import { userFromJson, UserModel } from '@/student/types/user';
import type { Role, SessionProfile } from '@/shared/session';

export interface SignupParams {
  email: string;
  password: string;
  name: string;
  usn?: string;
  branch?: string;
  phone?: string;
  year?: string;
  sem?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthResult {
  user: UserModel;
  token: string;
  userId: string;
  profile: SessionProfile;
  role: Role;
}

export async function signup(params: SignupParams): Promise<AuthResult> {
  try {
    const res = await apiClient.post('/auth/signup', {
      email: params.email,
      password: params.password,
      name: params.name,
      usn: params.usn || undefined,
      branch: params.branch || undefined,
      phone: params.phone || undefined,
      year: params.year || undefined,
      sem: params.sem || undefined,
    });
    const data = res.data;
    const user = userFromJson(data.profile);
    const token = data.token as string;
    return { user, token, userId: user.id, profile: data.profile as SessionProfile, role: 'STUDENT' };
  } catch (e) {
    throw new Error(formatApiError(e, 'Signup failed. Please try again.'));
  }
}

/** Student sign-in. (Club heads sign in at /club/auth and admins at /admin/login.) */
export async function login(params: LoginParams): Promise<AuthResult> {
  try {
    const res = await apiClient.post('/auth/login', {
      email: params.email,
      password: params.password,
    });
    const data = res.data;
    const user = userFromJson(data.profile);
    const token = data.token as string;
    return { user, token, userId: user.id, profile: data.profile as SessionProfile, role: data.profile.role as Role };
  } catch (e) {
    throw new Error(formatApiError(e, 'Sign in failed. Please check your email and password.'));
  }
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  try {
    await apiClient.post('/auth/verify-password', { userId, password });
    return true;
  } catch (e) {
    throw new Error(formatApiError(e, 'Failed to verify password.'));
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  try {
    await apiClient.post('/auth/change-password', { oldPassword, newPassword });
    return true;
  } catch (e) {
    throw new Error(formatApiError(e, 'Failed to update password.'));
  }
}

// ─── Password recovery ───────────────────────────────────────────────────────

/** Always resolves with the same generic message; the server never reveals whether the email exists. */
export async function forgotPassword(email: string): Promise<string> {
  try {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data.message as string;
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not send the reset link. Please try again.'));
  }
}

export async function validateResetToken(token: string, email: string): Promise<boolean> {
  try {
    const res = await apiClient.post('/auth/validate-reset-token', { token, email });
    return res.data.valid === true;
  } catch {
    return false;
  }
}

export async function resetPassword(token: string, email: string, newPassword: string): Promise<void> {
  try {
    await apiClient.post('/auth/reset-password', { token, email, newPassword });
  } catch (e) {
    throw new Error(formatApiError(e, 'Could not reset your password. Please request a new link.'));
  }
}
