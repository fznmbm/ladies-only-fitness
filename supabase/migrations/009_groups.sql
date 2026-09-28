-- Part 9: several groups in one app, and sessions that remember their timetable slot.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- What changes:
--  - A new "groups" table. Everything you already have moves into the first group,
--    so nothing is lost. Rename it in Settings.
--  - Each lady can belong to one or more groups (member_groups). Joining a group
--    is approved per group.
--  - Plans, the weekly timetable, sessions and payments each belong to a group.
--    Prices can differ between groups, and a plan's weekly allowance only counts
--    sessions in its own group.
--  - Each session remembers the timetable slot and the date it was made for.
--    Moving or cancelling one session sticks: the nightly job never recreates it.
--  - A cancelled session can carry a reason, shown to the ladies.

-- ---------- Groups ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into groups (name, sort)
select 'Ladies Fitness', 1
where not exists (select 1 from groups);

-- The group that existing data moves into: the first one ever made.
create or replace function public.first_group_id() returns uuid
language sql stable set search_path = public as $$
  select id from groups order by sort, created_at limit 1
$$;

-- ---------- Who is in which group ----------
create table if not exists member_groups (
  member_id uuid not null references members(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  primary key (member_id, group_id)
);
create index if not exists member_groups_group_idx on member_groups (group_id, status);

insert into member_groups (member_id, group_id, status)
select m.id, public.first_group_id(),
       case when m.status = 'pending' then 'pending' else 'active' end
from members m
on conflict (member_id, group_id) do nothing;

-- ---------- Plans, timetable, sessions and payments belong to a group ----------
alter table plans add column if not exists group_id uuid references groups(id) on delete cascade;
update plans set group_id = public.first_group_id() where group_id is null;
alter table plans alter column group_id set not null;

alter table schedule_slots add column if not exists group_id uuid references groups(id) on delete cascade;
update schedule_slots set group_id = public.first_group_id() where group_id is null;
alter table schedule_slots alter column group_id set not null;

alter table sessions add column if not exists group_id uuid references groups(id) on delete cascade;
alter table sessions add column if not exists slot_id uuid references schedule_slots(id) on delete set null;
alter table sessions add column if not exists slot_date date;
alter table sessions add column if not exists cancel_reason text;
update sessions set group_id = public.first_group_id() where group_id is null;
alter table sessions alter column group_id set not null;

alter table subscriptions add column if not exists group_id uuid references groups(id) on delete cascade;
update subscriptions set group_id = public.first_group_id() where group_id is null;
alter table subscriptions alter column group_id set not null;

-- Link sessions already made to the timetable slot they came from
-- (same group, same weekday, same time).
update sessions s
set slot_id = sl.id, slot_date = s.session_date
from schedule_slots sl
where s.slot_id is null
  and sl.group_id = s.group_id
  and sl.weekday = extract(isodow from s.session_date)::int
  and sl.start_time = s.start_time
  and not exists (
    select 1 from sessions o where o.slot_id = sl.id and o.slot_date = s.session_date
  );

-- ---------- Rules that stop duplicates ----------
-- A group can't have two live sessions at the same date and time. A cancelled one
-- doesn't count, so a replacement can be added at the same time.
alter table sessions drop constraint if exists sessions_session_date_start_time_key;
drop index if exists sessions_group_date_time;
create unique index sessions_group_date_time
  on sessions (group_id, session_date, start_time) where not cancelled;

-- Each timetable slot makes at most one session per date, even if that session
-- is later moved or cancelled.
alter table sessions drop constraint if exists sessions_slot_occurrence;
alter table sessions add constraint sessions_slot_occurrence unique (slot_id, slot_date);

create index if not exists sessions_group_date_idx on sessions (group_id, session_date);

-- One plan per lady, per group, per month.
drop index if exists subscriptions_one_per_month;
create unique index subscriptions_one_per_month
  on subscriptions (member_id, group_id, month) where status in ('pending', 'confirmed');
create index if not exists subscriptions_group_month_idx on subscriptions (group_id, month);

-- ---------- Security: staff only, same as every other table ----------
alter table groups enable row level security;
alter table member_groups enable row level security;
do $$
declare t text;
begin
  foreach t in array array['groups', 'member_groups']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format(
      'create policy "staff full access" on %I for all to authenticated '
      'using ((select public.is_staff())) with check ((select public.is_staff()))',
      t
    );
  end loop;
end $$;

-- ---------- Creating sessions from the timetable ----------
-- Makes this week's and the coming weeks' sessions for every active group.
-- Skips any that already exist, including ones moved or cancelled, and any that
-- would clash with a session already at that date and time.
create or replace function public.ensure_sessions(p_weeks int default 3)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_monday date := v_today - (extract(isodow from v_today)::int - 1);
  v_added int;
begin
  insert into sessions (group_id, slot_id, slot_date, session_date, start_time, title)
  select sl.group_id, sl.id, d.day, d.day, sl.start_time, sl.title
  from schedule_slots sl
  join groups g on g.id = sl.group_id and g.active
  cross join generate_series(0, greatest(p_weeks, 1) - 1) as w(n)
  cross join lateral (select (v_monday + w.n * 7 + (sl.weekday - 1))::date as day) d
  where d.day >= v_today
  on conflict do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end;
$$;
revoke execute on function public.ensure_sessions(int) from public;
grant execute on function public.ensure_sessions(int) to authenticated, service_role;

-- ---------- "Here" at the door, now counting only the session's own group ----------
create or replace function public.toggle_here(p_session_id uuid, p_member_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing attendance%rowtype;
  v_date date;
  v_cancelled boolean;
  v_group uuid;
  v_week_start date;
  v_allowance int;
  v_used int;
  v_flag text;
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;

  -- Already marked here? Then this tap takes it back,
  -- unless cash was taken for this visit.
  select * into v_existing
  from attendance
  where session_id = p_session_id and member_id = p_member_id
  for update;

  if found then
    if v_existing.extra_paid_pence > 0 then
      return 'has_payment';
    end if;
    delete from attendance where id = v_existing.id;
    return 'removed';
  end if;

  select session_date, cancelled, group_id into v_date, v_cancelled, v_group
  from sessions where id = p_session_id;
  if v_date is null then
    raise exception 'Session not found';
  end if;
  if v_cancelled then
    raise exception 'This session is cancelled';
  end if;
  if v_date > (now() at time zone 'Europe/London')::date then
    raise exception 'This session hasn''t happened yet';
  end if;

  -- Monday of that week (weeks run Monday to Sunday).
  v_week_start := v_date - (extract(isodow from v_date)::int - 1);

  -- Her plan in this group for the calendar month of this session.
  select sessions_per_week into v_allowance
  from subscriptions
  where member_id = p_member_id
    and group_id = v_group
    and month = date_trunc('month', v_date)::date
    and status in ('pending', 'confirmed')
  limit 1;

  if v_allowance is null then
    v_flag := 'no_plan';
  else
    -- Other sessions of this group she has already come to this week.
    select count(*) into v_used
    from attendance a
    join sessions s on s.id = a.session_id
    where a.member_id = p_member_id
      and a.session_id <> p_session_id
      and s.group_id = v_group
      and s.session_date between v_week_start and v_week_start + 6;

    if v_used >= v_allowance then
      v_flag := 'over_plan';
    end if;
  end if;

  -- If a second tap got here first, quietly do nothing instead of failing.
  insert into attendance (session_id, member_id, flag)
  values (p_session_id, p_member_id, v_flag)
  on conflict (session_id, member_id) do nothing;

  return 'added';
end;
$$;
revoke execute on function public.toggle_here(uuid, uuid) from public;
grant execute on function public.toggle_here(uuid, uuid) to authenticated;

-- ---------- Members page figures, for one group ----------
drop function if exists public.member_activity(date);
create or replace function public.member_activity(p_group_id uuid, p_today date)
returns table (member_id uuid, last_came date, owes int, recent boolean)
language sql
stable
security invoker
set search_path = public
as $$
  with last3 as (
    select id
    from sessions
    where group_id = p_group_id and session_date <= p_today and not cancelled
    order by session_date desc, start_time desc
    limit 3
  )
  select
    a.member_id,
    max(s.session_date) filter (where s.session_date <= p_today) as last_came,
    (count(*) filter (where a.resolution = 'pay_later'))::int as owes,
    bool_or(a.session_id in (select id from last3)) as recent
  from attendance a
  join sessions s on s.id = a.session_id
  where s.group_id = p_group_id
  group by a.member_id;
$$;
revoke execute on function public.member_activity(uuid, date) from public;
grant execute on function public.member_activity(uuid, date) to authenticated;

-- ---------- Changing the weekly timetable ----------
-- Removing a weekly session also removes its upcoming sessions (today onwards)
-- that nobody has been marked at yet. Anything already attended is kept, and so
-- is any session you moved by hand to another day or time.
-- Returns how many upcoming sessions were removed.
create or replace function public.remove_slot(p_slot_id uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_removed int;
begin
  delete from sessions s
  using schedule_slots sl
  where sl.id = p_slot_id
    and s.slot_id = sl.id
    and s.session_date >= (now() at time zone 'Europe/London')::date
    and s.session_date = s.slot_date          -- not moved by hand
    and s.start_time = sl.start_time          -- not moved by hand
    and not exists (select 1 from attendance a where a.session_id = s.id);
  get diagnostics v_removed = row_count;
  delete from schedule_slots where id = p_slot_id;
  return v_removed;
end;
$$;
revoke execute on function public.remove_slot(uuid) from public;
grant execute on function public.remove_slot(uuid) to authenticated;

-- Changing a weekly session's day, time or name. Its upcoming sessions that
-- nobody has been marked at yet follow the change. If the day or time moved,
-- they are made again at the new day and time (so "I'm coming" answers are
-- cleared, since they were for the old time). A name-only change keeps them.
-- Sessions you moved by hand are left alone.
-- Returns how many upcoming sessions changed.
create or replace function public.update_slot(
  p_slot_id uuid, p_weekday int, p_start_time time, p_title text
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old schedule_slots%rowtype;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_changed int := 0;
begin
  select * into v_old from schedule_slots where id = p_slot_id;
  if not found then
    raise exception 'Timetable entry not found';
  end if;

  update schedule_slots
  set weekday = p_weekday, start_time = p_start_time, title = p_title
  where id = p_slot_id;

  if v_old.weekday <> p_weekday or v_old.start_time <> p_start_time then
    delete from sessions s
    where s.slot_id = p_slot_id
      and s.session_date >= v_today
      and s.session_date = s.slot_date          -- not moved by hand
      and s.start_time = v_old.start_time       -- not moved by hand
      and not s.cancelled
      and not exists (select 1 from attendance a where a.session_id = s.id);
    get diagnostics v_changed = row_count;
    perform public.ensure_sessions(3);
  elsif v_old.title <> p_title then
    update sessions s
    set title = p_title
    where s.slot_id = p_slot_id
      and s.session_date >= v_today
      and s.title = v_old.title;
    get diagnostics v_changed = row_count;
  end if;
  return v_changed;
end;
$$;
revoke execute on function public.update_slot(uuid, int, time, text) from public;
grant execute on function public.update_slot(uuid, int, time, text) to authenticated;
