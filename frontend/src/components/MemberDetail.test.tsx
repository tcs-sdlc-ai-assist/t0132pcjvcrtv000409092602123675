import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CareActions } from './CareActions';
import { MemberDetail } from './MemberDetail';
import type { MemberDetail as MemberDetailData } from '../types';

afterEach(() => {
  cleanup();
});

const member: MemberDetailData = {
  id: 1,
  member_key: 'MEM-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  date_of_birth: '1980-01-01',
  sex: 'F',
  phone: '555-0100',
  address: '1 Main Street',
  ssn_masked: '***-**-0001',
  mbi_masked: '1EG4-TE5-MK73',
  plan: 'Meridian Choice',
  pcp: 'Dr. Rivera',
  risk_level: 'high',
  assigned_coordinator_id: 1,
  gaps: [],
  outreach: [],
  care_plan_goals: [{
    id: 9,
    goal_key: 'GOAL-009',
    title: 'Complete wellness visit',
    status: 'not-started',
    target_date: null,
    support_goal: null,
    interventions: null,
    updated_at: '2025-01-01T00:00:00Z',
  }],
};

describe('MemberDetail and CareActions', () => {
  it('uses backend goal values while presenting readable goal labels', async () => {
    const user = userEvent.setup();
    const onGoalChange = vi.fn();
    render(
      <MemberDetail
        member={member}
        onAssignmentChange={vi.fn().mockResolvedValue(undefined)}
        onGoalChange={onGoalChange}
        role="coordinator"
      />,
    );

    await user.selectOptions(screen.getByLabelText('Goal status for Complete wellness visit'), 'met');

    expect(onGoalChange).toHaveBeenCalledWith(9, 'met');
    expect(screen.getByRole('option', { name: 'Not started' })).toBeTruthy();
  });

  it('renders read-only goal status for auditors while preserving coordinator editing', () => {
    const onGoalChange = vi.fn();
    const { rerender } = render(
      <MemberDetail
        member={member}
        onAssignmentChange={vi.fn().mockResolvedValue(undefined)}
        onGoalChange={onGoalChange}
        role="auditor"
      />,
    );

    expect(screen.queryByRole('combobox', { name: 'Goal status for Complete wellness visit' })).toBeNull();
    expect(screen.getByText('Goal status: Not started')).toBeTruthy();

    rerender(
      <MemberDetail
        member={member}
        onAssignmentChange={vi.fn().mockResolvedValue(undefined)}
        onGoalChange={onGoalChange}
        role="coordinator"
      />,
    );
    expect(screen.getByLabelText('Goal status for Complete wellness visit')).toBeTruthy();
  });

  it('validates required care documentation and submits trimmed values', async () => {
    const user = userEvent.setup();
    const onCloseGap = vi.fn().mockResolvedValue(undefined);
    const onOutreach = vi.fn().mockResolvedValue(undefined);
    render(<CareActions openGapId={3} onCloseGap={onCloseGap} onOutreach={onOutreach} />);

    await user.click(screen.getByRole('button', { name: 'Close gap' }));
    expect(screen.getByRole('alert').textContent).toContain('A closure reason is required.');

    await user.type(screen.getByLabelText('Closure reason'), '  Verified in chart  ');
    await user.click(screen.getByRole('button', { name: 'Close gap' }));
    expect(onCloseGap).toHaveBeenCalledWith('Verified in chart');

    await user.click(screen.getByRole('button', { name: 'Log outreach' }));
    expect(screen.getByRole('alert').textContent).toContain('Outreach notes are required.');

    await user.selectOptions(screen.getByLabelText('Channel'), 'SMS');
    await user.selectOptions(screen.getByLabelText('Outcome'), 'left message');
    await user.type(screen.getByLabelText('Outreach notes'), '  Left a callback message  ');
    await user.click(screen.getByRole('button', { name: 'Log outreach' }));
    expect(onOutreach).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'SMS',
      notes: 'Left a callback message',
      occurred_at: expect.stringMatching(/Z$/),
      outcome: 'left message',
    }));
  });

  it('rejects invalid outreach dates and reports rejected close and outreach callbacks', async () => {
    const user = userEvent.setup();
    const closeFailure = vi.fn().mockRejectedValue(new Error('Gap close denied'));
    const outreachFailure = vi.fn().mockRejectedValue(new Error('Outreach save denied'));
    render(<CareActions openGapId={3} onCloseGap={closeFailure} onOutreach={outreachFailure} />);

    await user.type(screen.getByLabelText('Closure reason'), 'Verified in chart');
    await user.click(screen.getByRole('button', { name: 'Close gap' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Gap close denied');

    const dateInput = screen.getByLabelText('Outreach date and time');
    Object.defineProperty(dateInput, 'value', { configurable: true, value: 'not-a-date' });
    fireEvent.change(dateInput);
    await user.type(screen.getByLabelText('Outreach notes'), 'Attempted callback');
    await user.click(screen.getByRole('button', { name: 'Log outreach' }));
    expect(screen.getByRole('alert').textContent).toContain('Outreach date and time are invalid.');
    expect(outreachFailure).not.toHaveBeenCalled();

    Object.defineProperty(dateInput, 'value', { configurable: true, value: '2025-01-01T09:30' });
    fireEvent.change(dateInput);
    await user.click(screen.getByRole('button', { name: 'Log outreach' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Outreach save denied');
  });

  it('releases assignment busy state and displays a rejected supervisor assignment error', async () => {
    const user = userEvent.setup();
    let rejectAssignment: (reason: Error) => void = () => undefined;
    const onAssignmentChange = vi.fn(() => new Promise<void>((_, reject) => {
      rejectAssignment = reject;
    }));
    render(
      <MemberDetail
        member={member}
        onAssignmentChange={onAssignmentChange}
        onGoalChange={vi.fn()}
        role="supervisor"
      />,
    );

    await user.clear(screen.getByLabelText(/Assign coordinator ID/));
    await user.type(screen.getByLabelText(/Assign coordinator ID/), '2');
    await user.click(screen.getByRole('button', { name: 'Save assignment' }));
    expect((screen.getByRole('button', { name: 'Saving assignment…' }) as HTMLButtonElement).disabled).toBe(true);

    rejectAssignment(new Error('Assignment update denied'));

    expect((await screen.findByRole('alert')).textContent).toContain('Assignment update denied');
    expect((screen.getByRole('button', { name: 'Save assignment' }) as HTMLButtonElement).disabled).toBe(false);
    expect(onAssignmentChange).toHaveBeenCalledWith(2);
  });

  it('shows reassignment only to supervisors and validates then submits the coordinator ID', async () => {
    const user = userEvent.setup();
    const onAssignmentChange = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <MemberDetail
        member={member}
        onAssignmentChange={onAssignmentChange}
        onGoalChange={vi.fn()}
        role="coordinator"
      />,
    );

    expect(screen.queryByRole('form', { name: 'Member assignment' })).toBeNull();

    rerender(
      <MemberDetail
        member={member}
        onAssignmentChange={onAssignmentChange}
        onGoalChange={vi.fn()}
        role="supervisor"
      />,
    );
    await user.clear(screen.getByLabelText(/Assign coordinator ID/));
    await user.type(screen.getByLabelText(/Assign coordinator ID/), 'not-an-id');
    await user.click(screen.getByRole('button', { name: 'Save assignment' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter a positive numeric coordinator ID');

    await user.clear(screen.getByLabelText(/Assign coordinator ID/));
    await user.type(screen.getByLabelText(/Assign coordinator ID/), '1');
    await user.click(screen.getByRole('button', { name: 'Save assignment' }));
    expect(onAssignmentChange).toHaveBeenCalledWith(1);
  });
});
