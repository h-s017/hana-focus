-- Matches the applied Supabase migration 20261026093510.
-- The preexisting check accepted only pending/microsoft/google; Canva Connect
-- OAuth token exchange therefore failed at credential persistence (HTTP 400).
-- Scope-only change: does not change data, owner isolation, table grants or RLS.
ALTER TABLE public.hana_connector_credentials
  DROP CONSTRAINT hana_connector_credentials_kind_check;
ALTER TABLE public.hana_connector_credentials
  ADD CONSTRAINT hana_connector_credentials_kind_check
  CHECK (kind IN ('pending', 'microsoft', 'google', 'canva'));
