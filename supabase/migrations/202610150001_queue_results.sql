-- Private, short-lived finished drawings. Existing ticket credentials own downloads.
alter table public.oob_queue_tickets
  add column result_path text,
  add column result_bytes integer not null default 0 check (result_bytes between 0 and 2500000),
  add constraint oob_queue_result_path check (result_path is null or result_path = 'queue/' || id::text || '/completed.png');

create function public.oob_queue_finish(p_id uuid, p_bytes integer)
returns public.oob_queue_tickets language plpgsql security definer set search_path = '' as $$
declare ticket public.oob_queue_tickets;
begin
  perform 1 from public.oob_queue_control where id for update;
  perform public.oob_queue_expire();
  select * into ticket from public.oob_queue_tickets where id=p_id for update;
  if not found then raise exception 'QUEUE_EXPIRED'; end if;
  if ticket.status='completed' and ticket.result_path is not null then return ticket; end if;
  if ticket.status<>'active' then raise exception 'QUEUE_BUSY'; end if;
  update public.oob_queue_tickets set status='completed',participant_name='',expires_at=now()+interval '1 hour',
    result_path='queue/' || id::text || '/completed.png',result_bytes=p_bytes
    where id=p_id returning * into ticket;
  insert into public.oob_queue_usage as u(month,uploads) values(date_trunc('month',now())::date,1)
    on conflict(month) do update set uploads=u.uploads+1;
  return ticket;
end; $$;

create function public.oob_queue_result_download(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.oob_queue_usage as u(month,download_bytes,downloads)
    select date_trunc('month',now())::date,result_bytes,1 from public.oob_queue_tickets
    where id=p_id and status='completed' and result_path is not null and expires_at>now()
    on conflict(month) do update set download_bytes=u.download_bytes+excluded.download_bytes,downloads=u.downloads+1;
$$;
revoke all on function public.oob_queue_finish(uuid,integer),public.oob_queue_result_download(uuid) from public,anon,authenticated;
grant execute on function public.oob_queue_finish(uuid,integer),public.oob_queue_result_download(uuid) to service_role;
