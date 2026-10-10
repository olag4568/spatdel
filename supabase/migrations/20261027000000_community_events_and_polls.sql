-- SPATDEL Community Hub: events, polls, and one vote per member.
create table if not exists public.spatdel_community_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  location text not null default '' check (char_length(location) <= 250),
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.spatdel_community_polls (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 5 and 300),
  options text[] not null check (array_length(options, 1) between 2 and 6),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.spatdel_community_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.spatdel_community_polls(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index >= 0 and option_index <= 5),
  created_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

alter table public.spatdel_community_events enable row level security;
alter table public.spatdel_community_polls enable row level security;
alter table public.spatdel_community_poll_votes enable row level security;

drop policy if exists "Signed-in members can view community events" on public.spatdel_community_events;
create policy "Signed-in members can view community events" on public.spatdel_community_events for select to authenticated using (true);
drop policy if exists "Members can create community events" on public.spatdel_community_events;
create policy "Members can create community events" on public.spatdel_community_events for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists "Creators can update their own community events" on public.spatdel_community_events;
create policy "Creators can update their own community events" on public.spatdel_community_events for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
drop policy if exists "Creators can delete their own community events" on public.spatdel_community_events;
create policy "Creators can delete their own community events" on public.spatdel_community_events for delete to authenticated using (creator_id = auth.uid());

drop policy if exists "Signed-in members can view community polls" on public.spatdel_community_polls;
create policy "Signed-in members can view community polls" on public.spatdel_community_polls for select to authenticated using (true);
drop policy if exists "Members can create community polls" on public.spatdel_community_polls;
create policy "Members can create community polls" on public.spatdel_community_polls for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists "Creators can update their own community polls" on public.spatdel_community_polls;
create policy "Creators can update their own community polls" on public.spatdel_community_polls for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
drop policy if exists "Creators can delete their own community polls" on public.spatdel_community_polls;
create policy "Creators can delete their own community polls" on public.spatdel_community_polls for delete to authenticated using (creator_id = auth.uid());

drop policy if exists "Members can view poll votes" on public.spatdel_community_poll_votes;
create policy "Members can view poll votes" on public.spatdel_community_poll_votes for select to authenticated using (true);
drop policy if exists "Members can vote once in community polls" on public.spatdel_community_poll_votes;
create policy "Members can vote once in community polls" on public.spatdel_community_poll_votes for insert to authenticated with check (
  voter_id = auth.uid()
  and exists (
    select 1 from public.spatdel_community_polls p
    where p.id = poll_id
      and (p.closes_at is null or p.closes_at > now())
      and option_index < array_length(p.options, 1)
  )
);
grant select, insert, update, delete on public.spatdel_community_events to authenticated;
grant select, insert, update, delete on public.spatdel_community_polls to authenticated;
grant select, insert on public.spatdel_community_poll_votes to authenticated;
