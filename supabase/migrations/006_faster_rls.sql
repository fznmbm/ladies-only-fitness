-- Part 6: make the security rules cheaper to check.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- Every table only lets staff in. Written as "is_staff()", Postgres re-checks that
-- for every single row it reads. Wrapped as "(select is_staff())" it checks once
-- per query. Same rules, same protection, much less work. This is Supabase's own
-- advice for row level security.

drop policy if exists "staff read own row" on staff;
create policy "staff read own row" on staff
  for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['plans','members','subscriptions','schedule_slots','sessions','attendance','rsvps']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format(
      'create policy "staff full access" on %I for all to authenticated '
      'using ((select public.is_staff())) with check ((select public.is_staff()))',
      t
    );
  end loop;
end $$;