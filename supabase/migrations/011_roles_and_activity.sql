-- Part 11: helpers, and a record of who did what.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- Two kinds of staff (the "role" on the staff table):
--   organiser - can do everything.
--   helper    - runs the door: sees sessions and members, marks ladies here,
--               adds walk-ins and takes cash at the door. Can't confirm or remove
--               payments, change prices or the timetable, delete anyone, or see
--               the accounts.
-- The database enforces this, so it holds even if a screen is missed.
--
-- activity_log keeps a record of important changes (payments, deletions,
-- cancellations, costs, staff changes): who, what and when.

create or replace function public.is_organiser() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'organiser')
$$;

-- ---------- Staff can see their own row; organisers see everyone ----------
drop policy if exists "organiser reads staff" on staff;
create policy "organiser reads staff" on staff for select to authenticated
  using ((select public.is_organiser()));

-- ---------- Organiser-only changes ----------
-- Everyone on the staff can read these; only the organiser can change them.
do $$
declare t text;
begin
  foreach t in array array['groups', 'plans', 'schedule_slots', 'sessions', 'rsvps']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format('drop policy if exists "staff read" on %I', t);
    execute format('drop policy if exists "organiser full access" on %I', t);
    execute format(
      'create policy "staff read" on %I for select to authenticated using ((select public.is_staff()))', t);
    execute format(
      'create policy "organiser full access" on %I for all to authenticated '
      'using ((select public.is_organiser())) with check ((select public.is_organiser()))', t);
  end loop;
end $$;

-- ---------- Door work that helpers can do too ----------
-- Members: helpers can add walk-ins; only the organiser edits or deletes.
-- Groups a lady is in: helpers can add walk-ins to a group; only the organiser removes.
-- Payments: helpers can take cash for a plan at the door; only the organiser
-- confirms, rejects or removes payments.
do $$
declare t text;
begin
  foreach t in array array['members', 'member_groups', 'subscriptions']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format('drop policy if exists "staff read" on %I', t);
    execute format('drop policy if exists "staff add" on %I', t);
    execute format('drop policy if exists "organiser full access" on %I', t);
    execute format(
      'create policy "staff read" on %I for select to authenticated using ((select public.is_staff()))', t);
    execute format(
      'create policy "staff add" on %I for insert to authenticated with check ((select public.is_staff()))', t);
    execute format(
      'create policy "organiser full access" on %I for all to authenticated '
      'using ((select public.is_organiser())) with check ((select public.is_organiser()))', t);
  end loop;
end $$;

-- A walk-in who is already in the app gets added to the group ("upsert"),
-- which needs update as well as insert.
drop policy if exists "staff update" on member_groups;
create policy "staff update" on member_groups for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- A walk-in who asked to join but wasn't approved yet becomes active.
drop policy if exists "staff activate walk-in" on members;
create policy "staff activate walk-in" on members for update to authenticated
  using ((select public.is_staff()) and status <> 'active')
  with check ((select public.is_staff()) and status = 'active');

-- Attendance stays open to all staff: that is the register.

-- ---------- Accounts are for the organiser only ----------
drop policy if exists "staff full access" on expenses;
drop policy if exists "organiser full access" on expenses;
create policy "organiser full access" on expenses for all to authenticated
  using ((select public.is_organiser())) with check ((select public.is_organiser()));

-- ---------- Who did what ----------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  staff_name text,
  group_id uuid references groups(id) on delete set null,
  action text not null,
  detail text
);
create index if not exists activity_log_at_idx on activity_log (at desc);

alter table activity_log enable row level security;
drop policy if exists "staff write" on activity_log;
drop policy if exists "organiser reads" on activity_log;
create policy "staff write" on activity_log for insert to authenticated
  with check ((select public.is_staff()) and user_id = (select auth.uid()));
create policy "organiser reads" on activity_log for select to authenticated
  using ((select public.is_organiser()));
