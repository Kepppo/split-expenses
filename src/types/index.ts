export interface Profile {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  default_split_type: 'equal' | 'percentage' | 'fixed' | 'custom';
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  profile_id: string;
  category_id: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  profile_id: string;
  amount: number;
  percentage: number | null;
  share_value: number | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id: string;
  changes_json: Record<string, unknown>;
  created_at: string;
}

export type SplitType = 'equal' | 'percentage' | 'fixed' | 'custom';
