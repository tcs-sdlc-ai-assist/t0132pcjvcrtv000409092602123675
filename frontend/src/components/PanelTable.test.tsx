import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { PanelTable } from './PanelTable';

const members = [{
  id: 7,
  member_key: 'MEM-007',
  first_name: 'Ada',
  last_name: 'Lovelace',
  date_of_birth: '1980-01-01',
  risk_level: 'high',
  plan: 'Meridian Choice',
  pcp: 'Dr. Rivera',
  assigned_coordinator_id: 1,
  open_gap_count: 2,
  last_outreach_at: '2030-02-01T12:00:00Z',
}];

afterEach(() => {
  cleanup();
});

describe('PanelTable', () => {
  it('renders a member, exposes its detail route, and sorts through labelled headers', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <MemoryRouter>
        <PanelTable members={members} onSort={onSort} sortBy="last_name" sortOrder="asc" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Lovelace, Ada')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/members/7');
    expect(screen.getByRole('columnheader', { name: 'Member' }).getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getByRole('columnheader', { name: 'DOB' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Plan' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'PCP' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Risk' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Open gaps' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Last outreach' })).toBeTruthy();
    expect(screen.getByText('Dr. Rivera')).toBeTruthy();
    expect(screen.getByText('2030-02-01T12:00:00Z')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'DOB' }));
    await user.click(screen.getByRole('button', { name: 'PCP' }));
    await user.click(screen.getByRole('button', { name: 'Open gaps' }));
    await user.click(screen.getByRole('button', { name: 'Last outreach' }));

    expect(onSort).toHaveBeenCalledWith('date_of_birth');
    expect(onSort).toHaveBeenCalledWith('pcp');
    expect(onSort).toHaveBeenCalledWith('open_gap_count');
    expect(onSort).toHaveBeenCalledWith('last_outreach');
  });

  it('renders an empty body and reports descending sort state', () => {
    render(
      <MemoryRouter>
        <PanelTable members={[]} onSort={vi.fn()} sortBy="open_gap_count" sortOrder="desc" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('columnheader', { name: 'Open gaps' }).getAttribute('aria-sort')).toBe('descending');
    expect(screen.queryByRole('cell')).toBeNull();
  });
});
