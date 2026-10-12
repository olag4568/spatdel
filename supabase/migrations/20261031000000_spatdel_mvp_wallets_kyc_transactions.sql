-- SPATDEL Ijegun MVP: wallet ledger, KYC status, payout destinations, and transaction oversight.
-- This migration creates the database foundation only. Do not enable real-money transfers
-- until an approved payment provider / compliant collection or escrow arrangement is configured.
-- Apply after the existing profiles, properties, and spatdel_is_admin() foundations.

-- Keep the admin check available even when this migration is applied independently
-- of the optional community features.
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

revoke all on function public.spatdel_is_admin() from public, anon;
grant execute on function public.spatdel_is_admin() to authenticated;

create table if not exists public.spatdel_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spatdel_kyc_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  status text not null default 'not_started'
    check (status in ('not_started', 'pending', 'verified', 'rejected', 'needs_review')),
  provider text,
  provider_reference text,
  verified_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Store provider-issued recipient tokens and masked account details only.
-- Never store raw bank account numbers, PINs, card details, or identity-document images here.
create table if not exists public.spatdel_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null,
  provider_recipient_code text not null,
  bank_name text,
  account_name text,
  account_number_last4 text check (
    account_number_last4 is null or account_number_last4 ~ '^[0-9]{4}$'
  ),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'disabled')),
  is_default boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_recipient_code)
);

create unique index if not exists spatdel_one_default_payout_account_idx
  on public.spatdel_payout_accounts (user_id)
  where is_default = true and status = 'verified';

create table if not exists public.spatdel_property_transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  purpose text not null check (purpose in ('rent', 'sale')),
  currency text not null default 'NGN' check (currency = 'NGN'),
  gross_amount_kobo bigint not null check (gross_amount_kobo > 0),
  service_fee_kobo bigint not null default 0 check (service_fee_kobo >= 0),
  seller_net_kobo bigint generated always as (gross_amount_kobo - service_fee_kobo) stored,
  status text not null default 'created'
    check (status in (
      'created', 'awaiting_payment', 'payment_confirmed', 'funds_held',
      'release_pending', 'completed', 'disputed', 'refund_pending',
      'refunded', 'cancelled', 'failed'
    )),
  payment_provider text,
  provider_payment_reference text,
  provider_transfer_reference text,
  buyer_payout_account_id uuid references public.spatdel_payout_accounts(id) on delete restrict,
  seller_payout_account_id uuid references public.spatdel_payout_accounts(id) on delete restrict,
  paid_at timestamptz,
  funds_held_at timestamptz,
  released_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (service_fee_kobo <= gross_amount_kobo)
);

create index if not exists spatdel_transactions_buyer_created_idx
  on public.spatdel_property_transactions (buyer_id, created_at desc);
create index if not exists spatdel_transactions_seller_created_idx
  on public.spatdel_property_transactions (seller_id, created_at desc);
create index if not exists spatdel_transactions_status_created_idx
  on public.spatdel_property_transactions (status, created_at desc);

-- Immutable double-entry-style event log. Real provider settlement must be reconciled
-- against this ledger by a trusted server/webhook, never by a browser-supplied success flag.
create table if not exists public.spatdel_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.spatdel_wallets(id) on delete restrict,
  transaction_id uuid references public.spatdel_property_transactions(id) on delete restrict,
  entry_type text not null check (entry_type in (
    'deposit', 'withdrawal', 'purchase_hold', 'seller_release',
    'service_fee', 'refund', 'adjustment'
  )),
  direction text not null check (direction in ('credit', 'debit')),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  provider_reference text,
  idempotency_key text unique,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists spatdel_wallet_ledger_wallet_created_idx
  on public.spatdel_wallet_ledger (wallet_id, created_at desc);
create index if not exists spatdel_wallet_ledger_transaction_idx
  on public.spatdel_wallet_ledger (transaction_id, created_at desc);

