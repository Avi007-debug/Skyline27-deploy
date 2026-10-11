import { Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from './app/layouts/AdminLayout';
import { AuditLogsPage } from './modules/audit/AuditLogsPage';
import { ClubDetailsPage } from './modules/clubs/ClubDetailsPage';
import { ClubsPage } from './modules/clubs/ClubsPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { EventDetailsPage } from './modules/events/EventDetailsPage';
import { EventsPage } from './modules/events/EventsPage';
import { KeysPage } from './modules/keys/KeysPage';
import { OrdersPage } from './modules/merchandise/OrdersPage';
import { ProductsPage } from './modules/merchandise/ProductsPage';
import { RegistrationsPage } from './modules/registrations/RegistrationsPage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { UserDetailsPage } from './modules/users/UserDetailsPage';
import { UsersPage } from './modules/users/UsersPage';

/** The Super Admin console, mounted at /admin/* (loaded on demand). */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailsPage />} />
        <Route path="clubs" element={<ClubsPage />} />
        <Route path="clubs/:id" element={<ClubDetailsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailsPage />} />
        <Route path="registrations" element={<RegistrationsPage />} />
        <Route path="keys" element={<KeysPage />} />
        <Route path="merchandise" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
