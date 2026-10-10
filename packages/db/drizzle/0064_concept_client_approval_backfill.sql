-- 0064: backfill `concepts.client_approval_status` from the legacy `approval_status` (SMOKE-18,
-- Talal's Option B, 2026-10-11).
--
-- The Gratsi import wrote the Airtable "Status" of a concept into `approval_status` (the concept
-- vocabulary: draft / pending_client / approved / rejected / revision_needed) and never into
-- `client_approval_status`, the column the Concepts page renders as "Client Approval" — so the
-- page showed every concept as unset while the tester's "Status" column held the real answer
-- (live: approved 87, pending_client 12, rejected 2, NULL 1; `client_approval_status` NULL on all).
-- This copies the three legacy values into the ONE client vocabulary (`CLIENT_STATUS`):
--   approved → approved · pending_client → pending_for_approval · rejected → disapproved
-- A NULL `approval_status` is left alone, as is `draft` / `revision_needed` (no live row carries
-- them; the mapping is deliberately not invented). A row whose `client_approval_status` is already
-- set is NOT overwritten: a value the team chose on the platform outranks the import's. The WHERE
-- is the idempotency guard, so a re-run touches nothing.
-- Only the status column moves: `updated_at` / `updated_by` keep the last human edit, and
-- `client_approval_status_updated_at` stays NULL — a backfill is not a client decision.
UPDATE "concepts"
SET "client_approval_status" = CASE "approval_status"
	WHEN 'approved' THEN 'approved'
	WHEN 'pending_client' THEN 'pending_for_approval'
	WHEN 'rejected' THEN 'disapproved'
END
WHERE "approval_status" IN ('approved', 'pending_client', 'rejected')
  AND "client_approval_status" IS NULL
  AND "deleted_at" IS NULL;
