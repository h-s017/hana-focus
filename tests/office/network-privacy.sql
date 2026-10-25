create schema net;
create table net.http_request_queue(id integer);
create table net._http_response(id integer);
grant usage on schema net to public;
grant all on net.http_request_queue,net._http_response to public;
\i supabase/schema/hana-network-privacy.sql
do $$ begin
 if has_table_privilege('anon','net.http_request_queue','select') or has_table_privilege('authenticated','net.http_request_queue','select') then raise exception 'queued_headers_exposed';end if;
 if has_table_privilege('anon','net._http_response','select') then raise exception 'private_response_exposed';end if;
end $$;
select 'PASS: pg_net queued headers and responses denied to clients' as network_result;
