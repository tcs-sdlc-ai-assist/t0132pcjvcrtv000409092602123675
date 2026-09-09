import React from 'react';
import type { MemberDetail as MemberDetailData } from '../types';

interface MemberDetailProps {
  member: MemberDetailData;
  onGoalChange: (goalId: number, status: 'open' | 'in_progress' | 'completed' | 'on_hold') => void;
}

/** Render masked demographics, plan goals, care gaps, and outreach history. */
export function MemberDetail({ member, onGoalChange }: MemberDetailProps): React.JSX.Element {
  return (
    <section className="detail-grid" aria-label="Member care record">
      <section className="detail-section">
        <p className="eyebrow">Member profile</p>
        <h1>{member.first_name} {member.last_name}</h1>
        <dl className="demographics">
          <div><dt>Member ID</dt><dd>{member.member_key}</dd></div><div><dt>Date of birth</dt><dd>{member.date_of_birth}</dd></div>
          <div><dt>Sex</dt><dd>{member.sex}</dd></div><div><dt>Phone</dt><dd>{member.phone}</dd></div>
          <div><dt>Address</dt><dd>{member.address}</dd></div><div><dt>Plan</dt><dd>{member.plan}</dd></div>
          <div><dt>Primary care</dt><dd>{member.pcp}</dd></div><div><dt>SSN</dt><dd>{member.ssn_masked}</dd></div>
          <div><dt>MBI</dt><dd>{member.mbi_masked}</dd></div><div><dt>Risk</dt><dd>{member.risk_level}</dd></div>
        </dl>
      </section>
      <section className="detail-section">
        <h2>Care plan</h2>
        {member.care_plan_goals.map((goal) => <article className="record-row" key={goal.id}><div><strong>{goal.title}</strong><p>{goal.support_goal}</p><p>{goal.interventions}</p></div><label>Goal status<select value={goal.status} onChange={(event) => onGoalChange(goal.id, event.target.value as typeof goal.status)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="on_hold">On hold</option></select></label></article>)}
      </section>
      <section className="detail-section"><h2>Care gaps</h2>{member.gaps.map((gap) => <article className="record-row" key={gap.id}><div><strong>{gap.category}</strong><p>{gap.status} {gap.closed_reason ? `· ${gap.closed_reason}` : ''}</p></div></article>)}</section>
      <section className="detail-section"><h2>Outreach history</h2>{member.outreach.map((item) => <article className="record-row" key={item.id}><div><strong>{item.channel} · {item.outcome}</strong><p>{item.occurred_at}</p><p>{item.notes}</p></div></article>)}</section>
    </section>
  );
}