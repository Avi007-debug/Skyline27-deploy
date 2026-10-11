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
  const studentItems: NavItem[] = area ? [] : [{ icon: Ticket, label: variant === 'bottom' ? 'Tickets' : 'My Tickets', path: '/tickets' }];
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

  return (
    <aside
      style={{
        width: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        padding: '24px 0',
      }}
    >
      {/* Logo */}
      <div
        style={{ padding: '0 24px 28px', cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--color-crimson)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>S</span>
          </div>
          <span
            style={{
              color: 'var(--text)',
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: '-0.3px',
            }}
          >
            SkylineOS
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(({ icon: Icon, label, path }) => {
          const active = isActivePath(location.pathname, path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                background: active ? 'var(--color-crimson)' : 'transparent',
                color: active ? '#fff' : 'var(--subtext)',
                transition: 'background 0.15s, color 0.15s',
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--subtext)';
                }
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}

        {/* Notifications */}
        {isAuthenticated && <button
          onClick={() => navigate('/notifications')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 14px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: location.pathname === '/notifications' ? 600 : 500,
            background: location.pathname === '/notifications' ? 'var(--color-crimson)' : 'transparent',
            color: location.pathname === '/notifications' ? '#fff' : 'var(--subtext)',
            transition: 'background 0.15s, color 0.15s',
            textAlign: 'left',
            width: '100%',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (location.pathname !== '/notifications') {
              (e.currentTarget as HTMLElement).style.background = 'var(--border)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text)';
            }
          }}
          onMouseLeave={(e) => {
            if (location.pathname !== '/notifications') {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--subtext)';
            }
          }}
        >
          <div style={{ position: 'relative' }}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: 'var(--color-crimson)',
                  color: '#fff',
                  borderRadius: '99px',
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '1px 4px',
                  minWidth: 14,
                  textAlign: 'center',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
        </button>}
      </nav>

      {isAuthenticated && (
        <div style={{ padding: '0 16px', marginTop: 'auto' }}>
          <button
            onClick={() => { logout(); signOut(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderRadius: 12, border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--color-crimson)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <LogOut size={18} /> Sign out
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
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
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
              background: active ? 'var(--color-crimson)' : 'transparent',
              color: active ? '#fff' : 'var(--subtext)',
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
