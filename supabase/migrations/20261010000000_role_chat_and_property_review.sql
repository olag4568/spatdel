-- SPATDEL: role-aware direct messaging and listing review metadata.
-- Chat participants can include tenants, landlords, agents, admins, and future profile roles.
-- Account role labels are read from public.profiles, never trusted from message text.

create table if not exists public.spatdel_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spatdel_chat_participants (
  conversation_id uuid not null references public.spatdel_chat_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.spatdel_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.spatdel_chat_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists spatdel_chat_participants_user_idx
  on public.spatdel_chat_participants(user_id, conversation_id);
create index if not exists spatdel_chat_messages_conversation_created_idx
  on public.spatdel_chat_messages(conversation_id, created_at);

alter table public.spatdel_chat_conversations enable row level security;
alter table public.spatdel_chat_participants enable row level security;
alter table public.spatdel_chat_messages enable row level security;

-- SECURITY DEFINER avoids recursive RLS when policies need to check membership.
create or replace function public.spatdel_is_chat_participant(
  target_conversation_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.spatdel_chat_participants p
    where p.conversation_id = target_conversation_id
      and p.user_id = target_user_id
  );
$$;

revoke all on function public.spatdel_is_chat_participant(uuid, uuid) from public;
grant execute on function public.spatdel_is_chat_participant(uuid, uuid) to authenticated;

drop policy if exists "Participants can read their conversations" on public.spatdel_chat_conversations;
create policy "Participants can read their conversations"
on public.spatdel_chat_conversations for select to authenticated
using (public.spatdel_is_chat_participant(id, (select auth.uid())));

drop policy if exists "Participants can read chat members" on public.spatdel_chat_participants;
create policy "Participants can read chat members"
on public.spatdel_chat_participants for select to authenticated
using (public.spatdel_is_chat_participant(conversation_id, (select auth.uid())));

drop policy if exists "Participants can read chat messages" on public.spatdel_chat_messages;
create policy "Participants can read chat messages"
on public.spatdel_chat_messages for select to authenticated
using (
  public.spatdel_is_chat_participant(spatdel_chat_messages.conversation_id, (select auth.uid()))
);

drop policy if exists "Participants can send chat messages as themselves" on public.spatdel_chat_messages;
create policy "Participants can send chat messages as themselves"
on public.spatdel_chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.spatdel_is_chat_participant(spatdel_chat_messages.conversation_id, (select auth.uid()))
);

drop policy if exists "Recipients can mark messages read" on public.spatdel_chat_messages;
create policy "Recipients can mark messages read"
on public.spatdel_chat_messages for update to authenticated
using (
  sender_id <> (select auth.uid())
  and public.spatdel_is_chat_participant(spatdel_chat_messages.conversation_id, (select auth.uid()))
)
with check (
  sender_id <> (select auth.uid())
  and public.spatdel_is_chat_participant(spatdel_chat_messages.conversation_id, (select auth.uid()))
);

-- Clients may read their own chat membership but cannot add themselves to arbitrary chats.
revoke insert, update, delete on public.spatdel_chat_participants from anon, authenticated;
grant select on public.spatdel_chat_participants to authenticated;
grant select on public.spatdel_chat_conversations to authenticated;
grant select, insert on public.spatdel_chat_messages to authenticated;
revoke update on public.spatdel_chat_messages from anon, authenticated;
grant update (read_at) on public.spatdel_chat_messages to authenticated;

create or replace function public.spatdel_start_chat(
  target_user_id uuid,
  related_property_id uuid default null,
  first_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  new_conversation_id uuid;
  clean_message text := nullif(trim(first_message), '');
begin
  if actor_id is null then
    raise exception 'You must be signed in to start a chat.';
  end if;

  if target_user_id is null or target_user_id = actor_id then
    raise exception 'Choose another user to chat with.';
  end if;

  if not exists (select 1 from public.profiles where id = actor_id) then
    raise exception 'Your SPATDEL profile was not found.';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'The selected user was not found.';
  end if;

  if related_property_id is not null
     and not exists (select 1 from public.properties where id = related_property_id) then
    raise exception 'The selected property was not found.';
  end if;

  if clean_message is not null and char_length(clean_message) > 4000 then
    raise exception 'Messages must be 4000 characters or fewer.';
  end if;

  insert into public.spatdel_chat_conversations (created_by, property_id)
  values (actor_id, related_property_id)
  returning id into new_conversation_id;

  insert into public.spatdel_chat_participants (conversation_id, user_id)
  values (new_conversation_id, actor_id), (new_conversation_id, target_user_id);

  if clean_message is not null then
    insert into public.spatdel_chat_messages (conversation_id, sender_id, body)
    values (new_conversation_id, actor_id, clean_message);
  end if;

  return new_conversation_id;
end;
$$;

revoke all on function public.spatdel_start_chat(uuid, uuid, text) from public;
grant execute on function public.spatdel_start_chat(uuid, uuid, text) to authenticated;

-- Additive review fields for agent/landlord submissions. Existing verified listings
-- remain approved; existing unverified listings become pending.
alter table public.properties
  add column if not exists approval_status text;

update public.properties
set approval_status = case when verified is true then 'approved' else 'pending' end
where approval_status is null;

alter table public.properties
  alter column approval_status set default 'pending';

alter table public.properties
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists images text[] not null default '{}';

alter table public.properties
  drop constraint if exists properties_approval_status_check;
alter table public.properties
  add constraint properties_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected', 'changes_requested'));

create index if not exists properties_approval_status_created_idx
  on public.properties(approval_status, created_at desc);

-- Keep the current admin dashboard's verified toggle and the richer review state in sync.
create or replace function public.spatdel_sync_property_approval_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.approval_status is null then
      new.approval_status := case when new.verified is true then 'approved' else 'pending' end;
    end if;
    new.verified := (new.approval_status = 'approved');
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status then
    new.verified := (new.approval_status = 'approved');
    if new.approval_status in ('approved', 'rejected', 'changes_requested')
       and new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  elsif new.verified is distinct from old.verified then
    new.approval_status := case when new.verified is true then 'approved' else 'pending' end;
    if new.verified is true then
      new.reviewed_at := coalesce(new.reviewed_at, now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists spatdel_sync_property_approval_status on public.properties;
create trigger spatdel_sync_property_approval_status
before insert or update of verified, approval_status on public.properties
for each row execute function public.spatdel_sync_property_approval_status();


-- Agent/landlord submission access. Clients can create only pending, unverified listings
-- attributed to themselves; moderation fields remain controlled by the admin workflow.
drop policy if exists "Agents and landlords can submit pending properties" on public.properties;
create policy "Agents and landlords can submit pending properties"
on public.properties for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and verified is false
  and approval_status = 'pending'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('agent', 'landlord')
  )
);

drop policy if exists "Agents and landlords can read own property submissions" on public.properties;
create policy "Agents and landlords can read own property submissions"
on public.properties for select to authenticated
using (
  submitted_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('agent', 'landlord')
  )
);

-- A public bucket makes approved property photos viewable by the public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Agents and landlords upload their own property images" on storage.objects;
create policy "Agents and landlords upload their own property images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('agent', 'landlord')
  )
);

drop policy if exists "Agents and landlords delete their own property images" on storage.objects;
create policy "Agents and landlords delete their own property images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on column public.properties.approval_status is
  'Admin moderation state. Only approved listings should be visible in public property browsing.';
comment on column public.properties.submitted_by is
  'Profile that submitted the property for admin review.';
comment on column public.properties.images is
  'Optional additional property image URLs; image storage/upload policies must be configured separately.';
