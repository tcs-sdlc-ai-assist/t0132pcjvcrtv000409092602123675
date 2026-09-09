import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { closeGap, createOutreach, getMember, updateGoalStatus } from '../api/members';
import { CareActions } from '../components/CareActions';
import { MemberDetail } from '../components/MemberDetail';
import { useAuth } from '../auth/AuthContext';
import type { MemberDetail as MemberDetailData } from '../types';

/** Render an authorized member profile and its care-work controls. */
export default function MemberPage(): React.JSX.Element {
  const { memberId } = useParams(); const { session } = useAuth(); const [member, setMember] = useState<MemberDetailData | null>(null); const [error, setError] = useState('');
  const load = async (): Promise<void> => { if (!session || !memberId) return; try { setError(''); setMember(await getMember(session.access_token, memberId)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load member.'); } };
  useEffect(() => { void load(); }, [memberId, session]);
  if (error) return <main className="workspace"><p className="form-error" role="alert">{error}</p><button type="button" onClick={() => void load()}>Retry</button></main>;
  if (!member || !session) return <main className="workspace"><p className="state-message">Loading member record…</p></main>;
  return <main className="workspace"><Link className="back-link" to="/panel">← Back to panel</Link><MemberDetail member={member} onGoalChange={(goalId, status) => void updateGoalStatus(session.access_token, member.id, goalId, status).then(load).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Unable to update goal.'))} /><CareActions openGapId={member.gaps.find((gap) => gap.status === 'open')?.id} onCloseGap={async (reason) => { await closeGap(session.access_token, member.id, member.gaps.find((gap) => gap.status === 'open')?.id ?? 0, reason); await load(); }} onOutreach={async (payload) => { await createOutreach(session.access_token, member.id, payload); await load(); }} /></main>;
}