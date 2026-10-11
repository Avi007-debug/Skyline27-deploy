import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireRole } from '@/shared/guards';
import { getProfile } from '@/student/api/profiles';
import AppShell from '@/student/components/layout/AppShell';
import AboutPage from '@/student/pages/AboutPage';
import AllEventsPage from '@/student/pages/AllEventsPage';
import ClubEventsPage from '@/student/pages/ClubEventsPage';
import ClubsPage from '@/student/pages/ClubsPage';
import EventDetailPage from '@/student/pages/EventDetailPage';
import HomePage from '@/student/pages/HomePage';
import MerchandiseDetailPage from '@/student/pages/MerchandiseDetailPage';
import MerchandisePage from '@/student/pages/MerchandisePage';
import NotificationsPage from '@/student/pages/NotificationsPage';
import OrderDetailPage from '@/student/pages/OrderDetailPage';
import OrdersPage from '@/student/pages/OrdersPage';
import PaymentPage from '@/student/pages/PaymentPage';
import ProfilePage from '@/student/pages/ProfilePage';
import RegisterPage from '@/student/pages/RegisterPage';
import TicketDetailPage from '@/student/pages/TicketDetailPage';
import TicketsPage from '@/student/pages/TicketsPage';
import VolunteerTasksPage from '@/student/pages/VolunteerTasksPage';
import { useAuthStore } from '@/student/store/authStore';
import { useClubsStore } from '@/student/store/clubsStore';
import { useEventsStore } from '@/student/store/eventsStore';
import { useNotificationsStore } from '@/student/store/notificationsStore';
import { useUserStore } from '@/student/store/userStore';

/** Scopes the student/public design tokens (see student.css) so they never leak into other areas. */
export function StudentScope({ children }: { children: ReactNode }) {
  return <div className="stu-root">{children}</div>;
}

/** Loads the public catalogue for everyone, and account data once someone is signed in. */
function StudentData() {
  const { isAuthenticated, userId } = useAuthStore();
  const { setCurrentUser, loadFromCache } = useUserStore();
  const { loadEvents } = useEventsStore();
  const { load: loadClubs } = useClubsStore();
  const { load: loadNotifications } = useNotificationsStore();

  useEffect(() => {
    loadEvents();
    loadClubs();
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      loadFromCache();
      getProfile(userId).then((user) => {
        if (user) setCurrentUser(user);
      });
      loadNotifications();
    }
  }, [isAuthenticated, userId]);

  return null;
}

const student = (el: ReactNode) => <RequireRole roles={['STUDENT']}>{el}</RequireRole>;

/**
 * Public browsing is open to everyone. Registering, tickets and orders need a
 * student account; profile and notifications need any signed-in account.
 */
export default function StudentLayout() {
  return (
    <StudentScope>
      <StudentData />
      <AppShell>
        <Routes>
          {/* Public */}
          <Route path="home" element={<HomePage />} />
          <Route path="events" element={<AllEventsPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="clubs" element={<ClubsPage />} />
          <Route path="clubs/:id" element={<ClubEventsPage />} />
          <Route path="merch" element={<MerchandisePage />} />
          <Route path="merch/:id" element={<MerchandiseDetailPage />} />
          <Route path="about" element={<AboutPage />} />

          {/* Student accounts */}
          <Route path="events/:id/register" element={student(<RegisterPage />)} />
          <Route path="events/:id/payment" element={student(<PaymentPage />)} />
          <Route path="tickets" element={student(<TicketsPage />)} />
          <Route path="volunteer" element={student(<VolunteerTasksPage />)} />
          <Route path="tickets/:id" element={student(<TicketDetailPage />)} />
          <Route path="orders" element={student(<OrdersPage />)} />
          <Route path="orders/:id" element={student(<OrderDetailPage />)} />

          {/* Any signed-in account */}
          <Route path="notifications" element={<RequireRole><NotificationsPage /></RequireRole>} />
          <Route path="profile" element={<RequireRole><ProfilePage /></RequireRole>} />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AppShell>
    </StudentScope>
  );
}
