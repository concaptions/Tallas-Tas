import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { appPath, campaignsOffersPath, emailCampaignsPath } from '../src/lib/routes';

/**
 * The Campaigns & Offers route in demo mode (no Clerk key): the three fixture campaigns render, a
 * campaign opens from the URL, and its panel lists what links to it FROM THE OTHER SIDE — the email
 * campaigns, the email flows and the YouTube copy whose fixtures carry its id — each as a link into
 * that module's page. Module parity, phase 2: every record link is two-way.
 */
const BFCM = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const SUMMER = 'dddddddd-dddd-4ddd-8ddd-000000000003';
const EMAIL_BFCM_EARLY_ACCESS = 'ee11ee11-ee11-4e11-8e11-000000000001';

test.describe('campaigns & offers in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/campaigns-offers needs a session and real data',
  );

  test('lists the three fixture campaigns and opens the one named in the URL', async ({ page }) => {
    await page.goto(`${campaignsOffersPath}?campaign=${BFCM}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Campaigns & Offers');
    await expect(page.locator('[data-slot="campaign-row"]')).toHaveCount(3);

    const panel = page.locator('[data-slot="campaign-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="campaign-panel-title"]')).toHaveText(
      'BFCM-20%OFF-BFCM26',
    );
  });

  test('the panel lists the email campaigns, email flows and YouTube copy linked from their side', async ({
    page,
  }) => {
    await page.goto(`${campaignsOffersPath}?campaign=${BFCM}`);
    const panel = page.locator('[data-slot="campaign-panel"]');

    // Two email campaign fixtures carry the BFCM id; each is a link into its own page.
    const emails = panel.locator('[data-slot="campaign-email-campaigns"]');
    await expect(emails.locator('[data-slot="campaign-linked-record"]')).toHaveCount(2);
    await expect(emails).toContainText('BFCM Early Access — VIP list');
    await expect(emails).toContainText('Cyber Monday last call — SMS');
    await expect(
      emails.getByRole('link', { name: 'BFCM Early Access — VIP list' }),
    ).toHaveAttribute('href', `${emailCampaignsPath}?emailCampaign=${EMAIL_BFCM_EARLY_ACCESS}`);

    // Two flows: the abandoned cart recovery and the back-in-stock alert.
    const flows = panel.locator('[data-slot="campaign-email-flows"]');
    await expect(flows.locator('[data-slot="campaign-linked-record"]')).toHaveCount(2);
    await expect(flows).toContainText('Abandoned Cart Recovery');
    await expect(flows).toContainText('Back-in-Stock SMS Alert');

    // Two YouTube copies carry the BFCM code: "Copy N · headline" in mono, with the status chip
    // labelled from the domain vocabulary, never the stored key.
    // Module parity: the far-side links read through copywriting_campaigns and campaign_concepts.
    await expect(
      panel.locator('[data-slot="campaign-meta-copy"] [data-slot="campaign-linked-record"]'),
    ).toHaveCount(2);
    await expect(
      panel.locator('[data-slot="campaign-concepts"] [data-slot="campaign-linked-record"]'),
    ).toHaveCount(2);

    const copy = panel.locator('[data-slot="campaign-youtube-copy"]');
    const records = copy.locator('[data-slot="campaign-linked-record"]');
    await expect(records).toHaveCount(2);
    await expect(records.nth(0)).toContainText('Copy 1 · Sleep Like Your Shift Never Happened');
    await expect(records.nth(0).locator('[data-slot="status-chip"]')).toHaveText('Approved');
    await expect(records.nth(0).getByRole('link')).toHaveClass(/font-mono/);
    await expect(records.nth(1)).toContainText('Copy 3 · Two Sleepers. One Bed. Zero Arguments.');
    await expect(records.nth(1).locator('[data-slot="status-chip"]')).toHaveText(
      'Edited By Client',
    );
  });

  test('a section with nothing linked says so and names where the link is edited', async ({
    page,
  }) => {
    await page.goto(`${campaignsOffersPath}?campaign=${SUMMER}`);
    const panel = page.locator('[data-slot="campaign-panel"]');

    await expect(panel.locator('[data-slot="campaign-email-campaigns"]')).toContainText(
      'Summer cooling push',
    );
    const flows = panel.locator('[data-slot="campaign-email-flows"]');
    await expect(flows.locator('[data-slot="campaign-linked-record"]')).toHaveCount(0);
    await expect(flows).toContainText('No email flow runs on this campaign yet');
    await expect(panel.locator('[data-slot="campaign-youtube-copy"]')).toContainText(
      'Copy 2 · Blackout For People Who Sleep In Daylight',
    );
  });

  /**
   * This test used to follow the link and assert the Email Campaigns panel opened on that row.
   * Email Campaigns is HIDDEN as of 2026-10-02 (template-base alignment): the Airtable TEMPLATE
   * base has no table for it, so `/app/email-campaigns` `redirect`s to the Overview
   * (`email-campaigns.spec.ts`, `docs/decisions/data-loss-blockers-2026-10-02.md`). The link itself
   * is unchanged and is still asserted by name AND by href — the reverse read through
   * `email_campaign_campaigns` is what this test is really about, and that still holds; only where
   * the click lands has changed.
   */
  test('a linked email campaign is named and addressed, and its hidden route redirects', async ({
    page,
  }) => {
    await page.goto(`${campaignsOffersPath}?campaign=${BFCM}`);

    const link = page
      .locator('[data-slot="campaign-email-campaigns"]')
      .getByRole('link', { name: 'BFCM Early Access — VIP list' });
    await expect(link).toHaveAttribute(
      'href',
      `${emailCampaignsPath}?emailCampaign=${EMAIL_BFCM_EARLY_ACCESS}`,
    );

    await link.click();

    await expect(page).toHaveURL((url) => url.pathname === appPath);
    await expect(page.locator('[data-slot="email-campaign-panel"]')).toHaveCount(0);
  });
});
