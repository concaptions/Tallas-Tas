# Extra Drizzle columns that shipped code uses (2026-10-02)

Companion to `docs/audits/template-base-diff-2026-10-02.md` and to
`docs/decisions/data-loss-blockers-2026-10-02.md`.

The audit finds **61 Drizzle columns with no field in the Airtable TEMPLATE base**
`appnaSGAgOUbJ0f9m`, the source of truth from 2026-10-02. This document answers one question about
each of them: **does code we have shipped read or write it?** For every column below the answer is
yes, and the reason given is the file that does it. Each was checked by grepping `apps/web` and
`packages` for the camelCase property and the snake_case column name; test files are not counted as
a reason on their own, so every file named here is production code.

**56 of the 61 have a reader; 5 have none, plus one (`click_for_ai_spell_checker`) that only the
importer writes.** The five with no reader are listed at the end and carried in
`data-loss-blockers-2026-10-02.md` instead: a column with no reader still stays, because it holds
imported Gratsi data, but "nothing reads it" is not a reason to keep it — so it is recorded as a
data-loss risk rather than as a dependency. `click_for_ai_spell_checker` is counted in the 56
because `packages/db/src/airtable-import.ts` writes it; it appears in the closing list too, under
its own heading, because no page displays it. It is one column, counted once.

The 56 is the sum of the per-table sections below: 10 + 10 + 9 + 6 + 7 + 7 + 4 + 1 + 1 + 1.

Every table in this document carries production rows (counts in the blockers doc), so none of these
columns is droppable regardless of this list. Dropping a column in use would additionally break a
page.

## `creative_briefs` (10 of 12 in use)

| Column | The file that uses it |
| --- | --- |
| `batch` | `apps/web/src/app/app/creative-design/actions.ts` — a standalone brief supplies its own batch, a linked brief inherits it; `packages/db/src/briefs.ts` reads it for the PRD §7 name |
| `version` | `apps/web/src/app/app/creative-design/actions.ts` (a `@tas/domain/creatives` vocabulary member); `packages/domain/src/creatives/creative-name.ts` builds the name from it |
| `sequence` | `apps/web/src/app/app/creative-design/actions.ts`; `packages/db/src/briefs.ts` assigns it |
| `due_date` | `apps/web/src/app/app/creative-design/actions.ts` (`dueDate: optionalDate` in the zod schema) and the briefs workspace column |
| `script_content` | `apps/web/src/app/app/creative-design/spell-check-action.ts` — the text the spell checker runs on |
| `inspo_links` | `apps/web/src/app/app/creative-design/actions.ts`; `packages/domain/src/creatives/thumbnail.ts` picks the thumbnail from it |
| `spelling_feedback_2` | `apps/web/src/app/app/creative-design/actions.ts` and the brief detail |
| `language` | `apps/web/src/app/app/creative-design/actions.ts`; `packages/domain/src/views/table-views.ts` offers it as a saved-view filter |
| `offer` | `apps/web/src/app/app/creative-design/actions.ts` and the brief detail |
| `asset_id` | `apps/web/src/app/app/creative-design/[briefId]/page.tsx` — resolves the R2 upload's filename |

Not in use: `launched_at`, `launch_priority`.

## `creative_sheet_items` (10 of 10 in use)

Every one of the ten is read or written by `apps/web/src/app/app/creative-sheet/`:

| Column | The file that uses it |
| --- | --- |
| `internal_status` | `creative-sheet-panel.tsx` (the hidden input the Server Action reads) |
| `qa_checklist_doc` | `creative-sheet-panel.tsx` (labelled field + `fieldError`) |
| `qa_video_editor` | `actions.ts` (`qaVideoEditor: checkbox`) and the panel's QA row |
| `qa_designer` | `actions.ts` (`qaDesigner: checkbox`) and the panel's QA row |
| `qa_strategist` | `actions.ts` (`qaStrategist: checkbox`) and the panel's QA row |
| `used` | `actions.ts` (`used: checkbox`) and the panel |
| `denied_revisions_needed` | `actions.ts` and `apps/web/src/app/(dev)/design-system/creative-sheet.stories.tsx` |
| `winning` | `creative-sheet-panel.tsx` (hidden input) |
| `spell_check_requested` | `actions.ts` and the design-system story |
| `spelling_feedback` | `creative-sheet-panel.tsx` (labelled read-only block) |

## `angles` (9 of 9 in use)

| Column | The file that uses it |
| --- | --- |
| `formats` | `apps/web/src/app/app/angles/angle-panel.tsx` — the "Formats to create" toggles |
| `ad_inspo_links` | `apps/web/src/app/app/angles/angle-panel.tsx` — the repeated-link editor |
| `potential` | `apps/web/src/app/app/angles/angles-workspace.tsx` — its own grid column |
| `winning` | `apps/web/src/app/app/angles/angle-panel.tsx` |
| `status` | `apps/web/src/app/app/angles/fields.ts` (`angleStatusView`) and `actions.ts`, keyed on `angleStatuses` from `@tas/db/schema` |
| `internal_notes` | `apps/web/src/app/app/angles/angles-workspace.tsx` grid column + `actions.ts` |
| `client_notes` | `apps/web/src/app/app/angles/angles-workspace.tsx` grid column + `actions.ts` |
| `brief_url` | `apps/web/src/app/app/angles/angles-workspace.tsx` (`LinkCell`) + `actions.ts` |
| `exact_script_url` | `apps/web/src/app/app/angles/angles-workspace.tsx` (`LinkCell`) + `actions.ts` |

