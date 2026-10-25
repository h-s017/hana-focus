-- pg_net defaults may grant PUBLIC table access; queued headers must remain private.
do $$ begin
 if to_regclass('net.http_request_queue') is not null then
  revoke all on net.http_request_queue from public,anon,authenticated;
 end if;
 if to_regclass('net._http_response') is not null then
  revoke all on net._http_response from public,anon,authenticated;
 end if;
end $$;
