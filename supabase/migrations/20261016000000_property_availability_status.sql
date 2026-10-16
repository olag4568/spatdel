-- Track property availability without deleting its history.
alter table public.properties
  add column if not exists availability_status text not null default 'available';

alter table public.properties
  drop constraint if exists properties_availability_status_check;

alter table public.properties
  add constraint properties_availability_status_check
  check (availability_status in ('available', 'rented', 'sold', 'deleted'));

-- Owners can update their own property records. The UI limits this action to
-- availability_status; row-level security ensures another user's listing is not affected.
drop policy if exists "Owners can update their submitted properties" on public.properties;
create policy "Owners can update their submitted properties"
  on public.properties
  for update
  to authenticated
  using (submitted_by = auth.uid())
  with check (submitted_by = auth.uid());
