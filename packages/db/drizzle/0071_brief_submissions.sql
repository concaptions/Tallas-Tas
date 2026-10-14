-- 0071: Ticket 10 version chip row — the uploads history for a brief.
-- One row per uploaded submission; at most one row per brief is `is_current = true`.
-- Notes:
--   * `(brief_id, version)` is unique so the chip row and the annotation link never see
--     two rows with the same number for one brief.
--   * The partial unique index on `is_current = true` enforces at most one "current"
--     submission per brief at the database level — a swap is a two-step write under the
--     caller's transaction.
--   * `thumbnail_url` and `duration_seconds` are nullable: an image upload has no duration,
--     and a brand-new row may be rendered before its thumbnail is derived.
CREATE TABLE "brief_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brief_id" uuid NOT NULL REFERENCES "creative_briefs"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id"),
  "file_url" text NOT NULL,
  "file_type" text NOT NULL,
  "thumbnail_url" text,
  "duration_seconds" integer,
  "uploaded_at" timestamp with time zone NOT NULL DEFAULT now(),
  "is_current" boolean NOT NULL DEFAULT false,
  CONSTRAINT "brief_submissions_brief_version_unique" UNIQUE ("brief_id", "version")
);--> statement-breakpoint
CREATE UNIQUE INDEX "brief_submissions_one_current" ON "brief_submissions" ("brief_id") WHERE "is_current" = true;
