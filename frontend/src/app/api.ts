import {
  getMockEvents,
  saveMockEvents,
  getMockRegistrations,
  saveMockRegistrations,
  getMockClub,
  saveMockClub,
  getMockProfile,
  computeMockDashboardStats,
  MockEvent,
} from './mockData';

// =========================================================================
// MOCK DATA LAYER (DEMO MODE)
// -------------------------------------------------------------------------
// When USE_MOCK_DATA is true, all frontend endpoints serve realistic mock data.
// Set USE_MOCK_DATA = false or VITE_USE_MOCK=false to connect to live backend.
// NONE of the original backend endpoints, types, or fetch logic were deleted!
// =========================================================================
export const USE_MOCK_DATA: boolean = (import.meta as any).env?.VITE_USE_MOCK !== 'false';

export function sanitizeErrorMessage(err: any, fallback: string = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  let msg = typeof err === 'string' ? err : (err.message || err.error || "");
  if (err.errors && err.errors.length > 0) {
    msg = err.errors[0].longMessage || err.errors[0].message || msg;
  }

  if (!msg || typeof msg !== 'string') return fallback;

  const lower = msg.toLowerCase();

  if (
    lower.includes("network error") ||
    lower.includes("failed to fetch") ||
    lower.includes("load failed") ||
    lower.includes("econnrefused") ||
    lower.includes("socket") ||
    lower.includes("offline") ||
    lower.includes("networkerror")
  ) {
    return "Connection error. Please check your internet connection and try again.";
  }

  if (
    lower.includes("no account exists") ||
    lower.includes("no club exists") ||
    lower.includes("incorrect password") ||
    lower.includes("social sign-in")
  ) {
    return msg;
  }

  if (lower.includes("form_identifier_not_found") || lower.includes("user_not_found") || lower.includes("invalid_credentials") || lower.includes("invalid password") || lower.includes("wrong password") || lower.includes("invalid email or password")) {
    return "Invalid email address or password. Please try again.";
  }
  if (
    lower.includes("form_identifier_exists") ||
    lower.includes("already_exists") ||
    lower.includes("email already in use") ||
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("club already exists") ||
    lower.includes("is taken") ||
    lower.includes("already taken") ||
    lower.includes("address is taken")
  ) {
    return "An account or club with this email address already exists.";
  }
  if (lower.includes("password_too_short") || lower.includes("password is too short")) {
    return "Password is too short. Please choose a stronger password.";
  }
  if (lower.includes("session_expired") || lower.includes("token_expired") || lower.includes("unauthorized") || lower.includes("401") || lower.includes("403")) {
    return "Your session has expired. Please sign in again.";
  }

  if (
    lower.includes("prisma") ||
    lower.includes("p2002") ||
    lower.includes("p2003") ||
    lower.includes("p2025") ||
    lower.includes("constraint") ||
    lower.includes("syntaxerror") ||
    lower.includes("typeerror") ||
    lower.includes("referenceerror") ||
    lower.includes("postgres") ||
    lower.includes("sqlite") ||
    lower.includes("database") ||
    lower.includes("internal server error") ||
    lower.includes("500") ||
    lower.includes("   at ") ||
    lower.includes("eval") ||
    lower.includes("[object object]")
  ) {
    return "An unexpected server error occurred. Please try again later.";
  }

  const cleanMsg = msg.replace(/^Error:\s*/i, '').replace(/^Exception:\s*/i, '').trim();
  return cleanMsg || fallback;
}

let rawBase = String((import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api')
  .replace(/\s+/g, '')
  .trim()
  .replace(/\/+$/, '');
if (!rawBase.endsWith('/api')) {
  rawBase += '/api';
}
const BASE_URL = rawBase;

function sanitizeImageUrls(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeImageUrls);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    let val = obj[key];
    if (typeof val === 'string' && val.includes('spotlight.msritise.in/uploads/')) {
      val = val.replace(/^https?:\/\/spotlight\.msritise\.in\/uploads\//, 'https://msritise.in/spotlight.msritise.in/uploads/');
    } else if (typeof val === 'object' && val !== null) {
      val = sanitizeImageUrls(val);
    }
    result[key] = val;
  }
  return result;
}

async function request(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, { cache: 'no-store', ...options, headers });
    let data: any = {};
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    if (!res.ok) {
      const rawError = data.error || data.message || `Request failed (${res.status})`;
      throw new Error(sanitizeErrorMessage(rawError));
    }
    return sanitizeImageUrls(data);
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err));
  }
}

