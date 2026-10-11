import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import { PublicOnly, RequireRole } from '../shared/guards';
import HomeEntry from './HomeEntry';
import AuthPage from '../student/pages/AuthPage';
import ForgotPasswordPage from '../student/pages/ForgotPasswordPage';
import OnboardingPage from '../student/pages/OnboardingPage';
import PrivacyPolicyPage from '../student/pages/PrivacyPolicyPage';
import ResetPasswordPage from '../student/pages/ResetPasswordPage';
import StudentLayout, { StudentScope } from '../student/StudentLayout';

// The admin console and the club dashboard are large and used by few visitors: load them on demand.
const AdminRoutes = lazy(() => import('../admin/AdminRoutes'));
const ClubChrome = lazy(() => import('../club/ClubChrome'));
const AdminLogin = lazy(() => import('../admin/modules/auth/AdminLogin'));
const ClubAuthRoute = lazy(() => import('../club/ClubRoutes').then(m => ({ default: m.ClubAuthRoute })));
const ClubDashboardRoute = lazy(() => import('../club/ClubRoutes').then(m => ({ default: m.ClubDashboardRoute })));

function Loading() {
  return <div role="status" className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
}

/**
 * One website, three roles:
 *
 *   public + STUDENT   /, /events, /merch, /clubs, /tickets, /orders, /profile …
 *   CLUB_HEAD          /club            (club dashboard)
 *   SUPER_ADMIN        /admin/*         (admin console)
 *
 * The landing page (/) offers the three roles. Each has its own sign-in:
 *   students   /login  (sign in + sign up)
 *   club heads /club/auth  (sign in, or register with an authorization key / Google)
 *   admins     /admin/login  (sign in only)
 * and a signed-in user is always sent to their own area. Guards only shape navigation: the API authorises every
 * request by role again.
 */
export function App() {
  return (
    <>
      <Suspense fallback={<Loading />}>
      <Routes>
        {/* Front door: landing for visitors, role-based redirect for signed-in users */}
        <Route path="/" element={<HomeEntry />} />

        {/* Student sign-in/sign-up and shared account recovery */}
        <Route path="/login" element={<PublicOnly><StudentScope><AuthPage /></StudentScope></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><StudentScope><AuthPage /></StudentScope></PublicOnly>} />
        <Route path="/forgot-password" element={<StudentScope><ForgotPasswordPage /></StudentScope>} />
        <Route path="/reset-password" element={<StudentScope><ResetPasswordPage /></StudentScope>} />
        <Route path="/privacy" element={<StudentScope><PrivacyPolicyPage /></StudentScope>} />
        <Route path="/onboarding" element={<RequireRole roles={['STUDENT']}><StudentScope><OnboardingPage /></StudentScope></RequireRole>} />

        {/* Clubs */}
        <Route element={<ClubChrome />}>
          <Route path="/for-clubs" element={<Navigate to="/" replace />} />
          <Route path="/club/auth" element={<PublicOnly><ClubAuthRoute /></PublicOnly>} />
          <Route path="/club" element={<RequireRole roles={['CLUB_HEAD']}><ClubDashboardRoute /></RequireRole>} />
        </Route>

        {/* Super admin */}
        <Route path="/admin/login" element={<PublicOnly><AdminLogin /></PublicOnly>} />
        <Route path="/admin/*" element={<RequireRole roles={['SUPER_ADMIN']}><AdminRoutes /></RequireRole>} />

        {/* Public site + student area (everything else) */}
        <Route path="/*" element={<StudentLayout />} />
      </Routes>
      </Suspense>

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--surface, #141416)',
            color: 'var(--text, #fff)',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: 14,
          },
        }}
      />
    </>
  );
}
