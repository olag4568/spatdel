-- Community Pulse: explicit read marks and author-owned post editing/deletion.
alter table public.spatdel_community_posts enable row level security;

drop policy if exists "Authors can delete their own community posts" on public.spatdel_community_posts;
drop policy if exists "Admins and chairmen can delete community posts" on public.spatdel_community_posts;
drop policy if exists "Community authors can update their own posts" on public.spatdel_community_posts;
drop policy if exists "Community authors can delete their own posts" on public.spatdel_community_posts;

create policy "Community authors can update their own posts"
on public.spatdel_community_posts for update to authenticated
using (
  author_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman'))
)
with check (
  author_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman'))
);

create policy "Community authors can delete their own posts"
on public.spatdel_community_posts for delete to authenticated
using (
  author_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman'))
);

grant update, delete on public.spatdel_community_posts to authenticated;

-- Read receipts are explicit: a recipient presses "Mark read"; merely loading chat
-- does not mark a message as read. Each member can mark a message once.
create table if not exists public.spatdel_community_message_reads (
  message_id uuid not null references public.spatdel_community_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.spatdel_community_message_reads enable row level security;
drop policy if exists "Members can view community message read marks" on public.spatdel_community_message_reads;
drop policy if exists "Recipients can mark community messages read" on public.spatdel_community_message_reads;

create policy "Members can view community message read marks"
on public.spatdel_community_message_reads for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.spatdel_community_messages m
    where m.id = message_id and m.author_id = auth.uid()
  )
);

create policy "Recipients can mark community messages read"
on public.spatdel_community_message_reads for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.spatdel_community_messages m
    where m.id = message_id and m.author_id <> auth.uid()
  )
);

grant select, insert on public.spatdel_community_message_reads to authenticated;
