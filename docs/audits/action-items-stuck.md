# Action items — stuck, blocked and deferred

Written during the 69-item run of 2026-10-04. Every entry here is something the run deliberately did
NOT build, with the reason and the exact evidence. Nothing in this file was dropped silently.

## 1. Blocked on a credential that does not exist on this machine

### AI-30, AI-31 — Cloud storage for uploads, and UGC multi-video upload

The R2 code path is written and wired; what is missing is the account.
`packages/integrations/r2` exists and is imported, but **none of the four variables** it needs is
present — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. `docs/runbook.md:30`
already marks them Human / Phase 4. Production `assets` holds **0 rows**, so no upload has ever
completed.

Per the run's hard rule — *media items faked only if R2 is genuinely wired* — nothing was faked and
no placeholder asset rows were written.

**To unblock:** a Cloudflare R2 account and bucket for TAS, and someone who can issue those four
values. This is a provisioning gate, not a product decision.

### AI-26 — Creator images imported: the stored URLs are dead

This one is worse than "not done", and I verified it independently against production rather than
trusting the audit:

- 31 creators carry a `profile_pic_url`; **27 of them point at `airtableusercontent.com`**, and **0
  at R2**.
- HEAD requests against a sample of those 27 return **HTTP 410 Gone** — every one.

So 27 avatars render broken in production today. Two separate pieces are missing:

1. **The re-host has never run.** `pnpm --filter @tas/db migrate-urls -- --dry-run` reports 919
   Airtable URLs across 442 rows. It cannot run without the R2 credentials above, so this half is
   blocked with AI-30/31.
2. **The UI does not survive a dead URL.** `ugc-workspace.tsx` falls back to initials only when
   `profilePicUrl === null`, never on a load error, and the comment claiming "never a broken image"
   is false for this data. This half needs **no credentials** and is scheduled as a direct fix once
   the view tracks merge (that file is contended this run).

### AI-64/65, live-mode E2E

`apps/web/e2e/live/briefs-start.spec.ts` reports `1 skipped`: the four live-mode E2E variables are
absent. Unverifiable here by design, not a defect.

## 2. Awaiting one production go-ahead

### AI-27 — Re-import the fields that were missed

**At the field level this is already complete** and I re-verified it against the live base, not a
report: `airtable-parity` exits 0 — 230 stored fields mapped, 27 record links written from their
inverse field, 33 excluded by the register, 50 computed.

**The data, however, is missing from production.** Measured today, live Airtable vs prod:

| Live Airtable | records | production | rows |
|---|---|---|---|
| Creative Sheet | 377 | `creative_sheet_items` | **0** |
| (Internal) Creative Modules | 35 | `creative_modules` | **0** |
| UGC `Products` links | 27 | `creator_products` | **0** |

A full **dependency-closed** 21-table export was fetched and dry-run against production. The dry run
is clean:

- every table's would-write count **equals** its Airtable record count; **0 failed, 0 skipped**
- `creativeModules` 35 imported, `creativeSheetItems` 377 imported — exactly the missing 412
- every other table updates **in place** (0 imported / N updated) — no duplicates
- 1,296 attachment URLs captured; unmapped fields are all lookups, formulas, system fields and
  reverse links, so no stored field is a gap
- transaction rolled back, nothing written

Safety is established, not assumed: `packages/db/src/scripts/airtable-import.ts:104` documents that
**the whole import — dry or live — runs inside ONE transaction**, with per-row SAVEPOINTs so a bad
row rolls back alone. The export is a complete 21-table fetch, never a slice, which is the specific
precaution the slicing incident that cost 111 junction rows taught us.

**Why it was not applied unattended:** it rewrites every junction in the brand and updates 669
existing rows. The dry-run evidence is complete and the operation is atomic, so this is a one-line
decision rather than an open question — but it is a hard-to-reverse production data write, and the
run chose to surface it rather than fire it while nobody was watching.

**To apply** (export already on disk, re-fetch first if the base has moved on):

```bash
cd /Users/macbook/tallas-tas && set -a && . "/Users/macbook/Tallas Tas/.env.local" && set +a && pnpm --filter @tas/db airtable-import -- --file "$SCRATCH/gratsi-full-2026-10-04.json" --brand-name "Gratsi" --brand-id 11111111-1111-4111-8111-111111111113
```

Two select values will normalise rather than map to an existing option, which is expected and
lossless but worth knowing: `creativeBriefs.funnel` "TAS" (×4) and `creativeBriefs.source`
"Facebook Reels, Facebook Feed Square" (×4). `concepts.productionStatus` "Declined By Client" (×2)
is deliberately unmapped.

## 3. Blocked on a missing artifact

### AI-47 — The brief UI should replicate the reference

**There is no reference.** `docs/prd-assets/` holds exactly three files —
`PRD-v1-original.docx`, `dashboard-reference.png`, `team-assignment-reference.png`. No brief screen.
A grep for "replica", "exact copy" and "other client" across `docs/` hits only a prior audit quoting
the same gap.

Building to an unstated reference would be guessing at a visual target, so nothing was built.

**To unblock:** a screenshot set or URL for the brief list and brief detail in `docs/prd-assets/`,
plus a ticket naming which screens count.

