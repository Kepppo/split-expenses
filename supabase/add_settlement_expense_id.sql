-- Migration: add expense_id to settlements
-- Run this in the Supabase SQL editor if you have an existing database

alter table if exists public.settlements
  add column if not exists expense_id uuid references public.expenses(id) on delete set null;

create index if not exists idx_settlements_expense_id on public.settlements(expense_id);
