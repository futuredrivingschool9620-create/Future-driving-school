import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './features/auth/LoginPage';
import HomePage from './features/home/HomePage';
import DashboardPage from './features/dashboard/DashboardPage';
import RegistrationHistoryPage from './features/dashboard/RegistrationHistoryPage';
import SettingsPage from './features/settings/SettingsPage';
import AuthenticatedLayout from './components/layout/AuthenticatedLayout';

import CustomerListPage from './features/customers/CustomerListPage';
import CustomerRegistrationPage from './features/customers/CustomerRegistrationPage';
import CustomerDetailPage from './features/customers/CustomerDetailPage';
import CustomerEditPage from './features/customers/CustomerEditPage';

import DocumentsPage from './features/documents/DocumentsPage';
import NotificationsPage from './features/notifications/NotificationsPage';
import RenewalHistoryPage from './features/renewals/RenewalHistoryPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)] font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isLoading ? (
              <div className="flex items-center justify-center min-h-screen">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="customers" element={<CustomerListPage />} />
          <Route path="customers/new" element={<CustomerRegistrationPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="customers/:id/edit" element={<CustomerEditPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="renewals" element={<RenewalHistoryPage />} />
          <Route path="registrations" element={<RegistrationHistoryPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
