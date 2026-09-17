import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { designSystemPath, propagationPath } from '../src/lib/routes';

/**
 * Propagation with no environment variables at all — the Vercel deployment as it stands
 * (PRD §5, §14.1; ticket criterion 12).
 *
 * The middleware lets the route through, there is no session to ask, so `currentTeamActor` stands
 * `DEMO_TEAM_ACTOR` in for an admin and the page serves `demoPromotionRequests` from `@tas/db`.
 * Everything below is therefore the demo contract: the admin note is visible, the pending queue is
 * exactly the three seeded requests, every row carries a diff with both values, and every write
 * control is disabled and says why.
 */

/** The seeded pending requests, newest `requested_at` first — the order the page renders them in. */
const PENDING = [
  {
    id: 'eeeeeeee-eeee-4eee-8eee-000000000003',
    brand: 'Funky Painting',
    table: 'angles',
    field: 'formats',
    current: 'Static, Video, Carousel',
    proposed: 'Static, Video, Carousel, Motion Graphic',
    requestedBy: 'Rhiannon Okafor',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-000000000002',
    brand: 'Gratsi',
    table: 'themes',
    field: 'reference_links',
    current: 'https://drive.tasdigital.example/themes/problem-solution-2024',
    proposed: 'https://drive.tasdigital.example/themes/problem-solution-2026',
    requestedBy: 'Imogen Bardsley',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-000000000001',
    brand: 'Mattress Central',
    table: 'personas',
    field: 'pain_points',
    current: 'Sleeps hot and wakes around 3am, then blames the mattress before the bedroom.',
    proposed: 'Has already bought a cooling topper and a fan',
    requestedBy: 'Dorian Vance',
  },
] as const;

/** The tooltip `DisabledWrite` carries in demo mode (criterion 10). */
const DEMO_HINT = 'Sign in required to save changes';

