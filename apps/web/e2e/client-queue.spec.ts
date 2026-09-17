import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { DEMO_QUEUE_ASSIGNEE } from '../src/lib/demo-mode';
import { briefPath, clientQueuePath } from '../src/lib/routes';

/**
 * The Client Queue board with no environment variables at all — the Vercel deployment as it stands
 * (PRD §9, §10; ticket `client-queue` criterion 12).
 *
 * The middleware lets the route through, `loadClientQueue()` serves the in-repo fixtures, and the
 * board is fully usable read-only: the client columns in PRD §9 order with counts, the eligible
 * seeded briefs spread across them, the muted line explaining why the board is shorter than the
 * briefs list, a card that links to the real Creative Brief page, a `?filter=` that survives a
 * reload, and both write controls present, disabled and explaining themselves.
 *
 * WHAT THE FIXTURES GIVE THIS BOARD (`demoBriefs` in `packages/db/src/demo-data.ts`, seven rows):
 * three are internally Approved and not yet Launched, so three cards reach the board — two in
 * Pending for Approval, one in Approved — and the launched/launched row is excluded, which is what
 * makes "eligible rows appear, ineligible ones do not" a real assertion rather than a coincidence.
 * The remaining four sit in pre-Approved internal states and are withheld by the gate.
 *
 * TICKET DRIFT, noted rather than asserted around: criteria 5 and 12 were written against the older
 * six-fixture set and say "exactly one card". The db handoff that this page was built on changed
 * that deliberately, and the counts below are the ones the fixtures actually produce.
 */

/** `CLIENT_STATUS` in PRD §9 order with `launched` removed — what `clientQueueColumns()` returns. */
const COLUMNS_IN_ORDER = ['Pending for Approval', 'Approved'];

/** The three fixtures PRD §9's gate lets through, with the column each one lands in. */
const ON_BOARD = [
  { id: '77777777-7777-4777-8777-000000000001', status: 'pending_for_approval' },
  { id: '77777777-7777-4777-8777-000000000004', status: 'pending_for_approval' },
  { id: '77777777-7777-4777-8777-000000000005', status: 'approved' },
];

const BODY_CLOCK = '77777777-7777-4777-8777-000000000001';
const BODY_CLOCK_NAME = 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2';

/** Internally launched and client-launched: the client owes it nothing, so it must not appear. */
const LAUNCHED = '77777777-7777-4777-8777-000000000007';

/** Still in `static_design_in_progress`: the gate holds it back, so it must not appear either. */
const NOT_APPROVED = '77777777-7777-4777-8777-000000000002';

