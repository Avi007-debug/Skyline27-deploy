// ============================================================================
// SkylineOS Mock Data Service (Demo Mode)
// Provides realistic campus events, registrations, stats, and auth
// Stored in localStorage so demo actions (Approve, Reject, Create Event) persist!
// ============================================================================

export interface MockProfile {
  id: string;
  fullName: string;
  email: string;
  clubId: string;
  hasPassword?: boolean;
}

export interface MockClub {
  id: string;
  name: string;
  email: string;
  logoUrl: string | null;
  upiId: string | null;
  qrUrl: string | null;
  adminIds: string[];
}

export interface MockEvent {
  id: string;
  title: string;
  name?: string;
  description: string;
  date: string;
  eventDate: string;
  eventEndDate: string;
  venue: string;
  capacity: number;
  registrationLimit?: number;
  type: string;
  eventType: string;
  teamSizeLimit: number | null;
  minTeamSize: number | null;
  club: string;
  club_id: string;
  clubId?: string;
  status: 'live' | 'upcoming' | 'previous';
  price: number;
  fee?: number;
  qrUrl: string | null;
  bannerUrl: string | null;
  registrationDeadline: string;
  pendingCount?: number;
}

export interface MockRegistration {
  id: string;
  eventId: string;
  eventTitle: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  checkedInAt: string | null;
  paymentProofUrl: string | null;
  transactionId: string | null;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    usn: string;
    branch: string;
    phone: string;
    year: number;
    sem: number;
  };
  team: {
    id: string;
    name: string;
    passkey: string;
    leaderId: string;
  } | null;
}

const STORAGE_KEYS = {
  EVENTS: 'skyline_mock_events_v1',
  REGISTRATIONS: 'skyline_mock_registrations_v1',
  CLUB: 'skyline_mock_club_v1',
  PROFILE: 'skyline_mock_profile_v1',
};

// Seed Mock Club
export const DEFAULT_MOCK_CLUB: MockClub = {
  id: 'club-skyline-01',
  name: 'Skyline Innovation Hub',
  email: 'organizer@skylineos.com',
  logoUrl: '/logo.png',
  upiId: 'skylineos@upi',
  qrUrl: '/logo.png',
  adminIds: ['user-demo-admin'],
};

// Seed Mock Admin Profile
export const DEFAULT_MOCK_PROFILE: MockProfile = {
  id: 'user-demo-admin',
  fullName: 'Skyline Hub Admin',
  email: 'organizer@skylineos.com',
  clubId: 'club-skyline-01',
  hasPassword: true,
};

