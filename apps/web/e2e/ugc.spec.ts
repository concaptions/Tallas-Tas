import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { ugcPath } from '../src/lib/routes';

/**
 * UGC Management with no environment variables at all — the Vercel deployment as it stands. The
 * middleware lets the route through, the data source serves the in-repo fixtures, and the page is
 * fully usable read-only: two tabs, five creator cards with their three labelled tracks, three
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

  test('opens on Creators with the five fixtures as cards, never a table', async ({ page }) => {
    await page.goto(ugcPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('UGC Management');
    await expect(page.locator('[data-slot="ugc-tabs"]')).toBeVisible();
    await expect(page.locator('[data-slot="tabs-trigger"]')).toHaveText([
      'Creators',
      'Partnership Ads',
    ]);

    const cards = page.locator('[data-slot="creator-card"]');
    await expect(cards).toHaveCount(5);
    await expect(page.locator('[data-slot="ugc-count"]')).toHaveText('5 creators');

    // The Creators tab is a grid of cards; the partnership table is on the other tab.
    await expect(page.locator('[data-slot="partnership-table"]')).toHaveCount(0);

    // Every card carries a picture, a name, the identity line and all three tracks — never a blank.
    for (let index = 0; index < 5; index += 1) {
      const card = cards.nth(index);
      await expect(card.locator('[data-slot="creator-avatar"]')).toHaveCount(1);
      await expect(card.locator('[data-slot="creator-name"]')).not.toHaveText('');
      await expect(card.locator('[data-slot="creator-identity"]')).not.toHaveText('');
      await expect(card.locator('[data-slot="creator-track"]')).toHaveCount(3);
    }

    // The two-track separation of PRD §9 is legible: each chip sits under the review it belongs to.
    const danielle = cards.filter({ hasText: DANIELLE });
    await expect(danielle.locator('[data-slot="creator-track"]')).toHaveText([
      /Internal/,
      /Client/,
      /Assets/,
    ]);
    await expect(danielle.locator('[data-slot="creator-identity"]')).toHaveText('Female · 25–34');

    // Marcus is internally Approved, client-side Filming In Progress and his assets are still
    // pending: one row, three different answers, three different tones.
    const marcus = cards.filter({ hasText: 'Marcus Delacroix' });
    await expect(
      marcus.locator('[data-slot="creator-track"][data-track="client"] [data-slot="status-chip"]'),
    ).toHaveAttribute('data-tone', 'accent');
    await expect(
      marcus.locator(
        '[data-slot="creator-track"][data-track="internal"] [data-slot="status-chip"]',
      ),
    ).toHaveAttribute('data-tone', 'ok');
  });

  test('falls back to initials for the creator with no headshot, never a broken image', async ({
    page,
  }) => {
    await page.goto(ugcPath);

    const tomas = page.locator('[data-slot="creator-card"]').filter({ hasText: TOMAS });
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
    await expect(page.locator('[data-slot="creator-card"]')).toHaveCount(0);

    // An unknown tab falls back to the roster rather than an empty page.
    await page.goto(`${ugcPath}?tab=nonsense`);
    await expect(page.locator('[data-slot="creator-card"]')).toHaveCount(5);
  });

  test('search narrows both tabs, lives in ?q= and reaches a worded empty state', async ({
    page,
  }) => {
    await page.goto(ugcPath);

    await page.locator('[data-slot="ugc-search"]').fill('danielle');
    await expect(page.locator('[data-slot="creator-card"]')).toHaveCount(1);
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
    await expect(page.locator('[data-slot="creator-card"]')).toHaveCount(5);
  });

  test('fits a 390px phone with no horizontal page scroll, on either tab', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ugcPath);

    await expect(page.locator('[data-slot="creator-card"]')).toHaveCount(5);
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
