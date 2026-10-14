-- 0069: Ticket 6 — Creative Sheet missing fields.
-- Four new columns on creative_briefs, every one nullable; the Content section of the sidebar and
-- the Focus Mode content panel are the readers after the operator applies this.
-- Notes:
--   * `due_date` is NOT added here — migration 0043 already added it as `timestamp with time zone`
--     (nullable), the importer writes to it, and the sheet renders it. If the ticket wants a `date`
--     type instead of `timestamptz`, that is a type-change migration under its own tag; this
--     migration adds only columns that don't already exist.
--   * `brief_text` is distinct from the pre-existing `brief_to_design` column: `brief_text` is the
--     strategist's rich-text brief for the editor; `brief_to_design` is a legacy text field
--     reserved by the importer for the Airtable column of the same name. The UI wiring step will
--     choose how both surface in the sidebar.
--   * `voiceover_script` is distinct from the pre-existing `script_content` for the same reason.
ALTER TABLE "creative_briefs" ADD COLUMN "brief_text" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "music" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "voiceover_type" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD COLUMN "voiceover_script" text;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_voiceover_type_check" CHECK ("voiceover_type" IS NULL OR "voiceover_type" IN ('tts', 'human', 'none'));
