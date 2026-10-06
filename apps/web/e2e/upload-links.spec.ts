import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { uploadLinksPath } from '../src/lib/routes';

/**
 * Upload Links in demo mode — Oct 6/7 relocation (docs/decisions.md "Oct 6/7 Upload Links →
 * Settings"). The page the sidebar used to link to from the Production group now lives inside
 * the Settings group. The route stays at `/app/upload-links`, so a direct navigation still
 * renders the workspace; the sidebar link to it has moved.
 *
 * The spec runs in demo mode (no Clerk publishable key): `loadUploadLinks` returns
 * `demoUploadLinks`, the shell resolves to the admin role, and the demo brand is Niagara (a
 * child brand) — the one place `navGroupsForView(role, isTemplate)` renders Upload Links under
 * Settings for the whole admin catalogue.
 */
test.describe('upload-links in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/upload-links needs a session and real data',
  );

  test('the route still renders its workspace and the sidebar lists it under Settings, not Production', async ({
    page,
  }) => {
    await page.goto(uploadLinksPath);

    // The route is alive and the workspace renders — the Upload Links module did not disappear
    // with the sidebar move.
    await expect(page).toHaveURL(new RegExp(`${uploadLinksPath}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upload Links');

    const sidebar = page.locator('[data-slot="shell-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Exactly one Upload Links link in the sidebar — the relocation didn't duplicate it.
    const link = sidebar.getByRole('link', { name: /^Upload Links$/ });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', uploadLinksPath);
    await expect(link).toHaveAttribute('aria-current', 'page');

    // The sidebar groups each render as a `<ul aria-label="<group label>">` (see
    // `components/shell/sidebar.tsx`). Upload Links sits inside the Settings group now…
    const settingsGroup = sidebar.locator('ul[aria-label="Settings"]');
    await expect(settingsGroup).toHaveCount(1);
    await expect(settingsGroup.getByRole('link', { name: /^Upload Links$/ })).toHaveCount(1);

    // …and no longer inside Production.
    const productionGroup = sidebar.locator('ul[aria-label="Production"]');
    await expect(productionGroup).toHaveCount(1);
    await expect(productionGroup.getByRole('link', { name: /^Upload Links$/ })).toHaveCount(0);
  });
});