Worth knowing: one *checkable* "replicate" criterion already exists against a different reference —
`apps/web/e2e/module-parity.spec.ts:208-252` asserts 35 named Gratsi Airtable fields render on the
Creative Design detail page by label, and it passes.

## 4. Ambiguous wording, resolved with the ambiguity recorded

### AI-53 — "The copy system"

Four words that admit two readings landing in different files with opposite verdicts.

- **Noun** — the copywriting system: four modules exist and are substantially built
  (`copy-types`, `copywriting`, `meta-copywriting`, `youtube-copywriting`); `copy_types` and
  `youtube_copy` both report `ok` in `verify-rollout`, matching Gratsi. Brief-side copy links render
  at `brief-detail.tsx:1023-1049`. Under this reading the item is **largely DONE**.
- **Verb** — clone a reference platform's brief system as is: nothing in `docs/decisions.md`
  (D-001…D-031 plus dated entries) records such a decision. Under this reading it is **NOT STARTED**
  and the deliverable is a decision record, not code.

**Resolved as the noun reading**, because that is the reading which maps to modules that actually
exist in this repo, and because the verb reading's deliverable is a product decision this run has no
authority to invent. If the verb reading was meant, AI-47 and AI-53 are the same blocked item and
both need the same artifact.

## 5. Deferred inside the run for a file-contention reason, not a product one

- **The Overview's role leak.** `apps/web/src/app/app/page.tsx` renders Personas, Angles, Themes and
  Concepts cards to every role with no filter. The Editor track built the role-aware sidebar and
  route guards (AI-57/65) but was forbidden from this file because the Dashboard track held it the
  whole run. The role mapping it needs already exists as a pure, unit-tested function.
- **AI-55's product rule.** The persona half is done and tested; the product half needs
  `productIds` threaded into `validateAngleDraft`, whose doc comment currently states the opposite
  policy. Held because the Linking track owns `angles/actions.ts` this run.

## 6. The thirteen Talal questions, consolidated (overnight run, 2026-10-04)

Every blocked-on-Talal item's question in one place. The evidence behind each sits in the item's
section of `action-items-full-status.md`; these stay open as questions, never failures.

1. **AI-02 — roles beyond Member/Admin:** the six brand roles exist in code and five are assigned to
   real users in production; which roles should exist beyond Member/Admin, and with what access?
   (Engineering gap when it unblocks: role-aware nav + a gate on every module page, not just the
   four admin pages.)
2. **AI-33 — Internal Status on Concepts, keep or remove:** neither live base has the field on
   Concepts and 103 of 106 prod concepts never left the default. If it goes: (a) what does the
   Concepts board group by instead (or does Concepts lose its board, as item 18 also asks), and
   (b) drop the NOT NULL column or hide it like Production Status?
3. **AI-39 — Script Idea, keep or remove:** 92 of 106 live concepts carry a script, so removal
   destroys real content; the rename problem is already solved per-brand by the resolver. If
   "remove" stands, confirm it means HIDE (template + Gratsi rows), never a column drop.
4. **AI-43 — Linked Concepts on the Angle:** the panel shows concepts twice (editable picker +
   read-only list). Pick one: (a) keep only the picker, (b) keep only the list, (c) remove both.
   The concept↔angle data itself stays either way (115 prod rows; naming depends on it).
5. **AI-44 — Angle Brief URL / Exact Script URL:** the fields DO exist in Airtable (Gratsi `Brief`
   and `Exact Script`), absent only from the template. (a) keep, (b) hide on Gratsi only (two-row
   config flip, reversible), or (c) genuinely remove (destructive migration + six code sites)?
6. **AI-60 — client progress bar:** a pipeline showing internal stages collides with
   non-negotiables 4 and 10. (a) two-step bar over the client track only, (b) coarse bar with
   internal stages collapsed into one unnamed step, or (c) drop it? 286 briefs are client-visible
   today, so this ships to real data immediately.
7. **AI-61 — Meta API:** no code path exists from UI to API (zero callers, dead button). Wire it
   now? If yes: approve the Inngest job it requires (new hosted service against the 500 USD/year
   ceiling), and supply a read-only Meta token (none exists here; write scopes are forbidden).
8. **AI-62 — manual ad↔concept linking:** should the raw-UUID "Concept ID" box become a searchable
   concept picker, also on the create form? Related tenancy hole (uuid from another brand is
   accepted) — may that be fixed now, independent of the Meta decision?
9. **AI-63 — ad uploader (~$60/month):** ~720 USD/year alone exceeds the 500 USD/year TOTAL
   ceiling. Raise the ceiling or drop the item?
10. **AI-66 — role views:** for each of video_editor, designer, strategist: which modules may they
    see, and which route do they land on after sign-in? And must hidden routes be genuinely blocked
    by role, or only hidden from the sidebar (URL-reachable)?
11. **AI-67 — remaining Airtable bases:** which base is next, and in what order? Each needs its
    per-table field-alias list, and every import must stay dependency-closed (slicing cost 111
    junction rows once).
12. **AI-68 — mood boards / library / tracking / publishing:** which of the four first? For mood
    boards, which PRD §15 parts are in scope? The library cannot be exercised until R2 credentials
    exist.
13. **AI-69 — the green light:** what exactly counts as it, and what does it gate — do 57/59/64/65
    wait on it? May it be recorded as a dated sign-off line in docs/decisions.md so it is checkable?
