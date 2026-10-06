import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { assetsPath } from '../src/lib/routes';

/**
 * The Asset Library's upload / download / delete pipeline, with no environment variables — the
 * demo-mode shape the Vercel deployment ships in. Two things it proves:
 *
 *   1. The Upload button renders in its disabled state with the shipped DisabledWrite hint, so a
 *      visitor without a session cannot try to upload.
 *   2. Even if the UI opens the dialog (another flow does), a stubbed 503 lands the paste's
 *      "Storage not configured" copy inside the modal rather than silently failing.
 *
 * A LIVE happy-path case is skipped: it needs R2 credentials, a Clerk session, and a real brand on
 * the connected Postgres. Flipping it on is the orchestrator's job once Vercel's R2 vars reach the
 * test environment — see the TODO(live) marker below.
 */

test.describe('asset library upload in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/assets write flow needs a session and real data',
  );

  test('renders the Upload button in its disabled state with the shipped hint', async ({
    page,
  }) => {
    await page.goto(assetsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asset Library');

    const uploadButton = page.locator('[data-slot="asset-upload-button"]');
    await expect(uploadButton).toBeVisible();
    // Demo mode disables the button and wraps it in DisabledWrite, which carries the aria-label
    // the whole shell reuses for every write it refuses because no session exists.
    await expect(uploadButton).toBeDisabled();

    const wrapper = page.locator('[data-slot="disabled-write"]').filter({ has: uploadButton });
    await expect(wrapper).toHaveAttribute('aria-label', 'Sign in required to save changes');
  });

  test('shows the "Storage not configured" copy inside the modal when the API responds 503', async ({
    page,
  }) => {
    // Stub /api/assets/upload BEFORE the page loads, so a click on Upload reaches our handler.
    await page.route('**/api/assets/upload', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Storage not configured — set R2 credentials in the environment.',
        }),
      });
    });

    await page.goto(assetsPath);

    // Demo mode disables the real Upload button, so we open the dialog via the design-system
    // story mounted on `/design-system` — the same AssetUploadModal, uploader stubbed by the
    // route handler above.
    await page.goto('/design-system');
    // The story has a button that opens the modal in happy-path mode. We'll explicitly flip to
    // 503 by clicking the storage-not-configured toggle first.
    await page.getByRole('button', { name: 'Storage not configured (503)' }).click();
    await page.getByRole('button', { name: 'Open upload modal' }).click();

    // Dialog is open. Attach a file via the hidden input.
    const dialog = page.locator('[data-slot="asset-upload-dialog"]');
    await expect(dialog).toBeVisible();

    const fileInput = dialog.locator('[data-slot="asset-file-input"]');
    await fileInput.setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    });

    // The stub resolves to 503, so the modal paints the paste copy.
    await dialog.locator('[data-slot="asset-upload-submit"]').click();
    await expect(dialog.locator('[data-slot="asset-upload-error"]')).toContainText(
      'Storage not configured',
    );
  });
});

test.describe('asset library live happy path', () => {
  // TODO(live): post a real file once R2 is reachable from the test environment. The handler
  // dispatches to R2 only when all four R2_* env vars are set, so this stays `test.skip` until
  // Vercel's R2 vars propagate to the Playwright run (see docs/runbook.md pending verification).
  test.skip('uploads a file and sees it in the grid', () => {
    /* intentional empty placeholder */
  });
});
