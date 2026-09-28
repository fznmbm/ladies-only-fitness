-- Part 10: accounts. Run once in the Supabase SQL editor. Safe to run more than once.
--
--  - "expenses": money going out, like hall hire, the instructor or equipment.
--    A cost can be for one group or shared by all groups, and a bulk payment
--    (say 3 months of hall hire paid at once) can be spread over the months it
--    covers, so each month's profit is right.
--  - Each lady gets her own payment reference (like AMINA-4821) to put on bank
--    transfers, so payments are easy to match up.
--  - accounts_summary(): money in and out, month by month, worked out in the
--    database so it's quick however much history there is.

-- ---------- Costs ----------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete set null,   -- empty = shared by all groups
  category text not null default 'other'
    check (category in ('hall', 'instructor', 'music', 'equipment', 'marketing', 'other')),
  description text,
  amount_pence int not null check (amount_pence > 0),
  paid_on date not null,
  covers_from date not null check (extract(day from covers_from) = 1),
  covers_months int not null default 1 check (covers_months between 1 and 24),
  receipt_path text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists expenses_covers_idx on expenses (covers_from);

alter table expenses enable row level security;
drop policy if exists "staff full access" on expenses;
create policy "staff full access" on expenses for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------- Payment references ----------
alter table members add column if not exists pay_ref text;
create unique index if not exists members_pay_ref_key on members (pay_ref) where pay_ref is not null;

-- First name in capitals (letters only, up to 8) plus 4 random digits, never repeated.
create or replace function public.new_pay_ref(p_name text)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_base text := left(upper(regexp_replace(split_part(trim(coalesce(p_name, '')), ' ', 1), '[^A-Za-z]', '', 'g')), 8);
  v_ref text;
begin
  if v_base = '' then
    v_base := 'MEMBER';
  end if;
  loop
    v_ref := v_base || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from members where pay_ref = v_ref);
  end loop;
  return v_ref;
end;
$$;

create or replace function public.members_set_pay_ref()
returns trigger
language plpgsql
as $$
begin
  if new.pay_ref is null then
    new.pay_ref := public.new_pay_ref(new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists members_set_pay_ref on members;
create trigger members_set_pay_ref
  before insert on members
  for each row execute function public.members_set_pay_ref();

-- Give everyone already in the app a reference.
update members set pay_ref = public.new_pay_ref(name) where pay_ref is null;

-- ---------- Month by month ----------
-- For one group (or every group when p_group_id is empty), for p_months months
-- starting at p_from:
--   plans   = plans paid for that month (confirmed), split into cash and transfer
--   door    = extra cash taken at the door for sessions that month
--   costs   = costs for that month, with bulk payments spread over their months.
--             For one group, only that group's own costs; shared costs are
--             counted in the all-groups view.
create or replace function public.accounts_summary(p_group_id uuid, p_from date, p_months int)
returns table (
  month date,
  plans_pence bigint,
  plans_cash_pence bigint,
  plans_transfer_pence bigint,
  plans_count int,
  door_pence bigint,
  costs_pence bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with months as (
    select (p_from + make_interval(months => i))::date as month
    from generate_series(0, greatest(p_months, 1) - 1) as i
  ),
  plans as (
    select s.month,
           sum(s.price_pence) as total,
           sum(s.price_pence) filter (where s.method = 'cash') as cash,
           sum(s.price_pence) filter (where s.method = 'transfer') as transfer,
           count(*) as n
    from subscriptions s
    where s.status = 'confirmed'
      and (p_group_id is null or s.group_id = p_group_id)
      and s.month >= p_from
      and s.month < p_from + make_interval(months => greatest(p_months, 1))
    group by s.month
  ),
  door as (
    select date_trunc('month', se.session_date)::date as month,
           sum(a.extra_paid_pence) as total
    from attendance a
    join sessions se on se.id = a.session_id
    where a.extra_paid_pence > 0
      and (p_group_id is null or se.group_id = p_group_id)
      and se.session_date >= p_from
      and se.session_date < p_from + make_interval(months => greatest(p_months, 1))
    group by 1
  ),
  costs as (
    select (e.covers_from + make_interval(months => i))::date as month,
           sum(e.amount_pence / e.covers_months
               + case when i = 0 then e.amount_pence % e.covers_months else 0 end) as total
    from expenses e
    cross join lateral generate_series(0, e.covers_months - 1) as i
    where (p_group_id is null or e.group_id = p_group_id)
    group by 1
  )
  select m.month,
         coalesce(p.total, 0)::bigint,
         coalesce(p.cash, 0)::bigint,
         coalesce(p.transfer, 0)::bigint,
         coalesce(p.n, 0)::int,
         coalesce(d.total, 0)::bigint,
         coalesce(c.total, 0)::bigint
  from months m
  left join plans p on p.month = m.month
  left join door d on d.month = m.month
  left join costs c on c.month = m.month
  order by m.month;
$$;
revoke execute on function public.accounts_summary(uuid, date, int) from public;
grant execute on function public.accounts_summary(uuid, date, int) to authenticated;
