-- Supabase SQL Migration (v2 — real users + groups + settlements)
-- Run this in the Supabase SQL Editor on a FRESH project.
-- If you have an existing v1 project with data in it, see supabase/migration_v1_to_v2.sql instead.

create extension if not exists "uuid-ossp";

-- =========================================================================
-- USERS  (mirrors auth.users so we can join/display names from the client,
-- and so other members can "see" who's in their group)
-- =========================================================================
create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Auto-create a public.users row whenever someone signs up
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =========================================================================
-- GROUPS  (a group is the real-user equivalent of what "profiles" used to
-- fake — a household, a trip, a pair of roommates, etc.)
-- =========================================================================
create table if not exists public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  currency text not null default 'USD' check (currency in ('USD','EUR','GBP','JPY','MXN','INR','AUD','CAD','CHF','SEK','BRL','TRY')),
  created_by uuid references public.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (group_id, user_id)
);

-- Invites let you add someone who already has an account (or will sign up)
-- by email, without needing their user id up front.
create table if not exists public.group_invites (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  email text not null,
  invited_by uuid references public.users not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (group_id, email)
);

-- =========================================================================
-- CATEGORIES  (now shared per-group instead of per-owner)
-- =========================================================================
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  name text not null,
  color text not null default '#3B82F6',
  default_split_type text not null default 'equal' check (default_split_type in ('equal', 'percentage', 'fixed', 'custom')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- EXPENSES  (paid_by is now a REAL user, not a fake profile)
-- =========================================================================
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.users(id) not null,
  category_id uuid references public.categories(id),
  description text not null,
  amount numeric not null check (amount > 0),
  date date not null,
  created_by uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.expense_splits (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  amount numeric not null check (amount >= 0),
  percentage numeric check (percentage >= 0 and percentage <= 100),
  share_value numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (expense_id, user_id)
);

-- =========================================================================
-- SETTLEMENTS  (recording "I paid you back") — the new piece
-- =========================================================================
create table if not exists public.settlements (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.users(id) not null,
  paid_to uuid references public.users(id) not null,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  note text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_by uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  check (paid_by <> paid_to)
);

-- =========================================================================
-- ACTIVITY LOG  (now keyed by group + actor rather than a single owner)
-- =========================================================================
create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  actor_id uuid references public.users(id) not null,
  action text not null check (action in ('create', 'update', 'delete')),
  entity_type text not null,
  entity_id uuid not null,
  changes_json jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- INDEXES
-- =========================================================================
create index if not exists idx_group_members_group_id on public.group_members(group_id);
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_group_invites_group_id on public.group_invites(group_id);
create index if not exists idx_group_invites_email on public.group_invites(email);
create index if not exists idx_categories_group_id on public.categories(group_id);
create index if not exists idx_expenses_group_id on public.expenses(group_id);
create index if not exists idx_expenses_paid_by on public.expenses(paid_by);
create index if not exists idx_expenses_category_id on public.expenses(category_id);
create index if not exists idx_expense_splits_expense_id on public.expense_splits(expense_id);
create index if not exists idx_expense_splits_user_id on public.expense_splits(user_id);
create index if not exists idx_settlements_group_id on public.settlements(group_id);
create index if not exists idx_settlements_paid_by on public.settlements(paid_by);
create index if not exists idx_settlements_paid_to on public.settlements(paid_to);
create index if not exists idx_activity_log_group_id on public.activity_log(group_id);
create index if not exists idx_activity_log_created_at on public.activity_log(created_at desc);

-- =========================================================================
-- HELPER FUNCTIONS (security definer so RLS policies that call them don't
-- recurse into the RLS of the table they query)
-- =========================================================================
create or replace function public.is_group_member(_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.expense_group_id(_expense_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select group_id from public.expenses where id = _expense_id;
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_log enable row level security;

-- ---- users --------------------------------------------------------------
-- You can see yourself, and anyone who shares at least one group with you.
create policy "Users can view themselves and groupmates" on public.users
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = users.id
    )
  );

create policy "Users can update their own row" on public.users
  for update using (id = auth.uid());

-- ---- groups ---------------------------------------------------------------
-- `or created_by = auth.uid()` matters: right after INSERT, PostgREST needs
-- to SELECT the new row back to return it to the client, but the creator
-- isn't a group_members row yet (that insert happens next, client-side) —
-- without this clause, is_group_member() alone would reject that read-back
-- and the insert would surface as an RLS error even though it succeeded.
create policy "Members can view their groups" on public.groups
  for select using (public.is_group_member(id) or created_by = auth.uid());

create policy "Any authenticated user can create a group" on public.groups
  for insert with check (created_by = auth.uid());

create policy "Owners can update their group" on public.groups
  for update using (public.is_group_owner(id));

create policy "Owners can delete their group" on public.groups
  for delete using (public.is_group_owner(id));

-- ---- group_members --------------------------------------------------------
create policy "Members can view group membership" on public.group_members
  for select using (public.is_group_member(group_id));

-- Inserting yourself as a member is only allowed via the accept-invite RPC
-- (security definer, see below) or when creating a group (owner row).
create policy "Owners can add members directly" on public.group_members
  for insert with check (public.is_group_owner(group_id) or user_id = auth.uid());

create policy "Owners can remove members" on public.group_members
  for delete using (public.is_group_owner(group_id) or user_id = auth.uid());

-- ---- group_invites ----------------------------------------------------
create policy "Members can view invites for their group" on public.group_invites
  for select using (
    public.is_group_member(group_id)
    or email = (select email from public.users where id = auth.uid())
  );

create policy "Members can create invites" on public.group_invites
  for insert with check (public.is_group_member(group_id) and invited_by = auth.uid());

create policy "Invited user or a member can update invite status" on public.group_invites
  for update using (
    public.is_group_member(group_id)
    or email = (select email from public.users where id = auth.uid())
  );

create policy "Members can delete invites" on public.group_invites
  for delete using (public.is_group_member(group_id));

-- ---- categories ---------------------------------------------------------
create policy "Members can view group categories" on public.categories
  for select using (public.is_group_member(group_id));

create policy "Members can create group categories" on public.categories
  for insert with check (public.is_group_member(group_id));

create policy "Members can update group categories" on public.categories
  for update using (public.is_group_member(group_id));

create policy "Members can delete group categories" on public.categories
  for delete using (public.is_group_member(group_id));

-- ---- expenses -------------------------------------------------------------
create policy "Members can view group expenses" on public.expenses
  for select using (public.is_group_member(group_id));

create policy "Members can create group expenses" on public.expenses
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy "Members can update group expenses" on public.expenses
  for update using (public.is_group_member(group_id));

create policy "Members can delete group expenses" on public.expenses
  for delete using (public.is_group_member(group_id));

-- ---- expense_splits ---------------------------------------------------
create policy "Members can view splits for group expenses" on public.expense_splits
  for select using (public.is_group_member(public.expense_group_id(expense_id)));

create policy "Members can create splits for group expenses" on public.expense_splits
  for insert with check (public.is_group_member(public.expense_group_id(expense_id)));

create policy "Members can update splits for group expenses" on public.expense_splits
  for update using (public.is_group_member(public.expense_group_id(expense_id)));

create policy "Members can delete splits for group expenses" on public.expense_splits
  for delete using (public.is_group_member(public.expense_group_id(expense_id)));

-- ---- settlements ------------------------------------------------------
create policy "Members can view group settlements" on public.settlements
  for select using (public.is_group_member(group_id));

create policy "Members can record a settlement" on public.settlements
  for insert with check (
    public.is_group_member(group_id)
    and created_by = auth.uid()
    and (paid_by = auth.uid() or paid_to = auth.uid())
  );

create policy "Involved parties can delete a settlement" on public.settlements
  for delete using (paid_by = auth.uid() or paid_to = auth.uid() or public.is_group_owner(group_id));

-- ---- activity_log -------------------------------------------------------
create policy "Members can view group activity" on public.activity_log
  for select using (group_id is null or public.is_group_member(group_id));

create policy "Members can write group activity" on public.activity_log
  for insert with check (actor_id = auth.uid());

-- =========================================================================
-- RPC: accept a group invite (bypasses the "owner-only insert" restriction
-- on group_members, safely, since it only ever inserts the CALLER)
-- =========================================================================
create or replace function public.accept_group_invite(_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _group_id uuid;
  _email text;
  _caller_email text;
begin
  select group_id, email into _group_id, _email
  from public.group_invites
  where id = _invite_id and status = 'pending';

  if _group_id is null then
    raise exception 'Invite not found or already handled';
  end if;

  select email into _caller_email from public.users where id = auth.uid();

  if _caller_email is distinct from _email then
    raise exception 'This invite was not sent to your account';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  update public.group_invites set status = 'accepted' where id = _invite_id;
end;
$$;

-- =========================================================================
-- REALTIME
-- =========================================================================
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.group_invites;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.expense_splits;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.activity_log;

-- =========================================================================
-- TRIGGERS: updated_at + activity log
-- =========================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.expenses
  for each row
  execute function public.handle_updated_at();

create or replace function public.log_activity()
returns trigger as $$
declare
  _group_id uuid;
begin
  -- Resolve the owning group from the row type that this trigger is firing on.
  -- Access expense_id ONLY inside the expense_splits branch, otherwise the
  -- record field reference fails on tables that don't have that column
  -- (e.g. categories), producing "record new has no field expense_id".
  if TG_TABLE_NAME = 'expense_splits' then
    if (TG_OP = 'DELETE') then
      _group_id := public.expense_group_id(old.expense_id);
    else
      _group_id := public.expense_group_id(new.expense_id);
    end if;
  else
    if (TG_OP = 'DELETE') then
      _group_id := old.group_id;
    else
      _group_id := new.group_id;
    end if;
  end if;

  if (TG_OP = 'DELETE') then
    insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, changes_json)
    values (_group_id, auth.uid(), 'delete', TG_TABLE_NAME, old.id, to_jsonb(old));
    return old;
  elsif (TG_OP = 'UPDATE') then
    insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, changes_json)
    values (_group_id, auth.uid(), 'update', TG_TABLE_NAME, new.id, jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
    return new;
  elsif (TG_OP = 'INSERT') then
    insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, changes_json)
    values (_group_id, auth.uid(), 'create', TG_TABLE_NAME, new.id, to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger log_expenses_changes
  after insert or update or delete on public.expenses
  for each row execute function public.log_activity();

create trigger log_settlements_changes
  after insert or update or delete on public.settlements
  for each row execute function public.log_activity();

create trigger log_categories_changes
  after insert or update or delete on public.categories
  for each row execute function public.log_activity();
