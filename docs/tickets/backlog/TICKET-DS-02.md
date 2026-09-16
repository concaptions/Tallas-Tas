# TICKET-DS-02 · Codify the creative status state machines

- Owner: backend (`packages/domain/src/state/**`)
- Size: M
- Depends on: TICKET-014 (`@tas/domain` package skeleton)
- PRD: §9 (the two approval tracks), §12 (notification triggers named after these states)
- Design: handoff "TICKET-DS-02", values and descriptions verbatim

## Why

Status values are code, not database enums scattered across the UI (CLAUDE.md principles). The
descriptions are the source of truth for tooltips, notifications and analytics labels. The client track's
gate is one pure function that every component imports.

## Acceptance criteria (`packages/domain/src/state/creative-status.ts`)

1. `@tas/domain` already exists (TICKET-014); this ticket adds `src/state/creative-status.ts` and exports it
   from `src/index.ts` and, if the package uses an `exports` map, as the subpath `@tas/domain/state`.


2. Export `INTERNAL_VIDEO_STATUS`, `INTERNAL_STATIC_STATUS`, `CLIENT_STATUS` as `as const` arrays of
   `{ key, label, description }` with exactly these entries and texts:

   ```ts
   export const INTERNAL_VIDEO_STATUS = [
     { key: 'sent_to_video_editor',      label: 'Sent to Video Editor',        description: 'Set when the strategist submits the brief and assigns an editor.' },
     { key: 'video_editing_in_progress', label: 'Video Editing in Progress',   description: 'Editor opened the brief and claimed it.' },
     { key: 'ad_submitted',              label: 'Ad Submitted',                description: 'Editor uploaded a cut and marked the brief submitted.' },
     { key: 'videos_revisions',          label: 'Videos Revisions',            description: 'Internal reviewer left revisions. Client never sees this state.' },
     { key: 'revisions_submitted',       label: 'Revisions Submitted',         description: 'Editor re-uploaded against the revision notes.' },
     { key: 'approved',                  label: 'Approved',                    description: 'Internal sign-off. This is the gate that opens the client track.' },
     { key: 'launched',                  label: 'Launched',                    description: 'Media buyer confirmed the ad is live.' },
   ] as const;

   export const CLIENT_STATUS = [
     { key: 'pending_for_approval', label: 'Pending for Approval', description: 'Visible to the client the moment internal status hits Approved.' },
     { key: 'approved',             label: 'Approved',             description: 'Client signed off. Moves to the media buyer queue.' },
     { key: 'launched',             label: 'Launched',             description: 'Set by the media buyer once the ad is live in the account.' },
   ] as const;
   ```

   `INTERNAL_STATIC_STATUS` is the same shape with `sent_to_designer` / `Sent to Designer`,
   `static_design_in_progress` / `Static Design in Progress`, `images_revisions` / `Images Revisions` in
   place of the three video entries; descriptions reuse the video texts with "editor" → "designer" and
   "cut" → "design" (recorded as open question DS-Q4 because the handoff gives no static texts).
3. `ON_HOLD = { key: 'on_hold', label: 'On Hold', description: 'Work paused after it was claimed. Resumes into the in-progress step.' }`
   (description not in the handoff: open question DS-Q5). It is a branch, not a linear step: legal from
   `*_in_progress` and back to the same `*_in_progress`; `isOnHold(key)`, and the linear steppers exclude it.
4. Types: `InternalVideoStatusKey`, `InternalStaticStatusKey`, `InternalStatusKey` (union of both plus
   `'on_hold'`), `ClientStatusKey`, `Track = 'video' | 'static'`; `internalStatusFor(track)` returns the
   array for a track; `describe(track, key)` returns the label and description.
5. Transitions as data, pure functions on top: `INTERNAL_TRANSITIONS[track]` maps each key to its legal
   next keys: `sent_to_* → *_in_progress`; `*_in_progress → on_hold | ad_submitted`; `on_hold →
   *_in_progress`; `ad_submitted → *_revisions | approved`; `*_revisions → revisions_submitted`;
   `revisions_submitted → *_revisions | approved`; `approved → launched`; `launched → (none)`.
   `CLIENT_TRANSITIONS`: `pending_for_approval → approved`, `approved → launched`, `launched → (none)`.
   `canTransitionInternal(track, from, to)`, `canTransitionClient(from, to, internal)` (false whenever
   `isClientTrackOpen(internal)` is false), `assertTransition(...)` throwing `IllegalTransitionError`
   with both keys in the message.
6. Gate rule, verbatim:

   ```ts
   export function isClientTrackOpen(internal: InternalStatusKey): boolean {
     return internal === 'approved' || internal === 'launched';
   }
   ```

   Also `stepState(list, current, key): 'done' | 'now' | 'next'` used by the stepper, and
   `chipTone(label): 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'mute'` implementing the handoff tone map
   (Approved → ok, Launched → accent, any label containing "Revisions" but not "Submitted" → warn,
   Pending for Approval → info, everything else → mute).
7. Unit tests `creative-status.test.ts`: every legal transition passes and every other pair is rejected
   for both tracks (generated from the full key product, not hand-listed); client transitions are refused
   while the gate is closed and accepted once open; the gate truth table over every internal key of both
   tracks and `on_hold`; `chipTone` for every label in the three arrays plus `On Hold`; `stepState` for
   done/now/next; the arrays are frozen and the descriptions match the handoff text exactly (snapshot).

## Gated criteria (D-008)

none.

## Files touched

`packages/domain/**`, `docs/decisions.md` ("Design system open questions" DS-Q4, DS-Q5, DS-Q6).

## Notes

- DS-Q6 (append, do not resolve): PRD §9 lists a client state "Revisions Needed" and PRD §12 has a
  trigger "Client requested revisions"; the handoff's `CLIENT_STATUS` has no such state. The arrays are
  implemented exactly as handed off; the human decides whether to add `revisions_needed`.
- Concept, copy and creator tracks (PRD §5.7, §5.8, §5.11) are separate state machines in later tickets;
  this file is creatives only.
