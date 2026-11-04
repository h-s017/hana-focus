ALTER TABLE public.hana_intake_receipts
 ADD COLUMN receipt_kind text NOT NULL DEFAULT 'live' CHECK(receipt_kind IN ('live','historical')),
 ADD COLUMN submitted_at timestamptz,
 ADD COLUMN source_verified_at timestamptz,
 ADD COLUMN source_key text;
CREATE UNIQUE INDEX hana_intake_source_key ON public.hana_intake_receipts(owner_id,source_key) WHERE source_key IS NOT NULL;
GRANT SELECT(receipt_kind,submitted_at,source_verified_at) ON public.hana_intake_receipts TO authenticated;
COMMENT ON COLUMN public.hana_intake_receipts.receipt_kind IS 'Historical rows are verified imports from the original response worksheet; never counted as new/unread notifications.';
COMMENT ON COLUMN public.hana_intake_receipts.submitted_at IS 'Original form timestamp; history import must not replace it with import time.';