export async function fetchPublicStats() {
  if (USE_MOCK_DATA) {
    const events = getMockEvents();
    const regs = getMockRegistrations();
    return {
      liveEvents: events.filter(e => e.status !== 'previous').length,
      registrations: regs.length,
      clubs: 14,
      totalEvents: events.length,
      totalStudents: 1420,
    };
  }
  return request('/public/stats');
}

export async function clubLogin(email: string, password: string) {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 350));
    const club = getMockClub();
    const cleanEmail = email.trim().toLowerCase();
    const prefix = cleanEmail.split('@')[0] || 'Admin';
    const profile = {
      id: 'user-demo-admin',
      fullName: prefix.charAt(0).toUpperCase() + prefix.slice(1) + ' Admin',
      email: cleanEmail,
      clubId: club.id,
      hasPassword: true,
    };
    const token = 'skyline_mock_jwt_token_' + Date.now();
    return {
      message: 'Logged in successfully',
      profile,
      token,
    };
  }
  return request('/auth/club-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function syncProfile(
  clerkUserId: string,
  email: string,
  name: string,
  token?: string
) {
  if (USE_MOCK_DATA) {
    const profile = getMockProfile();
    return {
      message: 'Profile synced',
      profile: {
        ...profile,
        email: email || profile.email,
        fullName: name || profile.fullName,
      },
    };
  }
  return request('/auth/sync', {
    method: 'POST',
    body: JSON.stringify({ clerkUserId, email, name }),
  }, token);
}

export async function getProfile(userId: string) {
  if (USE_MOCK_DATA) {
    return { profile: getMockProfile() };
  }
  return request(`/profiles/${userId}`);
}

export async function changePassword(data: {
  oldPassword?: string;
  newPassword?: string;
}, token?: string) {
  if (USE_MOCK_DATA) {
    return { message: 'Password updated successfully.' };
  }
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
}

export async function fetchEvents() {
  if (USE_MOCK_DATA) {
    const events = getMockEvents();
    const regs = getMockRegistrations();
    return {
      events: events.map(e => ({
        ...e,
        registrationCount: regs.filter(r => r.eventId === e.id).length,
      })),
    };
  }
  return request('/events');
}

export async function createEvent(data: {
  name: string;
  description?: string;
  venue?: string;
  eventDate?: string;
  eventEndDate?: string;
  registrationDeadline?: string;
  fee?: number;
  registrationLimit?: number;
  eventType?: string;
  teamSizeLimit?: number;
  minTeamSize?: number;
  clubId?: string;
  bannerUrl?: string;
  qrUrl?: string;
  upiId?: string;
}, token?: string) {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 350));
    const events = getMockEvents();
    const newEvt: MockEvent = {
      id: 'evt-' + Date.now(),
      title: data.name,
      name: data.name,
      description: data.description || '',
      date: data.eventDate || new Date().toISOString(),
      eventDate: data.eventDate || new Date().toISOString(),
      eventEndDate: data.eventEndDate || new Date(Date.now() + 86400000).toISOString(),
      venue: data.venue || 'TBD',
      capacity: data.registrationLimit ? Number(data.registrationLimit) : 100,
      registrationLimit: data.registrationLimit ? Number(data.registrationLimit) : 100,
      type: data.eventType || 'Solo',
      eventType: data.eventType || 'Solo',
      teamSizeLimit: data.teamSizeLimit ? Number(data.teamSizeLimit) : null,
      minTeamSize: data.minTeamSize ? Number(data.minTeamSize) : null,
      club: 'Skyline Innovation Hub',
      club_id: data.clubId || 'club-skyline-01',
      clubId: data.clubId || 'club-skyline-01',
      status: 'upcoming',
      price: data.fee ? Number(data.fee) : 0,
      fee: data.fee ? Number(data.fee) : 0,
      qrUrl: data.qrUrl || null,
      bannerUrl: data.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
      registrationDeadline: data.registrationDeadline || new Date().toISOString(),
      pendingCount: 0,
    };
    saveMockEvents([newEvt, ...events]);
    return { event: newEvt };
  }
  return request('/events/create', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
}

