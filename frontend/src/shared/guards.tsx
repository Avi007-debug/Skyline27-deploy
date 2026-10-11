import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { destinationFor, homeFor, loginUrl } from './session';
import type { Role } from './session';

function Splash() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
      Checking your session…
    </div>
  );
}

/**
 * Route guard: signed-out visitors go to login (and come back here afterwards);
 * signed-in users with the wrong role are sent to their own area.
 * This only shapes navigation. The API authorises every request by role again.
 */
export function RequireRole({ roles, children }: { roles?: Role[]; children?: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!profile) return <Navigate to={loginUrl(location.pathname + location.search)} replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={homeFor(profile.role)} replace />;
  return children ? <>{children}</> : <Outlet />;
}

/** Login/sign-up style pages: someone already signed in is sent on to where they were headed. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <Splash />;
  if (profile) return <Navigate to={destinationFor(profile.role, params.get('redirect'))} replace />;
  return <>{children}</>;
}
