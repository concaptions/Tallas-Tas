# Client-base fields with no template equivalent (2026-10-02)

The template base `appnaSGAgOUbJ0f9m` is the source of truth for what the app displays (Talal,
2026-10-02). A client base may carry fields the template does not. Where the two bases merely
RENAMED the same datum, the importer reads both names into one column through `PERSONA_FIELDS`-style
alias lists in `packages/db/src/airtable-import.ts` (template name first, client aliases after).
Where a client field has no template equivalent, the rule is this document, not a forced mapping:
guessing a target silently overwrites a real field and makes the data less trustworthy than an
honest blank. Field names below are verbatim from each base's live metadata; the full field-by-field
comparison is `docs/audits/base-field-mapping-2026-10-02.md`.

## Decided — Personas, the worked example

| Gratsi field | Decision | Reason |
| --- | --- | --- |
| `Passion` (richText) | **Not imported.** Needs Talal. | It is the only one of Gratsi's 7 Personas fields with no template counterpart. It previously landed in `core_desires`, which displaced the field that genuinely belongs there (`Drivers for this persona`), so the old mapping made two columns wrong at once. Options, for Talal: (a) leave it out, as now; (b) read it into `emotional_triggers`, which is the nearest template field but still a guess; (c) add a column, which argues against the template base being the authority. |

Corrected in the same change, both verified against the live bases:

- `Drivers for this persona` → `core_desires` (was `emotional_triggers`). Template counterpart:
  `Core Desires (Cashvertising)`.
- The template's own names carry their framework in parentheses, so the previous short-name reads
  (`f['Core Desires']`, `f['Pain Points']`, `f['Problem Challenge']`, …) matched ELEVEN of the
  fifteen template fields not at all, and `A Day in the Life` was never read. A template import
  would have produced near-empty personas.

**Consequence Talal should expect:** for the Gratsi brand, 10 of the 15 template Personas columns
are now legitimately blank, because the Gratsi base holds no such data — `A Day in the Life`,
`Emotional Triggers`, `Pain Points`, `Success Factors`, `Perceived Barriers`, `Buying Triggers`,
`Problem/Challenge`, `Success/Transformation`, `Trigger Words`, and `Product`. No mapping can fill
them. The em-dashes are the honest reading of a client base with 7 fields against a template with
15; the fix for them is data entry in Airtable, or hiding template columns per brand (which is what
the per-brand column config exists for).

## Not yet decided — the same question on every other table

Subagent A's comparison found client-only fields on ten further paired tables. They are NOT mapped
and NOT dropped; they are listed here so the decision is explicit rather than implied by silence.
Counts are of stored (non-computed) fields with no template counterpart:

| Table | Gratsi-only fields | The ones that matter |
| --- | --- | --- |
| Angles | 16 | `Status`, `Potential`, `Winning`, `Internal Notes`, `Client Notes`, `Brief`, `Exact Script`, `Ad Inspo`, `Formats to create` — all real, populated Gratsi data with columns already in our schema |
| Concepts | 10 | `Decription` (sic), `Pain Points`, `USP`, `Client's Comments`, `Type`, `Product`, `Personas`, `Collection` |
| Creative Design | 9 | `Batch`, `Language`, `Offer`, `Creative Module`, `Spelling Feedback 2` |
| Meta Copywriting | 13 | `Angle`, `Campaign Code`, `Funnel`, `Copy Type`, `Winning`, `Meta Rating`, `Client's Comment` |
| UGC Management | 8 | `Creator's cost (USD) - Internal`, `Paid by TAS`, `Creator Status`, `Payment Date`, `Creator Info Request` |
| Campaigns & Offers | 7 | `Promotional Ideas`, `Interested`, and five link fields |
| (Internal) Collections | 5 | `Copywriting`, `Creative Sheet`, `Table 17` |
| (Internal) Product | 6 | `Youtube Copywriting`, `Table 17`, `Creative Sheet` |
| Themes / Creative Modules | 1 | `(Internal) Creative Design` |
| Creative Sheet | 10 | the QA checkboxes and `Spelling Feedback` |

The question for Talal is one question asked ten times: **when a client base carries a field the
template does not, does the app show it for that client, or not at all?** Non-negotiables 1 and 2
and the per-brand column config were built for the first answer — see
`docs/audits/inheritance-plan-2026-10-02.md`; the `brand_field_overrides` table CLAUDE.md:66 names
does not exist, and `column_definitions` is what replaces it. Until
it is answered, these fields keep their columns and their imported data, and the app shows the
template's column set.
