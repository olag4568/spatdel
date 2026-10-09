-- SPATDEL Community Pulse: posts, comments, live room messages, and reports.
create table if not exists public.spatdel_community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create table if not exists public.spatdel_community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.spatdel_community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);

create table if not exists public.spatdel_community_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.spatdel_community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'message')),
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists spatdel_community_posts_created_idx on public.spatdel_community_posts (created_at desc);
create index if not exists spatdel_community_comments_post_created_idx on public.spatdel_community_comments (post_id, created_at asc);
create index if not exists spatdel_community_messages_created_idx on public.spatdel_community_messages (created_at desc);

alter table public.spatdel_community_posts enable row level security;
alter table public.spatdel_community_comments enable row level security;
alter table public.spatdel_community_messages enable row level security;
alter table public.spatdel_community_reports enable row level security;

drop policy if exists "Signed-in members can read community posts" on public.spatdel_community_posts;
create policy "Signed-in members can read community posts" on public.spatdel_community_posts
for select to authenticated using (true);
drop policy if exists "Members can create their own community posts" on public.spatdel_community_posts;
create policy "Members can create their own community posts" on public.spatdel_community_posts
for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "Authors can delete their own community posts" on public.spatdel_community_posts;
create policy "Authors can delete their own community posts" on public.spatdel_community_posts
for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Signed-in members can read community comments" on public.spatdel_community_comments;
create policy "Signed-in members can read community comments" on public.spatdel_community_comments
for select to authenticated using (true);
drop policy if exists "Members can create their own community comments" on public.spatdel_community_comments;
create policy "Members can create their own community comments" on public.spatdel_community_comments
for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "Authors can delete their own community comments" on public.spatdel_community_comments;
create policy "Authors can delete their own community comments" on public.spatdel_community_comments
for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Signed-in members can read live community messages" on public.spatdel_community_messages;
create policy "Signed-in members can read live community messages" on public.spatdel_community_messages
for select to authenticated using (true);
drop policy if exists "Members can send their own live community messages" on public.spatdel_community_messages;
create policy "Members can send their own live community messages" on public.spatdel_community_messages
for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "Authors can delete their own live community messages" on public.spatdel_community_messages;
create policy "Authors can delete their own live community messages" on public.spatdel_community_messages
for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Members can submit community reports" on public.spatdel_community_reports;
create policy "Members can submit community reports" on public.spatdel_community_reports
for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "Reporters can view their own community reports" on public.spatdel_community_reports;
create policy "Reporters can view their own community reports" on public.spatdel_community_reports
for select to authenticated using (reporter_id = auth.uid());

grant select, insert, delete on public.spatdel_community_posts to authenticated;
grant select, insert, delete on public.spatdel_community_comments to authenticated;
grant select, insert, delete on public.spatdel_community_messages to authenticated;
grant select, insert on public.spatdel_community_reports to authenticated;
