import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { DEMO_QUEUE_ASSIGNEE } from '../src/lib/demo-mode';
import { briefPath, internalQueuePath } from '../src/lib/routes';

/**
 * The Internal Queue board with no environment variables at all — the Vercel deployment as it
 * stands (PRD §9, §13; ticket `internal-queue.md` criterion 14).
 *
 * The middleware lets the route through, `loadInternalQueue()` serves the in-repo fixtures, and the
 * board is fully usable read-only: eleven columns in PRD §9 order, the six seeded briefs spread one
 * per column across six of them, the five empty columns keeping their place, a card that links to
 * the real Creative Brief page, and a `?view=` filter that survives a reload.
 *
 * The fixtures are `demoBriefs` in `packages/db/src/demo-data.ts`: six rows in six DIFFERENT
 * internal statuses across both tracks, which is what makes "one card per occupied column, zero in
 * the rest" a real assertion rather than a coincidence. `DEMO_QUEUE_ASSIGNEE` is imported rather
 * than retyped, so renaming the seeded assignee fails here instead of quietly emptying "Mine".
 */

/** PRD §9, the two ladders merged: the static half of each pair first, `On Hold` last. */
const COLUMNS_IN_ORDER = [
  'Sent to Designer',
  'Static Design in Progress',
  'Sent to Video Editor',
  'Video Editing in Progress',
  'Ad Submitted',
  'Images Revisions',
  'Videos Revisions',
  'Revisions Submitted',
  'Approved',
  'Launched',
  'On Hold',
];

/** The status each seeded brief is parked at. Six of the eleven columns hold exactly one card. */
const OCCUPIED_STATUSES = [
  'sent_to_designer',
  'static_design_in_progress',
  'video_editing_in_progress',
  'ad_submitted',
  'images_revisions',
  'approved',
];

const BODY_CLOCK = '77777777-7777-4777-8777-000000000001';
const BODY_CLOCK_NAME = 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2';

/** The two briefs `DEMO_QUEUE_ASSIGNEE` owns, in two different columns. */
const MINE_IDS = [BODY_CLOCK, '77777777-7777-4777-8777-000000000003'];

