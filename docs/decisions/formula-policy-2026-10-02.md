# Formula field policy, with every offset resolved (2026-10-02)

Owner's policy: for every Airtable formula field, do NOT create a stored Drizzle column unless the
formula provably cannot be replicated at read time. Compute it in the query layer instead. If a
formula depends on an offset or multiplier that is not visible in the Airtable config, STOP and
record it rather than guessing.

**No field needs to stop.** Every formula in the Gratsi base exposes its text through the metadata
API, so the offsets below are quoted from the base itself, not inferred. Field ids were resolved to
field names before transcription. `docs/decisions/formula-blockers-2026-10-02.md` is therefore
deliberately absent: there are no blockers.

## Compute at read time — the formulas, verbatim from the base

| Table | Field | Formula (ids resolved to names) | Implementation |
| --- | --- | --- | --- |
| Email Campaigns Management | `Design Due Date` | `DATEADD({Send Date}, -5, 'days')` | derive from `send_date` |
| Email Campaigns Management | `Copywriting Due Date` | `DATEADD({Design Due Date}, -5, 'days')` | **chained** — `send_date − 10 days`, since Design Due Date is itself `send_date − 5` |
| Email Flows Management | `Design Due Date` | `DATEADD({Expected Setup Date}, -5, 'days')` | derive from `expected_setup_date` |
| Email Flows Management | `Copywriting Due Date` | `DATEADD({Design Due Date}, -5, 'days')` | **chained** — `expected_setup_date − 10 days` |
| SM Campaign Management Feed | `Reminder Trigger` | `IF(IS_AFTER(NOW(), DATEADD({Due Date}, -12, 'hours')), "Yes", "No")` | clock-dependent, so read time only — never stored |
| Creative Reporting | `Difference CPA` | `{CPA} - {Target CPA}` | derive |
| Creative Reporting | `Creative Name` | `{Creative Name (from Creative)}` | a lookup through the `Creative` link, not arithmetic |
| Campaigns & Offers | `Name` | `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})` | derive; mirrors the §7 naming style, renders `font-mono` |
| Creative Sheet | `Name` | `DATETIME_FORMAT({Created}, "MMMM") & "-" & {Creative Name}` | derive from `created_at` month name + the linked creative's name |
| UGC Management | `Creator's cost (USD)` | `IF({Platform}='Fiverr', {Creator's cost (USD) - Internal} * 1.055, IF({Platform}='Insense', {Creator's cost (USD) - Internal} * 1.10, {Creator's cost (USD) - Internal}))` | derive from `creator_cost` + `platform` |
| UGC Management | `Notify Flag` | `IF(AND({Date of Partnership Activation}, DATETIME_DIFF(TODAY(), {Date of Partnership Activation}, 'days') >= 25), "YES")` | clock-dependent, read time only |

Two things the owner should know, because the brief stated them differently:

1. **The UGC cost fee is platform-dependent, not a flat 5%.** The field's own description says "plus a
   5% fee", but the formula multiplies by **1.055 for Fiverr and 1.10 for Insense**, and leaves every
   other platform at cost. The formula is the authority; the description is stale. Implemented as the
   formula reads.
2. **The two Copywriting Due Dates are chained, not parallel.** Each is five days before the *Design*
   Due Date, which is itself five days before the send/setup date — so copywriting is due **ten**
   days before the send date, not five. A naive reading of "both are −5" would be wrong by five days.

`Angles.Name` is a plain text field in this base, not a formula, so it is stored as it is today.

## Not stored, not derived: lookups

`multipleLookupValues` fields (`Angles.Product (from Angles)`, `Angles.Personas (from Angles)`,
`Concepts.Performance`, and the fourteen on Creative Sheet) are reads through an existing link. They
are rendered by following the junction or FK at query time, exactly as the inherited values on the
concept and brief pages already work. No column, no import.
