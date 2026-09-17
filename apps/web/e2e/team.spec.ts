import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { teamPath } from '../src/lib/routes';

/**
 * The Team route with no environment variables at all — the Vercel deployment as it stands.
 *
 * The middleware lets the route through, there is no session to ask, so the page stands the stub
 * actor in for an admin (ticket criterion 7) and serves the five in-repo fixtures. Everything below
 * is therefore the demo contract: the whole roster renders read-only, the one write control is
 * disabled and says why, and the only interaction — the `?q=` filter — is a link you can share.
 */
test.describe('team in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/team needs a session and real data',
  );

  test('lists the five fixture members in four columns, each with a role chip', async ({
    page,
  }) => {
    await page.goto(teamPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Team');
    await expect(page.locator('[data-slot="team-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="team-count"]')).toContainText('5 people');

    await expect(page.locator('[data-slot="team-table"] thead th')).toHaveText([
      'Name',
      'Role',
      'Brands',
      'Last active',
    ]);

    // Every row carries at least one role chip, and every chip is the shared StatusChip.
    for (const row of await page.locator('[data-slot="team-row"]').all()) {
      const chips = row.locator('[data-slot="role-chip"] [data-slot="status-chip"]');
      expect(await chips.count()).toBeGreaterThan(0);
    }

    // Callum is CSM and media buyer, so his row shows two chips rather than dropping one.
    const dual = page.locator('[data-slot="team-row"]', { hasText: 'Callum Ashworth' });
    await expect(dual.locator('[data-slot="role-chip"]')).toHaveCount(2);
    await expect(dual.locator('[data-slot="role-chip"]')).toHaveText([
      'Client Success Manager',
      'Media Buyer',
    ]);

    // The name cell carries the email beneath the full name.
    await expect(dual.locator('td').first()).toContainText('callum@tasdigital.example');
  });

  test('the admin reads All brands, everyone else their own, and every row has a last active', async ({
    page,
  }) => {
    await page.goto(teamPath);

    const admin = page.locator('[data-slot="team-row"]', { hasText: 'Marguerite Alaoui' });
    await expect(admin.locator('[data-slot="role-chip"]')).toHaveText('Admin');
    await expect(admin.locator('[data-slot="team-brands"]')).toHaveText('All brands');

    const designer = page.locator('[data-slot="team-row"]', { hasText: 'Rhiannon Okafor' });
    await expect(designer.locator('[data-slot="team-brands"]')).toContainText('Niagara');

    // Never an empty cell: every Brands and Last active cell says something.
    for (const cell of await page.locator('[data-slot="team-brands"]').all()) {
      expect(((await cell.textContent()) ?? '').trim()).not.toBe('');
    }
    for (const cell of await page.locator('[data-slot="team-last-active"]').all()) {
      expect(((await cell.textContent()) ?? '').trim()).not.toBe('');
    }

    // No fixture member is a client, so no row claims client-only access.
    await expect(page.locator('[data-slot="client-access"]')).toHaveCount(0);
  });

  test('the access note names the two roles and says the rule is enforced on the server', async ({
    page,
  }) => {
    await page.goto(teamPath);

    const note = page.locator('[data-slot="team-access-note"]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Admin and Client Success Managers only.');
    await expect(note).toContainText('canSeeTeamPage');
    await expect(note).toContainText('not by hiding the sidebar link');
    // Criterion 7: demo mode says out loud that it signed you in as an admin.
    await expect(note).toContainText('Demo mode signs you in as an Admin');
  });

  test('search filters the table, rides in the URL, and the empty state offers to clear it', async ({
    page,
  }) => {
    await page.goto(teamPath);

    // A role is searchable by its label, not only by a name.
    await page.locator('[data-slot="team-search"]').fill('designer');
    await expect(page.locator('[data-slot="team-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="team-count"]')).toContainText('1 of 5 people');
    await expect(page).toHaveURL(/\?q=designer/);

    // The filter is table state in the URL, so a reload restores it.
    await page.reload();
    await expect(page.locator('[data-slot="team-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="team-search"]')).toHaveValue('designer');

    // An email fragment matches too.
    await page.locator('[data-slot="team-search"]').fill('dorian@');
    await expect(page.locator('[data-slot="team-row"]')).toHaveCount(1);

    await page.locator('[data-slot="team-search"]').fill('nobody here by that name');
    await expect(page.locator('[data-slot="team-row"]')).toHaveCount(0);

    // The empty state is words and a way out, inside the table, never a blank panel or raw JSON.
    const empty = page.locator('[data-slot="team-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Nobody matches');
    await expect(page.locator('[data-slot="team-table"] thead th')).toHaveCount(4);

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="team-row"]')).toHaveCount(5);
    await expect(page).not.toHaveURL(/\?q=/);
  });

  test('Invite member is disabled and explains why', async ({ page }) => {
    await page.goto(teamPath);

    const invite = page.locator('[data-slot="invite-member"]');
    await expect(invite).toBeVisible();
    await expect(invite).toBeDisabled();

    // A disabled button receives no pointer events, so the tooltip lives on the wrapper around it.
    const wrapper = page.locator('[data-slot="disabled-write"]', { has: invite });
    await expect(wrapper).toHaveAttribute('title', 'Sign in required to save changes');

    // Criterion 8: it opens nothing. There is no invite form on this page in either mode.
    await expect(page.locator('form')).toHaveCount(0);
  });

  test('the sidebar links Team and no longer marks it as coming soon', async ({ page }) => {
    await page.goto(teamPath);

    const link = page.getByRole('link', { name: 'Team' });
    await expect(link).toHaveAttribute('href', teamPath);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(link.locator('[data-slot="soon-chip"]')).toHaveCount(0);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(teamPath);

    await expect(page.locator('[data-slot="team-row"]')).toHaveCount(5);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
