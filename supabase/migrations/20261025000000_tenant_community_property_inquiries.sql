-- Tenant-only property questions in Community Pulse live chat.
alter table public.spatdel_community_messages
  add column if not exists property_image_url text,
  add column if not exists property_type text,
  add column if not exists property_location text,
  add column if not exists property_budget text,
  add column if not exists property_question text;

create or replace function public.spatdel_enforce_tenant_property_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_property_inquiry boolean;
  actor_role text;
begin
  has_property_inquiry :=
    new.property_image_url is not null
    or new.property_type is not null
    or new.property_location is not null
    or new.property_budget is not null
    or new.property_question is not null;

  if has_property_inquiry then
    select p.role::text into actor_role
    from public.profiles p
    where p.id = new.author_id;

    if new.author_id <> auth.uid() or actor_role <> 'tenant' then
      raise exception 'Only tenant accounts can upload property inquiries to Community Pulse.';
    end if;

    if new.property_image_url is null
       or new.property_type is null
       or new.property_location is null
       or new.property_question is null then
      raise exception 'A property inquiry needs a photo, type, location, and question.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists spatdel_enforce_tenant_property_inquiry on public.spatdel_community_messages;
create trigger spatdel_enforce_tenant_property_inquiry
before insert or update on public.spatdel_community_messages
for each row execute function public.spatdel_enforce_tenant_property_inquiry();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-property-inquiries', 'community-property-inquiries', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Tenants upload their own community property inquiry images" on storage.objects;
create policy "Tenants upload their own community property inquiry images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-property-inquiries'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'tenant'
  )
);

drop policy if exists "Members can view community property inquiry images" on storage.objects;
create policy "Members can view community property inquiry images"
on storage.objects for select to authenticated
using (bucket_id = 'community-property-inquiries');

grant select, insert on public.spatdel_community_messages to authenticated;
