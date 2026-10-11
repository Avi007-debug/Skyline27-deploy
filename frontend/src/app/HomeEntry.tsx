import { Navigate, useNavigate } from 'react-router';
import ClubChrome from '../club/ClubChrome';
import LandingPage from '../club/LandingPage';
import { useAuth } from '../shared/AuthProvider';
import { homeFor } from '../shared/session';

/**
 * "/" — the front door.
 *  - Visitors see the SkylineOS landing page and pick a role: Student, Club head or Admin,
 *    each with its own sign-in (and sign-up where it applies).
 *  - Signed-in users go straight to their own area: students to /home,
 *    club heads to /club, super admins to /admin.
 */
export default function HomeEntry() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div role="status" className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (profile) return <Navigate to={homeFor(profile.role)} replace />;
  return (
    <ClubChrome>
      <LandingPage onStudent={() => navigate('/login')} onClub={() => navigate('/club/auth')} onAdmin={() => navigate('/admin/login')} onBrowse={() => navigate('/events')} />
    </ClubChrome>
  );
}
