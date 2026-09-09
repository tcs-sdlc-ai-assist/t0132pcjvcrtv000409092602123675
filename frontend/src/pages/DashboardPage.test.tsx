import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '../auth/AuthContext';
import DashboardPage from './DashboardPage';

const dashboardPayload = {
  metrics: {
    members_assigned: 20,
    open_care_gaps: 7,
    outreach_this_week: 4,
    high_risk_members: 3,
    gap_closure_rate_percent: 25,
  },
  gaps_by_type: [{ category: 'Annual wellness visit', count: 7 }],
  recent_activity: [{ action: 'care_gap_closed', detail: 'member_id=3;gap_id=4', created_at: '2025-01-01T12:00:00Z' }],
  attention_needed: [{ member_id: 3, member_key: 'MEM-DEMO-003', first_name: 'Alex', last_name: 'Rivera', overdue_gap_count: 1 }],
};

function renderPage(): void {
  sessionStorage.setItem('meridian.auth.session', JSON.stringify({ access_token: 'test-token', token_type: 'bearer', role: 'coordinator', name: 'Care Coordinator' }));
  render(
    <BrowserRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </BrowserRouter>,
  );
}

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('DashboardPage', () => {
  it('renders scoped KPI cards, SVG chart, activity, and attention from the API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dashboardPayload }));

    renderPage();

    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeTruthy();
    expect(await screen.findByText('Members assigned')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Open care gaps by type' })).toBeTruthy();
    expect(screen.getByText('Alex Rivera')).toBeTruthy();
    expect(screen.getByText('care gap closed')).toBeTruthy();
  });

  it('shows a retryable error and reloads the dashboard', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: 'Service temporarily unavailable' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => dashboardPayload });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect((await screen.findByRole('alert')).textContent).toContain('Service temporarily unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry dashboard' }));
    await waitFor(() => expect(screen.getByText('Members assigned')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