export async function updateEventDeadline(eventId: string, deadline: string, token?: string) {
  if (USE_MOCK_DATA) {
    const events = getMockEvents();
    const updated = events.map(e => e.id === eventId ? { ...e, registrationDeadline: deadline } : e);
    saveMockEvents(updated);
    return { event: updated.find(e => e.id === eventId) };
  }
  return request(`/events/${eventId}/deadline`, {
    method: 'PUT',
    body: JSON.stringify({ registrationDeadline: deadline }),
  }, token);
}

export async function updateEvent(eventId: string, data: {
  eventDate?: string;
  eventEndDate?: string;
  registrationDeadline?: string;
  venue?: string;
  registrationLimit?: number;
  teamSizeLimit?: number;
  minTeamSize?: number;
  bannerUrl?: string;
  password?: string;
}, token?: string) {
  if (USE_MOCK_DATA) {
    const events = getMockEvents();
    const updated = events.map(e => {
      if (e.id === eventId) {
        return {
          ...e,
          venue: data.venue !== undefined ? data.venue : e.venue,
          registrationLimit: data.registrationLimit !== undefined ? Number(data.registrationLimit) : e.registrationLimit,
          capacity: data.registrationLimit !== undefined ? Number(data.registrationLimit) : e.capacity,
          teamSizeLimit: data.teamSizeLimit !== undefined ? Number(data.teamSizeLimit) : e.teamSizeLimit,
          minTeamSize: data.minTeamSize !== undefined ? Number(data.minTeamSize) : e.minTeamSize,
          bannerUrl: data.bannerUrl !== undefined ? data.bannerUrl : e.bannerUrl,
          eventDate: data.eventDate || e.eventDate,
          eventEndDate: data.eventEndDate || e.eventEndDate,
          registrationDeadline: data.registrationDeadline || e.registrationDeadline,
        };
      }
      return e;
    });
    saveMockEvents(updated);
    return { event: updated.find(e => e.id === eventId) };
  }
  return request(`/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
}

export async function fetchClubs() {
  if (USE_MOCK_DATA) {
    return { clubs: [getMockClub()] };
  }
  return request('/clubs');
}

export async function verifyRegistrationKey(key: string) {
  if (USE_MOCK_DATA) {
    return { valid: true, message: 'Authorization key verified successfully.' };
  }
  return request('/clubs/verify-key', {
    method: 'POST',
    body: JSON.stringify({ key }),
  });
}

export async function checkClubEmail(email: string) {
  if (USE_MOCK_DATA) {
    return { exists: false, message: 'Email is available.' };
  }
  return request('/clubs/check-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function googleAuth(authPayload: { credential?: string; access_token?: string; registrationKey?: string; clubName?: string }) {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 400));
    const club = getMockClub();
    const profile = {
      id: 'user-google-demo',
      fullName: authPayload.clubName || 'Skyline Organizer',
      email: 'organizer@skylineos.com',
      clubId: club.id,
      hasPassword: true,
    };
    return {
      message: 'Google login successful',
      profile,
      club,
      token: 'skyline_mock_google_jwt_' + Date.now(),
    };
  }
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify(authPayload),
  });
}

export async function createClub(data: {
  name: string;
  email: string;
  logoUrl?: string;
  clerkUserId: string;
  password?: string;
  registrationKey: string;
}, token?: string) {
  if (USE_MOCK_DATA) {
    const club = {
      id: 'club-' + Date.now(),
      name: data.name,
      email: data.email,
      logoUrl: data.logoUrl || '/logo.png',
      upiId: 'skyline@upi',
      qrUrl: null,
      adminIds: ['user-demo-admin'],
    };
    saveMockClub(club);
    return { club };
  }
  return request('/clubs', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
}

export async function updateClub(clubId: string, data: {
  name?: string;
  email?: string;
  logoUrl?: string;
  upiId?: string;
  qrUrl?: string;
  password?: string;
}, token?: string) {
  if (USE_MOCK_DATA) {
    const club = getMockClub();
    const updated = {
      ...club,
      name: data.name ?? club.name,
      email: data.email ?? club.email,
      logoUrl: data.logoUrl !== undefined ? data.logoUrl : club.logoUrl,
      upiId: data.upiId !== undefined ? data.upiId : club.upiId,
      qrUrl: data.qrUrl !== undefined ? data.qrUrl : club.qrUrl,
    };
    saveMockClub(updated);
    return { club: updated };
  }
  return request(`/clubs/${clubId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
}

export async function fetchEventRegistrations(eventId: string, token?: string) {
  if (USE_MOCK_DATA) {
    const allRegs = getMockRegistrations();
    const eventRegs = allRegs.filter(r => r.eventId === eventId);
    return { registrations: eventRegs };
  }
  return request(`/events/${eventId}/registrations`, {}, token);
} 

export async function approveRegistration(registrationId: string, token?: string) {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 250));
    const allRegs = getMockRegistrations();
    const updated = allRegs.map(r => r.id === registrationId ? { ...r, status: 'CONFIRMED' as const } : r);
    saveMockRegistrations(updated);
    return { message: 'Registration approved and notification sent.' };
  }
  return request(`/registrations/${registrationId}/approve`, {
    method: 'PUT',
  }, token);
}

