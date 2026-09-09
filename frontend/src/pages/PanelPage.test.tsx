import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PanelPage from './PanelPage';

const { getMembers, useAuth } = vi.hoisted(() => ({ getMembers: vi.fn(), useAuth: vi.fn() }));
vi.mock('../api/members', () => ({ getMembers }));
vi.mock('../auth/AuthContext', () => ({ useAuth }));

const panel = {
  items: [
    { id: 1, member_key: 'MEM-1', first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1980-01-01', risk_level: 'high', plan: 'Meridian Choice', pcp: 'Dr. Rivera', assigned_coordinator_id: 1, open_gap_count: 2, last_outreach_at: '2030-02-01T12:00:00Z' },
    { id: 2, member_key: 'MEM-2', first_name: 'Grace', last_name: 'Hopper', date_of_birth: '1985-02-02', risk_level: 'moderate', plan: 'Meridian Advantage', pcp: 'Dr. Chen', assigned_coordinator_id: 1, open_gap_count: 0, last_outreach_at: null },
  ],
  total: 2,
  limit: 10,
  offset: 0,
};

function renderPage(): void {
  render(
    <MemoryRouter>
      <PanelPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuth.mockReturnValue({ session: { access_token: 'token', role: 'supervisor', name: 'Care' }, logout: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PanelPage', () => {
  it('sends URL-backed server filters and applies an explicitly current-page open-gap filter', async () => {
    getMembers.mockResolvedValue(panel);
    renderPage();
    await screen.findByText('Lovelace, Ada');
    expect(screen.getByText('Dr. Rivera')).toBeTruthy();
    expect(screen.getByText('2030-02-01T12:00:00Z')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Coordinator ID'), { target: { value: '1' } });
    await waitFor(() => {
      const latestRequest = getMembers.mock.calls[getMembers.mock.calls.length - 1]?.[1];
      expect(latestRequest?.get('coordinator_id')).toBe('1');
    });

    fireEvent.change(screen.getByLabelText('Minimum open gaps (current page)'), { target: { value: '1' } });
    await screen.findByText('Lovelace, Ada');
    expect(screen.queryByText('Hopper, Grace')).toBeNull();
  });

  it('requests server sorting for PCP and last outreach with accessible state', async () => {
    getMembers.mockResolvedValue(panel);
    renderPage();
    await screen.findByText('Lovelace, Ada');

    fireEvent.click(screen.getByRole('button', { name: 'PCP' }));
    await waitFor(() => {
      const latestRequest = getMembers.mock.calls[getMembers.mock.calls.length - 1]?.[1];
      expect(latestRequest?.get('sort_by')).toBe('pcp');
      expect(latestRequest?.get('sort_order')).toBe('asc');
      expect(screen.getByRole('columnheader', { name: 'PCP' }).getAttribute('aria-sort')).toBe('ascending');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Last outreach' }));
    await waitFor(() => {
      const latestRequest = getMembers.mock.calls[getMembers.mock.calls.length - 1]?.[1];
      expect(latestRequest?.get('sort_by')).toBe('last_outreach');
      expect(latestRequest?.get('sort_order')).toBe('asc');
      expect(screen.getByRole('columnheader', { name: 'Last outreach' }).getAttribute('aria-sort')).toBe('ascending');
    });
  });

  it('uses local descending gap sorting with accessible state', async () => {
    getMembers.mockResolvedValue(panel);
    renderPage();
    await screen.findByText('Lovelace, Ada');

    fireEvent.click(screen.getByRole('button', { name: 'Open gaps' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open gaps' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Open gaps' }));

    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Open gaps' }).getAttribute('aria-sort')).toBe('descending'));
  });

  it('offers clear filters when a nonzero server panel is locally empty after the open-gap filter', async () => {
    getMembers.mockResolvedValue({
      items: [{ ...panel.items[1], open_gap_count: 0 }],
      total: 7,
      limit: 10,
      offset: 0,
    });
    renderPage();
    await screen.findByText('Hopper, Grace');

    fireEvent.change(screen.getByLabelText('Minimum open gaps (current page)'), { target: { value: '1' } });
    expect(await screen.findByText('No members on this page meet the minimum open-gap filter.')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Hopper, Grace')).toBeTruthy();
  });

  it('distinguishes an empty assigned panel', async () => {
    getMembers.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
    renderPage();
    expect(await screen.findByText('No members are assigned to your panel.')).toBeTruthy();
  });

  it('presents retryable errors', async () => {
    getMembers.mockRejectedValue(new Error('Network unavailable'));
    renderPage();
    expect(await screen.findByText(/We could not load members/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});