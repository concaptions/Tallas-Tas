/**
 * Verifies the two demo-mode affordances and captures them:
 *   docs/verification/04-sidebar-soon.png   the left rail with its SOON chips
 *   docs/verification/05-disabled-save.png  the Personas panel footer, Save disabled and muted
 *
 * Beyond the pictures it reads computed styles, so "muted, not accent" is measured rather than
 * eyeballed. Run against `next start` with no environment variables (demo mode).
 *
 * Usage: node scripts/verify-cosmetics.mjs [baseUrl]
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(repoRoot, 'docs/verification');
const baseUrl = process.argv[2] ?? 'http://localhost:3300';

/** Token values the dark theme must resolve to, as the browser reports them. */
const SURFACE3 = 'rgb(36, 31, 27)';
const TEXT3 = 'rgb(148, 138, 127)';
const ACCENT = 'rgb(217, 139, 74)';

const problems = [];

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  if (!ok) problems.push(`${label}: got ${actual}, expected ${expected}`);
  return ok;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // --- Sidebar -------------------------------------------------------------
  await page.goto(`${baseUrl}/app`, { waitUntil: 'networkidle' });
  const sidebar = page.locator('[data-slot="shell-sidebar"]');
  await sidebar.waitFor();

  const chips = sidebar.locator('[data-slot="soon-chip"]');
  const chipCount = await chips.count();
  console.log(`SOON chips in the sidebar: ${chipCount}`);
  if (chipCount < 8) problems.push(`expected at least 8 SOON chips, found ${chipCount}`);

  const chipStyle = await chips.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      text: el.textContent?.trim(),
      background: s.backgroundColor,
      color: s.color,
      font: s.fontFamily,
      size: s.fontSize,
    };
  });
  check('SOON chip label', chipStyle.text, 'SOON');
  check('SOON chip background is --surface3', chipStyle.background, SURFACE3);
  check('SOON chip colour is --text3', chipStyle.color, TEXT3);
  console.log(`      font ${chipStyle.font.split(',')[0]} at ${chipStyle.size}`);
  if (!/mono/i.test(chipStyle.font)) problems.push(`SOON chip is not monospace: ${chipStyle.font}`);

  await sidebar.screenshot({ path: resolve(outDir, '04-sidebar-soon.png') });

  // --- Disabled Save -------------------------------------------------------
  await page.goto(`${baseUrl}/app/personas`, { waitUntil: 'networkidle' });
  await page.locator('table tbody tr').first().click();
  const save = page.locator('[data-slot="persona-save"]');
  await save.waitFor();

  const disabled = await save.isDisabled();
  console.log(`${disabled ? 'PASS' : 'FAIL'}  Save is disabled in demo mode: ${String(disabled)}`);
  if (!disabled) problems.push('Save is not disabled in demo mode');

  const saveStyle = await save.evaluate((el) => {
    const s = getComputedStyle(el);
    return { background: s.backgroundColor, color: s.color };
  });
  check('disabled Save background is --surface3', saveStyle.background, SURFACE3);
  check('disabled Save label is --text3', saveStyle.color, TEXT3);
  if (saveStyle.background === ACCENT) problems.push('disabled Save is still accent-filled');

  const wrapper = page.locator('[data-slot="disabled-write"]');
  const hint = await wrapper.first().getAttribute('title');
  check('tooltip', hint, 'Sign in required to save changes');

  // Frame the footer so the disabled Save and its note are the subject of the shot.
  const box = await page.locator('[data-slot="persona-panel"] footer').boundingBox();
  if (box === null) {
    problems.push('could not locate the panel footer');
    await page.screenshot({ path: resolve(outDir, '05-disabled-save.png') });
  } else {
    await page.screenshot({
      path: resolve(outDir, '05-disabled-save.png'),
      clip: {
        x: Math.max(0, box.x - 8),
        y: Math.max(0, box.y - 170),
        width: Math.min(1440 - Math.max(0, box.x - 8), box.width + 16),
        height: box.height + 186,
      },
    });
  }

  await browser.close();

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nBoth affordances verified.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
