-- Part 2: the ladies' side. Run once in the Supabase SQL editor.
-- Safe to run more than once.

alter table members add column if not exists login_token_hash text;
alter table members add column if not exists approved_at timestamptz;
create unique index if not exists members_login_token_hash_key
  on members (login_token_hash) where login_token_hash is not null;
