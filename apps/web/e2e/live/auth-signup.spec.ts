import { clerk } from '@clerk/testing/playwright';
import { createPageObjects } from '@clerk/testing/playwright/unstable';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { appPath } from '../../src/lib/routes';
import { removeSignUpArtifacts } from '../support/clerk-admin';
import { anonymousTest as test, expect } from '../support/clerk-login';

/**
 * Sign-up and organisation creation (TICKET-004), the live half of `auth.spec.ts`. Runs in the
 * `live` Playwright project against the Clerk dev instance (docs/runbook.md, "Playwright live
 * mode"); without the four variables it reports itself skipped (D-008). Starts with no session,
 * which is why it uses `anonymousTest`, not the signed-in `test`. Whatever it creates on the
 * instance is removed in `afterAll` through the Backend API, by id when the test got that far and
 * by email / name otherwise.
 */
test.describe('sign-up and organisation creation (live project)', () => {
  test.skip(
    liveE2eEnv() === undefined,
    'No live-mode variables (CLERK_PUBLISHABLE_KEY_TEST, CLERK_SECRET_KEY_TEST, CLERK_E2E_USER_PASSWORD, DATABASE_URL_E2E): sign-up needs a Clerk dev instance. See docs/runbook.md, "Playwright live mode".',
  );

  const stamp = Date.now().toString(36);
  // `+clerk_test` addresses are Clerk's test mode: no email is sent and the code 424242 verifies.
  const created: {
    readonly email: string;
    readonly organisationName: string;
    userId?: string;
    organizationId?: string;
  } = {
    email: `tas-e2e-${stamp}+clerk_test@example.com`,
    organisationName: `TAS Digital E2E ${stamp}`,
  };

  test.afterAll(async () => {
    const live = liveE2eEnv();
    if (live !== undefined) {
      await removeSignUpArtifacts(live.secretKey, created);
    }
  });

  test('visiting /app signed out lands on /sign-in', async ({ page }) => {
    await page.goto(appPath);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('signs up, creates an organisation and lands on /app showing its name', async ({
    page,
    baseURL,
  }) => {
    const { signUp } = createPageObjects({ page, baseURL });

    await signUp.goTo();
    await signUp.signUpWithEmailAndPassword({
      email: created.email,
      password: `Tas-e2e-${stamp}-pass!`,
    });
    await signUp.waitForEmailVerificationScreen();
    await signUp.enterTestOtpCode();
    await signUp.waitForSession();

    await page.goto(appPath);
    await clerk.loaded({ page });
    created.userId = await page.evaluate(() => window.Clerk.user?.id);
    created.organizationId = await page.evaluate(async (name) => {
      const organization = await window.Clerk.createOrganization({ name });
      await window.Clerk.setActive({ organization });
      return organization.id;
    }, created.organisationName);

    await page.goto(appPath);
    await expect(page.getByTestId('organisation-name')).toHaveText(created.organisationName);
    await expect(page.locator('.cl-organizationSwitcher-root')).toBeAttached();
  });
});
