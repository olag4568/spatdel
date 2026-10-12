-- SPATDEL MVP guardrails: neutral account roles and user-submitted Ijegun listings.
-- New accounts receive the ordinary "tenant" role. Privileged roles are assigned by admins.
-- Everyone signed in may submit a property listing, but only Ijegun listings enter review.

create or replace function public.spatdel_enforce_admin_assigned_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
begin
  if tg_op = 'INSERT' then
    -- Auth-driven signups must never self-assign agent, chairman, or admin.
    if request_role not in ('service_role', 'postgres', 'supabase_admin') then
      new.role := 'tenant';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    -- Authenticated users cannot promote themselves or change someone else's role.
    -- Admin dashboard actions and trusted server/database administration can assign roles.
    if request_role in ('anon', 'authenticated')
       and not public.spatdel_is_admin() then
      raise exception 'Only a SPATDEL admin can assign or change account roles.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists spatdel_admin_assigned_roles_only on public.profiles;
create trigger spatdel_admin_assigned_roles_only
before insert or update of role on public.profiles
for each row execute function public.spatdel_enforce_admin_assigned_roles();

revoke all on function public.spatdel_enforce_admin_assigned_roles() from public, anon, authenticated;

alter table public.properties enable row level security;

drop policy if exists "Signed-in users can submit Ijegun property listings" on public.properties;
create policy "Signed-in users can submit Ijegun property listings"
  on public.properties
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and verified = false
    and approval_status = 'pending'
    and listing_purpose in ('rent', 'sale')
    and lower(coalesce(location, '')) like '%ijegun%'
  );

-- Existing public browsing policies should continue to control reads; the new insert
-- policy does not allow a user to publish a verified listing or modify someone else's row.
