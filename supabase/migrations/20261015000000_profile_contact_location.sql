-- SPATDEL profile contact and location fields.
alter table public.profiles
  add column if not exists contact_phone text,
  add column if not exists location text;

alter table public.profiles
  drop constraint if exists profiles_contact_phone_length_check,
  drop constraint if exists profiles_location_length_check;

alter table public.profiles
  add constraint profiles_contact_phone_length_check
    check (contact_phone is null or char_length(contact_phone) <= 30),
  add constraint profiles_location_length_check
    check (location is null or char_length(location) <= 120);

create or replace function public.spatdel_update_my_profile(
  p_full_name text,
  p_username text,
  p_bio text default null,
  p_avatar_url text default null,
  p_contact_phone text default null,
  p_location text default null
)
returns table (
  id uuid, full_name text, username text, bio text, avatar_url text,
  role text, contact_phone text, location text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  clean_username text := lower(trim(coalesce(p_username, '')));
  clean_name text := trim(coalesce(p_full_name, ''));
  clean_bio text := nullif(trim(coalesce(p_bio, '')), '');
  clean_phone text := nullif(trim(coalesce(p_contact_phone, '')), '');
  clean_location text := nullif(trim(coalesce(p_location, '')), '');
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
  if clean_phone is not null and char_length(clean_phone) > 30 then
    raise exception 'Contact number must be 30 characters or fewer.';
  end if;
  if clean_location is not null and char_length(clean_location) > 120 then
    raise exception 'Location must be 120 characters or fewer.';
  end if;
  if p_avatar_url is not null and p_avatar_url <> '' and p_avatar_url !~ '^https?://' then
    raise exception 'Please provide a valid profile photo URL.';
  end if;

  update public.profiles p
  set full_name = clean_name,
      username = clean_username,
      bio = clean_bio,
      avatar_url = nullif(trim(coalesce(p_avatar_url, '')), ''),
      contact_phone = clean_phone,
      location = clean_location
  where p.id = actor_id;

  if not found then
    raise exception 'Your SPATDEL profile was not found.';
  end if;

  return query
  select p.id, p.full_name, p.username, p.bio, p.avatar_url, p.role::text,
         p.contact_phone, p.location
  from public.profiles p
  where p.id = actor_id;
exception
  when unique_violation then
    raise exception 'That username is already taken. Please choose another one.';
end;
$$;

revoke all on function public.spatdel_update_my_profile(text, text, text, text, text, text) from public;
grant execute on function public.spatdel_update_my_profile(text, text, text, text, text, text) to authenticated;

create or replace function public.spatdel_get_my_profile()
returns table (
  id uuid, full_name text, username text, bio text, avatar_url text,
  role text, contact_phone text, location text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.username, p.bio, p.avatar_url, p.role::text,
         p.contact_phone, p.location
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.spatdel_get_public_profile(target_profile_id uuid)
returns table (
  id uuid, full_name text, username text, bio text, avatar_url text,
  role text, contact_phone text, location text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.username, p.bio, p.avatar_url, p.role::text,
         p.contact_phone, p.location
  from public.profiles p
  where p.id = target_profile_id
    and auth.uid() is not null;
$$;

create or replace function public.spatdel_search_profiles(
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
