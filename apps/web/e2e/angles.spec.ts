import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { anglesPath, conceptPath, creativeModulesPath } from '../src/lib/routes';

/**
 * The Angles route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: five rows, four columns, a side panel that is not a modal, the open
 * angle in the URL, document links in the Resources group, the creative modules that link the angle
 * (the other side of `creative_module_angles`, from `demoCreativeModules`), the concepts paired
 * with it (`concept_angles`, from `demoConcepts`), the briefs that point at it
 * (`creative_briefs.angle_id`, from `demoBriefs`), and every write control disabled with a reason.
 */
const BODY_CLOCK = '55555555-5555-4555-8555-000000000001';
const NOT_YOUR_AGE = '55555555-5555-4555-8555-000000000003';
const DAYLIGHT = '55555555-5555-4555-8555-000000000004';

/** `demoCreativeModules`: "Problem → Solution Hooks" links Body Clock and Not Your Age. */
const MODULE_PROBLEM_SOLUTION = '1234abcd-1234-4abc-8abc-000000000001';
/** "Daylight Proof Demos" links only Daylight. */
const MODULE_DAYLIGHT_PROOF = '1234abcd-1234-4abc-8abc-000000000002';

/** `demoConcepts`: the one concept paired with the Body Clock angle (`angleIds: [BODY_CLOCK]`). */
const CONCEPT_BODY_CLOCK = '66666666-6666-4666-8666-000000000001';

/**
 * What the panel says under "Creative Designs" when no brief's `angle_id` is the angle —
 * `NO_CREATIVE_DESIGNS_NOTICE` in `angles/fields.ts`, verbatim. Every `demoBriefs` row stores
 * `angleId: null` (a brief is ordinarily briefed through its concept), so in demo mode every angle
 * shows it.
 */
const NO_CREATIVE_DESIGNS_NOTICE =
  'No creative design points at this angle yet. Set it from the brief’s own page.';

