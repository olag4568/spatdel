-- SPATDEL community directory: controlled join requests and safe membership approval.
-- Apply after 20261018000000_spatdel_communities_and_chairmen.sql.

create table if not exists public.community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_join_requests_review_idx
  on public.community_join_requests (community_id, status, created_at);
create unique index if not exists community_join_requests_one_pending_idx
  on public.community_join_requests (community_id, requester_id)
  where status = 'pending';

alter table public.community_join_requests enable row level security;

drop policy if exists "Members can see their own community requests" on public.community_join_requests;
create policy "Members can see their own community requests"
  on public.community_join_requests for select to authenticated
  using (
    requester_id = auth.uid()
    or public.spatdel_is_admin()
    or public.spatdel_chairs_community(community_id)
  );

drop policy if exists "Members can request community membership" on public.community_join_requests;
create policy "Members can request community membership"
  on public.community_join_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1 from public.communities c
      where c.id = community_id and c.status = 'active'
    )
    and not public.spatdel_is_community_member(community_id)
  );

drop policy if exists "Admins and assigned chairmen review requests" on public.community_join_requests;
create policy "Admins and assigned chairmen review requests"
  on public.community_join_requests for update to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id))
  with check (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id));

create or replace function public.spatdel_review_community_join_request(
  target_request_id uuid,
  decision text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.community_join_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into request_row
  from public.community_join_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Join request not found';
  end if;

  if not (public.spatdel_is_admin() or public.spatdel_chairs_community(request_row.community_id)) then
    raise exception 'You are not assigned to this community';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'This request has already been reviewed';
  end if;

  update public.community_join_requests
  set status = decision, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = target_request_id;

  if decision = 'approved' then
    insert into public.community_memberships (community_id, member_id, status)
    values (request_row.community_id, request_row.requester_id, 'active')
    on conflict (community_id, member_id)
    do update set status = 'active';
  end if;

  return true;
end;
$$;

revoke all on function public.spatdel_review_community_join_request(uuid, text) from public;
grant execute on function public.spatdel_review_community_join_request(uuid, text) to authenticated;
grant select, insert, update on public.community_join_requests to authenticated;
