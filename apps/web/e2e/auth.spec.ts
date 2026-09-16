import { clerk } from '@clerk/testing/playwright';
import { createPageObjects } from '@clerk/testing/playwright/unstable';
import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { appPath } from '../src/lib/routes';

test('visiting /app signed out lands on /sign-in', async ({ page }) => {
  await page.goto(appPath);

  await expect(page).toHaveURL(/\/sign-in/);
});

test.describe('sign-up and organisation creation (skipped when Clerk keys are absent)', () => {
  // Gated on Clerk keys (D-008): reported as skipped with this reason, never as a pass.
  test.skip(
    clerkKeys() === undefined,
    'Clerk keys absent: run with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY set (docs/runbook.md, Pending human verification)',
  );

  test('signs up, creates an organisation and lands on /app showing its name', async ({
    page,
    baseURL,
  }) => {
    const { signUp } = createPageObjects({ page, baseURL });
    const stamp = Date.now().toString(36);

    // `+clerk_test` addresses are Clerk's test mode: no email is sent and the code 424242 verifies.
    await signUp.goTo();
    await signUp.signUpWithEmailAndPassword({
      email: `tas-e2e-${stamp}+clerk_test@example.com`,
      password: `Tas-e2e-${stamp}-pass!`,
    });
    await signUp.waitForEmailVerificationScreen();
    await signUp.enterTestOtpCode();
    await signUp.waitForSession();

    await page.goto(appPath);
    await clerk.loaded({ page });
    const organisationName = `TAS Digital E2E ${stamp}`;
    await page.evaluate(async (name) => {
      const organization = await window.Clerk.createOrganization({ name });
      await window.Clerk.setActive({ organization });
    }, organisationName);

    await page.goto(appPath);
    await expect(page.getByTestId('organisation-name')).toHaveText(organisationName);
    await expect(page.locator('.cl-organizationSwitcher-root')).toBeAttached();
  });
});
