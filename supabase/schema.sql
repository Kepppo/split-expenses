-- Supabase SQL Migration
-- Run this in the Supabase SQL Editor after creating your project

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Categories table
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  color text not null default '#3B82F6',
  default_split_type text not null default 'equal' check (default_split_type in ('equal', 'percentage', 'fixed', 'custom')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expenses table
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  profile_id uuid references public.profiles not null,
  category_id uuid references public.categories not null,
  description text not null,
  amount numeric not null check (amount > 0),
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expense splits table
create table if not exists public.expense_splits (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references public.expenses on delete cascade not null,
  profile_id uuid references public.profiles not null,
  amount numeric not null check (amount >= 0),
  percentage numeric check (percentage >= 0 and percentage <= 100),
  share_value numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Activity log table
create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  action text not null check (action in ('create', 'update', 'delete')),
  entity_type text not null,
  entity_id uuid not null,
  changes_json jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_profile_id on public.expenses(profile_id);
create index if not exists idx_expenses_category_id on public.expenses(category_id);
create index if not exists idx_expense_splits_expense_id on public.expense_splits(expense_id);
create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_activity_log_created_at on public.activity_log(created_at desc);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.activity_log enable row level security;

-- RLS Policies for profiles
create policy "Users can view their own profiles" on public.profiles
  for select using (auth.uid() = user_id);

create policy "Users can create their own profiles" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own profiles" on public.profiles
  for update using (auth.uid() = user_id);

create policy "Users can delete their own profiles" on public.profiles
  for delete using (auth.uid() = user_id);

-- RLS Policies for categories
create policy "Users can view their own categories" on public.categories
  for select using (auth.uid() = user_id);

create policy "Users can create their own categories" on public.categories
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own categories" on public.categories
  for update using (auth.uid() = user_id);

create policy "Users can delete their own categories" on public.categories
  for delete using (auth.uid() = user_id);

-- RLS Policies for expenses
create policy "Users can view their own expenses" on public.expenses
  for select using (auth.uid() = user_id);

create policy "Users can create their own expenses" on public.expenses
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own expenses" on public.expenses
  for update using (auth.uid() = user_id);

create policy "Users can delete their own expenses" on public.expenses
  for delete using (auth.uid() = user_id);

-- RLS Policies for expense_splits
create policy "Users can view splits for their expenses" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
      and expenses.user_id = auth.uid()
    )
  );

create policy "Users can create splits for their expenses" on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
      and expenses.user_id = auth.uid()
    )
  );

create policy "Users can update splits for their expenses" on public.expense_splits
  for update using (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
      and expenses.user_id = auth.uid()
    )
  );

create policy "Users can delete splits for their expenses" on public.expense_splits
  for delete using (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
      and expenses.user_id = auth.uid()
    )
  );

-- RLS Policies for activity_log
create policy "Users can view their own activity" on public.activity_log
  for select using (auth.uid() = user_id);

create policy "Users can create their own activity" on public.activity_log
  for insert with check (auth.uid() = user_id);

-- Enable Realtime
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.expense_splits;
alter publication supabase_realtime add table public.activity_log;

-- Function to auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for expenses updated_at
create trigger set_updated_at
  before update on public.expenses
  for each row
  execute function public.handle_updated_at();

-- Function to log activity
create or replace function public.log_activity()
returns trigger as $$
begin
  if (TG_OP = 'DELETE') then
    insert into public.activity_log (user_id, action, entity_type, entity_id, changes_json)
    values (auth.uid(), 'delete', TG_TABLE_NAME, old.id, to_jsonb(old));
    return old;
  elsif (TG_OP = 'UPDATE') then
    insert into public.activity_log (user_id, action, entity_type, entity_id, changes_json)
    values (auth.uid(), 'update', TG_TABLE_NAME, new.id, jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
    return new;
  elsif (TG_OP = 'INSERT') then
    insert into public.activity_log (user_id, action, entity_type, entity_id, changes_json)
    values (auth.uid(), 'create', TG_TABLE_NAME, new.id, to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- Triggers for activity logging
create trigger log_profiles_changes
  after insert or update or delete on public.profiles
  for each row execute function public.log_activity();

create trigger log_categories_changes
  after insert or update or delete on public.categories
  for each row execute function public.log_activity();

create trigger log_expenses_changes
  after insert or update or delete on public.expenses
  for each row execute function public.log_activity();

create trigger log_expense_splits_changes
  after insert or update or delete on public.expense_splits
  for each row execute function public.log_activity();
