-- Public browsing for SPATDEL Community Pulse.
-- Reads are public; existing authenticated write policies remain unchanged.
-- Do not grant public access to profiles or individual poll voter records.

create policy "Public can read community posts"
on public.spatdel_community_posts
for select to anon, authenticated
using (true);

create policy "Public can read community comments"
on public.spatdel_community_comments
for select to anon, authenticated
using (true);

create policy "Public can read community messages"
on public.spatdel_community_messages
for select to anon, authenticated
using (true);

create policy "Public can read community events"
on public.spatdel_community_events
for select to anon, authenticated
using (true);

create policy "Public can read community polls"
on public.spatdel_community_polls
for select to anon, authenticated
using (true);

grant select on public.spatdel_community_posts to anon, authenticated;
grant select on public.spatdel_community_comments to anon, authenticated;
grant select on public.spatdel_community_messages to anon, authenticated;
grant select on public.spatdel_community_events to anon, authenticated;
grant select on public.spatdel_community_polls to anon, authenticated;
