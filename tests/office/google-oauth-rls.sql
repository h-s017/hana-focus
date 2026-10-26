-- Existing audit table only; synthetic transaction fixtures. No schema/data migration.
set local role service_role;
do $$
declare owner uuid:='10000000-0000-4000-8000-000000000003'; other uuid:='10000000-0000-4000-8000-000000000001'; flow uuid:=gen_random_uuid(); n integer;
begin
 if not public.hana_focus_allowed(owner) then raise exception 'trusted owner unavailable';end if;
 insert into public.hana_automation_events(id,owner_id,project,code,details) values(flow,owner,'fixture','google_oauth_pending','{"state_hash":"synthetic-hash","expires_at":9999999999999,"payload":"synthetic-encrypted-pkce"}');
 update public.hana_automation_events set code='google_oauth_claimed',details='{}' where id=flow and owner_id=other and code='google_oauth_pending';get diagnostics n=row_count;if n<>0 then raise exception 'cross-owner claim';end if;
 update public.hana_automation_events set code='google_oauth_claimed',details='{}' where id=flow and owner_id=owner and code='google_oauth_pending' and details->>'state_hash'='wrong';get diagnostics n=row_count;if n<>0 then raise exception 'forged claim';end if;
 update public.hana_automation_events set code='google_oauth_claimed',details='{"consumed_at":"fixture"}' where id=flow and owner_id=owner and code='google_oauth_pending' and details->>'state_hash'='synthetic-hash' and details->>'expires_at'='9999999999999';get diagnostics n=row_count;if n<>1 then raise exception 'claim failed';end if;
 update public.hana_automation_events set code='google_oauth_claimed',details='{}' where id=flow and owner_id=owner and code='google_oauth_pending';get diagnostics n=row_count;if n<>0 then raise exception 'replay claim';end if;
 if (select details ? 'payload' from public.hana_automation_events where id=flow) then raise exception 'pending verifier retained';end if;
 if has_table_privilege('authenticated','public.hana_automation_events','UPDATE') or has_table_privilege('authenticated','public.hana_connector_credentials','SELECT') then raise exception 'client can claim or read credentials';end if;
end $$;
reset role;
