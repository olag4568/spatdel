-- SPATDEL member profiles: unique usernames, profile photos, bios, and safe self-editing.
alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists bio text;

-- Give existing members a unique starter username; they can change it from Edit Profile.
update public.profiles
set username = left(
  regexp_replace(lower(coalesce(nullif(trim(full_name), ''), 'member')), '[^a-z0-9]+', '-', 'g'),
  24
) || '-' || left(replace(id::text, '-', ''), 6)
where username is null or trim(username) = '';

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$');

alter table public.profiles
  drop constraint if exists profiles_bio_length_check;

alter table public.profiles
  add constraint profiles_bio_length_check
  check (bio is null or char_length(bio) <= 280);

-- Ensure newly created profiles have a unique starter username without trusting client input.
create or replace function public.spatdel_assign_default_username()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_name text;
begin
  if new.username is null or trim(new.username) = '' then
    base_name := left(
      regexp_replace(lower(coalesce(nullif(trim(new.full_name), ''), 'member')), '[^a-z0-9]+', '-', 'g'),
      16
    );
    base_name := trim(both '-' from base_name);
    if length(base_name) < 3 then
      base_name := 'member';
    end if;
    new.username := base_name || '-' || left(replace(new.id::text, '-', ''), 6);
  end if;
  return new;
end;
$$;

drop trigger if exists spatdel_profiles_default_username on public.profiles;
create trigger spatdel_profiles_default_username
before insert on public.profiles
for each row execute function public.spatdel_assign_default_username();

-- Store profile photos in a public bucket; each member can write only to their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view SPATDEL profile photos" on storage.objects;
create policy "Public can view SPATDEL profile photos"
on storage.objects for select
using (bucket_id = 'profile-photos');

drop policy if exists "Members upload their own SPATDEL profile photos" on storage.objects;
create policy "Members upload their own SPATDEL profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Members update their own SPATDEL profile photos" on storage.objects;
create policy "Members update their own SPATDEL profile photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Members delete their own SPATDEL profile photos" on storage.objects;
create policy "Members delete their own SPATDEL profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Safe update RPC: callers can edit profile details but cannot change their role or ID.
create or replace function public.spatdel_update_my_profile(
  p_full_name text,
  p_username text,
  p_bio text default null,
  p_avatar_url text default null
)
returns table (id uuid, full_name text, username text, bio text, avatar_url text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  clean_username text := lower(trim(coalesce(p_username, '')));
  clean_name text := trim(coalesce(p_full_name, ''));
  clean_bio text := nullif(trim(coalesce(p_bio, '')), '');
begin
  if actor_id is null then
    raise exception 'You must be signed in to update your profile.';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 80 then
    raise exception 'Your display name must be between 2 and 80 characters.';
  end if;
  if clean_username !~ '^[a-z0-9][a-z0-9_-]{2,23}$' then
    raise exception 'Username must be 3–24 characters using lowercase letters, numbers, underscores, or hyphens.';
  end if;
  if clean_bio is not null and char_length(clean_bio) > 280 then
    raise exception 'Your bio must be 280 characters or fewer.';
  end if;
  if p_avatar_url is not null and p_avatar_url <> '' and p_avatar_url !~ '^https?://' then
    raise exception 'Please provide a valid profile photo URL.';
  end if;

  update public.profiles p
  set full_name = clean_name,
      username = clean_username,
      bio = clean_bio,
      avatar_url = nullif(trim(coalesce(p_avatar_url, '')), '')
  where p.id = actor_id;

  if not found then
    raise exception 'Your SPATDEL profile was not found.';
  end if;

  return query
  select p.id, p.full_name, p.username, p.bio, p.avatar_url, p.role::text
  from public.profiles p
  where p.id = actor_id;
exception
  when unique_violation then
    raise exception 'That username is already taken. Please choose another one.';
end;
$$;

revoke all on function public.spatdel_update_my_profile(text, text, text, text) from public;
grant execute on function public.spatdel_update_my_profile(text, text, text, text) to authenticated;

create or replace function public.spatdel_get_my_profile()
returns table (id uuid, full_name text, username text, bio text, avatar_url text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.username, p.bio, p.avatar_url, p.role::text
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.spatdel_get_my_profile() from public;
grant execute on function public.spatdel_get_my_profile() to authenticated;

-- Refresh public profile RPC with only safe, public-facing member fields.
drop function if exists public.spatdel_get_public_profile(uuid);
create function public.spatdel_get_public_profile(target_profile_id uuid)
returns table (id uuid, full_name text, username text, bio text, avatar_url text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.username, p.bio, p.avatar_url, p.role::text
  from public.profiles p
  where p.id = target_profile_id
    and auth.uid() is not null;
$$;

revoke all on function public.spatdel_get_public_profile(uuid) from public;
grant execute on function public.spatdel_get_public_profile(uuid) to authenticated;

-- Refresh directory results so usernames and photos appear in chats and member search.
drop function if exists public.spatdel_search_profiles(text, text);
create function public.spatdel_search_profiles(
  search_text text default '',
  role_filter text default 'all'
)
returns table (id uuid, full_name text, username text, bio text, avatar_url text, role text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean_search text := lower(trim(coalesce(search_text, '')));
  clean_role text := lower(trim(coalesce(role_filter, 'all')));
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to search SPATDEL members.';
  end if;
  if clean_role not in ('all', 'tenant', 'agent', 'landlord', 'admin') then
    clean_role := 'all';
  end if;
  return query
  select p.id, p.full_name, p.username, p.bio, p.avatar_url, p.role::text
  from public.profiles p
  where p.id <> auth.uid()
    and (clean_role = 'all' or lower(p.role::text) = clean_role)
    and (
      clean_search = ''
      or lower(coalesce(p.full_name, '')) like '%' || clean_search || '%'
      or lower(coalesce(p.username, '')) like '%' || replace(clean_search, '@', '') || '%'
    )
  order by lower(coalesce(p.full_name, '')), p.id
  limit 200;
end;
$$;

revoke all on function public.spatdel_search_profiles(text, text) from public;
grant execute on function public.spatdel_search_profiles(text, text) to authenticated;
