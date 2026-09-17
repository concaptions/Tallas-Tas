import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { notificationsPath, propagationPath } from '../src/lib/routes';

/**
 * Notifications with no environment variables at all — the Vercel deployment as it stands
 * (PRD §12, ticket criterion 12).
 *
 * The middleware lets the route through, there is no session to ask, so the page serves
 * `demoNotifications` from `@tas/db`. Everything below is therefore the demo contract: the routing
 * note and the Slack DM line are visible, the eight §12 triggers render in order with a recipient
 * and two switches each, and BOTH switches of every row are disabled and say why. There is no other
 * write control on the page to check, because §12 gives the page none.
 */
const TRIGGERS = [
  'brief_assigned',
  'internal_revisions_requested',
  'ad_submitted',
  'client_approved',
  'client_requested_revisions',
  'creative_ready_to_launch',
  'creator_status_changed',
  'partnership_expiring',
] as const;

/**
 * The Recipient cell of each row above, in the same order. §12 names a recipient per bullet and the
 * column's whole job is to show it, so "a recipient is present" is not enough of an assertion — a
 * cell that said "Strategist" where §12 says the media buyer would pass that and still be wrong.
 *
 * The seventh entry carries both names because §12's "UGC manager" is a role PRD §11 does not have:
 * the DM resolves to the strategist who books the roster, and the label says so rather than hiding
 * either half.
 */
const RECIPIENTS = [
  'Video Editor / Designer',
  'Video Editor / Designer',
  'Strategist + CSM',
  'CSM + Strategist',
  'CSM + Strategist',
  'Media Buyer',
  'UGC Manager (Strategist)',
  'Media Buyer + CSM',
] as const;

const DEMO_HINT = 'Sign in required to save changes';

