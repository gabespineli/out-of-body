-- One installation, one permanent entry point. All writes run server-side.
create table public.oob_queue_control (
  id boolean primary key default true check (id),
  next_number bigint not null default 1,
  online_until timestamptz not null default now()
);
insert into public.oob_queue_control(id) values (true);
create table public.oob_queue_tickets (
  id uuid primary key,
  number bigint not null unique,
  mobile_hash text not null unique check (length(mobile_hash) = 64),
  client_hash text not null check (length(client_hash) = 64),
  participant_name text not null default '' check (char_length(participant_name) <= 40),
  status text not null default 'preparing' check (status in ('preparing','uploading','ready','called','active','completed','cancelled','expired')),
  created_at timestamptz not null default now(),
  order_at timestamptz,
  expires_at timestamptz not null,
  object_path text,
  image_bytes integer not null default 0 check (image_bytes between 0 and 2500000),
  check (object_path is null or object_path like 'queue/' || id::text || '/%')
);
create index oob_queue_expiry on public.oob_queue_tickets(expires_at);
create index oob_queue_order on public.oob_queue_tickets(order_at, number) where status in ('ready','called');
create unique index oob_queue_one_active on public.oob_queue_tickets ((true)) where status = 'active';
create unique index oob_queue_one_called on public.oob_queue_tickets ((true)) where status = 'called';
create unique index oob_queue_one_client on public.oob_queue_tickets(client_hash) where status in ('preparing','uploading','ready','called','active');
create table public.oob_queue_rate_limits (
  key text not null, window_start timestamptz not null, attempts integer not null,
  primary key (key, window_start)
);
create table public.oob_queue_usage (
  month date primary key,
  download_bytes bigint not null default 0,
  downloads bigint not null default 0,
  uploads bigint not null default 0
);
alter table public.oob_queue_control enable row level security;
alter table public.oob_queue_tickets enable row level security;
alter table public.oob_queue_rate_limits enable row level security;
alter table public.oob_queue_usage enable row level security;
revoke all on public.oob_queue_control, public.oob_queue_tickets, public.oob_queue_rate_limits, public.oob_queue_usage from anon, authenticated;
grant all on public.oob_queue_control, public.oob_queue_tickets, public.oob_queue_rate_limits, public.oob_queue_usage to service_role;

create function public.oob_queue_expire() returns void language sql security definer set search_path = '' as $$
  update public.oob_queue_tickets set status = 'expired', participant_name = ''
  where expires_at <= now() and status in ('preparing','uploading','ready','called','active');
$$;
-- A row lock serializes admission, upload publication and operator transitions.
create function public.oob_queue_join(p_id uuid, p_mobile_hash text, p_client_hash text)
returns public.oob_queue_tickets language plpgsql security definer set search_path = '' as $$
declare ticket public.oob_queue_tickets; counter bigint; hits integer;
begin
  perform 1 from public.oob_queue_control where id for update;
  perform public.oob_queue_expire();
  select * into ticket from public.oob_queue_tickets where client_hash = p_client_hash
    and status in ('preparing','uploading','ready','called','active') limit 1;
  -- The server re-derives this browser's ticket credential; no secret is returned by SQL.
  if found then return ticket; end if;
  if not exists (select 1 from public.oob_queue_control where online_until > now()) then raise exception 'QUEUE_OFFLINE'; end if;
  if (select count(*) from public.oob_queue_tickets where status in ('preparing','uploading','ready','called')) >= 20 then raise exception 'QUEUE_FULL'; end if;
  insert into public.oob_queue_rate_limits as r(key, window_start, attempts)
    values ('join:' || p_client_hash, date_trunc('hour', now()), 1)
    on conflict (key,window_start) do update set attempts = r.attempts + 1 returning attempts into hits;
  if hits > 6 then raise exception 'QUEUE_RATE'; end if;
  insert into public.oob_queue_rate_limits as r(key, window_start, attempts)
    values ('join:installation', date_trunc('hour', now()), 1)
    on conflict (key,window_start) do update set attempts = r.attempts + 1 returning attempts into hits;
  if hits > 120 then raise exception 'QUEUE_RATE'; end if;
  select next_number into counter from public.oob_queue_control where id;
  update public.oob_queue_control set next_number = next_number + 1 where id;
  insert into public.oob_queue_tickets(id,number,mobile_hash,client_hash,expires_at)
    values(p_id,counter,p_mobile_hash,p_client_hash,now() + interval '10 minutes') returning * into ticket;
  return ticket;
