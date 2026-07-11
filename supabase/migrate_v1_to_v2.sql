-- ============================================================================
-- MIGRATION: v1 (fake profiles) -> v2 (real users + groups + settlements)
-- ============================================================================
-- Run this on your EXISTING Supabase project, in this order:
--   1. This file, Part A  (archives old tables — nothing is deleted)
--   2. schema.sql          (creates the new v2 tables/policies/functions)
--   3. This file, Part B  (bootstraps a default group per user, optionally
--                          imports old expense history)
--
-- Nothing here drops data. Old tables are renamed with a `_v1_archive`
-- suffix so you can inspect or roll back manually at any time.
-- ============================================================================


-- ============================================================================
-- PART A — run BEFORE schema.sql
-- ============================================================================
begin;

alter table if exists public.profiles rename to profiles_v1_archive;
alter table if exists public.categories rename to categories_v1_archive;
alter table if exists public.expenses rename to expenses_v1_archive;
alter table if exists public.expense_splits rename to expense_splits_v1_archive;
alter table if exists public.activity_log rename to activity_log_v1_archive;

-- Old RLS policies/triggers on these tables travel with the rename and stay
-- harmless — they just won't be hit by the app anymore since it only talks
-- to the new (unsuffixed) table names.

commit;

-- Now run schema.sql in full before continuing to Part B.


-- ============================================================================
-- PART B — run AFTER schema.sql
-- ============================================================================

-- B1. Ensure every existing auth user has a public.users row and their own
--     default group (owner), so the app has somewhere to put things.
--     Safe to re-run: the group insert is guarded per-user.
do $$
declare
  u record;
  g_id uuid;
  existing_group uuid;
begin
  for u in
    select id, email, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)) as name
    from auth.users
  loop
    insert into public.users (id, email, name)
    values (u.id, u.email, u.name)
    on conflict (id) do nothing;

    select gm.group_id into existing_group
    from public.group_members gm
    where gm.user_id = u.id
    limit 1;

    if existing_group is null then
      insert into public.groups (name, created_by) values ('My Group', u.id)
      returning id into g_id;

      insert into public.group_members (group_id, user_id, role)
      values (g_id, u.id, 'owner');
    end if;
  end loop;
end $$;

-- B2. OPTIONAL — import old categories into each user's new default group.
--     Comment this out if you'd rather recreate categories by hand.
insert into public.categories (group_id, name, color, default_split_type, created_at)
select
  gm.group_id,
  c.name,
  c.color,
  c.default_split_type,
  c.created_at
from public.categories_v1_archive c
join public.group_members gm on gm.user_id = c.user_id and gm.role = 'owner';

-- B3. OPTIONAL — import old expense history into each user's new default
--     group. Because v1 "profiles" weren't real accounts, this attributes
--     every historical expense entirely to the real user who owned the
--     data (paid_by = them, one split row = 100% of the amount to them).
--     That preserves totals/history for reference; it does NOT recreate
--     debts against fake profiles, since there's no real account to owe.
--     Comment this whole block out if you'd rather start expense history
--     clean.
with inserted as (
  insert into public.expenses (group_id, paid_by, category_id, description, amount, date, created_by, created_at, updated_at)
  select
    gm.group_id,
    e.user_id,
    nc.id,
    e.description,
    e.amount,
    e.date,
    e.user_id,
    e.created_at,
    e.updated_at
  from public.expenses_v1_archive e
  join public.group_members gm on gm.user_id = e.user_id and gm.role = 'owner'
  left join public.categories_v1_archive oc on oc.id = e.category_id
  left join public.categories nc on nc.group_id = gm.group_id and nc.name = oc.name
  returning id, group_id, paid_by, amount
)
insert into public.expense_splits (expense_id, user_id, amount)
select id, paid_by, amount from inserted;

-- ============================================================================
-- Once you've confirmed the new app works and the data looks right, you can
-- drop the archive tables whenever you're ready:
--   drop table public.profiles_v1_archive cascade;
--   drop table public.categories_v1_archive cascade;
--   drop table public.expenses_v1_archive cascade;
--   drop table public.expense_splits_v1_archive cascade;
--   drop table public.activity_log_v1_archive cascade;
-- ============================================================================
