import React, { createContext, useContext, useMemo, useState } from 'react';

import { loginRequest } from '../api/client';
import type { AuthContextValue, AuthSession, LoginCredentials } from '../types';

const SESSION_STORAGE_KEY = 'meridian.auth.session';
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): AuthSession | null {
  const storedValue = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }
  try {
    return JSON.parse(storedValue) as AuthSession;
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<AuthSession | null>(readStoredSession);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    login: async (credentials: LoginCredentials) => {
      const nextSession = await loginRequest(credentials);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    },
    logout: () => {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setSession(null);
    },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