-- The fee starts at 0 basis points until the admin configures and discloses a rate.
-- 100 basis points = 1%. Rent and sale can be configured separately.
create table if not exists public.spatdel_fee_settings (
  purpose text primary key check (purpose in ('rent', 'sale')),
  fee_bps integer not null default 0 check (fee_bps between 0 and 2000),
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.spatdel_fee_settings (purpose, fee_bps, enabled)
values ('rent', 0, false), ('sale', 0, false)
on conflict (purpose) do nothing;

-- MVP launch-area setting. Listing forms and server-side validation should use this
-- value to show a notice and block publication outside Ijegun, Ikotun, Lagos State.
create table if not exists public.spatdel_launch_settings (
  id boolean primary key default true check (id = true),
  launch_area text not null default 'Ijegun, Ikotun, Lagos State, Nigeria',
  outside_area_notice text not null default
    'SPATDEL is currently available in Ijegun, Ikotun, Lagos State only. You can register, but properties outside this launch area cannot be listed yet.',
  updated_at timestamptz not null default now()
);

insert into public.spatdel_launch_settings (id)
values (true)
on conflict (id) do nothing;

-- Create a wallet and KYC status row for existing and newly-created profiles.
insert into public.spatdel_wallets (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

insert into public.spatdel_kyc_profiles (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.spatdel_create_wallet_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.spatdel_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.spatdel_kyc_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists spatdel_profile_create_wallet on public.profiles;
create trigger spatdel_profile_create_wallet
after insert on public.profiles
for each row execute function public.spatdel_create_wallet_for_profile();

-- Protect the financial event log from edits/deletes, including accidental admin edits.
create or replace function public.spatdel_prevent_wallet_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Wallet ledger entries are immutable. Add a correcting entry instead.';
end;
$$;

drop trigger if exists spatdel_wallet_ledger_immutable on public.spatdel_wallet_ledger;
create trigger spatdel_wallet_ledger_immutable
before update or delete on public.spatdel_wallet_ledger
for each row execute function public.spatdel_prevent_wallet_ledger_mutation();

alter table public.spatdel_wallets enable row level security;
alter table public.spatdel_kyc_profiles enable row level security;
alter table public.spatdel_payout_accounts enable row level security;
alter table public.spatdel_property_transactions enable row level security;
alter table public.spatdel_wallet_ledger enable row level security;
alter table public.spatdel_fee_settings enable row level security;
alter table public.spatdel_launch_settings enable row level security;

drop policy if exists "Users and admins can view wallets" on public.spatdel_wallets;
create policy "Users and admins can view wallets"
  on public.spatdel_wallets for select to authenticated
  using (user_id = auth.uid() or public.spatdel_is_admin());

drop policy if exists "Users and admins can view KYC status" on public.spatdel_kyc_profiles;
create policy "Users and admins can view KYC status"
  on public.spatdel_kyc_profiles for select to authenticated
  using (user_id = auth.uid() or public.spatdel_is_admin());

drop policy if exists "Users can submit their own KYC request" on public.spatdel_kyc_profiles;
create policy "Users can submit their own KYC request"
  on public.spatdel_kyc_profiles for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null and verified_at is null);

-- The profile row is pre-created with the wallet, so users submit KYC by changing
-- only the status to pending; they can never self-verify or set reviewer fields.
drop policy if exists "Users can request KYC review" on public.spatdel_kyc_profiles;
create policy "Users can request KYC review"
  on public.spatdel_kyc_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and status in ('pending', 'needs_review')
    and reviewed_by is null
    and verified_at is null
  );

drop policy if exists "Users and admins can view payout accounts" on public.spatdel_payout_accounts;
create policy "Users and admins can view payout accounts"
  on public.spatdel_payout_accounts for select to authenticated
  using (user_id = auth.uid() or public.spatdel_is_admin());

drop policy if exists "Users can register pending payout accounts" on public.spatdel_payout_accounts;
create policy "Users can register pending payout accounts"
  on public.spatdel_payout_accounts for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and verified_at is null
    and is_default = false
  );

drop policy if exists "Buyers sellers and admins can view transactions" on public.spatdel_property_transactions;
create policy "Buyers sellers and admins can view transactions"
  on public.spatdel_property_transactions for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.spatdel_is_admin());

drop policy if exists "Buyers can create their own transaction requests" on public.spatdel_property_transactions;
create policy "Buyers can create their own transaction requests"
  on public.spatdel_property_transactions for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and status = 'created'
    and service_fee_kobo = 0
    and paid_at is null
    and funds_held_at is null
    and released_at is null
    and completed_at is null
    and exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.verified = true
        and coalesce(p.owner_id, p.submitted_by) = seller_id
        and coalesce(p.listing_purpose, 'rent') = purpose
        and lower(coalesce(p.location, '')) like '%ijegun%'
    )
  );

drop policy if exists "Users can view their own ledger entries and admins can review all" on public.spatdel_wallet_ledger;
create policy "Users can view their own ledger entries and admins can review all"
  on public.spatdel_wallet_ledger for select to authenticated
  using (
    public.spatdel_is_admin()
    or exists (
      select 1 from public.spatdel_wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view fee settings" on public.spatdel_fee_settings;
create policy "Users can view fee settings"
  on public.spatdel_fee_settings for select to authenticated using (true);

drop policy if exists "Admins manage fee settings" on public.spatdel_fee_settings;
create policy "Admins manage fee settings"
  on public.spatdel_fee_settings for all to authenticated
  using (public.spatdel_is_admin())
  with check (public.spatdel_is_admin());

drop policy if exists "Users can view launch-area settings" on public.spatdel_launch_settings;
create policy "Users can view launch-area settings"
  on public.spatdel_launch_settings for select to authenticated using (true);

drop policy if exists "Admins manage launch-area settings" on public.spatdel_launch_settings;
create policy "Admins manage launch-area settings"
  on public.spatdel_launch_settings for all to authenticated
  using (public.spatdel_is_admin())
  with check (public.spatdel_is_admin());

-- No client insert/update/delete policies are granted for wallets, ledger entries,
-- transaction status changes, or verified KYC/payout-account fields. Trusted server
-- routes using the service role must perform payment-provider webhooks and releases.
grant select on public.spatdel_wallets to authenticated;
grant select on public.spatdel_kyc_profiles to authenticated;
grant select, insert on public.spatdel_payout_accounts to authenticated;
grant select, insert on public.spatdel_property_transactions to authenticated;
grant select on public.spatdel_wallet_ledger to authenticated;
grant select on public.spatdel_fee_settings to authenticated;
grant select on public.spatdel_launch_settings to authenticated;

revoke all on function public.spatdel_create_wallet_for_profile() from public, anon, authenticated;
revoke all on function public.spatdel_prevent_wallet_ledger_mutation() from public, anon, authenticated;
