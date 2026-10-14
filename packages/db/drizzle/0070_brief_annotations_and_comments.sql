-- 0070: Tickets 10 & 11 scaffolding — annotations overlay and comment threads.
-- Two tables keyed to a brief and (optionally) a submission version. Both soft-deletable.
-- Notes:
--   * `submission_version` on `brief_annotations` is nullable because an annotation can be
--     filed before any upload exists; on `brief_comments` it is required — a comment thread
--     is always anchored to a specific version.
--   * `x_pct` / `y_pct` are percentages (0–100) with two decimals, so the overlay reads a
--     fractional coordinate without a round trip to pixels.
--   * `parent_comment_id` is self-referential and NULL for root comments; a partial index keeps
--     the lookup cheap for threaded replies.
CREATE TABLE "brief_annotations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brief_id" uuid NOT NULL REFERENCES "creative_briefs"("id") ON DELETE CASCADE,
  "submission_version" integer,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "x_pct" numeric(5,2) NOT NULL CHECK ("x_pct" BETWEEN 0 AND 100),
  "y_pct" numeric(5,2) NOT NULL CHECK ("y_pct" BETWEEN 0 AND 100),
  "note" text NOT NULL,
  "deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "brief_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brief_id" uuid NOT NULL REFERENCES "creative_briefs"("id") ON DELETE CASCADE,
  "submission_version" integer NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "body" text NOT NULL,
  "parent_comment_id" uuid REFERENCES "brief_comments"("id"),
  "deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX "brief_annotations_brief_version_idx" ON "brief_annotations" ("brief_id", "submission_version");--> statement-breakpoint
CREATE INDEX "brief_comments_brief_version_idx" ON "brief_comments" ("brief_id", "submission_version");--> statement-breakpoint
CREATE INDEX "brief_comments_parent_idx" ON "brief_comments" ("parent_comment_id") WHERE "parent_comment_id" IS NOT NULL;
