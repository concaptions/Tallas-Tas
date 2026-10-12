-- 0067: consolidate `creative_briefs.internal_status` onto the Oct 12 vocabulary (Ticket 5; applied
-- to Railway by hand on 2026-10-12 — 7 + 5 + 0 + 1 + 0 rows moved — BEFORE this file existed; the
-- apply script records the hash without re-running when no old value remains).
--
-- The two per-track lists (video / static) become one list: draft, sent_to_editor_or_designer,
-- under_editing_or_designing, ad_submitted, revisions_needed, revisions_submitted, approved.
-- `launched` is no longer an internal state (the media buyer's launch is `launched_at` and the
-- CLIENT track's `launched`); `on_hold` was never used in production. Idempotent: every UPDATE
-- matches only the old values.
UPDATE "creative_briefs" SET "internal_status" = 'under_editing_or_designing' WHERE "internal_status" IN ('video_editing_in_progress', 'static_design_in_progress');--> statement-breakpoint
UPDATE "creative_briefs" SET "internal_status" = 'sent_to_editor_or_designer' WHERE "internal_status" IN ('sent_to_video_editor', 'sent_to_designer');--> statement-breakpoint
UPDATE "creative_briefs" SET "internal_status" = 'revisions_needed' WHERE "internal_status" IN ('images_revisions', 'videos_revisions');--> statement-breakpoint
UPDATE "creative_briefs" SET "internal_status" = 'approved' WHERE "internal_status" = 'launched';--> statement-breakpoint
UPDATE "creative_briefs" SET "internal_status" = 'draft' WHERE "internal_status" = 'on_hold';
