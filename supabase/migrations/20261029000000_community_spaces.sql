-- SPATDEL per-community spaces: private chat and member complaint submission.
-- Apply after the community and membership-request migrations.

create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_chat_messages_room_created_idx
  on public.community_chat_messages (community_id, created_at desc);

alter table public.community_chat_messages enable row level security;

drop policy if exists "Community members can read their room chat" on public.community_chat_messages;
create policy "Community members can read their room chat"
  on public.community_chat_messages for select to authenticated
  using (
    public.spatdel_is_admin()
    or public.spatdel_chairs_community(community_id)
    or public.spatdel_is_community_member(community_id)
  );

drop policy if exists "Community members can send to their room chat" on public.community_chat_messages;
create policy "Community members can send to their room chat"
  on public.community_chat_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.spatdel_is_admin()
      or public.spatdel_chairs_community(community_id)
      or public.spatdel_is_community_member(community_id)
    )
  );

drop policy if exists "Authors and admins can delete community room messages" on public.community_chat_messages;
create policy "Authors and admins can delete community room messages"
  on public.community_chat_messages for delete to authenticated
  using (author_id = auth.uid() or public.spatdel_is_admin());

grant select, insert, delete on public.community_chat_messages to authenticated;

-- Residents can submit complaints only to a community they belong to.
-- Existing community_complaints policies control which officials can review them.
