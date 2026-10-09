UPDATE "creative_briefs" AS b
SET "client_status" = CASE s."status"
      WHEN 'approved' THEN 'approved'
      WHEN 'launched' THEN 'launched'
      WHEN 'revisions_needed' THEN 'revisions_needed'
      WHEN 'revisions_submitted' THEN 'revisions_submitted'
      WHEN 'denied' THEN 'disapproved'
      WHEN 'pending_for_approval' THEN 'pending_for_approval'
      ELSE b."client_status"
    END,
    "client_status_updated_at" = s."updated_at",
    "launched_at" = CASE WHEN s."status" = 'launched' THEN COALESCE(b."launched_at", s."updated_at") ELSE b."launched_at" END
FROM "creative_sheet_items" AS s
WHERE s."brief_id" = b."id"
  AND s."brand_id" = b."brand_id"
  AND s."deleted_at" IS NULL
  AND b."deleted_at" IS NULL
  AND s."status" IS NOT NULL;--> statement-breakpoint
UPDATE "creative_briefs" AS b
SET "qa_checklist_doc" = s."qa_checklist_doc"
FROM "creative_sheet_items" AS s
WHERE s."brief_id" = b."id"
  AND s."brand_id" = b."brand_id"
  AND s."deleted_at" IS NULL
  AND b."deleted_at" IS NULL
  AND s."qa_checklist_doc" IS NOT NULL
  AND jsonb_array_length(s."qa_checklist_doc") > 0
  AND s."qa_checklist_doc" IS DISTINCT FROM b."qa_checklist_doc";--> statement-breakpoint
UPDATE "creative_briefs" AS b
SET "spelling_feedback" = s."spelling_feedback"
FROM "creative_sheet_items" AS s
WHERE s."brief_id" = b."id"
  AND s."brand_id" = b."brand_id"
  AND s."deleted_at" IS NULL
  AND b."deleted_at" IS NULL
  AND NULLIF(btrim(s."spelling_feedback"), '') IS NOT NULL
  AND s."spelling_feedback" IS DISTINCT FROM b."spelling_feedback";
