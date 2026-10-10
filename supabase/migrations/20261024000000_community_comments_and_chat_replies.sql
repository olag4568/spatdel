-- Allow signed-in users to view community posts and add comments.
-- Keep post creation limited to admins and chairmen.
drop policy if exists "Signed-in members can read community posts" on public.spatdel_community_posts;
create policy "Signed-in members can read community posts"
on public.spatdel_community_posts for select to authenticated using (true);
drop policy if exists "Members can create their own community posts" on public.spatdel_community_posts;
create policy "Members can create their own community posts"
on public.spatdel_community_posts for insert to authenticated
with check (author_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','chairman')));
drop policy if exists "Authors can delete their own community posts" on public.spatdel_community_posts;
create policy "Authors can delete their own community posts"
on public.spatdel_community_posts for delete to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','chairman')));

drop policy if exists "Signed-in members can read community comments" on public.spatdel_community_comments;
create policy "Signed-in members can read community comments"
on public.spatdel_community_comments for select to authenticated using (true);
drop policy if exists "Members can create their own community comments" on public.spatdel_community_comments;
create policy "Members can create their own community comments"
on public.spatdel_community_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "Authors can delete their own community comments" on public.spatdel_community_comments;
create policy "Authors can delete their own community comments"
on public.spatdel_community_comments for delete to authenticated using (author_id = auth.uid());

alter table public.spatdel_community_messages add column if not exists reply_to_id uuid references public.spatdel_community_messages(id) on delete set null;
grant select, insert, delete on public.spatdel_community_posts to authenticated;
grant select, insert, delete on public.spatdel_community_comments to authenticated;
grant select, insert, delete on public.spatdel_community_messages to authenticated;
