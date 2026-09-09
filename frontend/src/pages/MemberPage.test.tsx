import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MemberPage from './MemberPage';

const { closeGap, createOutreach, getMember, updateGoalStatus, updateMemberAssignment, useAuth } = vi.hoisted(() => ({
  closeGap: vi.fn(),
  createOutreach: vi.fn(),
  getMember: vi.fn(),
  updateGoalStatus: vi.fn(),
  updateMemberAssignment: vi.fn(),
  useAuth: vi.fn(),
}));
vi.mock('../api/members', () => ({ closeGap, createOutreach, getMember, updateGoalStatus, updateMemberAssignment }));
vi.mock('../auth/AuthContext', () => ({ useAuth }));

const member = {
  id: 1, member_key: 'MEM-001', first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1980-01-01', sex: 'F', phone: '555-0100', address: '1 Main Street', ssn_masked: '***-**-0001', mbi_masked: '****0001', plan: 'Meridian Choice', pcp: 'Dr. Rivera', risk_level: 'high', assigned_coordinator_id: 1, gaps: [], outreach: [], care_plan_goals: [],
};

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/members/1']}>
      <Routes><Route path="/members/:memberId" element={<MemberPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuth.mockReturnValue({ session: { access_token: 'token', role: 'supervisor', name: 'Supervisor' } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MemberPage', () => {
  it('shows loading then persists a supervisor assignment and reloads detail', async () => {
    const user = userEvent.setup();
    let resolveMember: (value: typeof member) => void = () => undefined;
    getMember.mockImplementationOnce(() => new Promise((resolve) => { resolveMember = resolve; })).mockResolvedValueOnce({ ...member, assigned_coordinator_id: null });
    updateMemberAssignment.mockResolvedValue({ ...member, assigned_coordinator_id: null });
    renderPage();
    expect(screen.getByText('Loading member record…')).toBeTruthy();

    resolveMember(member);
    await screen.findByText('MEM-001');
    await user.clear(screen.getByLabelText(/Assign coordinator ID/));
    await user.click(screen.getByRole('button', { name: 'Save assignment' }));

    await waitFor(() => expect(updateMemberAssignment).toHaveBeenCalledWith('token', 1, null));
    await screen.findByText('Unassigned');
    expect(getMember).toHaveBeenCalledTimes(2);
  });

  it('shows a retryable detail error', async () => {
    getMember.mockRejectedValue(new Error('Access denied'));
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toContain('Access denied');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
