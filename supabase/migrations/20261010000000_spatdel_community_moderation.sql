-- Community moderation workflow for SPATDEL admins.
alter table public.spatdel_community_reports
  add column if not exists status text not null default 'open'
  check (status in ('open', 'resolved'));

drop policy if exists "Admins can review community reports" on public.spatdel_community_reports;
create policy "Admins can review community reports" on public.spatdel_community_reports
for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can resolve community reports" on public.spatdel_community_reports;
create policy "Admins can resolve community reports" on public.spatdel_community_reports
for update to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

grant select, update on public.spatdel_community_reports to authenticated;
