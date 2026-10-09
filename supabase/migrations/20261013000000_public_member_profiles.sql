-- Public, minimal profile details for the authenticated SPATDEL member directory.
-- Does not expose email addresses or other private account fields.
create or replace function public.spatdel_get_public_profile(target_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  role text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role::text
  from public.profiles p
  where p.id = target_profile_id
    and auth.uid() is not null;
$$;

revoke all on function public.spatdel_get_public_profile(uuid) from public;
grant execute on function public.spatdel_get_public_profile(uuid) to authenticated;
