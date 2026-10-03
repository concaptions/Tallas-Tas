import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { ORIGIN_LABEL, columnAdminPath } from '../src/app/app/column-admin/fields';

/**
 * Column Admin with no environment variables at all — the Vercel deployment as it stands.
 *
 * The middleware lets the route through, there is no session to ask, so `currentTeamActor` stands
 * `DEMO_TEAM_ACTOR` in for an admin and the page serves `COLUMN_SEED` from `@tas/db`. Everything
 * below is therefore the demo contract: the admin note is visible, the parent base shows the master
 * Personas set in Airtable field order, a child base shows its OWN names with the inheritance each
 * column has, and every write control is disabled and says why.
 *
 * The page's own guard is exercised here only in its passing direction. A refused reader needs a
 * real session with a non-admin role, so the `not-admin` branch is asserted by `fields.test.ts`
 * (the copy) and by `actions.test.ts` (the write refusal), and is listed for human verification.
 */

/** The tooltip `DisabledWrite` carries in demo mode. */
const DEMO_HINT = 'Sign in required to save changes';

/** The parent's first five Personas columns, in the order the Airtable metadata returned them. */
const PARENT_HEAD = [
  ['name', 'Persona Name'],
  ['day_in_the_life', 'A Day in the Life'],
  ['demographic', 'Demographic'],
  ['psychographic', 'Psychographic'],
  ['core_desires', 'Core Desires (Cashvertising)'],
] as const;

/**
 * Gratsi's departures: its own labels, and what each column's inheritance reads as. The chip text
 * is `ORIGIN_LABEL`, read from the same module the page renders from — the chip is uppercased by
 * CSS, and `toHaveText` compares the text content, so the assertion is the label as written.
 */
const GRATSI = [
  ['name', 'Name', ORIGIN_LABEL.detached],
  ['demographic', 'Description [Age Status Salary]', ORIGIN_LABEL.detached],
  ['passion', 'Passion', ORIGIN_LABEL.custom],
] as const;

test.describe('column admin in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/column-admin needs a session and real bases',
  );

  test('states what the page is for and who may change structure', async ({ page }) => {
    await page.goto(columnAdminPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Column Admin');

    const note = page.locator('[data-slot="admin-note"]');
    await expect(note).toContainText('admin only');
    await expect(note).toContainText('stubbed, not skipped');
    await expect(note).toContainText('again on the server');
  });

  test('says on a brand what a local row actually does to a read, and nothing on the parent', async ({
    page,
  }) => {
    await page.goto(columnAdminPath);

    // The parent base has nothing to follow, so the note would be meaningless there.
    await expect(page.locator('[data-slot="inheritance-note"]')).toHaveCount(0);

    await page.locator('[data-slot="base-option"][data-option="gratsi"]').click();

    const note = page.locator('[data-slot="inheritance-note"]');
    await expect(note).toContainText('holds no definition of its own');
    await expect(note).toContainText('Relabelling or moving');
    await expect(note).toContainText('does not read the flag yet');
  });

  test('offers a brand the template columns it hides, as the way back from Hide', async ({
    page,
  }) => {
    await page.goto(columnAdminPath);

    // There is no free-text "Add column": a definition for a key the table does not store is a
    // column the grid has to drop, so the only add is restoring one the template already defines.
    await expect(page.getByRole('button', { name: 'Add column' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Restore a template column' })).toHaveCount(0);

    await page.locator('[data-slot="base-option"][data-option="gratsi"]').click();

    await expect(page.getByRole('heading', { name: 'Restore a template column' })).toBeVisible();
    // The nine columns Gratsi hides, every one of them offered back.
    const restore = page.getByRole('button', { name: /^Restore / });
    await expect(restore).toHaveCount(9);
    await expect(page.getByRole('button', { name: 'Restore day_in_the_life' })).toBeDisabled();
  });

  test('opens on the parent template and lists its master Personas set in field order', async ({
    page,
  }) => {
    await page.goto(columnAdminPath);

    await expect(page.locator('[data-slot="base-option"][data-active="true"]')).toContainText(
      'Parent template',
    );
    await expect(page.locator('[data-slot="table-option"][data-active="true"]')).toHaveText(
      'personas',
    );

    const rows = page.locator('[data-slot="column-row"]');
    await expect(rows).toHaveCount(15);

    for (const [index, [columnKey, label]] of PARENT_HEAD.entries()) {
      const row = rows.nth(index);
      await expect(row).toHaveAttribute('data-column', columnKey);
      await expect(row).toContainText(label);
      // Every column of the parent IS the master set: nothing there follows anything.
      await expect(row.locator('[data-slot="status-chip"]')).toHaveText(ORIGIN_LABEL.master);
    }
  });

  test('a child base shows its own labels and what each column inherits', async ({ page }) => {
    await page.goto(columnAdminPath);
    await page.locator('[data-slot="base-option"][data-option="gratsi"]').click();

    await expect(page.locator('[data-slot="base-option"][data-active="true"]')).toContainText(
      'Gratsi',
    );

    for (const [columnKey, label, inheritance] of GRATSI) {
      const row = page.locator(`[data-slot="column-row"][data-column="${columnKey}"]`);
      await expect(row).toContainText(label);
      await expect(row.locator('[data-slot="status-chip"]')).toHaveText(inheritance);
    }

    // The nine columns Gratsi hides are not in the list, and nothing else is either.
    await expect(page.locator('[data-slot="column-row"]')).toHaveCount(7);
  });

  test('a table with no definitions is empty rather than broken', async ({ page }) => {
    await page.goto(columnAdminPath);
    await page.locator('[data-slot="table-option"][data-option="angles"]').click();

    await expect(page.locator('[data-slot="column-row"]')).toHaveCount(0);
    await expect(page.getByText('No columns are configured')).toBeVisible();
  });

  test('every control that would write is disabled, and says why', async ({ page }) => {
    await page.goto(columnAdminPath);

    const firstRow = page.locator('[data-slot="column-row"]').first();
    const buttons = firstRow.getByRole('button');
    await expect(buttons).not.toHaveCount(0);
    for (const button of await buttons.all()) {
      await expect(button).toBeDisabled();
    }

    const wrapper = page.locator('[data-slot="disabled-write"]').first();
    await expect(wrapper).toHaveAttribute('title', DEMO_HINT);
  });
});
