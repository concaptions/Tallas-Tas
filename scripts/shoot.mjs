/**
 * Screenshots one route of the running app, for the record under docs/verification/.
 *
 * Usage:
 *   node scripts/shoot.mjs <url> <outfile.png> [options]
 *
 * Options:
 *   --click <selector>    click it, then wait, before shooting
 *   --fill <selector=text> type into it before shooting (repeatable)
 *   --clip <selector>     frame the shot on this element instead of the viewport
 *   --wait <ms>           extra settle time (default 500)
 *   --width <px>          viewport width (default 1440)
 *   --height <px>         viewport height (default 900)
 *   --expect <text>       fail unless the page contains this text (repeatable)
 *
 * Exits non-zero on a page error, a console error, or an unmet --expect, so a screenshot
 * can never quietly record a broken page.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [url, outfile, ...rest] = process.argv.slice(2);

if (!url || !outfile) {
  console.error('usage: node scripts/shoot.mjs <url> <outfile.png> [--click sel] [--expect text]');
  process.exit(2);
}

const opts = { wait: 500, width: 1440, height: 900, expect: [], fill: [] };
for (let i = 0; i < rest.length; i += 2) {
  const flag = rest[i];
  const value = rest[i + 1];
  if (flag === '--click') opts.click = value;
  else if (flag === '--clip') opts.clip = value;
  else if (flag === '--wait') opts.wait = Number(value);
  else if (flag === '--width') opts.width = Number(value);
  else if (flag === '--height') opts.height = Number(value);
  else if (flag === '--expect') opts.expect.push(value);
  else if (flag === '--fill') opts.fill.push(value);
  else {
    console.error(`unknown option ${flag}`);
    process.exit(2);
  }
}

const target = resolve(repoRoot, 'docs/verification', outfile);

async function main() {
  await mkdir(dirname(target), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: opts.width, height: opts.height } });

  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const response = await page.goto(url, { waitUntil: 'networkidle' });

  for (const pair of opts.fill) {
    const at = pair.indexOf('=');
    await page.locator(pair.slice(0, at)).fill(pair.slice(at + 1));
    await page.waitForTimeout(200);
  }
  if (opts.click) {
    await page.locator(opts.click).first().click();
    await page.waitForTimeout(opts.wait);
  }
  await page.waitForTimeout(opts.wait);

  // innerText applies CSS text-transform, so a heading styled `uppercase` reads back uppercased.
  // Compare case-insensitively: casing here is a display concern, not content.
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const haystack = text.toLowerCase();
  const missing = opts.expect.filter((e) => !haystack.includes(e.toLowerCase()));

  if (opts.clip) {
    await page.locator(opts.clip).first().screenshot({ path: target });
  } else {
    await page.screenshot({ path: target });
  }
  await browser.close();

  console.log(`${outfile}  status=${response?.status()} url=${page.url()} chars=${text.length}`);
  if (missing.length > 0) console.log(`  MISSING TEXT: ${missing.join(' | ')}`);
  if (errors.length > 0) {
    console.log(`  console errors (${errors.length}):`);
    for (const e of errors.slice(0, 5)) console.log(`    - ${e}`);
  }

  const bad = missing.length > 0 || errors.length > 0 || (response?.status() ?? 500) >= 400;
  if (bad) {
    console.log('  NOT OK');
    process.exit(1);
  }
  console.log('  OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
