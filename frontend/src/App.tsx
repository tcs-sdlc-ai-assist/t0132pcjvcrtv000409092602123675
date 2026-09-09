import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';

function ProtectedConfirmation(): React.JSX.Element {
  const { logout, session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return (
    <main className="confirmation-shell">
      <section className="confirmation-panel" aria-labelledby="confirmation-title">
        <p className="eyebrow">Session confirmed</p>
        <h1 id="confirmation-title">Welcome, {session.name}.</h1>
        <p>You are signed in with the <strong>{session.role}</strong> role. Your authorized workspace will appear in the next slice.</p>
        <button type="button" className="secondary-button" onClick={logout}>Sign out</button>
      </section>
    </main>
  );
}

function AppRoutes(): React.JSX.Element {
  const { session } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/confirmed" replace /> : <LoginPage />} />
      <Route path="/confirmed" element={<ProtectedConfirmation />} />
      <Route path="*" element={<Navigate to={session ? '/confirmed' : '/login'} replace />} />
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
