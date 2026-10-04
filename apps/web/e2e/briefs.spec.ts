import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { briefPath, briefsPath } from '../src/lib/routes';

/**
 * The Creative Briefs route with no environment variables at all — the Vercel deployment as it
 * stands. The middleware lets the route through, the data source serves the in-repo fixtures, and
 * both pages are fully usable read-only: every brief in a six-column table, a real detail route with
 * a generated name that is not a field, three columns, the inspiration previews, the two-track rail
 * and every write disabled with a reason.
 *
 * The fixtures are `demoBriefs` in `packages/db/src/demo-data.ts`: SEVEN rows, newest edit first,
 * spread across both tracks of the internal ladder. Four of them are past internal sign-off (three
 * `approved`, one `launched`), so `isClientTrackOpen` is true on those four and false on the other
 * three — which is what makes "open here, shut there" a real assertion rather than a coincidence.
 * The count is spelled `BRIEF_COUNT` once so a fixture added to the seed fails in one place.
 */
const BRIEF_COUNT = 7;

/** The header's wording, built from the same number the table is asserted to render. */
const briefsLabel = (count: number): string => `${String(count)} briefs`;

const BODY_CLOCK = '77777777-7777-4777-8777-000000000001';
/** `static_design_in_progress`: the one the client track is still shut on. */
const NOT_YOUR_AGE_STATIC = '77777777-7777-4777-8777-000000000002';
const BUNDLE_STANDALONE = '77777777-7777-4777-8777-000000000005';
/** Cited by one creative module and by nothing else — the rail's empty states, three at once. */
const NINETY_MINUTES_CAROUSEL = '77777777-7777-4777-8777-000000000006';

// The generated creative name carries the Source prefix (Airtable "Source-(Funnel)(Type)(Number)-…"):
// TAS for internal briefs, Client for client-sourced ones. These constants were stale — the spec
// predated the source prefix in the naming formula and only ran once the demo webServer was fixed.
const BODY_CLOCK_NAME = 'TAS-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2';
const BUNDLE_NAME = 'Client-RS1-B4-Standalone-V3-NIGHT RESET BUNDLE';
/** The Creative Sheet's computed name: the month the sheet row was created, then the creative. */
const BODY_CLOCK_SHEET_NAME = `October-${BODY_CLOCK_NAME}`;

