import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { closeGap, createOutreach, getMember, updateGoalStatus, updateMemberAssignment } from '../api/members';
import { CareActions } from '../components/CareActions';
import { MemberDetail } from '../components/MemberDetail';
import type { GoalStatus, MemberDetail as MemberDetailData } from '../types';

/** Render an authorized member profile and its care-work controls. */
export default function MemberPage(): React.JSX.Element {
  const { memberId } = useParams();
  const { session } = useAuth();
  const [member, setMember] = useState<MemberDetailData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingGoalId, setUpdatingGoalId] = useState<number | null>(null);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);

  const load = async (): Promise<void> => {
    if (!session || !memberId) {
      return;
    }

    setLoading(true);
    try {
      setError('');
      setMember(await getMember(session.access_token, memberId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load member.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [memberId, session]);

  const changeGoal = async (goalId: number, status: GoalStatus): Promise<void> => {
    if (!session || !member) {
      return;
    }

    setUpdatingGoalId(goalId);
    try {
      setError('');
      await updateGoalStatus(session.access_token, member.id, goalId, status);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update goal.');
    } finally {
      setUpdatingGoalId(null);
    }
  };

  const changeAssignment = async (coordinatorId: number | null): Promise<void> => {
    if (!session || !member) {
      return;
    }

    setUpdatingAssignment(true);
    try {
      setError('');
      await updateMemberAssignment(session.access_token, member.id, coordinatorId);
      await load();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to update assignment.';
      setError(message);
      throw new Error(message);
    } finally {
      setUpdatingAssignment(false);
    }
  };

  if (error) {
    return (
      <section className="workspace">
        <p className="form-error" role="alert">{error}</p>
        <button onClick={() => void load()} type="button">Retry</button>
      </section>
    );
  }

  if (loading || !member || !session) {
    return (
      <section className="workspace">
        <p aria-live="polite" className="state-message">Loading member record…</p>
      </section>
    );
  }

  const openGapId = member.gaps.find((gap) => gap.status === 'open')?.id;

  return (
    <section className="workspace">
      <Link className="back-link" to="/panel">← Back to panel</Link>
      {updatingGoalId && (
        <p aria-live="polite" className="state-message">
          Updating care-plan goal…
        </p>
      )}
      {updatingAssignment && (
        <p aria-live="polite" className="state-message">
          Updating member assignment…
        </p>
      )}
      <MemberDetail
        member={member}
        onAssignmentChange={changeAssignment}
        onGoalChange={(goalId, status) => void changeGoal(goalId, status)}
        role={session.role}
      />
      {session.role !== 'auditor' && (
        <CareActions
          onCloseGap={async (reason) => {
            await closeGap(session.access_token, member.id, openGapId ?? 0, reason);
            await load();
          }}
          onOutreach={async (payload) => {
            await createOutreach(session.access_token, member.id, payload);
            await load();
          }}
          openGapId={openGapId}
        />
      )}
    </section>
  );
}
