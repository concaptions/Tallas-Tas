# P2F — Gratsi import second pass (missing fields, linkage, images)

**Role**: migrator · **PRD**: §migration · **Est**: M
**Blockers**: writes the **live Railway prod DB** (consequential — needs explicit human go per run); the mature importer + `TABLE_MAPPINGS` live on `dev`, not `main`; needs `AIRTABLE_PAT` (set).

## Context
Gratsi base `appllDG4OmkK2Hdnn`, existing Gratsi brand. A prior import ran (647/647 creators)
but dropped some fields and mislinked UGC↔Concepts. Do NOT modify the committed import script
without a ticket; do NOT run against any base but Gratsi.

## Acceptance criteria
- [ ] Second pass captures previously-dropped fields (e.g. "Facebook Profile for Partnership", and re-check every column against the P1 field list)
- [ ] Fix UGC → Concepts linkage: currently all concepts linked to all creators; import the correct per-record mappings from Airtable (`creator_concepts` junction)
- [ ] Creator profile pics imported (coordinate with P2E-3 — attachment URL handling)
- [ ] Dry-run + PGlite coverage simulation before any prod write; diff report of what changes
- [ ] Prod run only after human approval; result recorded in `docs/runbook.md`

## Notes
Reconcile the importer onto `main` first (it lives on `dev`), or run from a `dev`-based
checkout — decide with the human, since `main` is now the release line.
