import type { CareGap, CarePlanGoal, MemberDetail, MemberPanel, Outreach, OutreachCreatePayload } from '../types';

/** Build a same-origin authenticated request and surface API errors. */
async function memberRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: 'The request could not be completed.' }));
    throw new Error(detail.detail ?? 'The request could not be completed.');
  }
  return response.json() as Promise<T>;
}

/** Fetch a bounded and scoped member panel using the current URL controls. */
export function getMembers(token: string, params: URLSearchParams): Promise<MemberPanel> {
  return memberRequest<MemberPanel>(`/api/v1/members?${params.toString()}`, token);
}

/** Fetch a masked detail profile for an authorized member. */
export function getMember(token: string, memberId: string): Promise<MemberDetail> {
  return memberRequest<MemberDetail>(`/api/v1/members/${memberId}`, token);
}

/** Close a member gap with required documentation. */
export function closeGap(token: string, memberId: number, gapId: number, reason: string): Promise<CareGap> {
  return memberRequest<CareGap>(`/api/v1/members/${memberId}/gaps/${gapId}/close`, token, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Record an outreach event for a member. */
export function createOutreach(token: string, memberId: number, payload: OutreachCreatePayload): Promise<Outreach> {
  return memberRequest<Outreach>(`/api/v1/members/${memberId}/outreach`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Assign or unassign a member when the signed-in user is a supervisor. */
export function updateMemberAssignment(token: string, memberId: number, coordinatorId: number | null): Promise<MemberDetail> {
  return memberRequest<MemberDetail>(`/api/v1/members/${memberId}/assignment`, token, {
    method: 'PATCH',
    body: JSON.stringify({ coordinator_id: coordinatorId }),
  });
}

/** Update an allowed care-plan goal status. */
export function updateGoalStatus(token: string, memberId: number, goalId: number, status: CarePlanGoal['status']): Promise<CarePlanGoal> {
  return memberRequest<CarePlanGoal>(`/api/v1/members/${memberId}/care-plan/${goalId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
