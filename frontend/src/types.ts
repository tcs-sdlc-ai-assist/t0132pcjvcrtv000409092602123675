export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  role: string;
  name: string;
}

export interface AuthContextValue {
  session: AuthSession | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

export interface PanelMember {
  id: number;
  member_key: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  risk_level: string;
  plan: string;
  pcp: string;
  assigned_coordinator_id: number | null;
  open_gap_count: number;
  last_outreach_at: string | null;
}

export interface MemberPanel {
  items: PanelMember[];
  total: number;
  limit: number;
  offset: number;
}

export interface CareGap {
  id: number;
  gap_key: string;
  category: string;
  status: string;
  due_date: string | null;
  closed_reason: string | null;
  closed_by: string | null;
  closed_at: string | null;
}

export type OutreachChannel = 'phone' | 'SMS' | 'mail' | 'member portal';
export type OutreachOutcome = 'reached' | 'left message' | 'no answer' | 'wrong number';

export interface Outreach {
  id: number;
  outreach_key: string;
  channel: OutreachChannel;
  outcome: OutreachOutcome;
  occurred_at: string;
  notes: string | null;
}

export interface OutreachCreatePayload {
  channel: OutreachChannel;
  outcome: OutreachOutcome;
  occurred_at: string;
  notes: string;
}

export type GoalStatus = 'not-started' | 'in-progress' | 'met';

export interface CarePlanGoal {
  id: number;
  goal_key: string;
  title: string;
  status: GoalStatus;
  target_date: string | null;
  support_goal: string | null;
  interventions: string | null;
  updated_at: string;
}

export interface DashboardMetrics {
  members_assigned: number;
  open_care_gaps: number;
  outreach_this_week: number;
  high_risk_members: number;
  gap_closure_rate_percent: number;
}

export interface GapSeriesPoint {
  category: string;
  count: number;
}

export interface DashboardActivity {
  action: string;
  detail: string;
  created_at: string;
}

export interface AttentionMember {
  member_id: number;
  member_key: string;
  first_name: string;
  last_name: string;
  overdue_gap_count: number;
}

export interface Dashboard {
  metrics: DashboardMetrics;
  gaps_by_type: GapSeriesPoint[];
  recent_activity: DashboardActivity[];
  attention_needed: AttentionMember[];
}

export interface MemberDetail {
  id: number;
  member_key: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  phone: string;
  address: string;
  ssn_masked: string;
  mbi_masked: string;
  plan: string;
  pcp: string;
  risk_level: string;
  assigned_coordinator_id: number | null;
  gaps: CareGap[];
  outreach: Outreach[];
  care_plan_goals: CarePlanGoal[];
}
