export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  currency: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  email: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface Category {
  id: string;
  group_id: string;
  name: string;
  color: string;
  default_split_type: 'equal' | 'percentage' | 'fixed' | 'custom';
  created_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  category_id: string | null;
  description: string;
  amount: number;
  date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  percentage: number | null;
  share_value: number | null;
  created_at: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  paid_by: string;
  paid_to: string;
  amount: number;
  date: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  group_id: string | null;
  actor_id: string;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id: string;
  changes_json: Record<string, unknown>;
  created_at: string;
}

export type SplitType = 'equal' | 'percentage' | 'fixed' | 'custom';

/** A single directional debt: `from` owes `to` this `amount`. */
export interface Debt {
  from: string;
  to: string;
  amount: number;
}
