# P2B — Creative Briefs: Kanban-primary + detail (LuckyFours) + Concepts rules

**Role**: frontend + domain(state) · **PRD**: §5.10 (Briefs), §5.7 (Concepts) · **Est**: XL — SPLIT · **Blockers**: activity widget may need an audit-log source (verify)

> The spec's "most important UI change." Talal approved the LuckyFours Studio layout on the
> 2026-09-28 call.

## Current state
`kanban-board.tsx` exists (Sprint 5); briefs list/detail pages exist; brief state machine
in `packages/domain/state`. Concept required-fields + Production-Status removal were flagged
by the P1 audit and folded here.

## Sub-tickets
### P2B-1 Kanban as the primary Briefs view
- [ ] Stage columns: Sent to Editor / Sent to Designer → Under Editing → Under Collection → Review → Approved (TAS relabels of Incoming). Read transitions from `@tas/domain/state`, not magic strings
- [ ] Cards: brief name, assignee, priority, type, concept name; stage-based colour coding
- [ ] "Start" on an incoming brief moves it to Under Editing (domain transition)

### P2B-2 Brief detail — sidebar + full page
- [ ] Clicking a card opens a compressed right sidebar (assignee, priority, concept, status, type)
- [ ] Option to open the brief as a full page (all fields)
- [ ] Full-page layout: metadata top (Assignee, Priority, Due Date, Type, Concept, Source, Funnel, Internal Status, Client Status) → Brief content (richText) → Scripts table → Elements we are Testing / Inspiration / Design File

### P2B-3 Activity / history widget
- [ ] Widget on the brief showing edits, status changes, comments, submissions
- [ ] VERIFY a source exists (`annotations`/`comments` tables exist; a general edit-audit may need a new append-only `brief_activity` table — schema sub-ticket if so)

### P2B-4 Concepts rules (from P1 audit)
- [ ] Concept cannot be saved without Batch + Angle + Theme (form validation; server-side guard in the domain mutation)
- [ ] Concept link required on a brief
- [ ] Remove **Production Status** from the Concepts UI (keep the column; soft-delete philosophy — drop only if Talal confirms data loss is fine)

## DoD
Each sub-ticket ≤300 LOC, E2E for the Kanban→detail flow, stories on `/design-system`.
