# Migrating from v1 (fake profiles) to v2 (real users + groups)

Use `migrate_v1_to_v2.sql` to migrate your existing Supabase project in
place — it's non-destructive (old tables get renamed with a `_v1_archive`
suffix, nothing is dropped). Run it in three steps, in this order, in the
Supabase SQL editor:

1. **`migrate_v1_to_v2.sql` — Part A.** Renames the old `profiles`,
   `categories`, `expenses`, `expense_splits`, and `activity_log` tables out
   of the way so the new schema can use those names.
2. **`schema.sql`** in full. Creates the new v2 tables, RLS policies, and
   functions.
3. **`migrate_v1_to_v2.sql` — Part B.** Creates a `public.users` row and a
   default "My Group" (as owner) for every existing account, and optionally
   copies your old categories and expense history into that group.

**Important limitation:** v1 "profiles" were just labels you made up
("Partner", "Roommate") with no real login behind them — there's no
automatic way to turn a label into a real authenticated account. So the
historical-expense import (Part B, step 3) attributes every past expense
entirely to the real account that owned the data — it does not reconstruct
who-owed-who between fake profiles, because there's no real account on the
other end to owe anything. It's there so your spending history/totals
aren't lost, not to recreate old debts.

Once your other real participants sign up and you invite them into a group
via the app, everything going forward works as real multi-user splits.

If you'd rather not carry old data at all, skip Part B steps 2–3 and just
re-enter things by hand once everyone's in a group — sometimes that's less
work than untangling old fake-profile history anyway.