export async function rejectRegistration(registrationId: string, token?: string) {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 250));
    const allRegs = getMockRegistrations();
    const updated = allRegs.map(r => r.id === registrationId ? { ...r, status: 'REJECTED' as const } : r);
    saveMockRegistrations(updated);
    return { message: 'Registration rejected successfully.' };
  }
  return request(`/registrations/${registrationId}/reject`, {
    method: 'DELETE',
  }, token);
}

export async function fetchAllRegistrationsForEvents(
  events: { id: string; title: string }[],
  token?: string
): Promise<any[]> {
  if (USE_MOCK_DATA) {
    const allRegs = getMockRegistrations();
    return allRegs;
  }
  if (events.length === 0) return [];
  const results = await Promise.allSettled(
    events.map(ev =>
      fetchEventRegistrations(ev.id, token).then(d =>
        (d.registrations ?? []).map((r: any) => ({ ...r, eventTitle: ev.title, eventId: ev.id }))
      )
    )
  );
  return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
}

export async function fetchClubDashboardStats(clubId: string, token?: string) {
  if (USE_MOCK_DATA) {
    return computeMockDashboardStats();
  }
  return request(`/clubs/${clubId}/dashboard-stats`, {}, token);
}

export async function verifyTicketQR(ticketId: string, eventId: string, token?: string) {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 350));
    const allRegs = getMockRegistrations();
    let reg = allRegs.find(r => r.id === ticketId || (r.team && r.team.passkey === ticketId.trim().toUpperCase()));
    if (!reg) {
      reg = allRegs[0];
    }
    const nowStr = new Date().toISOString();
    const updated = allRegs.map(r => r.id === reg!.id ? { ...r, checkedInAt: nowStr } : r);
    saveMockRegistrations(updated);

    return {
      valid: true,
      alreadyCheckedIn: false,
      ticket: {
        id: reg.id,
        status: 'CONFIRMED',
        createdAt: reg.created_at,
        event: {
          id: reg.eventId,
          title: reg.eventTitle,
          date: reg.created_at,
          venue: 'Apex Auditorium & Innovation Hall',
          eventType: reg.team ? 'Team' : 'Solo',
        },
        attendee: reg.user,
        team: reg.team,
      },
    };
  }
  return request(`/registrations/verify-ticket`, {
    method: 'POST',
    body: JSON.stringify({ ticketId, eventId }),
  }, token);
}
