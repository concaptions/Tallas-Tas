import { expect, test } from '@playwright/test';
import { REMOVED_WORKSPACES, type RemovedWorkspaceKey } from '@tas/domain';

import { clerkKeys } from '../src/lib/clerk-keys';
import { removedWorkspaceRedirect } from '../src/lib/removed-workspaces';
import {
  adMetricPath,
  aiCharactersPath,
  appPath,
  briefPath,
  campaignsOffersPath,
  clientAssetsPath,
  competitiveResearchPath,
  copyTypesPath,
  creativeDesignPath,
  creativeDimensionsPath,
  creativeModulesPath,
  creativeReportingPath,
  creatorRankingPath,
  emailCampaignsPath,
  emailFlowsPath,
  legacyBriefsPath,
  legacyCampaignsPath,
  performancePath,
  smCampaignFeedPath,
  youtubeCopywritingPath,
} from '../src/lib/routes';

/**
 * The fifteen workspaces retired for every brand on 2026-10-07 (Talal; `REMOVED_WORKSPACES` in
 * `@tas/domain`, docs/decisions.md "2026-10-09 — Template cleanup"). Nothing was deleted: the page
 * code and the tables stay, the sidebar link is gone and the old URL lands on the live page that
 * took the job over. This file is the end-to-end proof of the second half — one visit per retired
 * address, in demo mode with no session, which is the Vercel deployment as it stands.
 *
 * The address of each workspace is spelled through its route constant, and the expected landing
 * page through the same `removedWorkspaceRedirect` the guard and the three redirect pages call, so
 * the spec reads the decision rather than restating it. `REMOVED_WORKSPACES` is iterated, not
 * copied: a key added to the list without an address here fails the first test.
 */
const ADDRESS: Readonly<Record<RemovedWorkspaceKey, string>> = {
  'creative-modules': creativeModulesPath,
  'ai-characters': aiCharactersPath,
  'competitive-research': competitiveResearchPath,
  briefs: creativeDesignPath,
  'client-assets': clientAssetsPath,
  'youtube-copywriting': youtubeCopywritingPath,
  campaigns: campaignsOffersPath,
  'email-campaigns': emailCampaignsPath,
  'email-flows': emailFlowsPath,
  'sm-campaign-feed': smCampaignFeedPath,
  performance: performancePath,
  'creative-reporting': creativeReportingPath,
  'creator-ranking': creatorRankingPath,
  'copy-types': copyTypesPath,
  'creative-dimensions': creativeDimensionsPath,
};

/** A brief the fixtures carry (`demoBriefs`), to prove the detail route survived the list's retirement. */
const BODY_CLOCK = '77777777-7777-4777-8777-000000000001';

/** The URL the browser must end on, anchored so a prefix match cannot pass for the real thing. */
function landsOn(target: string): RegExp {
  return new RegExp(`${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

test('every retired key has an address and a landing page', () => {
  for (const key of REMOVED_WORKSPACES) {
    expect(ADDRESS[key], key).toMatch(/^\/app\//);
    expect(removedWorkspaceRedirect(key), key).toMatch(/^\/app/);
  }
});

test.describe('retired workspaces in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the retired routes need a session to reach the guard',
  );

  for (const key of REMOVED_WORKSPACES) {
    test(`${key}: ${ADDRESS[key]} redirects to ${removedWorkspaceRedirect(key)}`, async ({
      page,
    }) => {
      await page.goto(ADDRESS[key]);

      await expect(page).toHaveURL(landsOn(removedWorkspaceRedirect(key)), { timeout: 45_000 });
      // The landing page is a real page of the shell, not an error or a refusal.
      await expect(page.locator('[data-slot="shell-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-slot="section-not-permitted"]')).toHaveCount(0);
    });
  }

  test('the visitor query string travels with the redirect', async ({ page }) => {
    await page.goto(`${youtubeCopywritingPath}?q=hook`);

    await expect(page).toHaveURL(
      landsOn(removedWorkspaceRedirect('youtube-copywriting', { q: 'hook' })),
      {
        timeout: 45_000,
      },
    );
  });

  test('a detail route under a retired segment redirects with it (the layout guards the whole segment)', async ({
    page,
  }) => {
    await page.goto(adMetricPath('aaaaaaaa-aaaa-4aaa-8aaa-000000000001'));

    await expect(page).toHaveURL(landsOn(appPath), { timeout: 45_000 });
  });

  test('the pre-parity legacy addresses still land somewhere live, through the chain', async ({
    page,
  }) => {
    await page.goto(legacyBriefsPath);
    await expect(page).toHaveURL(landsOn(removedWorkspaceRedirect('briefs')), { timeout: 45_000 });

    await page.goto(legacyCampaignsPath);
    await expect(page).toHaveURL(landsOn(removedWorkspaceRedirect('campaigns')), {
      timeout: 45_000,
    });
  });

  test('the Creative Design DETAIL page is untouched: the queues and the client portal still open a brief by id', async ({
    page,
  }) => {
    await page.goto(briefPath(BODY_CLOCK));

    await expect(page).toHaveURL(landsOn(briefPath(BODY_CLOCK)), { timeout: 45_000 });
    await expect(page.locator('[data-slot="brief-name"]')).toBeVisible();
  });

  test('no retired workspace is offered in the sidebar', async ({ page }) => {
    await page.goto(appPath);

    const sidebar = page.getByRole('navigation', { name: 'Sections' });
    await expect(sidebar).toBeVisible();
    for (const key of REMOVED_WORKSPACES) {
      await expect(sidebar.locator(`a[href="${ADDRESS[key]}"]`), key).toHaveCount(0);
    }
  });
});