## `creators` (6 of 9 in use)

| Column | The file that uses it |
| --- | --- |
| `cost_usd` | `apps/web/src/app/app/ugc/ugc-workspace.tsx` — the `MoneyCell` column, and the panel's cost input is bound to it |
| `concept_ids` | `apps/web/src/app/app/ugc/ugc-workspace.tsx` and `creator-card.tsx` (the linked-concept count) |
| `product_ids` | `apps/web/src/app/app/ugc/ugc-workspace.tsx` and `creator-card.tsx` |
| `slack_notified` | `apps/web/src/app/app/ugc/ugc-workspace.tsx` (`BoolCell`); `actions.ts` documents it as scanner-owned, not panel-editable |
| `payment_date` | `apps/web/src/app/app/ugc/ugc-workspace.tsx` (`DateCell`) |
| `creator_info_request` | `apps/web/src/app/app/ugc/ugc-workspace.tsx` + `actions.ts` |

Not in use: `current_period_start`, `partnership_ended_at`, `requires_attention`.

## `copywriting` (7 of 7 in use)

| Column | The file that uses it |
| --- | --- |
| `concept_id` | `apps/web/src/app/app/meta-copywriting/copy-panel.tsx` — the Concept select |
| `funnel` | `apps/web/src/app/app/meta-copywriting/copy-panel.tsx` — the Funnel select |
| `winning` | `apps/web/src/app/app/meta-copywriting/copy-panel.tsx` |
| `meta_rating` | `apps/web/src/app/app/meta-copywriting/copy-panel.tsx` |
| `click_for_ai_spell_checker` | `packages/db/src/airtable-import.ts:974` writes it from Gratsi "Click for AI Spell Checker Again", and `packages/db/src/scripts/import-mappings.ts:585` maps it. **No UI reads it yet** — the column is importer-owned, so it is in use but not displayed |
| `spelling_feedback` | `apps/web/src/app/app/meta-copywriting/copy-panel.tsx` (the feedback block) |
| `client_comment` | `apps/web/src/app/app/meta-copywriting/copy-panel.tsx` (`COPY_HEADINGS.clientComment`) |

## `themes` (7 of 7 in use)

| Column | The file that uses it |
| --- | --- |
| `category` | `apps/web/src/app/app/themes/theme-card.tsx` — the category chip, tone from `themeCategoryTone`. `NOT NULL`, which is the audit's one hard import blocker for the template base |
| `notes` | `apps/web/src/app/app/themes/theme-card.tsx` (`FieldRow`) and the grid column |
| `assignee_id` | `apps/web/src/app/app/themes/fields.ts` — resolved to `assigneeName` for the card |
| `status` | `apps/web/src/app/app/themes/theme-card.tsx` — `statusChip(theme.status)` |
| `attachments` | `apps/web/src/app/app/themes/theme-card.tsx` — `attachmentChipRow(theme.attachments)` |
| `ai_attachment_summary` | `apps/web/src/app/app/themes/theme-card.tsx` and the grid column |
| `is_active` | `apps/web/src/app/app/themes/theme-card.tsx` — the Archive / Restore control |

## `concepts` (4 of 4 in use)

| Column | The file that uses it |
| --- | --- |
| `formats` | `apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx` — the "Formats to create" toggles |
| `client_comments` | `apps/web/src/app/app/concepts/concepts-workspace.tsx` grid column + the detail |
| `internal_status` | `apps/web/src/app/app/concepts/concepts-workspace.tsx` — the Kanban's `kanbanGroupByField` |
| `client_status` | `apps/web/src/app/app/concepts/concepts-workspace.tsx` — a `StatusChip` column (CLAUDE.md non-negotiable 4) |

## `campaigns_offers` (1 of 1 in use)

| Column | The file that uses it |
| --- | --- |
| `promotional_ideas` | `apps/web/src/app/app/campaigns-offers/actions.ts` (`promotionalIdeas: optionalText`), and `apps/web/e2e/module-parity.spec.ts` asserts the panel labels it |

## `products` (1 of 1 in use)

| Column | The file that uses it |
| --- | --- |
| `collection_link` | `apps/web/src/app/app/products/products-workspace.tsx` — a grid column and part of the search predicate. PRD §5.1 asks for it |

## `personas` (1 of 1 in use)

| Column | The file that uses it |
| --- | --- |
| `product_id` | `packages/db/src/personas.ts:73` resolves it to `productName`, which `apps/web/src/app/app/personas/personas-workspace.tsx` renders as the `Product` grid column |

## The five with no reader

These are kept, and the reason is in `docs/decisions/data-loss-blockers-2026-10-02.md`, not here.
Nothing outside `packages/db/src/demo-data.ts` (the fixtures, which set them to null or false)
touches any of them:

- `creative_briefs.launched_at`
- `creative_briefs.launch_priority`
- `creators.current_period_start`
- `creators.partnership_ended_at`
- `creators.requires_attention`

They arrived with migrations 0032 / 0035 (the partnership scanner) and 0033 (ads to launch) for work
that is not wired to a page yet. They are columns waiting for a feature, not dead weight, and the
tables they sit on hold 397 and 75 production rows.

### And one written but never displayed

`copywriting.click_for_ai_spell_checker` is **not** in the five: `packages/db/src/airtable-import.ts`
writes it on every import, so it has a reader in production code and is counted in the 56 above. It
is called out separately only because no page displays it, which makes it the one column whose value
is write-only today. Dropping it would silently discard what the importer stores.
