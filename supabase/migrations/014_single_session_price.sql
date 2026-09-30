-- 014: a price for one session on its own (a drop-in), per group.
-- Used at the door when a lady has no plan and only wants to pay for today.
-- Empty means not set yet: the organiser types the amount at the door instead.
-- Safe to run more than once.
alter table public.groups
  add column if not exists dropin_pence int
  check (dropin_pence is null or dropin_pence >= 0);