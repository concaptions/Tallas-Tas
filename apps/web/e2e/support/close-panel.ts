import { expect, type Page } from '@playwright/test';

/**
 * Press Escape until a URL-backed panel closes, then assert it is gone.
 *
 * Five specs do the same thing after proving the panel survives a refresh: reload, see the panel,
 * press Escape, expect it closed. Two of them failed intermittently and then consistently, and the
 * cause is not the component — it is the order of events after a reload.
 *
 * The panel's open state lives in the URL, so a reload renders it on the SERVER: it is present and
 * visible in the first HTML, before any JavaScript runs. `toBeVisible()` is satisfied by exactly
 * that HTML. Escape, though, closes the panel from a `keydown` listener React attaches during
 * hydration — so a press that lands between first paint and hydration reaches no listener at all
 * and is simply lost. Nothing retries it, and the panel stays open for the rest of the test.
 *
 * `toPass` presses again until the listener exists, which is the honest way to say "Escape closes
 * this panel", rather than "Escape closes this panel if it happens to arrive after hydration".
 * Nothing is relaxed: the assertion is still that the panel reaches a count of zero, and if Escape
 * never closes it — a removed handler, a swallowed key — every attempt fails and so does the test.
 *
 * Waiting on a hydration marker instead would need one in the app, and an attribute that exists
 * only to be waited on by tests is worse than this: it would have to be rendered, maintained and
 * trusted on every page that grew a panel.
 */
export async function closePanelWithEscape(page: Page, panelSlot: string): Promise<void> {
  const panel = page.locator(`[data-slot="${panelSlot}"]`);
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
