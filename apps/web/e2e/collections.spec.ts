import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { collectionsPath, metaCopywritingPath } from '../src/lib/routes';

/**
 * The Collections route with no environment variables at all — the Vercel deployment as it stands.
 * The data source serves the in-repo fixtures and the panel shows, read-only, the records that link
 * TO a collection: the email campaigns (`email_campaign_collections`), the YouTube copy
 * (`youtube_copy_collections`), the concepts (`concept_collections`) and the briefs
 * (`creative_briefs.collection_id`) whose fixtures carry the collection's id — plus the one Meta
 * copy the collection's own `copywriting_id` points at.
 */
const BFCM_COLLECTION_ID = '11223344-1122-4334-8556-000000000001';
const SUMMER_COLLECTION_ID = '11223344-1122-4334-8556-000000000002';
/** The Meta Copywriting fixture the BFCM collection's `copywriting_id` points at (Copy #1). */
const BFCM_META_COPY_ID = '88888888-8888-4888-8888-000000000001';
/**
 * The two concept fixtures whose `collectionIds` carry the BFCM collection, in the order the panel
 * lists them: `indexConceptsByCollection` keeps the rows' order and `demoConcepts` is newest edit
 * first, so Not Your Age (edited 14 Sep) precedes Body Clock (edited 11 Sep).
 */
const BFCM_CONCEPT_IDS = [
  '66666666-6666-4666-8666-000000000002',
  '66666666-6666-4666-8666-000000000001',
] as const;

/** The empty sentences `collections/fields.ts` exports, asserted by their exact text. */
const NO_META_COPY_HINT = 'No copy is linked to this collection yet. Set the Copywriting ID above.';
const NO_CREATIVE_DESIGNS_HINT = 'No creative design is briefed on this collection yet.';

test.describe('collections in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/collections needs a session and real data',
  );

  test('lists the two fixture collections', async ({ page }) => {
    await page.goto(collectionsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Collections');
    await expect(page.locator('[data-slot="collection-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="collection-count"]')).toContainText('2 collections');
  });

  test('the BFCM panel lists the email campaign, the two YouTube copies, the two concepts and the Meta copy that link to it', async ({
    page,
  }) => {
    await page.goto(`${collectionsPath}?collection=${BFCM_COLLECTION_ID}`);

    const panel = page.locator('[data-slot="collection-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="collection-linked-work"]')).toBeVisible();

    // One email campaign promotes the BFCM collection; its name and workflow StatusChip are shown,
    // but nothing links out: the Email Campaigns workspace is retired (Oct 7).
    const emails = panel.locator('[data-slot="collection-email-campaigns-item"]');
    await expect(emails).toHaveCount(1);
    await expect(emails.first()).toContainText('BFCM Early Access — VIP list');
    await expect(emails.first().locator('a')).toHaveCount(0);
    await expect(emails.first().locator('[data-slot="status-chip"]')).toHaveCount(1);

    // Two YouTube copies link to it; the auto-generated titles render in font-mono, as text —
    // YouTube Copywriting is retired too.
    const copies = panel.locator('[data-slot="collection-youtube-copy-item"]');
    await expect(copies).toHaveCount(2);
    await expect(copies.nth(0)).toContainText('Copy 1');
    await expect(copies.nth(1)).toContainText('Copy 3');
    await expect(copies.first().locator('.font-mono')).not.toHaveCount(0);
    await expect(copies.locator('a')).toHaveCount(0);
    await expect(copies.first().locator('[data-slot="status-chip"]')).toHaveCount(1);

    // Two concepts carry the BFCM collection in `concept_collections`; the generated
    // Batch-Angle-Theme names render in font-mono, each links to the concept's own detail page
    // (a route, not a panel) and carries the Concepts module's internal-status chip.
    const concepts = panel.locator('[data-slot="collection-concepts-item"]');
    await expect(concepts).toHaveCount(2);
    for (const [index, conceptId] of BFCM_CONCEPT_IDS.entries()) {
      const link = concepts.nth(index).locator('a');
      await expect(link).toHaveAttribute('href', new RegExp(`^/app/concepts/${conceptId}$`));
    }
    await expect(concepts.first().locator('a')).toHaveClass(/font-mono/);
    await expect(concepts.first().locator('[data-slot="status-chip"]')).toHaveCount(1);

    // The BFCM collection's own `copywriting_id` points at Meta Copy #1: the generated title in
    // font-mono, a link that opens the Meta Copywriting panel by its `?copy=` parameter, and the
    // row's COPY_STATUS chip. The link is edited in the Copywriting ID field above, not here.
    const metaCopy = panel.locator('[data-slot="collection-meta-copy-item"]');
    await expect(metaCopy).toHaveCount(1);
    await expect(metaCopy.locator('a')).toHaveText('Copy #1');
    await expect(metaCopy.locator('a')).toHaveClass(/font-mono/);
    await expect(metaCopy.locator('a')).toHaveAttribute(
      'href',
      `${metaCopywritingPath}?copy=${BFCM_META_COPY_ID}`,
    );
    await expect(metaCopy.locator('[data-slot="status-chip"]')).toHaveCount(1);
  });

  test('the summer panel lists its one campaign and one copy, and says when nothing else links', async ({
    page,
  }) => {
    await page.goto(`${collectionsPath}?collection=${SUMMER_COLLECTION_ID}`);

    const panel = page.locator('[data-slot="collection-panel"]');
    await expect(panel.locator('[data-slot="collection-email-campaigns-item"]')).toHaveText([
      /Summer cooling push/,
    ]);
    await expect(panel.locator('[data-slot="collection-youtube-copy-item"]')).toHaveText([
      /Copy 2/,
    ]);

    // No fixture brief carries a `collection_id` and the summer collection's `copywriting_id` is
    // null, so both lists render their empty sentence rather than a blank.
    await expect(panel.locator('[data-slot="collection-meta-copy"]')).toHaveText(NO_META_COPY_HINT);
    await expect(panel.locator('[data-slot="collection-creative-designs"]')).toHaveText(
      NO_CREATIVE_DESIGNS_HINT,
    );
  });

  test('a new collection has no linked-work section to show', async ({ page }) => {
    await page.goto(`${collectionsPath}?collection=new`);

    const panel = page.locator('[data-slot="collection-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="collection-linked-work"]')).toHaveCount(0);
  });
});
