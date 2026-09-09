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
  assigned_coordinator_id: number | null;
  open_gap_count: number;
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

export interface Outreach {
  id: number;
  outreach_key: string;
  channel: string;
  outcome: string;
  occurred_at: string;
  notes: string | null;
}

export interface CarePlanGoal {
  id: number;
  goal_key: string;
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'on_hold';
  target_date: string | null;
  support_goal: string | null;
  interventions: string | null;
  updated_at: string;
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
