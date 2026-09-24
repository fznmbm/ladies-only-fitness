-- Ladies Fitness: database schema
-- Run this once in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- People who can use the organiser side of the app.
create table if not exists staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'organiser' check (role in ('organiser', 'helper'))
);

create or replace function public.is_staff() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

-- Plans the organiser sells. Prices and sessions a week can be edited any time.
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sessions_per_week int not null check (sessions_per_week between 1 and 7),
  price_pence int not null check (price_pence >= 0),
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  status text not null default 'active' check (status in ('pending', 'active', 'inactive')),
  notes text,
  login_token_hash text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists members_login_token_hash_key
  on members (login_token_hash) where login_token_hash is not null;
create unique index if not exists members_phone_key on members (phone) where phone is not null;

-- One paid plan per member per calendar month.
-- sessions_per_week and price_pence are copied from the plan when it is paid,
-- so changing a plan later never changes what someone already paid for.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  plan_id uuid not null references plans(id),
  month date not null check (extract(day from month) = 1),
  sessions_per_week int not null,
  price_pence int not null,
  method text not null check (method in ('cash', 'transfer')),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected')),
  receipt_path text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create unique index if not exists subscriptions_one_per_month
  on subscriptions (member_id, month) where status in ('pending', 'confirmed');

-- The weekly timetable. weekday: 1 = Monday ... 7 = Sunday.
create table if not exists schedule_slots (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 1 and 7),
  start_time time not null,
  title text not null default 'Workout session'
);

-- Actual sessions on actual dates (local UK date and time).
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  start_time time not null,
  title text not null default 'Workout session',
  cancelled boolean not null default false,
  unique (session_date, start_time)
);

-- One row per lady who turned up.
-- flag: why the organiser needs to decide something at the door.
-- resolution: what the organiser decided.
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  flag text check (flag in ('over_plan', 'no_plan')),
  resolution text check (resolution in ('allowed', 'cash', 'pay_later', 'settled')),
  extra_paid_pence int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, member_id)
);
create index if not exists attendance_member_idx on attendance (member_id);

-- Only staff can read or change anything.
alter table staff enable row level security;
alter table plans enable row level security;
alter table members enable row level security;
alter table subscriptions enable row level security;
alter table schedule_slots enable row level security;
alter table sessions enable row level security;
alter table attendance enable row level security;

drop policy if exists "staff read own row" on staff;
create policy "staff read own row" on staff for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['plans','members','subscriptions','schedule_slots','sessions','attendance']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format('create policy "staff full access" on %I for all using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- Starting plans. Change the prices in the app under Settings.
insert into plans (name, sessions_per_week, price_pence, sort)
select * from (values
  ('1 a week', 1, 2500, 1),
  ('3 a week', 3, 3500, 2),
  ('4 a week', 4, 4000, 3)
) as v(name, sessions_per_week, price_pence, sort)
where not exists (select 1 from plans);
