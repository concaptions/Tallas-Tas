# Corrections to `template-base-diff-2026-10-02.md`

The audit beside this file is kept **verbatim** as the evidence for the template-base alignment
change: it is what the auditing agent wrote on 2026-10-02, unedited. This file records what is
wrong with it, so the contradiction is not left in the repo as unqualified evidence.

Source of truth for every correction below: the raw base metadata at
`scratchpad/template-base-2026-10-02.json` (Airtable meta API dump of the TEMPLATE base
`appnaSGAgOUbJ0f9m`).

## Correction 1 — §1 and §4 report two "MISSING" fields that §9 already maps. §9 is right.

**What the audit says.** Three sections describe the same two Airtable relationships and reach
opposite verdicts:

| Audit section | Field it describes | Verdict |
| --- | --- | --- |
| §1 Copywriting | `Copywriting › Collection` | **MISSING** — "No `collection_id` on `copywriting` and no `copywriting_collections` junction" |
| §4 Angles | `Angles › Collection` | **MISSING** — "No `collection_id` on `angles` and no `angle_collections` junction" |
| §9 (Internal) Collections | `Angles`, `Ads Copywriting copy` | `angle_id` ✓, `copywriting_id` ✓ — "**0 missing, 0 extra** — every field has a column" |

**Why §9 is right.** An Airtable link field is one relationship with a field record on each side,
and each side names the other in `inverseLinkFieldId`. The four field records are reciprocal pairs:

| Side A | Side B | Each names the other |
| --- | --- | --- |
| `Angles › Collection` `fldNoiIB7Wt2899R5` | `(Internal) Collections › Angles` `fldyhctoyBzoilkJM` | ✓ |
| `Copywriting › Collection` `fldcBR6KPyWH78h4r` | `(Internal) Collections › Ads Copywriting copy` `fldorCMW3TO42mGlv` | ✓ |

So §1's "missing" field and §9's `copywriting_id` are **the same link, field id for field id**, and
the same holds for §4 and `angle_id`. Nothing is missing. The audit counted each relationship once
from each end and called one of the two ends a gap.

**Consequence for the audit's headline.** The "Summary counts" and §537 "Additive work" claim of
**exactly two missing stored fields** is therefore wrong: the correct figure is **zero**. There is
no additive DDL for this change, and migration `0044_template-base-alignment.sql` — drafted to add
`angle_collections` and `copywriting_collections` — was **withdrawn** rather than shipped. The last
migration remains `0043_brief-due-date`.

**What was done instead.** `collections.angle_id` and `collections.copywriting_id` stay the single
canonical store for both links, which is what the shipped code already reads and writes
(`apps/web/src/app/app/collections/actions.ts`, `packages/db/src/collections.ts`,
`apps/web/src/app/app/collections/fields.ts`). `packages/db/src/collection-links.test.ts` pins that
decision: the columns exist, no junction shadows them, and brand isolation holds.

## Correction 2 — the real defect in §9 is the many→one collapse, and it is unresolved

§9's own second bullet is the finding that matters and it survives Correction 1: **five Airtable
multi-links are collapsed to a single uuid FK each** on `collections` (`campaign_id`, `angle_id`,
`product_id`, `copywriting_id`, `creative_design_2_id`). Both sides of both Collection links are
`multipleRecordLinks` with `prefersSingleRecordLink: false`, so a collection legitimately linked to
two angles keeps one.

This is a genuine fidelity gap, but closing it is **not** the additive change the audit proposed.
It is a migration of existing data into a junction plus a drop of two columns on a table with **5
production rows**, plus a rewrite of the collections Server Action, query functions and panel
fields. That is a destructive step requiring human approval, and it is carried as a blocker in
`docs/decisions/data-loss-blockers-2026-10-02.md` rather than guessed at here.

## Correction 3 — §4's `Collection` row is also mis-shaped for a second reason

§4 proposes `angle_collections` "or an `angles.collection_id`". Neither is needed (Correction 1): the
link is stored on the *collection* side, as `collections.angle_id`. The audit's §4 row should read
`reverse of collections.angle_id ✓`, in the same style it already uses for that table's
`(Internal) Creative Design` row.

One caveat, checked rather than assumed: **no shipped code reads that reverse direction yet.**
Grepping `apps/web` and `packages` for the angle→collections lookup finds only the forward reads in
`packages/db/src/collections.ts` (which resolves `angle_id` to an angle name for the collections
grid and panel) and the write in `apps/web/src/app/app/collections/actions.ts`. The angles workspace
and panel render no Collections section. So the field is *stored* but not *displayed on the angle
side* — a UI parity gap for the angles module, not a schema gap, and not fixed by this change.

## Not corrections

Everything else in the audit was checked against the schema and held, in particular:

- The 61 extra Drizzle columns across 10 tables and the 7 extra content tables (both lists verified
  table by table; see `docs/decisions/data-loss-blockers-2026-10-02.md` and
  `docs/decisions/extra-fields-kept-2026-10-02.md`).
- The PERSONAS deep dive: all 15 template fields are stored on `packages/db/src/schema/personas.ts`,
  `product_id` is the one extra, and the grid displays every template field. Verified field by
  field — the Personas complaint is an importer problem, not a schema one.
- `themes.category` being `NOT NULL` as the one hard import blocker for the template base.
