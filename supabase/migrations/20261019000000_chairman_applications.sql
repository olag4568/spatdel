-- Store Chairman applications separately from account roles.
-- Applicants stay ordinary tenant accounts until an administrator approves them.
create table if not exists public.chairman_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  community_name text not null,
  state text not null,
  local_government text not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chairman_applications_status_created_idx
  on public.chairman_applications (status, created_at desc);

alter table public.chairman_applications enable row level security;

drop policy if exists "Applicants can view their own chairman application"
  on public.chairman_applications;
create policy "Applicants can view their own chairman application"
  on public.chairman_applications for select to authenticated
  using (user_id = auth.uid() or public.spatdel_is_admin());

drop policy if exists "Admins manage chairman applications"
  on public.chairman_applications;
create policy "Admins manage chairman applications"
  on public.chairman_applications for all to authenticated
  using (public.spatdel_is_admin())
  with check (public.spatdel_is_admin());

grant select, insert, update, delete on public.chairman_applications to authenticated;

-- Create an application from trusted auth metadata on signup.
-- Never assign the chairman role here; admin approval and community assignment are separate steps.
create or replace function public.spatdel_create_chairman_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  details jsonb;
begin
  requested_role := new.raw_user_meta_data ->> 'requested_role';
  details := new.raw_user_meta_data;

  if requested_role = 'chairman'
     and coalesce(details ->> 'chairman_community_name', '') <> ''
     and coalesce(details ->> 'chairman_state', '') <> ''
     and coalesce(details ->> 'chairman_local_government', '') <> '' then
    insert into public.chairman_applications
      (user_id, community_name, state, local_government, reason)
    values (
      new.id,
      trim(details ->> 'chairman_community_name'),
      trim(details ->> 'chairman_state'),
      trim(details ->> 'chairman_local_government'),
      nullif(trim(coalesce(details ->> 'chairman_application_reason', '')), '')
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists spatdel_create_chairman_application on auth.users;
create trigger spatdel_create_chairman_application
after insert on auth.users
for each row execute function public.spatdel_create_chairman_application();
