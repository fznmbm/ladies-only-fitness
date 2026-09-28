-- Part 7: store every WhatsApp number the same way, e.g. +447700900123.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- "07700 900123", "+44 7700 900123" and "00447700900123" are the same phone,
-- but were saved as three different numbers, so the same lady could be added
-- twice. From now on the database tidies every number as it is saved, whichever
-- page saved it, and the "one member per number" rule catches repeats.

-- Same rules as whatsappUrl() in src/lib/phone.ts:
--   +44…  or  0044…  -> kept, with +
--   07…              -> UK, becomes +447…
--   +44 (0)7…        -> the extra 0 is dropped
--   anything else    -> taken to already include its country code
-- Returns null if it can't be a real number (fewer than 8 or more than 15 digits).
create or replace function public.normalize_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p is null then
    return null;
  end if;
  d := regexp_replace(p, '[^0-9+]', '', 'g');
  if d like '+%' then
    d := substr(d, 2);
  elsif d like '00%' then
    d := substr(d, 3);
  elsif d like '0%' then
    d := '44' || substr(d, 2);
  end if;
  d := regexp_replace(d, '[^0-9]', '', 'g');
  -- "+44 (0)7700…" and "+44 07700…": drop the extra 0 after the UK code.
  if d like '440%' then
    d := '44' || substr(d, 4);
  end if;
  if length(d) < 8 or length(d) > 15 then
    return null;
  end if;
  return '+' || d;
end;
$$;

-- Tidy each number as it is saved. A number that can't be tidied is kept as typed,
-- so nothing is ever lost.
create or replace function public.members_tidy_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone := coalesce(public.normalize_phone(nullif(trim(new.phone), '')), nullif(trim(new.phone), ''));
  return new;
end;
$$;

drop trigger if exists members_tidy_phone on members;
create trigger members_tidy_phone
  before insert or update of phone on members
  for each row execute function public.members_tidy_phone();

-- Tidy the numbers already saved. If two members turn out to share a number,
-- neither is changed; they are listed by the query at the bottom instead.
update members m
set phone = public.normalize_phone(m.phone)
where public.normalize_phone(m.phone) is not null
  and m.phone is distinct from public.normalize_phone(m.phone)
  and not exists (
    select 1
    from members o
    where o.id <> m.id
      and public.normalize_phone(o.phone) = public.normalize_phone(m.phone)
  );

-- Anything left to sort out by hand (shows no rows if all is well):
-- the same phone on two members, or a number that doesn't look right.
select
  m.name,
  m.phone,
  m.status,
  case
    when public.normalize_phone(m.phone) is null then 'Number looks wrong, check it'
    else 'Same number as another member, keep one'
  end as problem
from members m
where m.phone is not null
  and (
    public.normalize_phone(m.phone) is null
    or exists (
      select 1 from members o
      where o.id <> m.id
        and public.normalize_phone(o.phone) = public.normalize_phone(m.phone)
    )
  )
order by public.normalize_phone(m.phone), m.name;