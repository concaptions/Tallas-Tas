import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { ugcPath } from '../src/lib/routes';

/**
 * UGC Management with no environment variables at all — the Vercel deployment as it stands. The
 * middleware lets the route through, the data source serves the in-repo fixtures, and the page is
 * fully usable read-only: two tabs, five creator rows with their three labelled tracks, three
 * partnership rows whose countdowns are read against the pinned reference date, a URL-backed search
 * that reaches a worded empty state on either tab, and every write disabled with a reason.
 *
 * The fixtures are `demoCreators` in `packages/db/src/demo-data.ts`: five creators, newest edit
 * first, three of them marked for partnership ads. Danielle lapses three days after
 * `PARTNERSHIP_REFERENCE_DATE` and is therefore the one highlighted row on any day this runs —
 * which is the whole point of pinning the date rather than deriving it from the clock.
 */
const DANIELLE = 'Danielle Okonkwo';
const TOMAS = 'Tomás Ferreira';

test.describe('ugc management in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/ugc needs a session and real data',
  );

  test('opens on Creators as a grid: five rows, every stored column, the avatar in the frozen name cell', async ({
    page,
  }) => {
    await page.goto(ugcPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('UGC Management');
    await expect(page.locator('[data-slot="ugc-tabs"]')).toBeVisible();
    // The Creators panel mounts a ViewSwitcher whose Grid/Kanban/Gallery triggers share
    // `data-slot="tabs-trigger"`, so the workspace tabs are the ones carrying `data-tab` and the view
    // triggers are the ones without it. Grid is the default.
    await expect(page.locator('[data-slot="tabs-trigger"][data-tab]')).toHaveText([
      'Creators',
      'Partnership Ads',
    ]);
    await expect(page.locator('[data-slot="tabs-trigger"]:not([data-tab])')).toHaveText([
      'Grid',
      'Kanban',
      'Gallery',
      'List',
    ]);

    const rows = page.locator('[data-slot="creator-row"]');
    await expect(rows).toHaveCount(5);
    await expect(page.locator('[data-slot="ugc-count"]')).toHaveText('5 creators');

    // The Creators tab is the grid; the partnership table is on the other tab.
    await expect(page.locator('[data-slot="partnership-table"]')).toHaveCount(0);

    /*
     * The headers are the RESOLVER's labels now, from `column_definitions`. Demo mode's brand is
     * `DEMO_BRAND_ID` (Niagara), which owns no rows of its own, so it inherits the template — and
     * the template's labels are the parent base's own Airtable field names, which is why the name
     * column reads in full and the three tracks sit at their Airtable positions rather than at 2-4.
     * The tracks are addressed by COLUMN KEY, because order is configuration now.
     */
    const headers = page.locator('[data-slot="creators-table"] thead th');
    await expect(headers.first()).toHaveText('Creator name (Filled by UGC Manager)');
    await expect(headers.first()).toHaveCSS('position', 'sticky');
    await expect(headers.locator('css=[data-column="internal_creator_status"]')).toHaveCount(0);
    await expect(
      page.locator('[data-slot="creators-table"] thead th[data-column="internal_creator_status"]'),
    ).toHaveText("Internal Creator's Status");
    await expect(
      page.locator('[data-slot="creators-table"] thead th[data-column="client_status"]'),
    ).toHaveText('Status');
    await expect(
      page.locator('[data-slot="creators-table"] thead th[data-column="internal_assets_status"]'),
    ).toHaveText('Internal Assets Status');
    // Thirty-three drawn, the same count as the hand-written array. Three template columns this grid
    // has never drawn as columns are stated in the notice instead.
    expect(await headers.count()).toBe(33);
    await expect(page.locator('[data-slot="creator-missing-columns"]')).toContainText(
      'profile_pic_url',
    );

    // Every row carries a picture, a name and all three tracks — never a blank.
    for (let index = 0; index < 5; index += 1) {
      const row = rows.nth(index);
      await expect(row.locator('td').first().locator('[data-slot="creator-avatar"]')).toHaveCount(
        1,
      );
      await expect(row.locator('td').first().locator('[data-slot="creator-name"]')).not.toHaveText(
        '',
      );
      await expect(row.locator('[data-slot="creator-track"]')).toHaveCount(3);
    }

    // The two-track separation of PRD §9 is legible: each chip sits under the review it belongs to.
    const danielle = rows.filter({ hasText: DANIELLE });
    await expect(danielle.locator('[data-slot="creator-identity"]')).toHaveText('25–34');

    // Marcus is internally Approved, client-side Filming In Progress and his assets are still
    // pending: one row, three different answers, three different tones.
    const marcus = rows.filter({ hasText: 'Marcus Delacroix' });
    await expect(
      marcus.locator('[data-slot="creator-track"][data-track="client"] [data-slot="status-chip"]'),
    ).toHaveAttribute('data-tone', 'accent');
    await expect(
      marcus.locator(
        '[data-slot="creator-track"][data-track="internal"] [data-slot="status-chip"]',
      ),
    ).toHaveAttribute('data-tone', 'ok');
  });

  test('a row opens the creator panel and the URL carries it', async ({ page }) => {
    await page.goto(ugcPath);

    await page.locator('[data-slot="creator-row"]').filter({ hasText: DANIELLE }).click();
    const panel = page.locator('[data-slot="creator-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="creator-panel-title"]')).toHaveText(DANIELLE);
    await expect(page).toHaveURL(/creator=/);

    /*
     * Both of the creator's links are the shared `LinkField`, so each is editable here AND from the
     * other record's panel — one `creator_concepts` row, one `creator_products` row, whichever side
     * writes it (LINK-01). Products used to be a row of toggle buttons of this panel's own, which
     * wrote the junction on Save only and left the product panel with nothing but a sentence
     * pointing back here; the toggles are gone and the picker is the same control as Concepts.
     */
    await expect(panel.locator('[data-slot="creator-concepts"]')).toHaveAttribute(
      'data-link',
      'creator-concepts',
    );
    await expect(panel.locator('[data-slot="creator-products"]')).toHaveAttribute(
      'data-link',
      'creator-products',
    );
    await expect(panel.locator('[data-slot="product-picker"]')).toHaveCount(0);
    // Demo mode: the picker is mounted and inert, like every other write control on the page.
    await expect(panel.locator('[data-slot="creator-products-add"]')).toBeDisabled();

    // NOT a modal: the grid stays beside it.
    await expect(page.locator('[data-slot="creator-row"]')).toHaveCount(5);
  });

  test('falls back to initials for the creator with no headshot, never a broken image', async ({
    page,
  }) => {
    await page.goto(ugcPath);

    const tomas = page.locator('[data-slot="creator-row"]').filter({ hasText: TOMAS });
    const avatar = tomas.locator('[data-slot="creator-avatar"]');

    await expect(avatar).toHaveAttribute('data-fallback', 'initials');
    await expect(avatar).toHaveText('TF');

    // The other four are real `<img>` elements that actually decoded.
    const loaded = await page
      .locator('img[data-slot="creator-avatar"]')
      .evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      );
    expect(loaded).toBe(true);
  });

  /**
   * AI-26: a STORED url that no longer loads gets the same initials tile as no url at all. In
   * production 27 of 31 profile pictures are airtableusercontent links answering 410 Gone, so
   * `null` is not the only way to have no picture. The demo fixtures' data-URI avatars cannot be
   * made to fail by the network, so the test fires the element's own error event — exactly what a
   * 410 delivers — and the row must flip to initials instead of keeping a broken image.
   */
  test('a dead picture URL flips to initials too, never a broken image', async ({ page }) => {
    await page.goto(ugcPath);

    const row = page.locator('[data-slot="creator-row"]').first();
    const img = row.locator('img[data-slot="creator-avatar"]');
    await expect(img).toHaveCount(1);

    await img.evaluate((element) => element.dispatchEvent(new Event('error')));

    const avatar = row.locator('[data-slot="creator-avatar"]');
    await expect(avatar).toHaveAttribute('data-fallback', 'initials');
    await expect(row.locator('img[data-slot="creator-avatar"]')).toHaveCount(0);
    await expect(row.locator('[data-slot="creator-name"]')).not.toBeEmpty();
  });

  test('the Partnership Ads tab writes ?tab=, survives a reload, and counts down', async ({
    page,
  }) => {
    await page.goto(ugcPath);

    await page.locator('[data-slot="tabs-trigger"][data-tab="partnerships"]').click();
    await expect(page).toHaveURL(/\?tab=partnerships/);

    const rows = page.locator('[data-slot="partnership-row"]');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('[data-slot="ugc-count"]')).toHaveText('3 partnerships');

    // A reload restores the tab, so the URL really is the state.
    await page.reload();
    await expect(page.locator('[data-slot="partnership-row"]')).toHaveCount(3);
    await expect(
      page.locator('[data-slot="tabs-trigger"][data-tab="partnerships"]'),
    ).toHaveAttribute('data-state', 'active');

    // Exactly one row is inside the highlight window, and it is the three-day one. The reference
    // date is pinned, so this reads 3 on any day the suite runs.
    const nearExpiry = page.locator('[data-slot="partnership-row"][data-near-expiry="true"]');
    await expect(nearExpiry).toHaveCount(1);
    await expect(nearExpiry).toContainText(DANIELLE);
    await expect(nearExpiry.locator('[data-slot="partnership-countdown"]')).toHaveText(
      '3 days left',
    );

    // The extension is shown as its own term, and it is why Marcus lapses after Danielle although
    // he was whitelisted first.
    const marcus = page.locator('[data-slot="partnership-row"]').filter({ hasText: 'Marcus' });
    await expect(marcus.locator('[data-slot="partnership-period"]')).toHaveText('60 + 30 days');
    await expect(marcus.locator('[data-slot="partnership-countdown"]')).toHaveText('20 days left');
    await expect(marcus).not.toHaveAttribute('data-near-expiry', 'true');

    // A lapsed window reads the word, never a negative number.
    const priya = page.locator('[data-slot="partnership-row"]').filter({ hasText: 'Priya' });
    await expect(priya.locator('[data-slot="partnership-countdown"]')).toHaveText('Expired');
    await expect(priya).toHaveAttribute('data-expiry-state', 'expired');

    // The handle is mono, and the internal price is nowhere on the page.
    await expect(
      page
        .locator('[data-slot="partnership-row"]')
        .first()
        .locator('[data-slot="partnership-handle"]'),
    ).toContainText('@');
    await expect(page.locator('[data-slot="partnership-internal-note"]')).toContainText('Internal');
    await expect(page.getByText('750')).toHaveCount(0);
  });

  test('a link opens the right tab directly', async ({ page }) => {
    await page.goto(`${ugcPath}?tab=partnerships`);

    await expect(page.locator('[data-slot="partnership-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="creator-row"]')).toHaveCount(0);

    // An unknown tab falls back to the roster rather than an empty page.
    await page.goto(`${ugcPath}?tab=nonsense`);
    await expect(page.locator('[data-slot="creator-row"]')).toHaveCount(5);
  });

  test('search narrows both tabs, lives in ?q= and reaches a worded empty state', async ({
    page,
  }) => {
    await page.goto(ugcPath);

    await page.locator('[data-slot="ugc-search"]').fill('danielle');
    await expect(page.locator('[data-slot="creator-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="ugc-count"]')).toHaveText('1 of 5 creators');
    await expect(page).toHaveURL(/[?&]q=danielle/);

    // The same search narrows the other tab, and both parameters travel together.
    await page.locator('[data-slot="tabs-trigger"][data-tab="partnerships"]').click();
    await expect(page.locator('[data-slot="partnership-row"]')).toHaveCount(1);
    await expect(page).toHaveURL(/tab=partnerships/);
    await expect(page).toHaveURL(/q=danielle/);

    // Filtering to nothing says so in words and offers the way out — never a blank panel.
    await page.locator('[data-slot="ugc-search"]').fill('nobody at all');
    const partnershipsEmpty = page.locator('[data-slot="partnerships-empty"]');
    await expect(partnershipsEmpty).toBeVisible();
    await expect(partnershipsEmpty).toContainText('No creator matches that search');

    await partnershipsEmpty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="partnership-row"]')).toHaveCount(3);
    await expect(page).not.toHaveURL(/[?&]q=/);

    // And on the Creators tab too.
    await page.locator('[data-slot="tabs-trigger"][data-tab="creators"]').click();
    await page.locator('[data-slot="ugc-search"]').fill('nobody at all');
    const creatorsEmpty = page.locator('[data-slot="creators-empty"]');
    await expect(creatorsEmpty).toBeVisible();
    await expect(creatorsEmpty).toContainText('No creator matches that search');
  });

  test('every write is disabled with a reason', async ({ page }) => {
    await page.goto(ugcPath);

    const newCreator = page.locator('[data-slot="new-creator"]');
    await expect(newCreator.first()).toBeVisible();
    await expect(newCreator.first()).toBeDisabled();

    // A disabled button receives no pointer events, so the tooltip lives on the wrapper.
    await expect(page.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    // Disabled means disabled: clicking it navigates nowhere and opens nothing.
    await newCreator.first().click({ force: true });
    await expect(page.locator('[data-slot="creator-row"]')).toHaveCount(5);
  });

  test('fits a 390px phone with no horizontal page scroll, on either tab', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ugcPath);

    await expect(page.locator('[data-slot="creator-row"]')).toHaveCount(5);
    const gridOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(gridOverflow).toBeLessThanOrEqual(1);

    await page.locator('[data-slot="tabs-trigger"][data-tab="partnerships"]').click();
    await expect(page.locator('[data-slot="partnership-row"]')).toHaveCount(3);
    const tableOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(tableOverflow).toBeLessThanOrEqual(1);
  });

  test('the sidebar links UGC Management and marks it active, so its SoonChip is gone', async ({
    page,
  }) => {
    await page.goto(ugcPath);

    const link = page.getByRole('link', { name: 'UGC Management' });
    await expect(link).toHaveAttribute('href', ugcPath);
    await expect(link).toHaveAttribute('aria-current', 'page');
  });
});
