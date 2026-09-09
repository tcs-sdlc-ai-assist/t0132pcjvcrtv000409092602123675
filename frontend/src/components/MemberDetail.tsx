import React, { useEffect, useState } from 'react';

import type { GoalStatus, MemberDetail as MemberDetailData } from '../types';

interface MemberDetailProps {
  member: MemberDetailData;
  onGoalChange: (goalId: number, status: GoalStatus) => void;
  role: string;
  onAssignmentChange: (coordinatorId: number | null) => Promise<void>;
}

const goalLabels: Record<GoalStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  met: 'Met',
};

/** Render masked demographics, plan goals, care gaps, outreach history, and supervisor assignment. */
export function MemberDetail({ member, onGoalChange, role, onAssignmentChange }: MemberDetailProps): React.JSX.Element {
  const [coordinatorId, setCoordinatorId] = useState(member.assigned_coordinator_id?.toString() ?? '');
  const [assignmentError, setAssignmentError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const canEditGoals = role === 'coordinator' || role === 'supervisor';

  useEffect(() => {
    setCoordinatorId(member.assigned_coordinator_id?.toString() ?? '');
  }, [member.assigned_coordinator_id]);

  const submitAssignment = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedId = coordinatorId.trim();
    if (normalizedId && (!/^\d+$/.test(normalizedId) || Number(normalizedId) < 1)) {
      setAssignmentError('Enter a positive numeric coordinator ID or leave the field empty to unassign.');
      return;
    }

    setAssigning(true);
    setAssignmentError('');
    try {
      await onAssignmentChange(normalizedId ? Number(normalizedId) : null);
    } catch (caught) {
      setAssignmentError(caught instanceof Error ? caught.message : 'Unable to update assignment.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <section aria-label="Member care record" className="detail-grid">
      <section className="detail-section">
        <p className="eyebrow">Member profile</p>
        <h1>
          {member.first_name} {member.last_name}
        </h1>
        <dl className="demographics">
          <div><dt>Member ID</dt><dd>{member.member_key}</dd></div>
          <div><dt>Date of birth</dt><dd>{member.date_of_birth}</dd></div>
          <div><dt>Sex</dt><dd>{member.sex}</dd></div>
          <div><dt>Phone</dt><dd>{member.phone}</dd></div>
          <div><dt>Address</dt><dd>{member.address}</dd></div>
          <div><dt>Plan</dt><dd>{member.plan}</dd></div>
          <div><dt>Primary care</dt><dd>{member.pcp}</dd></div>
          <div><dt>SSN</dt><dd>{member.ssn_masked}</dd></div>
          <div><dt>MBI</dt><dd>{member.mbi_masked}</dd></div>
          <div><dt>Risk</dt><dd>{member.risk_level}</dd></div>
          <div><dt>Assigned coordinator</dt><dd>{member.assigned_coordinator_id ?? 'Unassigned'}</dd></div>
        </dl>
        {role === 'supervisor' && (
          <form aria-label="Member assignment" className="assignment-form" onSubmit={submitAssignment}>
            <label htmlFor="coordinator-id">
              Assign coordinator ID
              <span className="table-meta">Enter a coordinator ID; leave empty to unassign this member.</span>
            </label>
            <input
              aria-describedby={assignmentError ? 'assignment-error' : undefined}
              aria-invalid={Boolean(assignmentError)}
              id="coordinator-id"
              inputMode="numeric"
              onChange={(event) => setCoordinatorId(event.target.value)}
              value={coordinatorId}
            />
            {assignmentError && (
              <p className="form-error" id="assignment-error" role="alert">
                {assignmentError}
              </p>
            )}
            <button disabled={assigning} type="submit">
              {assigning ? 'Saving assignment…' : 'Save assignment'}
            </button>
          </form>
        )}
      </section>
      <section className="detail-section">
        <h2>Care plan</h2>
        {member.care_plan_goals.map((goal) => (
          <article className="record-row" key={goal.id}>
            <div>
              <strong>{goal.title}</strong>
              <p>{goal.support_goal}</p>
              <p>{goal.interventions}</p>
            </div>
            {canEditGoals ? (
              <label>
                Goal status
                <select
                  aria-label={`Goal status for ${goal.title}`}
                  onChange={(event) => onGoalChange(goal.id, event.target.value as GoalStatus)}
                  value={goal.status}
                >
                  {Object.entries(goalLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p aria-label={`Goal status for ${goal.title}`}>
                Goal status: {goalLabels[goal.status]}
              </p>
            )}
          </article>
        ))}
      </section>
      <section className="detail-section">
        <h2>Care gaps</h2>
        {member.gaps.map((gap) => (
          <article className="record-row" key={gap.id}>
            <div>
              <strong>{gap.category}</strong>
              <p>
                {gap.status}
                {gap.closed_reason ? ` · ${gap.closed_reason}` : ''}
              </p>
            </div>
          </article>
        ))}
      </section>
      <section className="detail-section">
        <h2>Outreach history</h2>
        {member.outreach.map((item) => (
          <article className="record-row" key={item.id}>
            <div>
              <strong>{item.channel} · {item.outcome}</strong>
              <p>{item.occurred_at}</p>
              <p>{item.notes}</p>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
