-- 013: payment references become FIRSTNAME-LIVEFIT, e.g. AMINA-LIVEFIT.
-- Two ladies with the same first name: the second gets AMINA2-LIVEFIT, and so on.
-- At most 17 characters, inside the 18 that UK bank references allow.
-- Everyone already in the app gets her new reference. Safe to run more than once.

-- Her first name in capitals, letters only, up to 8. Accents are dropped
-- (Zoë becomes ZOE), since banks don't always accept them.
create or replace function public.pay_ref_base(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(left(upper(regexp_replace(
      translate(
        split_part(trim(coalesce(p_name, '')), ' ', 1),
        'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöøùúûüýÿĞğŞşİı',
        'AAAAAACEEEEIIIINOOOOOOUUUUYaaaaaaceeeeiiiinoooooouuuuyyGgSsIi'
      ),
      '[^A-Za-z]', '', 'g')), 8), ''),
    'MEMBER'
  )
$$;

-- The first free reference for this name. p_id is the lady herself, so her
-- own current reference never counts as taken.
create or replace function public.new_pay_ref(p_name text, p_id uuid)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_base text := public.pay_ref_base(p_name);
  v_ref text := v_base || '-LIVEFIT';
  v_n int := 1;
begin
  loop
    exit when not exists (
      select 1 from members
      where pay_ref = v_ref and (p_id is null or id <> p_id)
    );
    v_n := v_n + 1;
    v_ref := v_base || v_n || '-LIVEFIT';
  end loop;
  return v_ref;
end;
$$;

-- New ladies get one straight away. If her first name is corrected later,
-- her reference follows it.
create or replace function public.members_set_pay_ref()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.pay_ref is null then
      new.pay_ref := public.new_pay_ref(new.name, new.id);
    end if;
  elsif public.pay_ref_base(new.name) <> public.pay_ref_base(old.name)
     or new.pay_ref is null then
    new.pay_ref := public.new_pay_ref(new.name, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists members_set_pay_ref on members;
create trigger members_set_pay_ref
  before insert or update of name, pay_ref on members
  for each row execute function public.members_set_pay_ref();

-- The old version (4 random digits) is no longer used.
drop function if exists public.new_pay_ref(text);

-- Give everyone the new style, longest-standing ladies first, so they get the
-- plain AMINA-LIVEFIT when two share a first name.
do $$
declare
  r record;
begin
  -- Only redo references that aren't in the new style yet.
  update members set pay_ref = 'OLD-' || id::text
  where pay_ref is null or pay_ref not like '%-LIVEFIT';
  for r in
    select id, name from members where pay_ref like 'OLD-%' order by created_at, id
  loop
    update members set pay_ref = public.new_pay_ref(r.name, r.id) where id = r.id;
  end loop;
end;
$$;