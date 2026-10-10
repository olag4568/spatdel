-- SPATDEL community/chairman foundation.
-- Chairmen are assigned to communities; do not infer assignment from role alone.
-- Run this migration in the Supabase SQL editor or through your normal migration workflow.

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  address text,
  local_government text,
  state text,
  contact_phone text,
  rules text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'pending')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_chairmen (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  chairman_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (community_id, chairman_id)
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'pending', 'suspended')),
  joined_at timestamptz not null default now(),
  unique (community_id, member_id)
);

create table if not exists public.community_announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_complaints (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null default 'general',
  status text not null default 'open'
    check (status in ('open', 'in_review', 'resolved', 'closed')),
  resolution_note text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_meetings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  details text,
  starts_at timestamptz not null,
  location text,
  minutes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_services (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  contact_name text,
  contact_phone text,
  address text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_chairmen_chairman_id_idx
  on public.community_chairmen (chairman_id);
create index if not exists community_memberships_member_id_idx
  on public.community_memberships (member_id);
create index if not exists community_announcements_community_published_idx
  on public.community_announcements (community_id, published, published_at desc);
create index if not exists community_complaints_community_status_idx
  on public.community_complaints (community_id, status, created_at desc);
create index if not exists community_meetings_community_starts_idx
  on public.community_meetings (community_id, starts_at);
create index if not exists community_services_community_approved_idx
  on public.community_services (community_id, approved);

-- SECURITY DEFINER helpers avoid recursive RLS lookups when checking assignments.
create or replace function public.spatdel_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.spatdel_chairs_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_chairmen cc
    where cc.community_id = target_community_id
      and cc.chairman_id = auth.uid()
  );
$$;

create or replace function public.spatdel_is_community_member(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_memberships cm
    where cm.community_id = target_community_id
      and cm.member_id = auth.uid()
      and cm.status = 'active'
  );
$$;

revoke all on function public.spatdel_is_admin() from public;
revoke all on function public.spatdel_chairs_community(uuid) from public;
revoke all on function public.spatdel_is_community_member(uuid) from public;
grant execute on function public.spatdel_is_admin() to authenticated;
grant execute on function public.spatdel_chairs_community(uuid) to authenticated;
grant execute on function public.spatdel_is_community_member(uuid) to authenticated;

alter table public.communities enable row level security;
alter table public.community_chairmen enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_announcements enable row level security;
alter table public.community_complaints enable row level security;
alter table public.community_meetings enable row level security;
alter table public.community_services enable row level security;

-- Community directory: authenticated users can see active communities; admins manage all.
drop policy if exists "Active communities are visible" on public.communities;
create policy "Active communities are visible" on public.communities
  for select to authenticated
  using (status = 'active' or public.spatdel_is_admin() or public.spatdel_chairs_community(id));

drop policy if exists "Admins manage communities" on public.communities;
create policy "Admins manage communities" on public.communities
  for all to authenticated
  using (public.spatdel_is_admin())
  with check (public.spatdel_is_admin());

-- Only admins assign chairmen and community membership.
drop policy if exists "Admins manage chairman assignments" on public.community_chairmen;
create policy "Admins manage chairman assignments" on public.community_chairmen
  for all to authenticated
  using (public.spatdel_is_admin() or chairman_id = auth.uid())
  with check (public.spatdel_is_admin());

drop policy if exists "Members and chairs can view memberships" on public.community_memberships;
create policy "Members and chairs can view memberships" on public.community_memberships
  for select to authenticated
  using (member_id = auth.uid() or public.spatdel_is_admin() or public.spatdel_chairs_community(community_id));

drop policy if exists "Admins manage memberships" on public.community_memberships;
create policy "Admins manage memberships" on public.community_memberships
  for all to authenticated
  using (public.spatdel_is_admin())
  with check (public.spatdel_is_admin());

-- Announcements: chairmen may manage their own community; members see published notices.
drop policy if exists "Community announcement visibility" on public.community_announcements;
create policy "Community announcement visibility" on public.community_announcements
  for select to authenticated
  using (
    public.spatdel_is_admin()
    or public.spatdel_chairs_community(community_id)
    or (published = true and public.spatdel_is_community_member(community_id))
  );

drop policy if exists "Chairmen create announcements" on public.community_announcements;
create policy "Chairmen create announcements" on public.community_announcements
  for insert to authenticated
  with check (author_id = auth.uid() and (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id)));

drop policy if exists "Chairmen update announcements" on public.community_announcements;
create policy "Chairmen update announcements" on public.community_announcements
  for update to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id))
  with check (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id));

drop policy if exists "Chairmen delete announcements" on public.community_announcements;
create policy "Chairmen delete announcements" on public.community_announcements
  for delete to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id));

-- Residents can submit complaints; only their community's chairmen/admin can review them.
drop policy if exists "Complaint visibility" on public.community_complaints;
create policy "Complaint visibility" on public.community_complaints
  for select to authenticated
  using (submitted_by = auth.uid() or public.spatdel_is_admin() or public.spatdel_chairs_community(community_id));

drop policy if exists "Members submit complaints" on public.community_complaints;
create policy "Members submit complaints" on public.community_complaints
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and public.spatdel_is_community_member(community_id)
  );

drop policy if exists "Chairmen manage complaints" on public.community_complaints;
create policy "Chairmen manage complaints" on public.community_complaints
  for update to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id))
  with check (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id));

-- Meetings: community members can read; chairmen/admin create and manage.
drop policy if exists "Meeting visibility" on public.community_meetings;
create policy "Meeting visibility" on public.community_meetings
  for select to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id) or public.spatdel_is_community_member(community_id));

drop policy if exists "Chairmen manage meetings" on public.community_meetings;
create policy "Chairmen manage meetings" on public.community_meetings
  for all to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id))
  with check (public.spatdel_is_admin() or (public.spatdel_chairs_community(community_id) and created_by = auth.uid()));

-- Services: members see approved listings; chairmen/admin manage community services.
drop policy if exists "Service visibility" on public.community_services;
create policy "Service visibility" on public.community_services
  for select to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id) or (approved = true and public.spatdel_is_community_member(community_id)));

drop policy if exists "Chairmen manage services" on public.community_services;
create policy "Chairmen manage services" on public.community_services
  for all to authenticated
  using (public.spatdel_is_admin() or public.spatdel_chairs_community(community_id))
  with check (public.spatdel_is_admin() or (public.spatdel_chairs_community(community_id) and created_by = auth.uid()));

grant select, insert, update, delete on public.communities to authenticated;
grant select, insert, update, delete on public.community_chairmen to authenticated;
grant select, insert, update, delete on public.community_memberships to authenticated;
grant select, insert, update, delete on public.community_announcements to authenticated;
grant select, insert, update, delete on public.community_complaints to authenticated;
grant select, insert, update, delete on public.community_meetings to authenticated;
grant select, insert, update, delete on public.community_services to authenticated;
