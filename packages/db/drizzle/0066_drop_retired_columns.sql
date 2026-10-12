-- 0066: drop the six columns the Oct 12 client sync retired (Tickets 2 and 15; applied to Railway
-- by hand on 2026-10-12 BEFORE this file existed — the apply script records the hash without
-- re-running anything when the columns are already gone).
--
-- Copywriting (Ticket 15): Used, Winning, Meta Rating and the Client's Comment left the form; the
-- client's note on a copy row lives in `client_approval_note` (AUDIT-13). Concepts (Ticket 2): the
-- duplicate "Formats to create (production)" and Production Status (Talal: "remove production
-- status from concepts"). Idempotent: DROP COLUMN IF EXISTS.
ALTER TABLE "copywriting" DROP COLUMN IF EXISTS "used";--> statement-breakpoint
ALTER TABLE "copywriting" DROP COLUMN IF EXISTS "winning";--> statement-breakpoint
ALTER TABLE "copywriting" DROP COLUMN IF EXISTS "meta_rating";--> statement-breakpoint
ALTER TABLE "copywriting" DROP COLUMN IF EXISTS "client_comment";--> statement-breakpoint
ALTER TABLE "concepts" DROP COLUMN IF EXISTS "formats_to_create";--> statement-breakpoint
ALTER TABLE "concepts" DROP COLUMN IF EXISTS "production_status";
