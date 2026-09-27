-- Part 5: member activity for the Members page, worked out in the database.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- The Members page used to download every visit from the last 90 days and add
-- them up itself. Supabase only sends 1,000 rows at a time, so once the group
-- passed that, "Last came", "Owes" and "Not seen lately" quietly went wrong.
-- This sends back just one short line per lady instead.

create or replace function public.member_activity(p_today date)
returns table (member_id uuid, last_came date, owes int, recent boolean)
language sql
stable
security invoker
set search_path = public
as $$
  with last3 as (
    select id
    from sessions
    where session_date <= p_today and not cancelled
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
  group by a.member_id;
$$;

revoke execute on function public.member_activity(date) from public;
grant execute on function public.member_activity(date) to authenticated;