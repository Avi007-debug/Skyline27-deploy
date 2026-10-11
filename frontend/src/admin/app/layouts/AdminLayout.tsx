import { BarChart3, CalendarDays, Globe, KeyRound, LayoutDashboard, LogOut, Menu, Package, ScrollText, ShoppingBag, Store, Ticket, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import logo from '../../assets/logo.png';
import { ToastProvider } from '../../components/common/Toast';
import { useAuth } from '@/shared/AuthProvider';
import { ThemeToggle } from '@/shared/theme';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/clubs', label: 'Clubs', icon: Store },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/registrations', label: 'Registrations', icon: Ticket },
  { to: '/admin/keys', label: 'Registration keys', icon: KeyRound },
  { to: '/admin/merchandise', label: 'Merchandise', icon: ShoppingBag },
  { to: '/admin/orders', label: 'Orders', icon: Package },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/audit-logs', label: 'Audit logs', icon: ScrollText },
] as const;

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    if (open) setOpen(false);
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src={logo} alt="" className="h-9 w-9 rounded-xl object-cover" />
        <div>
          <div className="text-sm font-extrabold leading-tight">SkylineOS</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ad-brand">Super Admin</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-ad-brand text-white' : 'text-ad-muted hover:bg-ad-raised hover:text-ad-fg'}`}
          >
            <Icon size={17} aria-hidden /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ad-line p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{profile?.fullName}</div>
            <div className="truncate text-xs text-ad-faint">{profile?.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="ad-btn-ghost ad-btn-sm whitespace-nowrap" title="Public website">
            <Globe size={14} /> Site
          </Link>
          <ThemeToggle />
          <button className="ad-btn-ghost ad-btn-sm flex-1 whitespace-nowrap" onClick={signOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
    <div className="admin-root min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ad-line bg-ad-surface lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ad-line bg-ad-ink/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-sm font-extrabold">Super Admin</span>
        </div>
        <button className="rounded-lg p-2 hover:bg-ad-raised" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ad-line bg-ad-surface">
            <button className="absolute right-3 top-3 rounded-lg p-2 hover:bg-ad-raised" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
    </ToastProvider>
  );
}
