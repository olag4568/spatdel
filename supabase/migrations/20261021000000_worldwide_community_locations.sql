-- Worldwide location support for SPATDEL communities and chairman applications.
-- Existing records default to Nigeria; new records can use any country.
alter table public.communities
  add column if not exists country text not null default 'Nigeria';

alter table public.chairman_applications
  add column if not exists country text not null default 'Nigeria';

create index if not exists communities_country_region_area_idx
  on public.communities (country, state, local_government);

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
     and coalesce(details ->> 'chairman_country', '') <> ''
     and coalesce(details ->> 'chairman_state', '') <> ''
     and coalesce(details ->> 'chairman_local_government', '') <> '' then
    insert into public.chairman_applications
      (user_id, community_name, country, state, local_government, reason)
    values (
      new.id,
      trim(details ->> 'chairman_community_name'),
      trim(details ->> 'chairman_country'),
      trim(details ->> 'chairman_state'),
      trim(details ->> 'chairman_local_government'),
      nullif(trim(coalesce(details ->> 'chairman_application_reason', '')), '')
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;