test.describe('client queue in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/queue/client needs a session and real data',
  );

  test('renders every client column in §9 order with a count, and only the eligible fixtures', async ({
    page,
  }) => {
    await page.goto(clientQueuePath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Client Queue');
    await expect(page.locator('[data-slot="client-queue-count"]')).toHaveText('3 creatives');

    // Criterion 2: one column per CLIENT status, in PRD §9 order, labelled by the domain, with
    // `launched` removed — the client owes a launched creative no decision.
    const columns = page.locator('[data-slot="client-queue-column"]');
    await expect(columns).toHaveCount(COLUMNS_IN_ORDER.length);
    await expect(page.locator('[data-slot="client-queue-column-label"]')).toHaveText(
      COLUMNS_IN_ORDER,
    );
    await expect(
      page.locator('[data-slot="client-queue-column-label"]', { hasText: 'Launched' }),
    ).toHaveCount(0);

    // Criterion 3: every eligible brief in exactly one column, by its stored client status.
    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(ON_BOARD.length);
    for (const { id, status } of ON_BOARD) {
      const card = `[data-slot="client-queue-card"][data-brief-id="${id}"]`;
      await expect(page.locator(card)).toHaveAttribute('data-client-status', status);
      await expect(
        page.locator(`[data-slot="client-queue-column"][data-status="${status}"]`).locator(card),
      ).toHaveCount(1);
    }

    // Every count is a StatusChip, never a locally coloured pill.
    const approved = page.locator('[data-slot="client-queue-column"][data-status="approved"]');
    await expect(approved).toHaveAttribute('data-count', '1');
    await expect(
      approved.locator('[data-slot="client-queue-column-count"] [data-slot="status-chip"]'),
    ).toHaveText('1');
  });

  test('the gate is the whole rule: it is stated in words, and what it holds back is not here', async ({
    page,
  }) => {
    await page.goto(clientQueuePath);

    // Criterion 4 and 5: PRD §9's rule in one line, and why the board is shorter than the data.
    await expect(page.locator('[data-slot="client-queue-rule"]')).toContainText(
      'only once its internal status is Approved',
    );
    await expect(page.locator('[data-slot="client-queue-withheld"]')).toContainText(
      'internal sign-off gates this board',
    );

    // A brief the internal track has not signed off never reaches the page at all…
    await expect(
      page.locator(`[data-slot="client-queue-card"][data-brief-id="${NOT_APPROVED}"]`),
    ).toHaveCount(0);
    // …and neither does one the client has already finished with.
    await expect(
      page.locator(`[data-slot="client-queue-card"][data-brief-id="${LAUNCHED}"]`),
    ).toHaveCount(0);

    // Criterion 4: internal status is team-only and is never rendered on this page.
    await expect(page.locator('[data-slot="client-queue-board"]')).not.toContainText(
      'Static Design in Progress',
    );
  });

  test('a card shows the monospace name, a tile, the assignee and the client-status chip', async ({
    page,
  }) => {
    await page.goto(clientQueuePath);

    const card = page.locator(`[data-slot="client-queue-card"][data-brief-id="${BODY_CLOCK}"]`);
    await expect(card).toBeVisible();

    // Criterion 7: the generated name is system output, so it renders monospace and is not a field.
    const name = card.locator('[data-slot="client-queue-card-name"]');
    await expect(name).toHaveText(BODY_CLOCK_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);

    // The tile is built from the row's own design file. No image is fetched.
    const thumb = card.locator('[data-slot="client-queue-card-thumb"]');
    await expect(thumb).toHaveAttribute('data-thumb-source', 'design-file');
    await expect(thumb).toHaveText('frame.example');
    await expect(card.locator('img')).toHaveCount(0);

    await expect(card.locator('[data-slot="client-queue-card-assignee"]')).toHaveText(
      DEMO_QUEUE_ASSIGNEE,
    );

    // The client status is a StatusChip with the domain's own label and tone.
    const chip = card.locator('[data-slot="client-queue-card-status"] [data-slot="status-chip"]');
    await expect(chip).toHaveText('Pending for Approval');
    await expect(chip).toHaveAttribute('data-tone', /.+/);
  });

  test('both write controls are present, disabled and say why, and nothing is rounded-full', async ({
    page,
  }) => {
    await page.goto(clientQueuePath);

    // Criterion 8: two controls per card, labelled from CLIENT_QUEUE_ACTIONS.
    const approve = page.locator('[data-slot="client-queue-approve"]');
    const revise = page.locator('[data-slot="client-queue-request-revisions"]');
    await expect(approve).toHaveCount(ON_BOARD.length);
    await expect(revise).toHaveCount(ON_BOARD.length);
    await expect(approve.first()).toHaveText('Approve');
    await expect(revise.first()).toHaveText('Request Revisions');

    // Every one of them is inert, because demo mode has no database to write to…
    for (const control of [...(await approve.all()), ...(await revise.all())]) {
      await expect(control).toBeDisabled();
      await expect(control).not.toHaveClass(/rounded-full/);
    }

    // …and every one says so, on the enabled wrapper a disabled button needs to carry a tooltip.
    const wrappers = page.locator('[data-slot="client-queue-card"] [data-slot="disabled-write"]');
    await expect(wrappers).toHaveCount(ON_BOARD.length * 2);
    await expect(wrappers.first()).toHaveAttribute('title', /sign in/i);
  });

  test('a card click lands on the brief, and Back restores the board with its filter', async ({
    page,
  }) => {
    await page.goto(`${clientQueuePath}?filter=mine`);
    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(1);

    // Criterion 7: the readable body of the card is a link to the real Creative Brief route.
    const link = page
      .locator(`[data-slot="client-queue-card"][data-brief-id="${BODY_CLOCK}"]`)
      .locator('[data-slot="client-queue-card-link"]');
    await expect(link).toHaveAttribute('href', briefPath(BODY_CLOCK));
    await link.click();

    await expect(page).toHaveURL(new RegExp(`${briefPath(BODY_CLOCK)}$`));
    await expect(page.locator('[data-slot="brief-name"]')).toHaveText(BODY_CLOCK_NAME);

    await page.goBack();
    await expect(page).toHaveURL(/\?filter=mine$/);
    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(1);
  });

  test('?filter=mine narrows the board, writes the address and survives a reload', async ({
    page,
  }) => {
    await page.goto(clientQueuePath);

    // The option names the viewer, so the board never implies whose queue it is showing.
    const mine = page.locator('[data-slot="client-queue-filter-option"][data-filter="mine"]');
    await expect(mine).toHaveText(`Mine · ${DEMO_QUEUE_ASSIGNEE}`);
    await mine.click();

    // The History API writes ?filter= with no server round trip.
    await expect(page).toHaveURL(/\?filter=mine$/);
    await expect(mine).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-slot="client-queue-count"]')).toHaveText('1 of 3 creatives');
    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(1);

    // The columns never collapse, however narrow the filter gets.
    await expect(page.locator('[data-slot="client-queue-column"]')).toHaveCount(
      COLUMNS_IN_ORDER.length,
    );
    await expect(page.locator('[data-slot="client-queue-column-empty"]')).toHaveText(
      'Nothing here',
    );

    // A reload restores the same board from the same address: the URL is shareable.
    await page.reload();
    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(1);
    await expect(mine).toHaveAttribute('aria-pressed', 'true');

    // "All" is the default, so it deletes the parameter rather than writing ?filter=all.
    await page.locator('[data-slot="client-queue-filter-option"][data-filter="all"]').click();
    await expect(page).toHaveURL(new RegExp(`${clientQueuePath}$`));
    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(3);

    // Junk in the parameter is the default board, not an error page.
    await page.goto(`${clientQueuePath}?filter=%%%`);
    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(3);
  });

  test('reads down to 390px: the strip scrolls, the page does not', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(clientQueuePath);

    await expect(page.locator('[data-slot="client-queue-card"]')).toHaveCount(3);

    // Criterion 10: the shell never gets a horizontal page scrollbar.
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(0);

    // The board's own container is never wider than the viewport; the columns slide inside it.
    const board = await page
      .locator('[data-slot="client-queue-board"]')
      .evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
    expect(board.client).toBeLessThanOrEqual(390);
    expect(board.scroll).toBeGreaterThanOrEqual(board.client);
  });

  test('the sidebar links Client Queue and marks it active, so its SoonChip is gone', async ({
    page,
  }) => {
    await page.goto(clientQueuePath);

    // Criterion 1: the section gets its `href` in the same change as the page, so the shell stops
    // advertising a page that does not exist and starts pointing at the one that does.
    const link = page.getByRole('link', { name: 'Client Queue' });
    await expect(link).toHaveAttribute('href', clientQueuePath);
    await expect(link).toHaveAttribute('aria-current', 'page');

    // The row is a real link now, not the muted `aria-disabled` placeholder with a SOON chip on it.
    const row = page.locator('li', { has: link }).last();
    await expect(row.locator('[data-slot="soon-chip"]')).toHaveCount(0);
    await expect(row.locator('[aria-disabled="true"]')).toHaveCount(0);

    // Notifications is a later ticket, so it must still be the muted placeholder. This is what
    // proves the assertion above is about Client Queue shipping, and not about the SoonChip having
    // quietly disappeared from the whole sidebar. It was Team until the roster shipped its own page
    // and `href` in ticket `team`, then Interface Config until ticket `interface-config` shipped.
    const pending = page.locator('[aria-disabled="true"]', { hasText: 'Notifications' });
    await expect(pending.locator('[data-slot="soon-chip"]')).toHaveCount(1);
  });
});
