-- 0068: the Oct 12 one-list internal vocabulary (Ticket 5) — column defaults and the concepts rows.
-- 0067 rewrote creative_briefs rows only; the column default still minted 'sent_to_video_editor' and
-- concepts.internal_status (never written by the importer) sat on that default on every brand.
ALTER TABLE "creative_briefs" ALTER COLUMN "internal_status" SET DEFAULT 'draft';--> statement-breakpoint
UPDATE "concepts" SET "internal_status" = 'under_editing_or_designing' WHERE "internal_status" IN ('video_editing_in_progress', 'static_design_in_progress');--> statement-breakpoint
UPDATE "concepts" SET "internal_status" = 'sent_to_editor_or_designer' WHERE "internal_status" IN ('sent_to_video_editor', 'sent_to_designer');--> statement-breakpoint
UPDATE "concepts" SET "internal_status" = 'revisions_needed' WHERE "internal_status" IN ('images_revisions', 'videos_revisions');--> statement-breakpoint
UPDATE "concepts" SET "internal_status" = 'approved' WHERE "internal_status" = 'launched';--> statement-breakpoint
UPDATE "concepts" SET "internal_status" = 'draft' WHERE "internal_status" = 'on_hold';--> statement-breakpoint
ALTER TABLE "concepts" ALTER COLUMN "internal_status" SET DEFAULT 'draft';
