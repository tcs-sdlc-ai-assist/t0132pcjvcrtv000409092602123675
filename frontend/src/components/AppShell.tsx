import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

const THEME_STORAGE_KEY = 'meridian.theme';
type Theme = 'light' | 'dark';

function storedTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

interface AppShellProps {
  children: React.ReactNode;
}

/** Provide authenticated navigation and a persistent manual light/dark theme choice. */
export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const { logout, session } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const signOut = (): void => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to="/dashboard">
          Meridian Care
        </NavLink>
        <nav aria-label="Primary navigation" className="app-nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/panel">Member panel</NavLink>
        </nav>
        <div className="shell-actions">
          <span className="session-name">{session?.name}</span>
          <button
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            className="icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8L17 7m-10 10-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
            </svg>
          </button>
          <button className="quiet-button" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>
      <main className="app-content">
        {children}
      </main>
    </div>
  );
}
