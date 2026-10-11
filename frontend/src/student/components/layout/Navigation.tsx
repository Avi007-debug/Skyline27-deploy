import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, Ticket, Users, User, Bell, Download, CalendarDays, ShoppingBag, Package, LogIn, LayoutDashboard, ShieldCheck, LogOut, ClipboardList } from 'lucide-react';
import { useAuth } from '@/shared/AuthProvider';
import { useAuthStore } from '@/student/store/authStore';
import { useNotificationsStore } from '@/student/store/notificationsStore';

interface NavItem { icon: typeof Home; label: string; path: string }

/**
 * Public pages are always listed. Account pages are shown too: for a visitor they
 * lead to login and then back, so nothing is hidden, only gated by the route guard.
 * Club heads and admins get a link to their own area instead of student tickets/orders.
 */
function useNavItems(variant: 'sidebar' | 'bottom'): NavItem[] {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const account: NavItem = isAuthenticated
    ? { icon: User, label: 'Profile', path: '/profile' }
    : { icon: LogIn, label: 'Sign in', path: '/login' };
  const core: NavItem[] = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: CalendarDays, label: 'Events', path: '/events' },
    { icon: ShoppingBag, label: 'Merch', path: '/merch' },
  ];
  const area: NavItem | null =
    role === 'SUPER_ADMIN' ? { icon: ShieldCheck, label: 'Admin console', path: '/admin' }
    : role === 'CLUB_HEAD' ? { icon: LayoutDashboard, label: 'Club dashboard', path: '/club' }
    : null;
  const studentItems: NavItem[] = area ? [] : [{ icon: Ticket, label: 'My Events', path: '/tickets' }];
  if (variant === 'bottom') return [...core, ...(area ? [area] : studentItems), account];
  return [
    ...core,
    { icon: Users, label: 'Clubs', path: '/clubs' },
    ...studentItems,
    ...(area ? [area] : [{ icon: Package, label: 'My Orders', path: '/orders' }, { icon: ClipboardList, label: 'My Tasks', path: '/volunteer' }]),
    account,
  ];
}

const isActivePath = (pathname: string, path: string) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/'));

// Desktop sidebar - shown on lg+ screens
export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const { signOut } = useAuth();
  const items = useNavItems('sidebar');
  const all: Array<NavItem & { badge?: number }> = isAuthenticated
    ? [...items, { icon: Bell, label: 'Notifications', path: '/notifications', badge: unreadCount }]
    : items;

  return (
    <aside className="stu-sidebar">

      <nav className="stu-nav" aria-label="Main">
        {all.map(({ icon: Icon, label, path, badge }) => {
          const active = isActivePath(location.pathname, path);
          return (
            <button key={path} className="stu-nav-item" aria-current={active ? 'page' : undefined} onClick={() => navigate(path)}>
              <Icon size={17} strokeWidth={1.9} />
              <span>{label}</span>
              {!!badge && badge > 0 && <span className="stu-nav-badge">{badge > 99 ? '99+' : badge}</span>}
            </button>
          );
        })}
      </nav>

      {isAuthenticated && (
        <div className="stu-sidebar-foot">
          <button className="stu-nav-item" onClick={() => { logout(); signOut(); }}>
            <LogOut size={17} strokeWidth={1.9} /> <span>Sign out</span>
          </button>
        </div>
      )}
    </aside>
  );
}

// Mobile bottom navigation - shown on <lg screens
export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const items = useNavItems('bottom');

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        background: 'var(--surface)',
        borderRadius: 35,
        border: '1px solid var(--border)',
        boxShadow: 'var(--sk-shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: 68,
        zIndex: 100,
        padding: '0 8px',
      }}
    >
      {items.map(({ icon: Icon, label, path }) => {
        const active = isActivePath(location.pathname, path);
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: active ? 8 : 0,
              padding: active ? '10px 18px' : '12px',
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--text)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--subtext)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={22} />
            {active && <span>{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
