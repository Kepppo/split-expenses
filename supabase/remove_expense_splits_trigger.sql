-- Migration: remove expense_splits activity logging
-- Run this in the Supabase SQL editor if you have an existing database
-- This removes the noisy expense_splits trigger that clutters the activity feed

drop trigger if exists log_expense_splits_changes on public.expense_splits;
