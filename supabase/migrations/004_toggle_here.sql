-- Part 4: marking a lady "Here" in one quick, safe step.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- Tapping "Here" used to take about six separate trips to the database.
-- This does the whole job in one call, inside the database, so it is fast
-- and two quick taps can't clash with each other.
--
-- Returns:
--   'added'        she is now marked here (with a flag if she needs a decision)
--   'removed'      she was marked here, and now isn't
--   'has_payment'  she paid cash for this visit, so it was NOT removed

create or replace function public.toggle_here(p_session_id uuid, p_member_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing attendance%rowtype;
  v_date date;
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

  select session_date into v_date from sessions where id = p_session_id;
  if v_date is null then
    raise exception 'Session not found';
  end if;

  -- Monday of that week (weeks run Monday to Sunday).
  v_week_start := v_date - (extract(isodow from v_date)::int - 1);

  -- Her plan for the calendar month of this session.
  select sessions_per_week into v_allowance
  from subscriptions
  where member_id = p_member_id
    and month = date_trunc('month', v_date)::date
    and status in ('pending', 'confirmed')
  limit 1;

  if v_allowance is null then
    v_flag := 'no_plan';
  else
    -- Other sessions she has already come to this week.
    select count(*) into v_used
    from attendance a
    join sessions s on s.id = a.session_id
    where a.member_id = p_member_id
      and a.session_id <> p_session_id
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