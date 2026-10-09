-- SPATDEL: authenticated users need a safe searchable directory to start chats.
-- SECURITY DEFINER lets the function return only public profile fields without requiring
-- broad direct SELECT access to every row in public.profiles.

create or replace function public.spatdel_search_profiles(
  search_text text default '',
  role_filter text default 'all'
)
returns table (
  id uuid,
  full_name text,
  role text
)
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
  select p.id, p.full_name, p.role::text
  from public.profiles p
  where p.id <> auth.uid()
    and (clean_role = 'all' or lower(p.role::text) = clean_role)
    and (
      clean_search = ''
      or lower(coalesce(p.full_name, '')) like '%' || clean_search || '%'
    )
  order by lower(coalesce(p.full_name, '')), p.id
  limit 200;
end;
$$;

revoke all on function public.spatdel_search_profiles(text, text) from public;
grant execute on function public.spatdel_search_profiles(text, text) to authenticated;
