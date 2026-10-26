-- HANA AI OFFICE Canva import jobs: idempotent per owner and lesson date.
-- Privileged Edge Function writes only; browser receives safe status and design URL.
CREATE TABLE IF NOT EXISTS public.hana_canva_import_jobs (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_date date NOT NULL,
  job_id text,
  status text NOT NULL DEFAULT 'reserved',
  design_id text,
  edit_url text,
  page_count integer,
  error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, lesson_date),
  CONSTRAINT hana_canva_import_status_chk CHECK (status IN ('reserved','in_progress','success','failed','needs_verification')),
  CONSTRAINT hana_canva_import_page_count_chk CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 150),
  CONSTRAINT hana_canva_import_design_id_chk CHECK (design_id IS NULL OR design_id ~ '^[A-Za-z0-9_-]{6,64}$')
);
ALTER TABLE public.hana_canva_import_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hana_canva_import_jobs FROM PUBLIC, anon, authenticated;
-- service_role, already bound by the Edge Function to a verified HANA owner, is sole writer.