// Seed Mock Events
const now = new Date();
const inDays = (d: number, hours = 10, minutes = 0) => {
  const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

export const DEFAULT_MOCK_EVENTS: MockEvent[] = [
  {
    id: 'evt-01-hackskyline',
    title: 'HackSkyline 2026',
    name: 'HackSkyline 2026',
    description: 'A 36-hour flagship national level hackathon bringing together the finest student engineers to build next-generation AI, Web3, and Systems software.',
    date: inDays(3, 9, 0),
    eventDate: inDays(3, 9, 0),
    eventEndDate: inDays(4, 21, 0),
    venue: 'Apex Auditorium & Innovation Hall',
    capacity: 150,
    registrationLimit: 150,
    type: 'Team',
    eventType: 'Team',
    teamSizeLimit: 4,
    minTeamSize: 2,
    club: 'Skyline Innovation Hub',
    club_id: 'club-skyline-01',
    clubId: 'club-skyline-01',
    status: 'upcoming',
    price: 0,
    fee: 0,
    qrUrl: null,
    bannerUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80',
    registrationDeadline: inDays(2, 23, 59),
    pendingCount: 2,
  },
  {
    id: 'evt-02-ai-summit',
    title: 'AI & Quantum Systems Summit',
    name: 'AI & Quantum Systems Summit',
    description: 'Interactive deep-dive keynote and practical labs exploring LLM fine-tuning, autonomous robotics agents, and distributed quantum algorithms.',
    date: inDays(7, 10, 30),
    eventDate: inDays(7, 10, 30),
    eventEndDate: inDays(7, 17, 30),
    venue: 'Computing Seminar Hall 3',
    capacity: 200,
    registrationLimit: 200,
    type: 'Solo',
    eventType: 'Solo',
    teamSizeLimit: null,
    minTeamSize: null,
    club: 'Skyline Innovation Hub',
    club_id: 'club-skyline-01',
    clubId: 'club-skyline-01',
    status: 'upcoming',
    price: 0,
    fee: 0,
    qrUrl: null,
    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    registrationDeadline: inDays(5, 23, 59),
    pendingCount: 1,
  },
  {
    id: 'evt-03-esports-arena',
    title: 'Campus Esports Championship',
    name: 'Campus Esports Championship',
    description: 'High-adrenaline inter-college tournament featuring 5v5 tactical shooter and mobile strategy battle rounds with live stage commentary.',
    date: inDays(12, 11, 0),
    eventDate: inDays(12, 11, 0),
    eventEndDate: inDays(13, 19, 0),
    venue: 'Student Activity Complex',
    capacity: 64,
    registrationLimit: 64,
    type: 'Team',
    eventType: 'Team',
    teamSizeLimit: 5,
    minTeamSize: 5,
    club: 'Skyline Innovation Hub',
    club_id: 'club-skyline-01',
    clubId: 'club-skyline-01',
    status: 'upcoming',
    price: 150,
    fee: 150,
    qrUrl: '/logo.png',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
    registrationDeadline: inDays(10, 23, 59),
    pendingCount: 3,
  },
  {
    id: 'evt-04-robotics-expo',
    title: 'Autonomous Robotics & Drone Expo',
    name: 'Autonomous Robotics & Drone Expo',
    description: 'Live field obstacle navigation, custom drone showcases, and embedded hardware speed races judged by top industry mentors.',
    date: inDays(-2, 10, 0),
    eventDate: inDays(-2, 10, 0),
    eventEndDate: inDays(-2, 18, 0),
    venue: 'Open Tech Grounds',
    capacity: 120,
    registrationLimit: 120,
    type: 'Solo',
    eventType: 'Solo',
    teamSizeLimit: null,
    minTeamSize: null,
    club: 'Skyline Innovation Hub',
    club_id: 'club-skyline-01',
    clubId: 'club-skyline-01',
    status: 'previous',
    price: 50,
    fee: 50,
    qrUrl: '/logo.png',
    bannerUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&auto=format&fit=crop&q=80',
    registrationDeadline: inDays(-4, 23, 59),
    pendingCount: 0,
  },
];

// Seed Mock Registrations
export const DEFAULT_MOCK_REGISTRATIONS: MockRegistration[] = [
  {
    id: 'reg-01',
    eventId: 'evt-01-hackskyline',
    eventTitle: 'HackSkyline 2026',
    status: 'PENDING',
    checkedInAt: null,
    paymentProofUrl: null,
    transactionId: null,
    created_at: inDays(-1, 14, 20),
    user: {
      id: 'usr-101',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@skylineos.edu',
      usn: '1MS23CS012',
      branch: 'Computer Science',
      phone: '+91 9845012345',
      year: 3,
      sem: 5,
    },
    team: {
      id: 'tm-01',
      name: 'Neural Knights',
      passkey: 'KNIGHT',
      leaderId: 'usr-101',
    },
  },
  {
    id: 'reg-02',
    eventId: 'evt-01-hackskyline',
    eventTitle: 'HackSkyline 2026',
    status: 'CONFIRMED',
    checkedInAt: null,
    paymentProofUrl: null,
    transactionId: null,
    created_at: inDays(-2, 16, 45),
    user: {
      id: 'usr-102',
      name: 'Diya Kulkarni',
      email: 'diya.k@skylineos.edu',
      usn: '1MS23IS034',
      branch: 'Information Science',
      phone: '+91 9845123456',
      year: 3,
      sem: 5,
    },
    team: {
      id: 'tm-02',
      name: 'Quantum Pioneers',
      passkey: 'QNTUM',
      leaderId: 'usr-102',
    },
  },
  {
    id: 'reg-03',
    eventId: 'evt-02-ai-summit',
    eventTitle: 'AI & Quantum Systems Summit',
    status: 'CONFIRMED',
    checkedInAt: null,
    paymentProofUrl: null,
    transactionId: null,
    created_at: inDays(-1, 11, 10),
    user: {
      id: 'usr-103',
      name: 'Rohan Varma',
      email: 'rohan.v@skylineos.edu',
      usn: '1MS22AI018',
      branch: 'AI & Machine Learning',
      phone: '+91 9900234567',
      year: 4,
      sem: 7,
    },
    team: null,
  },
  {
    id: 'reg-04',
    eventId: 'evt-02-ai-summit',
    eventTitle: 'AI & Quantum Systems Summit',
    status: 'PENDING',
    checkedInAt: null,
    paymentProofUrl: null,
    transactionId: null,
    created_at: inDays(0, 8, 30),
    user: {
      id: 'usr-104',
      name: 'Ananya Hegde',
      email: 'ananya.h@skylineos.edu',
      usn: '1MS23EC056',
      branch: 'Electronics & Comm.',
      phone: '+91 9741345678',
      year: 2,
      sem: 3,
    },
    team: null,
  },
  {
    id: 'reg-05',
    eventId: 'evt-03-esports-arena',
    eventTitle: 'Campus Esports Championship',
    status: 'PENDING',
    checkedInAt: null,
    paymentProofUrl: 'https://images.unsplash.com/photo-1554415707-9e42fc698b64?w=600&auto=format&fit=crop&q=80',
    transactionId: 'UPI202610100987654',
    created_at: inDays(0, 9, 15),
    user: {
      id: 'usr-105',
      name: 'Vikram Aditya',
      email: 'vikram.a@skylineos.edu',
      usn: '1MS23ME022',
      branch: 'Mechanical Engg',
      phone: '+91 9886456789',
      year: 3,
      sem: 5,
    },
    team: {
      id: 'tm-03',
      name: 'Apex Predators',
      passkey: 'PREDTR',
      leaderId: 'usr-105',
    },
  },
  {
    id: 'reg-06',
    eventId: 'evt-03-esports-arena',
    eventTitle: 'Campus Esports Championship',
    status: 'CONFIRMED',
    checkedInAt: null,
    paymentProofUrl: 'https://images.unsplash.com/photo-1554415707-9e42fc698b64?w=600&auto=format&fit=crop&q=80',
    transactionId: 'UPI202610091234567',
    created_at: inDays(-2, 19, 0),
    user: {
      id: 'usr-106',
      name: 'Kavya Nair',
      email: 'kavya.n@skylineos.edu',
      usn: '1MS24CS089',
      branch: 'Computer Science',
      phone: '+91 9611567890',
      year: 2,
      sem: 3,
    },
    team: {
      id: 'tm-04',
      name: 'Valkyries',
      passkey: 'VALKYR',
      leaderId: 'usr-106',
    },
  },
  {
    id: 'reg-07',
    eventId: 'evt-04-robotics-expo',
    eventTitle: 'Autonomous Robotics & Drone Expo',
    status: 'CONFIRMED',
    checkedInAt: inDays(-2, 10, 45),
    paymentProofUrl: 'https://images.unsplash.com/photo-1554415707-9e42fc698b64?w=600&auto=format&fit=crop&q=80',
    transactionId: 'UPI202610087654321',
    created_at: inDays(-4, 15, 0),
    user: {
      id: 'usr-107',
      name: 'Siddharth Rao',
      email: 'siddharth.r@skylineos.edu',
      usn: '1MS22EC011',
      branch: 'Electronics & Comm.',
      phone: '+91 9980678901',
      year: 4,
      sem: 7,
    },
    team: null,
  },
];

// Helpers to get/set mock data from LocalStorage
export function getMockEvents(): MockEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(DEFAULT_MOCK_EVENTS));
  return DEFAULT_MOCK_EVENTS;
}

