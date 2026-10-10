-- Restrict Community Pulse to admin/chairman accounts and enable image posts.
alter table public.spatdel_community_posts add column if not exists image_url text;

drop policy if exists "Signed-in members can read community posts" on public.spatdel_community_posts;
drop policy if exists "Members can create their own community posts" on public.spatdel_community_posts;
drop policy if exists "Authors can delete their own community posts" on public.spatdel_community_posts;
drop policy if exists "Admins and chairmen can read community posts" on public.spatdel_community_posts;
create policy "Admins and chairmen can read community posts" on public.spatdel_community_posts
for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));
create policy "Admins and chairmen can create community posts" on public.spatdel_community_posts
for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));
create policy "Admins and chairmen can delete community posts" on public.spatdel_community_posts
for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));

drop policy if exists "Signed-in members can read community comments" on public.spatdel_community_comments;
drop policy if exists "Members can create their own community comments" on public.spatdel_community_comments;
drop policy if exists "Authors can delete their own community comments" on public.spatdel_community_comments;
create policy "Admins and chairmen can read community comments" on public.spatdel_community_comments
for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));
create policy "Admins and chairmen can create community comments" on public.spatdel_community_comments
for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));
create policy "Admins and chairmen can delete community comments" on public.spatdel_community_comments
for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));

drop policy if exists "Signed-in members can read live community messages" on public.spatdel_community_messages;
drop policy if exists "Members can send their own live community messages" on public.spatdel_community_messages;
drop policy if exists "Authors can delete their own live community messages" on public.spatdel_community_messages;
create policy "Admins and chairmen can read live community messages" on public.spatdel_community_messages
for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));
create policy "Admins and chairmen can send live community messages" on public.spatdel_community_messages
for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));
create policy "Admins and chairmen can delete live community messages" on public.spatdel_community_messages
for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-post-images', 'community-post-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Community roles can upload community post images" on storage.objects;
create policy "Community roles can upload community post images" on storage.objects
for insert to authenticated with check (
  bucket_id = 'community-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman'))
);
drop policy if exists "Community roles can update community post images" on storage.objects;
create policy "Community roles can update community post images" on storage.objects
for update to authenticated using (
  bucket_id = 'community-post-images'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman'))
) with check (
  bucket_id = 'community-post-images'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman'))
);
drop policy if exists "Community roles can delete community post images" on storage.objects;
create policy "Community roles can delete community post images" on storage.objects
for delete to authenticated using (
  bucket_id = 'community-post-images'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','chairman'))
);
