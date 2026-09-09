import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '../auth/AuthContext';
import { AppShell } from './AppShell';

function renderShell(withSession = true): void {
  if (withSession) {
    sessionStorage.setItem('meridian.auth.session', JSON.stringify({
      access_token: 'test-token',
      token_type: 'bearer',
      role: 'coordinator',
      name: 'Care Coordinator',
    }));
  }

  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/dashboard" element={<h1>Dashboard content</h1>} />
            <Route path="/panel" element={<h1>Member panel content</h1>} />
            <Route path="/login" element={<h1>Login content</h1>} />
          </Routes>
        </AppShell>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
  sessionStorage.clear();
});

describe('AppShell', () => {
  it('navigates through its primary links', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('link', { name: 'Member panel' }));

    expect(screen.getByRole('heading', { name: 'Member panel content' })).toBeTruthy();
  });

  it('persists the selected theme and applies it to the document root', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('meridian.theme')).toBe('dark');
  });

  it('clears the stored session and routes to login on logout, including when no session exists', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(sessionStorage.getItem('meridian.auth.session')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Login content' })).toBeTruthy();

    cleanup();
    renderShell(false);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Login content' })).toBeTruthy();
  });
});