export function saveMockEvents(events: MockEvent[]) {
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
}

export function getMockRegistrations(): MockRegistration[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(DEFAULT_MOCK_REGISTRATIONS));
  return DEFAULT_MOCK_REGISTRATIONS;
}

export function saveMockRegistrations(regs: MockRegistration[]) {
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(regs));
}

export function getMockClub(): MockClub {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLUB);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  localStorage.setItem(STORAGE_KEYS.CLUB, JSON.stringify(DEFAULT_MOCK_CLUB));
  return DEFAULT_MOCK_CLUB;
}

export function saveMockClub(club: MockClub) {
  localStorage.setItem(STORAGE_KEYS.CLUB, JSON.stringify(club));
}

export function getMockProfile(): MockProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_MOCK_PROFILE));
  return DEFAULT_MOCK_PROFILE;
}

// Compute mock dashboard stats dynamically from current mock storage
export function computeMockDashboardStats() {
  const events = getMockEvents();
  const regs = getMockRegistrations();

  const totalEvents = events.length;
  const upcomingEventsCount = events.filter(e => e.status !== 'previous').length;
  const totalRegistrations = regs.length;
  const pendingCount = regs.filter(r => r.status === 'PENDING').length;

  const recentActivity = regs.slice(0, 5);

  const mappedClubEvents = events.map(e => {
    const eventPending = regs.filter(r => r.eventId === e.id && r.status === 'PENDING').length;
    return {
      ...e,
      pendingCount: eventPending,
    };
  });

  return {
    totalEvents,
    upcomingEventsCount,
    totalRegistrations,
    pendingCount,
    recentActivity,
    clubEvents: mappedClubEvents,
  };
}