end; $$;

create function public.oob_queue_upload_attempt(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare hits integer;
begin
  insert into public.oob_queue_rate_limits as r(key,window_start,attempts)
    values('upload:' || p_id::text,date_trunc('minute',now()),1)
    on conflict(key,window_start) do update set attempts=r.attempts+1 returning attempts into hits;
  return hits <= 5;
end; $$;

create function public.oob_queue_publish(p_id uuid, p_path text, p_name text, p_bytes integer)
returns public.oob_queue_tickets language plpgsql security definer set search_path = '' as $$
declare ticket public.oob_queue_tickets;
begin
  perform 1 from public.oob_queue_control where id for update;
  update public.oob_queue_tickets set status='ready', participant_name=p_name, image_bytes=p_bytes,
    order_at=now(), expires_at=now() + interval '90 minutes'
    where id=p_id and status='uploading' and object_path=p_path and expires_at>now() returning * into ticket;
  if not found then raise exception 'QUEUE_EXPIRED'; end if;
  insert into public.oob_queue_usage as u(month,uploads) values(date_trunc('month',now())::date,1)
    on conflict(month) do update set uploads=u.uploads+1;
  return ticket;
end; $$;

create function public.oob_queue_action(p_action text, p_id uuid default null)
returns public.oob_queue_tickets language plpgsql security definer set search_path = '' as $$
declare ticket public.oob_queue_tickets;
begin
  perform 1 from public.oob_queue_control where id for update;
  perform public.oob_queue_expire();
  if p_action='call' then
    if exists(select 1 from public.oob_queue_tickets where status in ('called','active')) then raise exception 'QUEUE_BUSY'; end if;
    select * into ticket from public.oob_queue_tickets where status='ready' order by order_at,number limit 1;
    if not found then raise exception 'QUEUE_EMPTY'; end if;
    update public.oob_queue_tickets set status='called' where id=ticket.id returning * into ticket;
  else
    select * into ticket from public.oob_queue_tickets where id=p_id for update;
    if not found then raise exception 'QUEUE_EXPIRED'; end if;
    if p_action='start' and ticket.status='active' then return ticket; end if;
    if p_action in ('remove','end','complete','cancel') and ticket.status in ('completed','cancelled','expired') then return ticket; end if;
    if p_action='start' then
      if ticket.status<>'called' or exists(select 1 from public.oob_queue_tickets where status='active') then raise exception 'QUEUE_BUSY'; end if;
      update public.oob_queue_tickets set status='active',expires_at=now()+interval '30 minutes' where id=p_id returning * into ticket;
    elsif p_action='later' then
      if ticket.status not in ('ready','called') then raise exception 'QUEUE_BUSY'; end if;
      update public.oob_queue_tickets set status='ready',order_at=now() where id=p_id returning * into ticket;
    elsif p_action in ('remove','end','complete','cancel') then
      if p_action='complete' and ticket.status<>'active' then raise exception 'QUEUE_BUSY'; end if;
      if p_action='remove' and ticket.status='active' then raise exception 'QUEUE_BUSY'; end if;
      update public.oob_queue_tickets set status=case when p_action='complete' then 'completed' else 'cancelled' end,
        participant_name='',expires_at=now() where id=p_id returning * into ticket;
    else raise exception 'QUEUE_ACTION'; end if;
  end if;
  return ticket;
end; $$;

create function public.oob_queue_record_download(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.oob_queue_usage as u(month,download_bytes,downloads)
    select date_trunc('month',now())::date,image_bytes,1 from public.oob_queue_tickets where id=p_id and status='active' and expires_at>now()
    on conflict(month) do update set download_bytes=u.download_bytes+excluded.download_bytes,downloads=u.downloads+1;
$$;
revoke all on function public.oob_queue_expire(),public.oob_queue_join(uuid,text,text),public.oob_queue_upload_attempt(uuid),
  public.oob_queue_publish(uuid,text,text,integer),public.oob_queue_action(text,uuid),public.oob_queue_record_download(uuid) from public,anon,authenticated;
grant execute on function public.oob_queue_expire(),public.oob_queue_join(uuid,text,text),public.oob_queue_upload_attempt(uuid),
  public.oob_queue_publish(uuid,text,text,integer),public.oob_queue_action(text,uuid),public.oob_queue_record_download(uuid) to service_role;