test.describe('creative briefs in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/briefs needs a session and real data',
  );

  test('lists the seven fixtures under the resolved columns, with the standalone chip in the concept cell', async ({
    page,
  }) => {
    await page.goto(`${briefsPath}?view=grid`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Design');
    await expect(page.locator('[data-slot="brief-count"]')).toHaveText(briefsLabel(BRIEF_COUNT));

    // AI-64a: the headers are `column_definitions` rows now, not a six-string tuple in the page, so
    // a column is addressed by its KEY and its label is whatever the resolver returned. The
    // thirty-one are the parent master set — thirty Airtable fields plus the platform's Due Date.
    const headers = page.locator('[data-slot="briefs-table"] thead th');
    await expect(headers).toHaveCount(31);
    for (const key of [
      'name',
      'concept_id',
      'type',
      'priority',
      'assignee',
      'internal_status',
      'due_date',
    ]) {
      await expect(
        page.locator(`[data-slot="briefs-table"] thead th[data-column="${key}"]`),
      ).toHaveCount(1);
    }
    // The label comes from the seed row, which is the point of the migration (AI-49).
    await expect(
      page.locator('[data-slot="briefs-table"] thead th[data-column="due_date"]'),
    ).toHaveText('Due Date');

    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(BRIEF_COUNT);

    // The generated name is monospace, because it is system output and not a typed field.
    const name = page.locator(`[data-brief-id="${BODY_CLOCK}"] [data-slot="brief-row-name"]`);
    await expect(name).toHaveText(BODY_CLOCK_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);

    // A brief with no concept says so in a chip, never a blank cell or a bare em dash.
    const standalone = page.locator(
      `[data-brief-id="${BUNDLE_STANDALONE}"] [data-slot="brief-standalone"] [data-slot="status-chip"]`,
    );
    await expect(standalone).toHaveText('Standalone');
    await expect(standalone).toHaveAttribute('data-tone', 'mute');

    // AI-52. The name is a real anchor, so the row can be cmd-clicked, middle-clicked or copied —
    // which a `router.push` cannot be. The href is the detail route itself, not a fragment.
    await expect(name).toHaveAttribute('href', briefPath(BODY_CLOCK));

    // Every status is a StatusChip with a tone from chipTone, never a locally coloured pill. Read
    // out of the internal-status COLUMN rather than as the row's last chip, so a reordered or
    // relabelled column set cannot quietly move this assertion onto a different field.
    const approved = page.locator(
      `[data-brief-id="${BODY_CLOCK}"] td[data-column="internal_status"] [data-slot="status-chip"]`,
    );
    await expect(approved).toHaveText('Approved');
    await expect(approved).toHaveAttribute('data-tone', 'ok');

    // AI-49: the row carries the editor stage it sits at. This fixture is Approved, which is OFF
    // the editor board, so it carries no stage at all rather than a made-up one.
    await expect(page.locator(`[data-brief-id="${BODY_CLOCK}"]`)).not.toHaveAttribute(
      'data-stage',
      /.+/,
    );

    // "New brief" is a write: disabled, and it explains itself.
    const newBrief = page.locator('[data-slot="new-brief"]');
    await expect(newBrief).toBeDisabled();
    await expect(page.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      /.+/,
    );
  });

  test('the search narrows the list into ?q= and the empty state offers a way out', async ({
    page,
  }) => {
    await page.goto(`${briefsPath}?view=grid`);

    await page.locator('[data-slot="brief-search"]').fill('standalone');
    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="brief-count"]')).toHaveText(
      `1 of ${briefsLabel(BRIEF_COUNT)}`,
    );
    // `?view=grid` is kept alongside `?q=`, so match the query param in either position.
    await expect(page).toHaveURL(/[?&]q=standalone/);

    // A filter that matches nothing says so in words and offers to clear itself.
    await page.locator('[data-slot="brief-search"]').fill('zzzzz');
    await expect(page.locator('[data-slot="briefs-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="briefs-empty"]')).toContainText('No brief matches');
    await page.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(BRIEF_COUNT);
  });

  test('opens on the Kanban board by default, with the table reachable via ?view=grid', async ({
    page,
  }) => {
    await page.goto(briefsPath);
    await expect(page.locator('[data-slot="kanban-board"]')).toBeVisible();
    await expect(page.locator('[data-slot="briefs-table"]')).toHaveCount(0);

    await page.goto(`${briefsPath}?view=grid`);
    await expect(page.locator('[data-slot="briefs-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="kanban-board"]')).toHaveCount(0);
  });

  // P2B-3. The table's own click still navigates (covered by the ?view=grid test below); this covers
  // the board's quick-look panel, which deliberately does NOT navigate.
  test('a Kanban card opens the quick-look panel beside the board, and "Open full page" leaves for the detail route', async ({
    page,
  }) => {
    await page.goto(briefsPath);
    const card = page.locator(`[data-slot="kanban-card"][data-card-id="${BODY_CLOCK}"]`);
    await card.click();

    const panel = page.locator('[data-slot="brief-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="brief-panel-title"]')).toHaveText(BODY_CLOCK_NAME);
    // The quick look counts what points at the brief; the full page lists each record.
    await expect(panel.locator('[data-slot="brief-panel-links"]')).toHaveText(
      '1 sheet row · 1 module · 1 asset folder · 1 report',
    );
    // Not a modal: the board is still there beside it, and the URL has not moved.
    await expect(page.locator('[data-slot="kanban-board"]')).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`${briefPath(BODY_CLOCK)}$`));

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="brief-panel"]')).toHaveCount(0);

    // The full page is one button further. This is usually the run's FIRST navigation into the
    // dynamic /app/briefs/[id] route, which `next dev` compiles on demand — the same cold-compile
    // cost the config header describes, where the URL does change, just later than the 15s default
    // expect budget. Only this assertion waits longer; nothing about it is relaxed.
    await card.click();
    // AI-52. The footer control is a link, not a button that pushes, so it can be opened in a new
    // tab. The click below still navigates in this one.
    const openFull = page.locator('[data-slot="brief-panel-open-full"]');
    await expect(openFull).toHaveAttribute('href', briefPath(BODY_CLOCK));
    await openFull.click();
    await expect(page).toHaveURL(new RegExp(`${briefPath(BODY_CLOCK)}$`), { timeout: 45_000 });
  });

  test('a row click lands on the detail route, and Back restores the list', async ({ page }) => {
    await page.goto(`${briefsPath}?view=grid`);
    await page.locator(`[data-brief-id="${BODY_CLOCK}"]`).click();

    await expect(page).toHaveURL(new RegExp(`${briefPath(BODY_CLOCK)}$`));
    await expect(page.locator('[data-slot="briefs-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="brief-name"]')).toHaveText(BODY_CLOCK_NAME);

    await page.goBack();
    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(BRIEF_COUNT);
  });

  test('an unknown id is a 404, not a crash', async ({ page }) => {
    await page.goto(`${briefsPath}/77777777-7777-4777-8777-999999999999`);

    // The /app shell streams first through its Suspense boundary (app/loading.tsx), so the HTTP
    // status is the shell's 200 and the not-found page is what Next sends into the page slot, with
    // the `noindex` meta it adds to every `notFound()` (docs/decisions/briefs-spec-fix-2026-10-01.md).
    const notFound = page.locator('[data-slot="not-found"]');
    await expect(notFound).toBeVisible();
    await expect(notFound).toContainText('Not found');
    await expect(page.locator('meta[name="robots"][content="noindex"]')).not.toHaveCount(0);
    // The shell stays and no brief column renders: a missing record, not a crash.
    await expect(page.locator('[data-slot="shell-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-left"]')).toHaveCount(0);
  });

  test('the detail page is three columns, the name is copyable and the Version dropdown renames it with no navigation', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(briefPath(BODY_CLOCK));

    // Criterion 6: three real columns, left, centre and right.
    await expect(page.locator('[data-slot="brief-left"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-centre"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-right"]')).toBeVisible();

    // Criterion 4: the name is monospace, is not held by any field, and copies with a confirmation.
    const name = page.locator('[data-slot="brief-name"]');
    await expect(name).toHaveText(BODY_CLOCK_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);
    await expect(page.locator(`input[value="${BODY_CLOCK_NAME}"]`)).toHaveCount(0);

    const copy = page.locator('[data-slot="brief-name-copy"]');
    await expect(copy).toHaveText('Copy');
    await copy.click();
    await expect(copy).toHaveText('Copied');

    // Criterion 7: the Version dropdown rewrites the name in the browser, with no round trip.
    const url = page.url();
    await page.locator('[data-slot="brief-version"]').click();
    await page.getByRole('option', { name: 'V4' }).click();
    await expect(name).toHaveText(BODY_CLOCK_NAME.replace('-V2', '-V4'));
    expect(page.url()).toBe(url);

    // Criterion 7: the concept context card links to the concept, and the ratio grid is the §8 set.
    await expect(page.locator('[data-slot="brief-concept"]')).toHaveAttribute(
      'href',
      /\/app\/concepts\//,
    );
    await expect(page.locator('[data-slot="brief-dimension"]')).toHaveCount(3);

    // Criterion 8: the three prose sections, in order.
    await expect(page.locator('[data-slot="brief-briefToDesign"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-scriptContent"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-elementsTested"]')).toBeVisible();

    // Criterion 9: one preview per pasted link, with the provider named on each.
    const cards = page.locator('[data-slot="inspiration-card"]');
    await expect(cards).toHaveCount(2);
    await expect(cards.first().locator('[data-slot="inspiration-source"]')).toHaveText(
      'Meta Ad Library',
    );
    await expect(cards.nth(1).locator('[data-slot="inspiration-embed"]')).toHaveAttribute(
      'src',
      /youtube\.com\/embed\//,
    );
  });

  test('the rail shows both tracks, open past internal sign-off and shut before it', async ({
    page,
  }) => {
    await page.goto(briefPath(BODY_CLOCK));

    const rail = page.locator('[data-slot="brief-rail"]');
    await expect(rail.locator('[data-slot="internal-track"]')).toBeVisible();
    await expect(rail.locator('[data-slot="client-track"]')).toHaveAttribute('data-open', 'true');

    // `static_design_in_progress`, so `isClientTrackOpen` is false: the client bar is shut and says
    // so in a chip instead of rendering a stepper the client has not reached yet.
    await page.goto(briefPath(NOT_YOUR_AGE_STATIC));
    const shut = page.locator('[data-slot="brief-rail"] [data-slot="client-track"]');
    await expect(shut).toHaveAttribute('data-open', 'false');
    await expect(shut.locator('[data-slot="status-chip"]')).toHaveText('locked');

    // The standalone brief is internally Approved, so its bar is open — and it still says why it
    // has no concept card, rather than showing an empty one.
    await page.goto(briefPath(BUNDLE_STANDALONE));
    await expect(page.locator('[data-slot="brief-name"]')).toHaveText(BUNDLE_NAME);
    await expect(
      page.locator('[data-slot="brief-rail"] [data-slot="client-track"]'),
    ).toHaveAttribute('data-open', 'true');
    await expect(page.locator('[data-slot="brief-concept"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="brief-concept-standalone"]')).toContainText(
      'No parent concept',
    );
  });

  // Module parity, phase 2: the four tables that point at a brief are read back the other way on
  // its rail. The fixtures' link arrays are what render here, through the same demo-aware loaders.
  test('the rail lists every record that points at this creative, each linking to its own page', async ({
    page,
  }) => {
    await page.goto(briefPath(BODY_CLOCK));

    // Creative Sheet: the computed month-name in mono, with the sheet's own two status chips.
    const sheet = page.locator('[data-slot="brief-creative-sheet"]');
    const sheetLabel = sheet.locator('[data-slot="brief-link-label"]');
    await expect(sheetLabel).toHaveText(BODY_CLOCK_SHEET_NAME);
    await expect(sheetLabel).toHaveCSS('font-family', /mono/i);
    const sheetChips = sheet.locator('[data-slot="status-chip"]');
    await expect(sheetChips).toHaveText(['Approved', 'Pending For Approval']);
    await expect(sheetChips.first()).toHaveAttribute('data-tone', 'ok');
    await expect(sheet.locator('[data-slot="brief-link"]')).toHaveAttribute(
      'href',
      /\/app\/creative-sheet\?creative-sheet=/,
    );

    // Creative Modules and Client Asset folders: the record's own name, opening its panel.
    const modules = page.locator('[data-slot="brief-creative-modules"]');
    await expect(modules.locator('[data-slot="brief-link-label"]')).toHaveText([
      'Problem → Solution Hooks',
    ]);
    await expect(modules.locator('[data-slot="brief-link"]')).toHaveAttribute(
      'href',
      /\/app\/creative-modules\?module=/,
    );

    const folders = page.locator('[data-slot="brief-client-assets"]');
    await expect(folders.locator('[data-slot="brief-link-label"]')).toHaveText([
      'Product Photography — Deep Sleep Blanket',
    ]);
    await expect(folders.locator('[data-slot="brief-link"]')).toHaveAttribute(
      'href',
      /\/app\/client-assets\?folder=/,
    );

    // Creative Reports: the name, CPA against target, and the difference as a chip — over, so bad.
    const reports = page.locator('[data-slot="brief-creative-reports"]');
    await expect(reports.locator('[data-slot="brief-link-label"]')).toHaveText([
      'Body Clock V2 — Shift Worker — 90-Night Trial',
    ]);
    await expect(reports.locator('[data-slot="brief-link-detail"]')).toHaveText(
      'CPA $24.50 vs target $22.00',
    );
    const difference = reports.locator('[data-slot="status-chip"]');
    await expect(difference).toHaveText('+$2.50');
    await expect(difference).toHaveAttribute('data-tone', 'bad');
    await expect(reports.locator('[data-slot="brief-link"]')).toHaveAttribute(
      'href',
      /\/app\/creative-reporting\?creativeReport=/,
    );

    // The Meta Copywriting section this page already had is still here.
    await expect(page.locator('[data-slot="brief-copywriting"]')).toBeVisible();
  });

  test('a rail section nothing points at says so in a sentence, never a blank card', async ({
    page,
  }) => {
    await page.goto(briefPath(NINETY_MINUTES_CAROUSEL));

    await expect(
      page.locator('[data-slot="brief-creative-modules"] [data-slot="brief-link-label"]'),
    ).toHaveText(['Parent Handover Window']);
    await expect(page.locator('[data-slot="brief-creative-sheet-empty"]')).toContainText(
      'No sheet row',
    );
    await expect(page.locator('[data-slot="brief-client-assets-empty"]')).toContainText(
      'No client asset folder',
    );
    await expect(page.locator('[data-slot="brief-creative-reports-empty"]')).toContainText(
      'No report',
    );
  });

  test('every write on the detail page is disabled, with a reason on hover', async ({ page }) => {
    await page.goto(briefPath(BODY_CLOCK));

    const checks = page.locator('[data-slot="brief-qa-check"]');
    await expect(checks).toHaveCount(3);
    for (const check of await checks.all()) {
      await expect(check).toBeDisabled();
    }
    await expect(page.locator('[data-slot="brief-qa"]')).toContainText('Video Editor QA');

    await expect(page.locator('[data-slot="brief-spelling-rerun"]')).toBeDisabled();
    await expect(page.locator('[data-slot="brief-save"]')).toBeDisabled();
    await expect(page.locator('[data-slot="brief-advance"]')).toBeDisabled();

    // Each disabled write carries its explanation on the enabled wrapper around it.
    const wrapper = page.locator('[data-slot="brief-save"]').locator('xpath=..');
    await expect(wrapper).toHaveAttribute('title', 'Sign in required to save changes');
  });

  test('reads down to 390px with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(briefPath(BODY_CLOCK));

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.goto(briefsPath);
    const listOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(listOverflow).toBeLessThanOrEqual(0);
  });
});
