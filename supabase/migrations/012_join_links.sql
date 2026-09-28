-- 012: short join links (e.g. /join/livefitclub-7a3f) and the LiveFit Club name.
-- Safe to run more than once.

-- The old group name from before the app became LiveFit.
update public.groups set name = 'LiveFit Club' where name = 'Ladies Fitness';

-- Each group's short join link: its name in small letters plus 4 random
-- characters, so it can't be guessed. A new one can be made in Settings.
alter table public.groups add column if not exists join_slug text;
create unique index if not exists groups_join_slug_key on public.groups (join_slug);

create or replace function public.fill_join_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base text;
  candidate text;
begin
  if new.join_slug is not null and new.join_slug <> '' then
    return new;
  end if;
  base := left(regexp_replace(lower(coalesce(new.name, '')), '[^a-z0-9]+', '', 'g'), 16);
  if base = '' then
    base := 'join';
  end if;
  loop
    candidate := base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    exit when not exists (select 1 from public.groups where join_slug = candidate);
  end loop;
  new.join_slug := candidate;
  return new;
end;
$$;

drop trigger if exists groups_join_slug on public.groups;
create trigger groups_join_slug
  before insert or update of join_slug on public.groups
  for each row execute function public.fill_join_slug();

-- Give the existing groups their link.
update public.groups set join_slug = null where join_slug is null;