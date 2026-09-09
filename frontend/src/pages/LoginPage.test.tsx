import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '../auth/AuthContext';
import LoginPage from './LoginPage';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function renderLoginPage(): void {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage redirectTo="/confirmed" />} />
          <Route path="/confirmed" element={<p>Signed in confirmation</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  it('blocks submission when required credentials are absent', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert').textContent).toContain('Enter both your email address and password.');
  });

  it('stores the successful session and navigates after a mocked login', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'demo-token', token_type: 'bearer', role: 'coordinator', name: 'Care Coordinator' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderLoginPage();

    await user.type(screen.getByLabelText('Email address'), 'coordinator@example.com');
    await user.type(screen.getByLabelText('Password'), 'CareDemo1!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Signed in confirmation')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ method: 'POST' }));
    expect(sessionStorage.getItem('meridian.auth.session')).toContain('demo-token');
  });
});
