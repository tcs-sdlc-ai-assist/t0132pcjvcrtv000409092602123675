import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import MemberPage from './pages/MemberPage';
import PanelPage from './pages/PanelPage';

function ProtectedRoute({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const { session } = useAuth();
  return session ? children : <Navigate to="/login" replace />;
}

function AppRoutes(): React.JSX.Element {
  const { session } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/panel" replace /> : <LoginPage />} />
      <Route path="/panel" element={<ProtectedRoute><PanelPage /></ProtectedRoute>} />
      <Route path="/members/:memberId" element={<ProtectedRoute><MemberPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={session ? '/panel' : '/login'} replace />} />
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
