import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import MemberPage from './pages/MemberPage';
import PanelPage from './pages/PanelPage';

function ProtectedRoute({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const { session } = useAuth();

  return session ? children : <Navigate replace to="/login" />;
}

function AppRoutes(): React.JSX.Element {
  const { session } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate replace to="/dashboard" /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/panel"
        element={(
          <ProtectedRoute>
            <AppShell>
              <PanelPage />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/members/:memberId"
        element={(
          <ProtectedRoute>
            <AppShell>
              <MemberPage />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate replace to={session ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
