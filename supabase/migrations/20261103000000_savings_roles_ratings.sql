-- SPATDEL role assignment, savings goals, and member/property ratings.
-- Savings goals are planning records only. Deposits and withdrawals stay disabled until
-- a regulated/approved financial partner and server-side payment reconciliation are live.

alter table public.profiles
  add column if not exists role_assigned boolean not null default true;

-- Existing accounts keep their current role; only profiles created after this migration
-- start as unassigned members.
alter table public.profiles
  alter column role_assigned set default false;

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
    if request_role not in ('service_role', 'postgres', 'supabase_admin') then
      new.role := 'tenant';
      new.role_assigned := false;
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.role_assigned is distinct from old.role_assigned then
    if request_role in ('anon', 'authenticated')
       and not public.spatdel_is_admin() then
      raise exception 'Only a SPATDEL admin can assign or change account roles.';
    end if;

    if new.role is distinct from old.role then
      new.role_assigned := true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists spatdel_admin_assigned_roles_only on public.profiles;
create trigger spatdel_admin_assigned_roles_only
before insert or update of role, role_assigned on public.profiles
for each row execute function public.spatdel_enforce_admin_assigned_roles();

revoke all on function public.spatdel_enforce_admin_assigned_roles() from public, anon, authenticated;

create table if not exists public.spatdel_savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  goal_type text not null default 'general'
    check (goal_type in ('rent', 'general', 'emergency', 'furniture', 'deposit')),
  target_amount_kobo bigint not null check (target_amount_kobo between 10000 and 100000000000),
  saved_amount_kobo bigint not null default 0 check (saved_amount_kobo >= 0),
  target_date date,
  notes text check (notes is null or char_length(notes) <= 300),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (saved_amount_kobo <= target_amount_kobo or status = 'completed')
);

create index if not exists spatdel_savings_goals_user_created_idx
  on public.spatdel_savings_goals(user_id, created_at desc);

alter table public.spatdel_savings_goals enable row level security;

drop policy if exists "Users can read their own savings goals" on public.spatdel_savings_goals;
create policy "Users can read their own savings goals"
  on public.spatdel_savings_goals for select to authenticated
  using (user_id = auth.uid() or public.spatdel_is_admin());

drop policy if exists "Users can create their own savings goals" on public.spatdel_savings_goals;
create policy "Users can create their own savings goals"
  on public.spatdel_savings_goals for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own savings goals" on public.spatdel_savings_goals;
create policy "Users can update their own savings goals"
  on public.spatdel_savings_goals for update to authenticated
  using (user_id = auth.uid() or public.spatdel_is_admin())
  with check (user_id = auth.uid() or public.spatdel_is_admin());

drop policy if exists "Users can delete empty savings goals" on public.spatdel_savings_goals;
create policy "Users can delete empty savings goals"
  on public.spatdel_savings_goals for delete to authenticated
  using ((user_id = auth.uid() and saved_amount_kobo = 0) or public.spatdel_is_admin());

create or replace function public.spatdel_protect_savings_goal_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(auth.role(), '') in ('anon', 'authenticated')
       and not public.spatdel_is_admin() then
      new.saved_amount_kobo := 0;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.saved_amount_kobo is distinct from old.saved_amount_kobo
     and coalesce(auth.role(), '') in ('anon', 'authenticated')
     and not public.spatdel_is_admin() then
    raise exception 'Savings balances can only change after verified financial reconciliation.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists spatdel_protect_savings_goal_balance_trigger on public.spatdel_savings_goals;
create trigger spatdel_protect_savings_goal_balance_trigger
before insert or update on public.spatdel_savings_goals
for each row execute function public.spatdel_protect_savings_goal_balance();

revoke all on function public.spatdel_protect_savings_goal_balance() from public, anon, authenticated;

create table if not exists public.spatdel_ratings (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  reviewed_user_id uuid references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (property_id is not null and reviewed_user_id is null)
    or (property_id is null and reviewed_user_id is not null)
  ),
  check (reviewed_user_id is null or reviewed_user_id <> reviewer_id)
);

create unique index if not exists spatdel_ratings_one_property_review
  on public.spatdel_ratings(reviewer_id, property_id) where property_id is not null;
create unique index if not exists spatdel_ratings_one_member_review
  on public.spatdel_ratings(reviewer_id, reviewed_user_id) where reviewed_user_id is not null;
create index if not exists spatdel_ratings_property_created_idx
  on public.spatdel_ratings(property_id, created_at desc);
create index if not exists spatdel_ratings_member_created_idx
  on public.spatdel_ratings(reviewed_user_id, created_at desc);

alter table public.spatdel_ratings enable row level security;

drop policy if exists "Signed-in users can read ratings" on public.spatdel_ratings;
create policy "Signed-in users can read ratings"
  on public.spatdel_ratings for select to authenticated
  using (true);

drop policy if exists "Users can create their own ratings" on public.spatdel_ratings;
create policy "Users can create their own ratings"
  on public.spatdel_ratings for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and (reviewed_user_id is null or reviewed_user_id <> auth.uid())
    and (
      property_id is null
      or not exists (
        select 1 from public.properties p
        where p.id = property_id
          and (p.owner_id = auth.uid() or p.submitted_by = auth.uid())
      )
    )
  );

drop policy if exists "Users can edit their own ratings" on public.spatdel_ratings;
create policy "Users can edit their own ratings"
  on public.spatdel_ratings for update to authenticated
  using (reviewer_id = auth.uid())
  with check (
    reviewer_id = auth.uid()
    and (reviewed_user_id is null or reviewed_user_id <> auth.uid())
    and (
      property_id is null
      or not exists (
        select 1 from public.properties p
        where p.id = property_id
          and (p.owner_id = auth.uid() or p.submitted_by = auth.uid())
      )
    )
  );

drop policy if exists "Users can delete their own ratings" on public.spatdel_ratings;
create policy "Users can delete their own ratings"
  on public.spatdel_ratings for delete to authenticated
  using (reviewer_id = auth.uid());
