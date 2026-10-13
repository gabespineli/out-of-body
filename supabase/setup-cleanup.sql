-- Run in the dedicated hosted project AFTER the app is deployed and Vault secrets are set.
-- Vault names: oob_cleanup_url = https://YOUR_APP/api/participant/cleanup
--              oob_cleanup_secret = the same secret as the app's OOB_CLEANUP_SECRET
-- Enter these values through the Vault dashboard, not committed SQL or console output.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function public.oob_dispatch_cleanup()
returns bigint language plpgsql security definer set search_path = '' as $$
declare endpoint text; secret text; request_id bigint;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'oob_cleanup_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'oob_cleanup_secret' limit 1;
  if endpoint is null or secret is null or not (
    endpoint like 'https://%/api/participant/cleanup'
    or endpoint ~ '^http://host[.]docker[.]internal:[0-9]+/api/participant/cleanup$'
  ) then
    raise exception 'Configure Out of Body cleanup endpoint and secret in Vault first';
  end if;
  select net.http_post(url := endpoint, headers := jsonb_build_object('Authorization','Bearer ' || secret,
    'Content-Type','application/json'), body := '{}'::jsonb, timeout_milliseconds := 30000) into request_id;
  return request_id;
end;
$$;
revoke all on function public.oob_dispatch_cleanup() from public, anon, authenticated;
select cron.schedule('out-of-body-temporary-cleanup', '* * * * *', 'select public.oob_dispatch_cleanup();');
