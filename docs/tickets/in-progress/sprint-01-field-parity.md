# Sprint 1 — Field Parity for 8 Core Tables

**PRD sections**: §5.6 (Themes), §5.4 (Angles), §5.7 (Concepts), §5.10 (Briefs),
§5.11 (Copy), §5.8 (Creators/UGC), §5.3 (Products), §5.5 (Personas)

## Goal

Bring 8 content tables to full parity with the Airtable Creative Hub template v5.1.
~31 new columns, new enums, migration, demo data, domain layer updates, and frontend
for every new field (visible, editable, persistent).

## Acceptance criteria

- [ ] Migration 0020 adds all new columns and enum values
- [x] Drizzle schema TS files match the migration SQL
- [x] New enums defined in `packages/db/src/schema/enums.ts`
- [x] Demo data fixtures include all new fields
- [x] Domain vocabulary files export labels, tones, type guards for new enums
- [x] Themes frontend: status chip, assignee, attachments
- [x] Angles frontend: briefUrl, exactScriptUrl in Resources group
- [x] Concepts frontend: approvalStatus, productionStatus, formatsToCreate, creatorId
- [x] Briefs frontend: 12 new fields (adContent, inspiration, offer, language, etc.)
- [x] Copy frontend: funnel, used, winning, metaRating, spellingFeedback
- [x] UGC/Creators frontend: rawAssetsUrl, conceptIds, productIds
- [x] Design system stories updated for new fields
- [x] `pnpm typecheck` passes (0 errors)
- [x] `pnpm lint` passes (0 warnings)
- [x] `pnpm test` passes (1839/1839)
- [ ] Production migration run
- [ ] Vercel deployment verified
