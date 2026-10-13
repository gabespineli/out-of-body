-- Dedicated Out of Body project only. No participant accounts or public table access.
create table public.oob_sessions (
  id uuid primary key,
  owner_hash text not null check (length(owner_hash) = 64),
  pair_hash text not null unique check (length(pair_hash) = 64),
  mobile_hash text check (mobile_hash is null or length(mobile_hash) = 64),
  status text not null default 'waiting' check (status in ('waiting','uploading','ready','received','completed','closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  pair_expires_at timestamptz not null,
  object_path text,
  upload_started_at timestamptz,
  check (object_path is null or object_path like id::text || '/%')
);
create index oob_sessions_expiry on public.oob_sessions (expires_at);
alter table public.oob_sessions enable row level security;
revoke all on public.oob_sessions from anon, authenticated;
grant all on public.oob_sessions to service_role;
-- No anon/authenticated policies: only server-side service-role requests can use this table.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oob-temporary-artwork', 'oob-temporary-artwork', false, 2500000, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = 2500000, allowed_mime_types = array['image/png'];
-- No public storage policies and no public/signed participant URLs.
