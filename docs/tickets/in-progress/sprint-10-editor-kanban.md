# Sprint 10 — Brief Kanban for editors (EDIT-01 … EDIT-04)

**PRD sections**: §5.10 (Creative Briefs / Creative Design), §9 (two-track approval: the internal
track the editor works), §7 (names are generated, never typed).

| Ticket  | Scope |
| ------- | ----- |
| EDIT-01 | The editor board: Kanban grouping "Editing stage" with Incoming / Under Editing / Under Review, a VIEW of `internal_status` (`@tas/domain/state/editor-board`): Incoming = sent_to_video_editor / sent_to_designer; Under Editing = *_in_progress and *_revisions; Under Review = ad_submitted / revisions_submitted; approved / launched / on_hold are off the board |
| EDIT-02 | Start on an Incoming card: `startBriefAction` moves the brief to the track's in-progress status through the state machine and sets the signed-in user as assignee; `creative_briefs.due_date` (migration 0043) on the full page |
| EDIT-03 | Activity log: `activity_log` (migration 0042), one row per changed field per write, written from the Server Actions (`diffFields` + `insertActivity`), shown on the full page |
| EDIT-04 | Card click → quick-look panel (existing), "Open full page" → `/app/briefs/[id]` (permanent alias of `/app/creative-design/[id]`); the full page shows assignee, priority, due date, type, linked concept, internal status, a stage chip colour-coded by stage, and the Scripts table under the details |

## Acceptance criteria

- [x] Grouping the board by "Editing stage" shows the three columns in order; the mapping is
      pinned by `editor-board.test.ts` and documented in the module header.
- [x] An Incoming card carries a Start button; disabled with the reason in demo mode.
- [x] `startBriefAction` refuses in demo mode and without a session, validates the transition with
      `canTransitionInternal`, writes the status and assignee, and logs both changes.
- [x] `updateBriefAction` logs every changed field (old value, new value, actor id and name,
      timestamp) beside the row write; never from the client.
- [x] The full page shows the six facts, the stage chip (`data-stage`), the Scripts table and the
      Activity section (worded empty state in demo mode).
- [x] Playwright (demo): the Editing-stage grouping, the Start button's disabled reason, the full
      page's facts, scripts and activity section. Playwright (live, gated on Clerk keys): Start a
      brief, see it move to Under Editing, see the activity log name the status change and the user.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Pending human verification

- Live mode on Neon with Clerk: run `briefs-editor.spec.ts`'s live test (Start → column move →
  activity row with the signed-in user's name).
- Production: apply migrations 0042 and 0043.
