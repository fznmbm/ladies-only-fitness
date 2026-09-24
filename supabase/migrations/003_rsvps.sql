-- Part 3: "I'm coming / Can't make it". Run once in the Supabase SQL editor.
-- Safe to run more than once.

create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  coming boolean not null,
  created_at timestamptz not null default now(),
  unique (session_id, member_id)
);

alter table rsvps enable row level security;

drop policy if exists "staff full access" on rsvps;
create policy "staff full access" on rsvps for all
  using (public.is_staff()) with check (public.is_staff());

-- Ladies write their own RSVP through the server using the service role key,
-- the same way join requests work, so no member-facing policy is needed here.