test.describe('angles in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/angles needs a session and real data',
  );

  test('lists the five fixture angles in four columns', async ({ page }) => {
    await page.goto(anglesPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Angles');
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="angle-count"]')).toContainText('5 angles');

    // Talal feedback B+C: the Formats column left the table, so a row is four cells wide and
    // formats live only in the panel now.
    await expect(page.locator('[data-slot="angles-table"] thead th')).toHaveText([
      'Name',
      'Persona',
      'Product',
      'Updated',
    ]);

    // Persona is an info chip carrying the name before the em dash, the whole name in the title.
    const row = page.locator(`[data-angle-id="${DAYLIGHT}"]`);
    await expect(row.locator('td')).toHaveCount(4);
    const persona = row.locator('td').nth(1).locator('[data-slot="status-chip"]');
    await expect(persona).toHaveText('Marcus');
    await expect(persona).toHaveAttribute('data-tone', 'info');
    await expect(row.locator('td').nth(1)).toHaveAttribute('title', /rotating-shift nurse/);

    // Product is the mute chip on the same row; Updated closes the row where Formats used to sit.
    await expect(row.locator('td').nth(2).locator('[data-slot="status-chip"]')).toHaveAttribute(
      'data-tone',
      'mute',
    );
  });

  test('a row opens the panel, the URL carries it, a reload reopens it and Escape closes it', async ({
    page,
  }) => {
    await page.goto(anglesPath);

    const firstRow = page.locator('[data-slot="angle-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="angle-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="angle-panel-title"]')).toHaveText(name);

    // The six groups, in the order fields.ts states; "Inspiration" became "Resources".
    await expect(panel.locator('[data-slot="angle-group-heading"]')).toHaveText([
      'Identity',
      'Hypothesis',
      'Pain Points',
      'USP',
      'Targeting',
      'Resources',
    ]);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?angle=/);
    await page.reload();
    await expect(page.locator('[data-slot="angle-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);

    // After the reload the client bundle may still be hydrating, so the window keydown listener
    // is not always attached when a single Escape lands (the tracked panel Escape-close race —
    // products.spec and personas.spec keep the strict one-press form as its sentinels). Re-press
    // until the close takes.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="angle-panel"]')).toHaveCount(0, { timeout: 1_000 });
    }).toPass({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/\?angle=/);
  });

  test('persona and product are dropdowns, never typed text, and type renders as toggles', async ({
    page,
  }) => {
    await page.goto(`${anglesPath}?angle=${BODY_CLOCK}`);

    const panel = page.locator('[data-slot="angle-panel"]');

    // Both links are Select triggers (a combobox), not inputs a strategist can type into.
    const persona = panel.locator('[data-slot="angle-personaId"]');
    await expect(persona).toHaveAttribute('role', 'combobox');
    await expect(persona).toBeDisabled();
    await expect(persona).toContainText('Marcus');

    const product = panel.locator('[data-slot="angle-productId"]');
    await expect(product).toHaveAttribute('role', 'combobox');
    await expect(product).toBeDisabled();

    // Talal feedback B+C: the format toggles left the panel; the stored formats still ride along
    // as hidden form inputs so a save round-trips them unchanged.
    await expect(panel.locator('input[name="formats"]')).toHaveCount(2);
    await expect(panel.locator('input[name="formats"]').first()).toHaveValue('Static');

    // Type is the remaining toggle row: all four vocabulary entries, the stored ones pressed.
    await expect(panel.locator('[data-slot="type-toggle"]')).toHaveCount(4);
    await expect(panel.locator('[data-slot="type-toggle"][data-type="Identity"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      panel.locator('[data-slot="type-toggle"][data-type="Functional"]'),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('resources carry a brief URL and an exact script URL as document link fields', async ({
    page,
  }) => {
    await page.goto(`${anglesPath}?angle=${DAYLIGHT}`);

    // Talal feedback B+C: the rich ad-inspiration cards no longer render; the closest current
    // equivalent is the Resources group, whose two URL fields link the angle to its documents.
    const panel = page.locator('[data-slot="angle-panel"]');
    await expect(panel.locator('[data-slot="angle-group-heading"]').last()).toHaveText('Resources');
    await expect(panel.locator('[data-slot="inspo-card"]')).toHaveCount(0);

    const brief = panel.locator('input[name="briefUrl"]');
    await expect(brief).toBeVisible();
    await expect(brief).toHaveAttribute('type', 'url');
    await expect(brief).toHaveAttribute('placeholder', 'https://…');

    const script = panel.locator('input[name="exactScriptUrl"]');
    await expect(script).toBeVisible();
    await expect(script).toHaveAttribute('type', 'url');

    // The fixtures store no document links yet, so both fields sit empty on the placeholder,
    // rendered in font-mono like every machine-readable string.
    await expect(brief).toHaveValue('');
    await expect(script).toHaveValue('');
    await expect(brief).toHaveClass(/font-mono/);
  });

  test('the panel lists the creative modules that link the angle, read-only, each a link to its module', async ({
    page,
  }) => {
    await page.goto(`${anglesPath}?angle=${BODY_CLOCK}`);

    const panel = page.locator('[data-slot="angle-panel"]');

    // "Linked work" sits below the six field groups and is NOT one of them: the group-heading
    // assertion elsewhere in this file still sees exactly six.
    await expect(panel.locator('[data-slot="angle-linked-heading"]')).toHaveText('Linked work');
    await expect(panel.locator('[data-slot="angle-group-heading"]')).toHaveCount(6);

    // Body Clock is linked by one fixture module. The chip is the shared StatusChip, and the
    // record is an anchor to the Creative Modules page with that module's panel open — the link
    // is edited from the module's side, so here it only navigates.
    const modules = panel.locator('[data-slot="angle-creative-modules"]');
    await expect(modules).toBeVisible();
    const records = modules.locator('[data-slot="angle-creative-module"]');
    await expect(records).toHaveCount(1);
    await expect(records.first()).toHaveAttribute('data-record-id', MODULE_PROBLEM_SOLUTION);
    await expect(records.first()).toHaveAttribute(
      'href',
      `${creativeModulesPath}?module=${MODULE_PROBLEM_SOLUTION}`,
    );
    const chip = records.first().locator('[data-slot="status-chip"]');
    await expect(chip).toHaveText('Problem → Solution Hooks');
    await expect(chip).toHaveAttribute('data-tone', 'info');

    // Nothing in the section is a form control: read-only means no toggle, no picker, no input.
    await expect(modules.locator('button, input, [role="combobox"]')).toHaveCount(0);

    // "Concepts" is `concept_angles` read from the angle's side: Body Clock is paired with exactly
    // one fixture concept, listed by its generated Batch-Angle-Theme name as a link to the
    // concept's own page, with its internal status as the shared chip beside it. The page builds
    // this list (`indexConceptsByAngle` over `loadConcepts()`), so an empty sentence here would
    // mean the inversion never reached the panel.
    const conceptRows = panel.locator('[data-slot="angle-concepts"] [data-slot="angle-concept"]');
    await expect(conceptRows).toHaveCount(1);
    await expect(conceptRows.first()).toHaveAttribute('data-record-id', CONCEPT_BODY_CLOCK);
    await expect(conceptRows.first().locator('a')).toHaveAttribute(
      'href',
      conceptPath(CONCEPT_BODY_CLOCK),
    );
    await expect(conceptRows.first().locator('a')).toHaveClass(/font-mono/);
    await expect(conceptRows.first().locator('[data-slot="status-chip"]')).toHaveCount(1);

    // "Creative Designs" is `creative_briefs.angle_id` inverted. No fixture brief points straight
    // at an angle, so the list is the empty sentence — rendered, not omitted, under its label.
    const designs = panel.locator('[data-slot="angle-creative-designs"]');
    await expect(designs).toBeVisible();
    await expect(designs).toHaveText(NO_CREATIVE_DESIGNS_NOTICE);
    await expect(designs.locator('[data-slot="angle-creative-design"]')).toHaveCount(0);

    // The same module links Not Your Age; Daylight is linked by a different one. The list is the
    // junction read from the angle's side, not a count copied onto the row.
    await page.goto(`${anglesPath}?angle=${NOT_YOUR_AGE}`);
    await expect(
      page.locator('[data-slot="angle-creative-module"][data-record-id]'),
    ).toHaveAttribute('data-record-id', MODULE_PROBLEM_SOLUTION);

    await page.goto(`${anglesPath}?angle=${DAYLIGHT}`);
    const daylight = page.locator('[data-slot="angle-creative-module"]');
    await expect(daylight).toHaveCount(1);
    await expect(daylight).toHaveAttribute('data-record-id', MODULE_DAYLIGHT_PROOF);
    await expect(daylight.locator('[data-slot="status-chip"]')).toHaveText('Daylight Proof Demos');

    // Following the chip lands on the module's own panel.
    await daylight.click();
    await expect(page).toHaveURL(
      new RegExp(`${creativeModulesPath}\\?module=${MODULE_DAYLIGHT_PROOF}`),
    );
    await expect(page.locator('[data-slot="creative-module-panel-title"]')).toHaveText(
      'Daylight Proof Demos',
    );
  });

  test('a new angle has no linked work yet, so the section is absent', async ({ page }) => {
    // Demo disables the "New angle" button, so reach the create state the way the URL does.
    await page.goto(`${anglesPath}?angle=new`);

    const panel = page.locator('[data-slot="angle-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="angle-panel-title"]')).toHaveText('New angle');
    await expect(panel.locator('[data-slot="angle-linked-heading"]')).toHaveCount(0);
    await expect(panel.locator('[data-slot="angle-creative-modules"]')).toHaveCount(0);
  });

  test('every write is disabled with a reason', async ({ page }) => {
    await page.goto(`${anglesPath}?angle=${BODY_CLOCK}`);

    await expect(page.locator('[data-slot="new-angle"]')).toBeDisabled();

    const panel = page.locator('[data-slot="angle-panel"]');
    await expect(panel.locator('[data-slot="angle-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="angle-save"]')).toBeDisabled();
    await expect(panel.locator('#angle-field-name')).toHaveAttribute('readonly', '');
    await expect(panel.locator('#angle-field-description')).toHaveAttribute('readonly', '');

    // Every disabled write explains itself on hover, because a disabled button gets no pointer events.
    await expect(page.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    // The Resources URL fields are writes as much as the save is, so demo makes them read-only.
    await expect(panel.locator('input[name="briefUrl"]')).toHaveAttribute('readonly', '');
    await expect(panel.locator('input[name="exactScriptUrl"]')).toHaveAttribute('readonly', '');

    // The format toggles left the panel (Talal feedback B+C); Type is the remaining toggle row,
    // inert on this page, and its wrapper says why rather than pretending a click was saved.
    await expect(panel.locator('[data-slot="type-toggle"]').first()).toBeDisabled();
    await expect(
      panel.locator('[data-slot="disabled-write"]:has([data-slot="angle-types"])'),
    ).toHaveAttribute('title', 'Type is set with the Concepts phase; this page does not write it.');
  });

  test('search filters the table and the empty state offers to clear it', async ({ page }) => {
    await page.goto(anglesPath);

    // "Denise" is the persona on two of the five angles.
    await page.locator('[data-slot="angle-search"]').fill('denise');
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="angle-count"]')).toContainText('2 of 5 angles');

    await page.locator('[data-slot="angle-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="angles-empty"]');
    await expect(empty).toContainText('Nothing matches');

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);

    // The filter is URL-backed, so a narrowed table is a shareable link.
    await page.goto(`${anglesPath}?q=denise`);
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(2);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(anglesPath);

    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);
    const listOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(listOverflow).toBeLessThanOrEqual(1);

    // The panel is full width under 900px, so the open state has to fit too.
    await page.goto(`${anglesPath}?angle=${BODY_CLOCK}`);
    await expect(page.locator('[data-slot="angle-panel"]')).toBeVisible();
    const panelOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(panelOverflow).toBeLessThanOrEqual(1);
  });
});