test.describe('notifications in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/notifications needs a session and real data',
  );

  test('renders the routing note, the Slack DM line and one table of eight triggers', async ({
    page,
  }) => {
    await page.goto(notificationsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notifications');

    // Criterion 2: the note sits above the table and links to the Team page.
    const note = page.locator('[data-slot="routing-note"]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('team assignment made at onboarding');
    await expect(note.locator('[data-slot="routing-note-link"]')).toHaveAttribute(
      'href',
      '/app/team',
    );

    // §12 opens with the problem it solves: DMs through the existing bot, never a channel post.
    const slackNote = page.locator('[data-slot="slack-dm-note"]');
    await expect(slackNote).toContainText('TAS Bot');
    await expect(slackNote).toContainText('never into a channel');

    // Criterion 3: exactly one table, four columns, in this order.
    const table = page.locator('[data-slot="notification-table"]');
    await expect(table).toHaveCount(1);
    await expect(table.locator('thead th')).toHaveText([
      'Trigger',
      'Recipient',
      'Slack DM',
      'Email',
    ]);

    // Criterion 6: the eight §12 triggers, in PRD order.
    const rows = page.locator('[data-slot="notification-row"]');
    await expect(rows).toHaveCount(8);
    for (const [index, trigger] of TRIGGERS.entries()) {
      await expect(rows.nth(index)).toHaveAttribute('data-trigger', trigger);
    }

    await expect(page.locator('[data-slot="notification-count"]')).toHaveText('8 triggers');
  });

  test('every row names a recipient in words and carries exactly two switches', async ({
    page,
  }) => {
    await page.goto(notificationsPath);

    const rows = page.locator('[data-slot="notification-row"]');
    for (let index = 0; index < TRIGGERS.length; index += 1) {
      const row = rows.nth(index);

      // Criterion 4: §12's recipient for this bullet, as read-only text and never a control.
      const recipient = row.locator('[data-slot="notification-recipient"]');
      await expect(recipient).toHaveText(RECIPIENTS[index] ?? '');
      await expect(recipient.locator('button, a, input, select')).toHaveCount(0);

      // Criterion 5: two switches and nothing else interactive in the row.
      await expect(row.locator('[data-slot="channel-switch"]')).toHaveCount(2);
      await expect(row.locator('[data-channel="slack"]')).toHaveCount(1);
      await expect(row.locator('[data-channel="email"]')).toHaveCount(1);
    }

    // Criterion 5 from the other side: nothing on this page offers to edit routing. The table body's
    // only controls are the sixteen switches — no add, no delete, no reorder, no per-person
    // override, no channel picker, no message template and no test-send.
    const body = page.locator('[data-slot="notification-table"] tbody');
    await expect(body.locator('button, a, input, select, textarea')).toHaveCount(16);

    // Criterion 8's defaults, seeded: Slack on for all eight, email off for all eight.
    for (const slack of await page.locator('[data-channel="slack"]').all()) {
      await expect(slack).toHaveAttribute('data-state', 'checked');
    }
    for (const email of await page.locator('[data-channel="email"]').all()) {
      await expect(email).toHaveAttribute('data-state', 'unchecked');
    }
  });

  test('both switches of every row are disabled in demo mode and explain why', async ({ page }) => {
    await page.goto(notificationsPath);

    const switches = page.locator('[data-slot="channel-switch"]');
    await expect(switches).toHaveCount(16);

    // Addressed by trigger and channel rather than by index: `has:` resolves its argument RELATIVE
    // to each candidate wrapper, so an nth-indexed switch would match every wrapper's own switch and
    // the locator would be ambiguous. A trigger/channel pair names exactly one switch, and therefore
    // exactly one wrapper — which also pins the tooltip to the right cell rather than to any cell.
    for (const trigger of TRIGGERS) {
      for (const channel of ['slack', 'email'] as const) {
        const control = page.locator(
          `[data-slot="channel-switch"][data-trigger="${trigger}"][data-channel="${channel}"]`,
        );
        await expect(control).toBeDisabled();
        // A disabled control receives no pointer events, so the tooltip lives on the wrapper.
        const wrapper = page.locator(
          `[data-slot="disabled-write"]:has([data-trigger="${trigger}"][data-channel="${channel}"])`,
        );
        await expect(wrapper).toHaveCount(1);
        await expect(wrapper).toHaveAttribute('title', DEMO_HINT);
      }
    }

    // Clicking one changes nothing: the row is still what the fixtures say.
    const slack = page.locator('[data-trigger="ad_submitted"][data-channel="slack"]');
    await slack.click({ force: true });
    await expect(slack).toHaveAttribute('data-state', 'checked');
    await expect(page.locator('[data-slot="save-error"]')).toHaveCount(0);
  });

  test('?q= narrows the table, reaches the empty state, and the empty state offers the way out', async ({
    page,
  }) => {
    await page.goto(notificationsPath);

    const search = page.locator('[data-slot="notification-search"]');
    await search.fill('client');

    const rows = page.locator('[data-slot="notification-row"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-trigger', 'client_approved');
    await expect(rows.nth(1)).toHaveAttribute('data-trigger', 'client_requested_revisions');
    await expect(page.locator('[data-slot="notification-count"]')).toHaveText('2 of 8 triggers');
    await expect(page).toHaveURL(/\?q=client$/);

    // A filter that matches nothing is words and a way back, never a blank panel.
    await search.fill('zzzz');
    await expect(rows).toHaveCount(0);
    const empty = page.locator('[data-slot="notifications-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No trigger matches');
    // The headings stay put: the empty state lives inside the table, not in place of it.
    await expect(page.locator('[data-slot="notification-table"] thead th')).toHaveCount(4);

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(rows).toHaveCount(8);
    await expect(page).toHaveURL(new RegExp(`${notificationsPath}$`));
  });

  test('a ?q= link opens already narrowed', async ({ page }) => {
    await page.goto(`${notificationsPath}?q=media+buyer`);

    const rows = page.locator('[data-slot="notification-row"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-trigger', 'creative_ready_to_launch');
    await expect(rows.nth(1)).toHaveAttribute('data-trigger', 'partnership_expiring');
  });

  test('the sidebar links Notifications and no longer marks it as coming soon', async ({
    page,
  }) => {
    await page.goto(notificationsPath);

    const link = page.getByRole('link', { name: 'Notifications' });
    await expect(link).toHaveAttribute('href', notificationsPath);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(link.locator('[data-slot="soon-chip"]')).toHaveCount(0);

    const row = page.locator('li', { has: link }).last();
    await expect(row.locator('[aria-disabled="true"]')).toHaveCount(0);

    // Propagation has since shipped too (ticket `propagation`), so the sidebar now has no muted
    // placeholder left at all. The assertion that used to prove the SoonChip had not quietly
    // disappeared from the whole rail is therefore the opposite one: the section that shipped last
    // is a real link, and nothing in the rail is a placeholder. The positive half is what keeps the
    // zero-count honest — on its own it would also pass on a sidebar that failed to render — and
    // `pendingSections()` in `nav.test.ts` is what fails if a section loses its href again.
    await expect(page.getByRole('link', { name: 'Propagation' })).toHaveAttribute(
      'href',
      propagationPath,
    );
    await expect(page.locator('[data-slot="shell-sidebar"] [aria-disabled="true"]')).toHaveCount(0);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(notificationsPath);

    await expect(page.locator('[data-slot="notification-row"]')).toHaveCount(8);
    await expect(page.locator('[data-slot="routing-note"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
