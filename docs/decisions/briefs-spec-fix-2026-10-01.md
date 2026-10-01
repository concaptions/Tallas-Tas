# briefs.spec.ts: the two long-standing failures (2026-10-01)

Branch `claude/fix-briefs-spec-pre-existing`, based on `main` at `ee1c1ae`. Phase 1 only: no app or
spec code was changed to produce this document. Both tests reproduce on `main` with
`npx playwright test apps/web/e2e/briefs.spec.ts -g "unknown id is a 404|disabled, with a reason"`.

## When they went red

`git log -S` for either test's text names exactly one commit: **`d8441cc` (2026-09-29, "chore(e2e):
reconcile interface-config.spec.ts with the shipped UI")**. That commit created `briefs.spec.ts`
(284 lines), the whole brief detail route, `spell-check-action.ts`, `lib/spell-check.ts` and
`apps/web/src/app/app/loading.tsx` in one change. The two later touches of the spec (`01b5769`,
`83f1232`) did not edit these tests. So both tests were red from the commit that introduced them;
there is no earlier green to bisect back to. The cause of each is inside that same commit.

## (a) "an unknown id is a 404, not a crash"

**Root cause.** `apps/web/src/app/app/creative-design/[briefId]/page.tsx:73` calls `notFound()`
correctly when `loadBriefById` returns null. But `apps/web/src/app/app/loading.tsx` (added in
`d8441cc`) wraps every route under `/app` in a Suspense boundary, and the page is an async Server
Component that suspends on its first `await`. Next.js therefore flushes the app shell with **HTTP 200**
before `notFound()` runs; the not-found UI then arrives inside the stream. This is documented
Next.js behaviour: a `notFound()` thrown after the shell has streamed cannot change the status code.

**Evidence.**

- Playwright trace (`--trace on`): the document request for
  `/app/creative-design/77777777-7777-4777-8777-999999999999` returns `200 text/html`. The body
  carries Next's `NEXT_NOT_FOUND` payload, the text "404: This page could not be found." and a
  `noindex` meta, so the route is not crashing and not rendering an empty shell: it renders the
  default not-found UI with the wrong status.
- Direct fetch against `next dev` on `main`: `curl -w %{http_code}` on the same URL prints `200`.
  With `apps/web/src/app/app/loading.tsx` temporarily moved aside, the same fetch prints **`404`**;
  restored, it prints `200` again. The boundary is the only variable.

**Chosen fix (recommended): keep the loading boundary, give `/app` a real not-found page, and
correct the spec's assertion.** Add `apps/web/src/app/app/not-found.tsx` (token classes, a worded
"This brief does not exist" page with a link back to Creative Design) so an unknown id lands on a
designed page inside the shell. The spec's `response.status() === 404` is the part that is wrong:
under a streamed shell the framework cannot deliver that status, and the test's name states its
real intent ("not a crash"). Phase 2 would assert the rendered not-found page (`data-slot`
"app-not-found", the `noindex` meta) instead of the status code. **This is a spec change and the
prompt says to call that out: the spec asserts a transport detail the chosen architecture cannot
satisfy.**

**Considered and rejected.**

- Delete `apps/web/src/app/app/loading.tsx`. Restores a true 404 (proved above) and keeps the spec
  untouched, but removes the instant skeleton on every `/app` navigation, which is the one reason
  that file exists (its header explains the sidebar-click-shows-nothing problem it fixed).
- Per-route `loading.tsx` files for the list pages only. Keeps the skeleton on lists and a true 404
  on detail routes, but means ~35 copies of the same file, and a new list route silently loses the
  skeleton until someone remembers. A route group (`app/app/(lists)/…`) would avoid the copies but
  moves ~35 directories and breaks every `@/app/app/...` import the design-system page uses.
- Checking the id before the first `await`. Not possible: `params` is a Promise in Next 15, so the
  page suspends before it can inspect the id.

If you would rather keep the status-code assertion, say so and Phase 2 takes the first rejected
option (delete the boundary) instead; nothing else in this fix changes.

## (b) "every write on the detail page is disabled, with a reason on hover"

**Root cause.** The assertion that fails is
`expect(page.locator('[data-slot="brief-spelling-rerun"]')).toBeDisabled()`. In
`apps/web/src/app/app/creative-design/[briefId]/brief-detail.tsx:806` (on `main`) the button is
`disabled={spellPending}` only; every other write on the page is `disabled={demo || pending}` inside
a `DisabledWrite` wrapper. The button is enabled in demo mode by construction, not by accident:
`spell-check-action.ts:30-36` branches on `isDemoMode()` and runs `demoSpellCheck` from
`lib/spell-check.ts:63-81`, a local hyphenation heuristic, instead of refusing. Both the enabled
button and the spec that asserts it disabled were written in `d8441cc`; they contradicted each
other from the first commit. So: the button is enabled, the action does run in demo mode (a fake
result, nothing stored), and the test asserts the intended rule rather than the wrong element.

**Chosen fix: the app, not the spec.** The platform rule (CLAUDE.md credential status, D-008, every
other write on this page) is that demo mode is read-only and every write control is disabled with
the reason. In live mode this button IS a write: `runSpellCheckAction` calls the Anthropic API and
stores the result with `updateBrief(..., { spellingFeedback })`. Phase 2 would:

1. `brief-detail.tsx`: `disabled={demo || spellPending}`, `className={disabledWriteClassName}`,
   wrapped in `<DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>`, exactly like `brief-save`
   and `brief-advance` beside it. This alone turns the test green.
2. `spell-check-action.ts`: return `{ ok: false, error: DEMO_WRITE_REFUSAL }` in demo mode like
   every other action, instead of running the heuristic, so the server guard matches the UI.
3. Remove `demoSpellCheck` from `lib/spell-check.ts`. Its only callers are the demo branch of
   the action and `apps/web/src/lib/spell-check.test.ts` (three unit tests of the heuristic), so that
   test file is deleted with it. This is a test deletion of a helper that no longer exists, not a
   skipped or weakened assertion; it is called out here so it can be vetoed with steps 2 and 3.

Step 2 and 3 change what demo mode does (today it shows a fake "No issues found." on click).
**That is a behaviour change beyond the failing assertion; it is listed so you can veto it.** Step 1
alone satisfies the test and the rule; steps 2 and 3 only remove code the disabled button makes
unreachable.

**Considered and rejected.**

- Treat the spec as wrong and keep the demo heuristic enabled. Rejected: the heuristic was never
  specified by a ticket (no `docs/tickets` entry mentions it), it contradicts the one demo-mode rule
  every other control follows, and a visitor would read its output as the product's AI check.
- Only disabling the button and leaving the demo branch in the action. Rejected as the end state
  (kept as step 1 if you veto 2 and 3): a guard that computes a fake answer is a guard that does
  not refuse.

**Out of scope, noted.** `lib/spell-check.ts` calls the Anthropic API directly from a Server Action,
which CLAUDE.md forbids ("never call an external API from a request handler; enqueue an Inngest
job"). Not touched here; it is unrelated to either failure.

## Phase 2 plan (on approval)

Fix (a): one commit, `not-found.tsx` + spec assertion. Fix (b): one commit, button + action +
helper. Then the full `briefs.spec.ts`, the specs that share the route (`briefs-editor.spec.ts`
exists only on `claude/festive-euler-9578qg` and is not on `main`), `module-parity.spec.ts`,
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm exec playwright test`; push; PR titled
"Fix two long-standing briefs.spec failures" linking this document.
