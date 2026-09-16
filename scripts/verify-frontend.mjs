/**
 * Visual verification of the built app, run against `next start` with no environment
 * variables, which is exactly the configuration Vercel deploys today (demo mode).
 *
 * Usage: node scripts/verify-frontend.mjs [baseUrl]
 * Writes docs/verification/{01-root,02-app-shell,03-personas-panel}.png and prints a
 * per-route report. Exits non-zero when a route is blank, errored, or still shows the
 * old TICKET-002 placeholder.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(repoRoot, 'docs/verification');
const baseUrl = process.argv[2] ?? 'http://localhost:3300';

const PLACEHOLDER = /TAS Creative Platform\s*$/;

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  const results = [];

  async function shot(name, file) {
    const path = resolve(outDir, file);
    await page.screenshot({ path, fullPage: false });
    return path;
  }

  async function bodyText() {
    return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  }

  // 1. Root: must redirect or land on /app, never the placeholder card.
  const rootResponse = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const rootUrl = page.url();
  const rootText = await bodyText();
  const rootShot = await shot('root', '01-root.png');
  results.push({
    route: '/',
    status: rootResponse?.status(),
    landedOn: rootUrl,
    chars: rootText.length,
    screenshot: rootShot,
    ok: rootUrl.includes('/app') && rootText.length > 40,
    note: rootUrl.includes('/app') ? 'redirected into the app' : 'did NOT reach /app',
  });

  // 2. The shell: sidebar sections and the top bar.
  const appResponse = await page.goto(`${baseUrl}/app`, { waitUntil: 'networkidle' });
  const appText = await bodyText();
  const appShot = await shot('app', '02-app-shell.png');
  const sidebarHits = ['Personas', 'Angles', 'Themes', 'Concepts', 'Creative Briefs'].filter((s) =>
    appText.includes(s),
  );
  results.push({
    route: '/app',
    status: appResponse?.status(),
    landedOn: page.url(),
    chars: appText.length,
    sidebarSectionsFound: sidebarHits,
    screenshot: appShot,
    ok:
      appResponse?.status() === 200 &&
      !page.url().includes('/sign-in') &&
      sidebarHits.length >= 4 &&
      !PLACEHOLDER.test(appText),
    note: page.url().includes('/sign-in') ? 'REDIRECTED TO SIGN-IN' : 'shell rendered',
  });

  // 3. Personas: three rows, then the right-side panel with all five field groups.
  const personasResponse = await page.goto(`${baseUrl}/app/personas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const rows = page.locator('table tbody tr');
  const rowCount = await rows.count();
  let panelGroups = [];
  let panelOpened = false;
  if (rowCount > 0) {
    await rows.first().click();
    await page.waitForTimeout(700);
    const afterClick = await bodyText();
    panelGroups = ['Identity', 'Desires', 'Barriers', 'Buying Behaviour', 'Language'].filter((g) =>
      afterClick.includes(g),
    );
    panelOpened = panelGroups.length >= 4 || page.url().includes('persona=');
  }
  const personasShot = await shot('personas', '03-personas-panel.png');
  results.push({
    route: '/app/personas',
    status: personasResponse?.status(),
    landedOn: page.url(),
    rowCount,
    panelOpened,
    panelGroupsFound: panelGroups,
    screenshot: personasShot,
    ok:
      personasResponse?.status() === 200 && rowCount >= 3 && panelOpened && panelGroups.length >= 5,
    note: `${rowCount} rows, panel ${panelOpened ? 'opened' : 'did NOT open'}`,
  });

  await browser.close();

  const report = { baseUrl, when: new Date().toISOString(), results, consoleErrors };
  await writeFile(resolve(outDir, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);

  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    console.log(
      `${mark}  ${r.route.padEnd(15)} status=${r.status} landed=${r.landedOn} ${r.note}` +
        (r.rowCount === undefined
          ? ''
          : ` rows=${r.rowCount} groups=${r.panelGroupsFound?.length ?? 0}`),
    );
  }
  if (consoleErrors.length) {
    console.log(`\nBrowser console errors (${consoleErrors.length}):`);
    for (const e of consoleErrors.slice(0, 10)) console.log(`  - ${e}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\n${failed.length} route(s) failed verification. Not safe to push.`);
    process.exit(1);
  }
  console.log('\nAll three routes verified.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
