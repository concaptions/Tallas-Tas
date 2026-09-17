import { expect, test, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { interfaceConfigPath } from '../src/lib/routes';

/**
 * Interface Config with no environment variables at all — the Vercel deployment as it stands
 * (PRD §10, ticket criterion 15).
 *
 * The middleware lets the route through, there is no session to ask, so the page serves
 * `demoInterfaceConfig` from `@tas/db`. Everything below is therefore the demo contract: the whole
 * configuration renders, every switch is fully interactive and changes the preview with no server
 * round trip, and the one write control — Save configuration — is disabled and says why.
 */
const CONCEPTS = 'concepts';
const COPYWRITING = 'copywriting';
const HOOK_EXAMPLES = 'hook_examples';

/** A flag on `window` that a real navigation would destroy: how "no reload" is proven below. */
async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __tasNoReload?: boolean }).__tasNoReload = true;
  });
}

async function stillTheSameDocument(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as unknown as { __tasNoReload?: boolean }).__tasNoReload === true,
  );
}

test.describe('interface config in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/interface-config needs a session and real data',
  );

  test('renders both columns, five pages, and twelve fields under Concepts', async ({ page }) => {
    await page.goto(interfaceConfigPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Interface Config');
    await expect(page.locator('[data-slot="config-tree"]')).toBeVisible();
    await expect(page.locator('[data-slot="config-preview"]')).toBeVisible();

    // The five pages of PRD §10, in order, each with a switch that is on.
    const pages = page.locator('[data-slot="page-node"]');
    await expect(pages).toHaveCount(5);
    await expect(pages.locator('[data-slot="config-toggle"]')).toHaveCount(5);
    for (const toggle of await pages.locator('[data-slot="config-toggle"]').all()) {
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
    }

    // Twelve field nodes under the Concepts page — the concept card's default field list.
    const conceptFields = page.locator(
      `[data-slot="field-list"][data-page-key="${CONCEPTS}"] [data-slot="field-node"]`,
    );
    await expect(conceptFields).toHaveCount(12);
    await expect(conceptFields.first()).toHaveAttribute('data-field-name', 'batch');
    await expect(conceptFields.last()).toHaveAttribute('data-field-name', HOOK_EXAMPLES);

    // The preview opens on the concept card, with a line per visible field.
    const card = page.locator('[data-slot="preview-concept-card"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-slot="preview-field"]')).toHaveCount(12);

    // The guarantee of CLAUDE.md non-negotiable 10 is stated, not implied.
    await expect(page.locator('[data-slot="preview-privacy-note"]')).toContainText(
      'The client sees nothing internal',
    );
  });

  test('toggling Hook examples off removes it from the card, with no reload, and back restores its order', async ({
    page,
  }) => {
    await page.goto(interfaceConfigPath);
    await markPage(page);

    const card = page.locator('[data-slot="preview-concept-card"]');
    const hookInCard = card.locator(
      `[data-slot="preview-field"][data-field-name="${HOOK_EXAMPLES}"]`,
    );
    await expect(hookInCard).toBeVisible();

    const toggle = page
      .locator(`[data-slot="field-node"][data-field-name="${HOOK_EXAMPLES}"]`)
      .locator('[data-slot="config-toggle"]');

    await toggle.click();
    await expect(hookInCard).toHaveCount(0);
    await expect(card.locator('[data-slot="preview-field"]')).toHaveCount(11);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await stillTheSameDocument(page)).toBe(true);

    await toggle.click();
    await expect(hookInCard).toBeVisible();
    await expect(card.locator('[data-slot="preview-field"]')).toHaveCount(12);
    // Position is data, so it comes back LAST rather than at the end of a re-sorted list.
    await expect(card.locator('[data-slot="preview-field"]').last()).toHaveAttribute(
      'data-field-name',
      HOOK_EXAMPLES,
    );
    expect(await stillTheSameDocument(page)).toBe(true);
  });

  test('toggling Copywriting off removes its preview tab and mutes nothing else', async ({
    page,
  }) => {
    await page.goto(interfaceConfigPath);
    await markPage(page);

    const tabs = page.locator('[data-slot="preview-tab"]');
    await expect(tabs).toHaveCount(5);

    const pageToggle = page
      .locator(`[data-slot="page-node"][data-page-key="${COPYWRITING}"]`)
      .locator('[data-slot="config-toggle"]');
    await pageToggle.click();

    await expect(tabs).toHaveCount(4);
    await expect(
      page.locator(`[data-slot="preview-tab"][data-page-key="${COPYWRITING}"]`),
    ).toHaveCount(0);
    // Its field rows stay in the tree, with their own values, so switching back restores them.
    await expect(
      page.locator(
        `[data-slot="field-list"][data-page-key="${COPYWRITING}"] [data-slot="field-node"]`,
      ),
    ).not.toHaveCount(0);
    expect(await stillTheSameDocument(page)).toBe(true);

    await pageToggle.click();
    await expect(tabs).toHaveCount(5);
  });

  test('every field off is a legitimate configuration, and the preview says so', async ({
    page,
  }) => {
    await page.goto(interfaceConfigPath);

    const toggles = page
      .locator(`[data-slot="field-list"][data-page-key="${CONCEPTS}"] [data-slot="field-node"]`)
      .locator('[data-slot="config-toggle"]');
    const count = await toggles.count();
    for (let index = 0; index < count; index += 1) {
      await toggles.nth(index).click();
    }

    const empty = page.locator('[data-slot="preview-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('empty card');
    await expect(page.locator('[data-slot="preview-concept-card"]')).toHaveCount(0);

    // Never a blank panel: the empty state offers the action that undoes it.
    await empty.locator('[data-slot="show-every-field"]').click();
    await expect(page.locator('[data-slot="preview-concept-card"]')).toBeVisible();
    await expect(
      page.locator('[data-slot="preview-concept-card"] [data-slot="preview-field"]'),
    ).toHaveCount(12);
  });

  test('Save configuration is disabled in demo mode and explains why', async ({ page }) => {
    await page.goto(interfaceConfigPath);

    const save = page.locator('[data-slot="save-config"]');
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();

    // A disabled button receives no pointer events, so the tooltip lives on the wrapper around it.
    const wrapper = page.locator('[data-slot="disabled-write"]', { has: save });
    await expect(wrapper).toHaveAttribute('title', 'Sign in required to save changes');

    // Toggling stays fully interactive while Save is disabled (criterion 13).
    const toggle = page
      .locator(`[data-slot="field-node"][data-field-name="${HOOK_EXAMPLES}"]`)
      .locator('[data-slot="config-toggle"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('[data-slot="demo-notice"]')).toContainText('nothing is saved');
  });

  test('the sidebar links Interface Config and no longer marks it as coming soon', async ({
    page,
  }) => {
    await page.goto(interfaceConfigPath);

    const link = page.getByRole('link', { name: 'Interface Config' });
    await expect(link).toHaveAttribute('href', interfaceConfigPath);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(link.locator('[data-slot="soon-chip"]')).toHaveCount(0);

    // The row is a real link now, not the muted `aria-disabled` placeholder it was before.
    const row = page.locator('li', { has: link }).last();
    await expect(row.locator('[aria-disabled="true"]')).toHaveCount(0);

    // Propagation is a later ticket and must still be the muted placeholder, which is what proves
    // the assertions above are about Interface Config shipping rather than about the SoonChip having
    // quietly disappeared from the whole sidebar. It was Notifications until ticket `notifications`
    // shipped its page. The queue specs make the same assertion from the other side.
    const pending = page.locator('[aria-disabled="true"]', { hasText: 'Propagation' });
    await expect(pending.locator('[data-slot="soon-chip"]')).toHaveCount(1);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(interfaceConfigPath);

    await expect(page.locator('[data-slot="page-node"]')).toHaveCount(5);
    // Stacked to one column, with the tree first.
    const tree = await page.locator('[data-slot="config-tree"]').boundingBox();
    const preview = await page.locator('[data-slot="config-preview"]').boundingBox();
    expect(tree).not.toBeNull();
    expect(preview).not.toBeNull();
    expect(tree?.y ?? 0).toBeLessThan(preview?.y ?? 0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