test.describe('propagation in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/propagation needs a session and real data',
  );

  test('states what the page is for and who may act, above the table', async ({ page }) => {
    await page.goto(propagationPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Propagation');

    // Criterion 2: the admin note sits above the table and says what a promotion actually is.
    const note = page.locator('[data-slot="admin-note"]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('This page is admin only.');
    await expect(note).toContainText('request promotion to the template');
    await expect(note).toContainText('nothing is promoted automatically');
    // Criterion 3: demo mode says the role check is stubbed, not skipped.
    await expect(note).toContainText('stubbed');

    // The second line: the check is a server-side guard, not a hidden button.
    const enforcement = page.locator('[data-slot="enforcement-note"]');
    await expect(enforcement).toContainText('Only an agency Admin');
    await expect(enforcement).toContainText('canSeePropagationPage');

    // The note is above the table in the document, not merely present somewhere on the page.
    const order = await page.evaluate(() => {
      const admin = document.querySelector('[data-slot="admin-note"]');
      const table = document.querySelector('[data-slot="promotion-table"]');
      if (admin === null || table === null) {
        return null;
      }
      return (admin.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(order).toBe(true);

    // Criterion 3 from the other side: demo mode is an admin, so the refusal block is absent.
    await expect(page.locator('[data-slot="not-admin"]')).toHaveCount(0);
  });

  test('renders exactly one table of the three seeded pending requests', async ({ page }) => {
    await page.goto(propagationPath);

    // Criterion 4: exactly one table, and the ticket's six columns in the ticket's order.
    const table = page.locator('[data-slot="promotion-table"]');
    await expect(table).toHaveCount(1);
    const headers = table.locator('thead th');
    await expect(headers).toHaveCount(7);
    await expect(headers.nth(0)).toHaveText('Brand');
    await expect(headers.nth(1)).toHaveText('Table');
    await expect(headers.nth(2)).toHaveText('Field');
    await expect(headers.nth(3)).toHaveText('Requested by');
    await expect(headers.nth(4)).toHaveText('Requested at');
    await expect(headers.nth(5)).toHaveText('Change');
    // The seventh cell is the decision, not a seventh fact about the request.
    await expect(headers.nth(6)).toHaveText('Decision');

    // Criterion 8: exactly three, in `requested_at` order, each addressed by its seeded id.
    const rows = page.locator('[data-slot="promotion-row"]');
    await expect(rows).toHaveCount(3);
    for (const [index, request] of PENDING.entries()) {
      const row = rows.nth(index);
      await expect(row).toHaveAttribute('data-request', request.id);
      await expect(row.locator('[data-slot="promotion-brand"]')).toContainText(request.brand);
      await expect(row.locator('[data-slot="promotion-table-name"]')).toHaveText(request.table);
      await expect(row.locator('[data-slot="promotion-field-name"]')).toHaveText(request.field);
      await expect(row).toContainText(request.requestedBy);
    }

    await expect(page.locator('[data-slot="promotion-count"]')).toHaveText('3 requests');
  });

  test('every row shows both values of the change, as read-only text', async ({ page }) => {
    await page.goto(propagationPath);

    const rows = page.locator('[data-slot="promotion-row"]');
    for (const [index, request] of PENDING.entries()) {
      const diff = rows.nth(index).locator('[data-slot="diff-preview"]');

      // Criterion 5: both values are present, the previous one struck through.
      await expect(diff.locator('[data-slot="diff-current"]')).toHaveAttribute(
        'title',
        request.current,
      );
      await expect(diff.locator('[data-slot="diff-proposed"]')).toContainText(request.proposed);
      // Read-only text, never an input: nothing inside the diff can be edited or clicked.
      await expect(diff.locator('input, textarea, select, button, a')).toHaveCount(0);
    }

    const struck = rows.first().locator('[data-slot="diff-current"]');
    await expect(struck).toHaveCSS('text-decoration-line', 'line-through');
  });

  test('Approve and Reject are disabled in demo mode and explain why', async ({ page }) => {
    await page.goto(propagationPath);

    // Criterion 6: one actions cell per pending row, with exactly these two decisions in it.
    await expect(page.locator('[data-slot="promotion-actions"]')).toHaveCount(3);

    for (const request of PENDING) {
      for (const slot of ['approve-request', 'reject-request'] as const) {
        const control = page.locator(`[data-slot="${slot}"][data-request="${request.id}"]`);
        await expect(control).toBeDisabled();

        // Criterion 10: a disabled control receives no pointer events, so the tooltip lives on the
        // DisabledWrite wrapper around it. Addressed by slot and request so it names one wrapper.
        const wrapper = page.locator(
          `[data-slot="disabled-write"]:has([data-slot="${slot}"][data-request="${request.id}"])`,
        );
        await expect(wrapper).toHaveCount(1);
        await expect(wrapper).toHaveAttribute('title', DEMO_HINT);
      }

      // The reason box a rejection needs is disabled too: nothing in the row is writable.
      await expect(
        page.locator(`[data-slot="promotion-note"][data-request="${request.id}"]`),
      ).toBeDisabled();
    }

    // Criterion 6 from the other side: the table body offers nothing else. Three rows × (two
    // buttons + one reason box) and no checkbox, menu, row link, value editor or brand picker.
    const body = page.locator('[data-slot="promotion-table"] tbody');
    await expect(body.locator('button, a, input, select, textarea')).toHaveCount(9);

    // Clicking one changes nothing, and the page never shows a raw error.
    await page.locator(`[data-slot="approve-request"][data-request="${PENDING[0].id}"]`).click({
      force: true,
    });
    await expect(page.locator('[data-slot="promotion-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="decision-error"]')).toHaveCount(0);
  });

  test('?status= is the address: the filter narrows the table and a link opens it narrowed', async ({
    page,
  }) => {
    await page.goto(propagationPath);

    const filter = page.locator('[data-slot="status-filter"]');
    await expect(filter.locator('[data-slot="status-filter-option"]')).toHaveCount(4);
    await expect(filter.locator('[data-status="pending"]')).toHaveAttribute('aria-current', 'page');

    // The primary interaction that works in demo mode: choosing a state re-reads the table.
    await filter.locator('[data-status="approved"]').click();
    await expect(page).toHaveURL(/\?status=approved$/);
    const rows = page.locator('[data-slot="promotion-row"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-status', 'Approved');
    // A settled row shows who decided it instead of the two buttons.
    await expect(rows.first().locator('[data-slot="promotion-decided"]')).toContainText(
      'Marguerite Alaoui',
    );
    await expect(rows.first().locator('[data-slot="promotion-actions"]')).toHaveCount(0);

    await page.goto(`${propagationPath}?status=all`);
    await expect(page.locator('[data-slot="promotion-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="promotion-count"]')).toHaveText('5 requests');

    // An unknown state is not an error page: it falls back to the pending queue.
    await page.goto(`${propagationPath}?status=promoted`);
    await expect(page.locator('[data-slot="promotion-row"]')).toHaveCount(3);
  });

  test('a status with no rows says so in words and offers the way out', async ({ page }) => {
    // Every seeded state has at least one row (3 pending, 1 approved, 1 rejected), so the empty
    // table is not reachable from the route in demo mode without deleting a fixture. It IS reachable
    // on /design-system, which mounts the route's own PromotionTable with no items at all — the same
    // component, the same copy, rendered by a real page. Criterion c is checked there rather than
    // asserted from the source.
    await page.goto(designSystemPath);

    const empty = page.locator('[data-slot="propagation-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Nothing is waiting for a decision.');
    await expect(empty).toContainText('Nothing is promoted automatically');

    // Never a blank panel: the empty state offers the one action that leads somewhere.
    const action = empty.getByRole('link', { name: 'See every request' });
    await expect(action).toHaveAttribute('href', `${propagationPath}?status=all`);

    // The headings stay put, because the empty state lives inside the table, not in place of it.
    const emptyTable = page.locator('[data-slot="promotion-table"]', { has: empty });
    await expect(emptyTable.locator('thead th')).toHaveCount(7);
  });

  test('the sidebar links Propagation and no longer marks it as coming soon', async ({ page }) => {
    await page.goto(propagationPath);

    const link = page.getByRole('link', { name: 'Propagation' });
    await expect(link).toHaveAttribute('href', propagationPath);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(link.locator('[data-slot="soon-chip"]')).toHaveCount(0);

    const row = page.locator('li', { has: link }).last();
    await expect(row.locator('[aria-disabled="true"]')).toHaveCount(0);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(propagationPath);

    await expect(page.locator('[data-slot="promotion-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="admin-note"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
