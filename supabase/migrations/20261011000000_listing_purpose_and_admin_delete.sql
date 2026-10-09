-- SPATDEL: distinguish rental listings from properties offered for sale,
-- allow optional descriptions, and let admins remove unsuitable listings.

alter table public.properties
  add column if not exists listing_purpose text not null default 'rent';

alter table public.properties
  drop constraint if exists properties_listing_purpose_check;

alter table public.properties
  add constraint properties_listing_purpose_check
  check (listing_purpose in ('rent', 'sale'));

alter table public.properties
  alter column description drop not null;

alter table public.properties enable row level security;

drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties"
on public.properties for delete to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

grant delete on public.properties to authenticated;
