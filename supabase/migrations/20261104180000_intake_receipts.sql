CREATE TABLE public.hana_intake_receipts (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES auth.users(id),digest text NOT NULL,
 student_name text NOT NULL CHECK(length(student_name) BETWEEN 1 AND 50),courses jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','saved','failed')),source_row integer,
 seen_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid NOT NULL DEFAULT gen_random_uuid(),attempts integer NOT NULL DEFAULT 1,
 ip_hash text NOT NULL,error_code text,source text NOT NULL DEFAULT 'quiz.hanascent.com / Google Sheets'
);
CREATE INDEX hana_intake_recent ON public.hana_intake_receipts(owner_id,created_at DESC);
CREATE INDEX hana_intake_rate ON public.hana_intake_receipts(ip_hash,created_at DESC);
ALTER TABLE public.hana_intake_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hana_intake_receipts FROM anon,authenticated;
GRANT SELECT(id,owner_id,student_name,courses,status,source_row,seen_at,created_at,source),UPDATE(seen_at) ON public.hana_intake_receipts TO authenticated;
CREATE POLICY intake_owner_read ON public.hana_intake_receipts FOR SELECT TO authenticated USING(owner_id=auth.uid() AND (auth.jwt()->'app_metadata'->>'hana_office_access')='true' AND (auth.jwt()->'app_metadata'->>'hana_reservation_read_access')='true');
CREATE POLICY intake_owner_seen ON public.hana_intake_receipts FOR UPDATE TO authenticated USING(owner_id=auth.uid() AND (auth.jwt()->'app_metadata'->>'hana_office_access')='true' AND (auth.jwt()->'app_metadata'->>'hana_reservation_read_access')='true') WITH CHECK(owner_id=auth.uid());
GRANT ALL ON public.hana_intake_receipts TO service_role;
CREATE FUNCTION public.hana_intake_claim(p_id uuid,p_owner uuid,p_digest text,p_name text,p_courses jsonb,p_ip_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hana_intake_receipts; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO r FROM public.hana_intake_receipts WHERE id=p_id;
 IF FOUND THEN
  IF r.digest<>p_digest OR r.owner_id<>p_owner THEN RAISE EXCEPTION 'intake_conflict'; END IF;
  IF r.status='saved' THEN RETURN jsonb_build_object('state','saved'); END IF;
  IF r.attempts>=5 OR (r.status='pending' AND r.updated_at>now()-interval '90 seconds') THEN RETURN jsonb_build_object('state','busy'); END IF;
  UPDATE public.hana_intake_receipts SET status='pending',lease_token=gen_random_uuid(),attempts=attempts+1,updated_at=now(),error_code=NULL WHERE id=p_id RETURNING * INTO r;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended(p_ip_hash,1));
  IF (SELECT count(*) FROM public.hana_intake_receipts WHERE ip_hash=p_ip_hash AND created_at>now()-interval '1 hour')>=30 OR (SELECT count(*) FROM public.hana_intake_receipts WHERE created_at>now()-interval '1 hour')>=300 THEN RETURN jsonb_build_object('state','rate_limited'); END IF;
  INSERT INTO public.hana_intake_receipts(id,owner_id,digest,student_name,courses,status,ip_hash) VALUES(p_id,p_owner,p_digest,p_name,p_courses,'pending',p_ip_hash) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('state','claimed','lease',r.lease_token);
END $$;
REVOKE ALL ON FUNCTION public.hana_intake_claim(uuid,uuid,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hana_intake_claim(uuid,uuid,text,text,jsonb,text) TO service_role;
COMMENT ON TABLE public.hana_intake_receipts IS 'Private completion receipts only; full answers remain in the original Google Sheet. Submission is an unverified student identity, not an order match. seen_at tracks HANA inbox review; no outgoing mail.';
