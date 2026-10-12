-- The community directory and per-community pages read country for search and display.
-- Keep this as a follow-up migration so existing databases can apply it safely.
alter table public.communities
  add column if not exists country text;

create index if not exists communities_country_status_name_idx
  on public.communities (country, status, name);
