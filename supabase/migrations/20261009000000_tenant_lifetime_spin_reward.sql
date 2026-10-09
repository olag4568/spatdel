-- SPATDEL: lifetime one-time tenant spin reward.
-- The prize is a tenant-specific display discount; listing prices are never mutated.

create table if not exists public.tenant_rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0,
  last_claim_date date,
  reward_amount integer,
  spun_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.tenant_rewards
  add column if not exists reward_amount integer;
alter table public.tenant_rewards
  add column if not exists spun_at timestamptz;
alter table public.tenant_rewards
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenant_rewards_reward_amount_check'
      and conrelid = 'public.tenant_rewards'::regclass
  ) then
    alter table public.tenant_rewards
      add constraint tenant_rewards_reward_amount_check
      check (
        reward_amount is null
        or reward_amount in (5000, 10000, 15000, 20000, 25000, 30000)
      );
  end if;
end
$$;

alter table public.tenant_rewards enable row level security;

drop policy if exists "Tenants can view their own rewards" on public.tenant_rewards;
create policy "Tenants can view their own rewards"
  on public.tenant_rewards
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.tenant_rewards from public, anon, authenticated;
grant select on table public.tenant_rewards to authenticated;

create or replace function public.claim_tenant_spin_reward()
returns table (
  reward_amount integer,
  spun_at timestamptz,
  already_spun boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_reward_amount integer;
  v_spun_at timestamptz;
  v_reward_options integer[] := array[5000, 10000, 15000, 20000, 25000, 30000];
  v_reward_index integer;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to spin.';
  end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_user_id;

  if v_role is distinct from 'tenant' then
    raise exception 'Only tenant accounts can claim this reward.';
  end if;

  insert into public.tenant_rewards (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select tr.reward_amount, tr.spun_at
  into v_reward_amount, v_spun_at
  from public.tenant_rewards tr
  where tr.user_id = v_user_id
  for update;

  if v_reward_amount is not null or v_spun_at is not null then
    reward_amount := v_reward_amount;
    spun_at := v_spun_at;
    already_spun := true;
    return next;
    return;
  end if;

  v_reward_index := floor(random() * array_length(v_reward_options, 1))::integer + 1;
  v_reward_amount := v_reward_options[v_reward_index];
  v_spun_at := now();

  update public.tenant_rewards tr
  set reward_amount = v_reward_amount,
      spun_at = v_spun_at,
      updated_at = now()
  where tr.user_id = v_user_id;

  reward_amount := v_reward_amount;
  spun_at := v_spun_at;
  already_spun := false;
  return next;
end;
$$;

revoke all on function public.claim_tenant_spin_reward() from public, anon;
grant execute on function public.claim_tenant_spin_reward() to authenticated;
