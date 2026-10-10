-- Allow every signed-in SPATDEL member to use the live community chat.
-- Community posts and their comments remain limited to admins and chairmen.
drop policy if exists "Admins and chairmen can read live community messages" on public.spatdel_community_messages;
drop policy if exists "Admins and chairmen can send live community messages" on public.spatdel_community_messages;
drop policy if exists "Admins and chairmen can delete live community messages" on public.spatdel_community_messages;
drop policy if exists "Signed-in members can read live community messages" on public.spatdel_community_messages;
drop policy if exists "Members can send their own live community messages" on public.spatdel_community_messages;
drop policy if exists "Authors can delete their own live community messages" on public.spatdel_community_messages;

create policy "Signed-in users can read live community messages"
on public.spatdel_community_messages for select to authenticated using (true);

create policy "Signed-in users can send their own live community messages"
on public.spatdel_community_messages for insert to authenticated
with check (author_id = auth.uid());

create policy "Users can delete their own live community messages"
on public.spatdel_community_messages for delete to authenticated
using (author_id = auth.uid() or public.spatdel_is_admin());

grant select, insert, delete on public.spatdel_community_messages to authenticated;

-- Chairman-to-community assignments contain public-facing community labels.
-- Let signed-in users read assignments so chat messages can show the chairman's
-- community, LGA/district, state/region, and country. Only admins can assign.
drop policy if exists "Signed-in users can view chairman community tags" on public.community_chairmen;
create policy "Signed-in users can view chairman community tags"
on public.community_chairmen for select to authenticated using (true);

grant select on public.community_chairmen to authenticated;

-- Keep the location join limited to active communities or the user's assigned community;
-- the existing communities policies already govern access to the joined community row.