test.describe('internal queue in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/queue/internal needs a session and real data',
  );

  test('renders every §9 column in order with a count, and the six fixtures across them', async ({
    page,
  }) => {
    await page.goto(internalQueuePath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Internal Queue');
    await expect(page.locator('[data-slot="queue-count"]')).toHaveText('6 briefs');

    // Criterion 2: one column per internal status, in PRD §9 order, labelled by the domain.
    const columns = page.locator('[data-slot="queue-column"]');
    await expect(columns).toHaveCount(COLUMNS_IN_ORDER.length);
    await expect(page.locator('[data-slot="queue-column-label"]')).toHaveText(COLUMNS_IN_ORDER);

    // Criterion 3: every brief in exactly one column, and the empty stages keep their place.
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(6);
    for (const status of OCCUPIED_STATUSES) {
      const column = page.locator(`[data-slot="queue-column"][data-status="${status}"]`);
      await expect(column).toHaveAttribute('data-count', '1');
      await expect(column.locator('[data-slot="queue-card"]')).toHaveCount(1);
      await expect(column.locator('[data-slot="queue-column-empty"]')).toHaveCount(0);
    }
    const emptyColumns = COLUMNS_IN_ORDER.length - OCCUPIED_STATUSES.length;
    await expect(page.locator('[data-slot="queue-column-empty"]')).toHaveCount(emptyColumns);
    await expect(page.locator('[data-slot="queue-column-empty"]').first()).toHaveText(
      'Nothing here',
    );

    // Every count is a StatusChip, never a locally coloured pill.
    const zero = page
      .locator('[data-slot="queue-column"][data-count="0"]')
      .first()
      .locator('[data-slot="queue-column-count"] [data-slot="status-chip"]');
    await expect(zero).toHaveText('0');
  });

  test('a card shows the monospace name, a tile, the assignee and a priority chip', async ({
    page,
  }) => {
    await page.goto(internalQueuePath);

    const card = page.locator(`[data-slot="queue-card"][data-brief-id="${BODY_CLOCK}"]`);
    await expect(card).toBeVisible();

    // Criterion 4: the generated name is system output, so it renders monospace and is not a field.
    const name = card.locator('[data-slot="queue-card-name"]');
    await expect(name).toHaveText(BODY_CLOCK_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);

    // Criterion 5: a labelled tile built from the row's own design file. No image is fetched.
    const thumb = card.locator('[data-slot="queue-card-thumb"]');
    await expect(thumb).toHaveAttribute('data-thumb-source', 'design-file');
    await expect(thumb).toHaveText('frame.example');
    await expect(card.locator('img')).toHaveCount(0);

    await expect(card.locator('[data-slot="queue-card-assignee"]')).toHaveText(DEMO_QUEUE_ASSIGNEE);

    // Criterion 4: the priority chip is a StatusChip with priorityView's own tone.
    const priority = card.locator('[data-slot="queue-card-priority"] [data-slot="status-chip"]');
    await expect(priority).toHaveText('Video High');
    await expect(priority).toHaveAttribute('data-tone', /.+/);

    // Every seeded brief carries a priority, so every card carries exactly one chip and no card
    // shows an empty pill. The unset case — no chip at all — is mounted on `/design-system`.
    await expect(page.locator('[data-slot="queue-card-priority"]')).toHaveCount(6);
    await expect(page.locator('[data-slot="queue-card-priority"]:empty')).toHaveCount(0);
  });

  test('a card click lands on the brief, and Back restores the board with its filter', async ({
    page,
  }) => {
    await page.goto(`${internalQueuePath}?view=mine`);
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(2);

    // Criterion 6: the whole card is a link to the real Creative Brief detail route.
    const card = page.locator(`[data-slot="queue-card"][data-brief-id="${BODY_CLOCK}"]`);
    await expect(card).toHaveAttribute('href', briefPath(BODY_CLOCK));
    await card.click();

    await expect(page).toHaveURL(new RegExp(`${briefPath(BODY_CLOCK)}$`));
    await expect(page.locator('[data-slot="brief-name"]')).toHaveText(BODY_CLOCK_NAME);

    await page.goBack();
    await expect(page).toHaveURL(/\?view=mine$/);
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(2);
  });

  test('?view=mine narrows the board, writes the address and survives a reload', async ({
    page,
  }) => {
    await page.goto(internalQueuePath);

    // Criterion 9: the option names the viewer, so the board never implies whose queue it is.
    const mine = page.locator('[data-slot="queue-view-option"][data-view="mine"]');
    await expect(mine).toHaveText(`Mine · ${DEMO_QUEUE_ASSIGNEE}`);
    await mine.click();

    // Criterion 7: the History API writes ?view= with no server round trip.
    await expect(page).toHaveURL(/\?view=mine$/);
    await expect(mine).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-slot="queue-count"]')).toHaveText('2 of 6 briefs');
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(2);
    for (const id of MINE_IDS) {
      await expect(page.locator(`[data-slot="queue-card"][data-brief-id="${id}"]`)).toBeVisible();
    }
    // The columns never collapse, however narrow the filter gets.
    await expect(page.locator('[data-slot="queue-column"]')).toHaveCount(COLUMNS_IN_ORDER.length);

    // A reload restores the same board from the same address: the URL is shareable.
    await page.reload();
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(2);
    await expect(mine).toHaveAttribute('aria-pressed', 'true');

    // "All" is the default, so it deletes the parameter rather than writing ?view=all.
    await page.locator('[data-slot="queue-view-option"][data-view="all"]').click();
    await expect(page).toHaveURL(new RegExp(`${internalQueuePath}$`));
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(6);
  });

  test('the brand option is derived from the rows, and a filter that matches nothing says so', async ({
    page,
  }) => {
    await page.goto(internalQueuePath);

    // Criterion 8: one brand in demo mode, named, with the number of briefs actually behind it.
    const brand = page.locator('[data-slot="queue-view-option"][data-view^="brand:"]');
    await expect(brand).toHaveCount(1);
    await expect(brand).toHaveText('Niagara Sleep Solutions · 6');
    await expect(page.locator('[data-slot="queue-brand-note"]')).toContainText('One brand');

    await brand.click();
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(6);

    // Criterion 7: a hand-edited URL never throws; an unknown brand is an empty board that
    // explains itself in words and offers its way back, never a blank panel or raw JSON.
    await page.goto(`${internalQueuePath}?view=brand:nope`);
    await expect(page.locator('[data-slot="queue-board"]')).toHaveCount(0);
    const empty = page.locator('[data-slot="queue-empty"]');
    await expect(empty).toContainText('No briefs on the internal track');
    await page.locator('[data-slot="queue-show-all"]').click();
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(6);

    // Junk in the parameter is the default board, not an error page.
    await page.goto(`${internalQueuePath}?view=%%%`);
    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(6);
  });

  test('there is no write on the board at all, and the page says so in one line', async ({
    page,
  }) => {
    await page.goto(internalQueuePath);

    // Criterion 11: absent, not faked. No DisabledWrite, because there is no control to disable.
    await expect(page.locator('[data-slot="disabled-write"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="queue-read-only"]')).toContainText('Read-only board');

    // The only buttons on the board are the filter's own, and every one of them is enabled.
    const buttons = page.locator(
      '[data-slot="queue-board"] button, [data-slot="queue-card"] button',
    );
    await expect(buttons).toHaveCount(0);
    for (const option of await page.locator('[data-slot="queue-view-option"]').all()) {
      await expect(option).toBeEnabled();
    }
  });

  test('reads down to 390px: the strip scrolls, the page does not', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(internalQueuePath);

    await expect(page.locator('[data-slot="queue-card"]')).toHaveCount(6);

    // Criterion 12: the shell never gets a horizontal page scrollbar.
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(0);

    // …because the columns scroll inside the board's own container instead.
    const board = await page
      .locator('[data-slot="queue-board"]')
      .evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
    expect(board.scroll).toBeGreaterThan(board.client);
    expect(board.client).toBeLessThanOrEqual(390);
  });

  test('the sidebar links Internal Queue and marks it active, so its SoonChip is gone', async ({
    page,
  }) => {
    await page.goto(internalQueuePath);

    // Criterion 1: the section gets its `href` in the same change as the page, so the shell stops
    // advertising a page that does not exist and starts pointing at the one that does.
    const link = page.getByRole('link', { name: 'Internal Queue' });
    await expect(link).toHaveAttribute('href', internalQueuePath);
    await expect(link).toHaveAttribute('aria-current', 'page');

    // The row is a real link now, not the muted `aria-disabled` placeholder with a SOON chip on it.
    const row = page.locator('li', { has: link }).last();
    await expect(row.locator('[data-slot="soon-chip"]')).toHaveCount(0);
    await expect(row.locator('[aria-disabled="true"]')).toHaveCount(0);

    // Client Queue is the next ticket, so it must still be the muted placeholder. This is what
    // proves the assertion above is about Internal Queue shipping, and not about the SoonChip
    // having quietly disappeared from the whole sidebar.
    const clientQueue = page.locator('[aria-disabled="true"]', { hasText: 'Client Queue' });
    await expect(clientQueue.locator('[data-slot="soon-chip"]')).toHaveCount(1);
  });
});
