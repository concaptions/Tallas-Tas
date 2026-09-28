# P3 — Overview dashboard (replicate pipeline.tas-digital.ai)

**Role**: backend + frontend · **PRD**: §overview · **Est**: L–XL — SPLIT
**Blockers**: Priority Signals needs Slack/Fathom integration that does not exist yet (own epic).

## Current state
The per-role Overview landing page shipped this session: `6f5e310` (live Overview + role tiles),
`b0ecce4` (per-role cards, `dashboard-source.ts` `buildRoleDashboard`/`loadRoleDashboard`,
`team.ts` `getActiveBrandRole`). P3 EXTENDS this — not from scratch.

## Sub-tickets
### P3-1 The 8 metric cards + click-through
- [ ] Cards: Concepts Pending (approval pending/empty) · Creators Pending · Sent to Video Editor (Internal=Sent to Editor AND Type=Video) · Sent to Designer · Videos in Progress (Under Editing AND Video) · Designs in Progress (Under Editing AND Design) · Awaiting Internal Review (Internal=Awaiting Internal Feedback) · Awaiting Client Review (Client=Pending Review)
- [ ] Each card clickable → filtered list of those items (reuse existing table/list views with a filter param)
- [ ] Counts come from scoped queries via `withBrand`; status keys from `@tas/domain/state`

### P3-2 Per-role aggregation
- [ ] Creative Strategist → metrics across ALL clients assigned to them; PM/CSM → all their clients; Admin → all brands
- [ ] Aggregate over brand assignments (`brand_assignments`); extends `getActiveBrandRole`

### P3-3 Active Clients page
- [ ] List active brands with per-brand item counts + base-link status

### P3-4 Priority Signals  (BLOCKED — needs Slack/Fathom ingestion)
- [ ] Daily-scanned prioritization requests / creative issues / PM notes; filter by type + source (Fathom/Slack); "Reviewed" toggle. Depends on an integration epic — keep as a stub until then

### P3-5 CSM Summary
- [ ] Per-client rollup per CSM (what's happening / what needs doing)

## Visual (with P2D)
Charts/graphs for quick comprehension, emojis on cards, colour-coded status. Overview is the
post-login landing page (already is).
