import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

/**
 * Runs the REAL `stream-airtable-to-r2.mjs` in a child process with every external dependency
 * stubbed by `stream-airtable-to-r2.stub.mjs` (preloaded with `--import`). Regression for the
 * Oct 9 crash: a video download that died mid-stream (`TypeError: terminated`, cause ETIMEDOUT)
 * surfaced as an unhandled 'error' event and took the whole run down.
 */
const run = promisify(execFile);
const PACKAGE_DIR = fileURLToPath(new URL('../..', import.meta.url));
const SCRIPT = join(PACKAGE_DIR, 'stream-airtable-to-r2.mjs');
const STUB = join(PACKAGE_DIR, 'src', 'scripts', 'stream-airtable-to-r2.stub.mjs');

interface StubState {
  readonly uploads: readonly { key: string; bytes: number; completed: boolean }[];
  readonly aborts: readonly string[];
  readonly deletes: readonly string[];
  readonly updates: readonly { column: string; id: string }[];
  readonly recordFetches: number;
  readonly downloads: number;
}

async function runScenario(
  scenario: string,
): Promise<{ stdout: string; exitCode: number; state: StubState }> {
  const out = join(mkdtempSync(join(tmpdir(), 'stream-r2-')), 'state.json');
  const env = {
    STUB_SCENARIO: scenario,
    STUB_OUT: out,
    RETRY_BACKOFF_MS: '10',
    STALL_TIMEOUT_MS: '150',
    DATABASE_URL: 'postgresql://u:p@h:1/d',
    AIRTABLE_PAT: 'x',
    AIRTABLE_SOURCE_BASES: '[{"baseId":"appA","creatorsTableId":"tblA","brandLabel":"Alpha"}]',
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
    R2_BUCKET: 'tas-site-media',
    R2_PUBLIC_BASE: 'https://pub-x.r2.dev',
  };
  let stdout: string;
  let exitCode = 0;
  try {
    ({ stdout } = await run(process.execPath, ['--import', STUB, SCRIPT], {
      cwd: PACKAGE_DIR,
      env,
      timeout: 30_000,
    }));
  } catch (error) {
    const failed = error as { stdout?: string; code?: number };
    stdout = failed.stdout ?? '';
    exitCode = typeof failed.code === 'number' ? failed.code : 1;
  }
  const state = JSON.parse(readFileSync(out, 'utf8')) as StubState;
  return { stdout, exitCode, state };
}

const videoUploads = (state: StubState) => state.uploads.filter((u) => u.key.includes('/intro-'));

describe('stream-airtable-to-r2: a download that dies halfway', () => {
  it('retries with a fresh URL, aborts every failed upload, logs FAIL, writes nothing, and keeps going', async () => {
    const { stdout, exitCode, state } = await runScenario('error-halfway');

    // The process survived and reached the summary — the Oct 9 crash is gone.
    expect(exitCode).toBe(0);
    expect(stdout).toContain('DONE in');
    expect(stdout).not.toContain('Unhandled');

    // Three attempts, each on a URL re-read from the record, then one FAIL naming the cause.
    expect(
      stdout.match(/RETRY video r1 <- Alpha\/recA: attempt \d\/3 failed: terminated/gu),
    ).toHaveLength(3);
    expect(stdout).toMatch(/FAIL video r1 <- Alpha\/recA: terminated \(after 3 attempts\)/u);
    expect(state.recordFetches).toBe(2);
    expect(state.downloads).toBe(4);

    // Every partial upload was aborted and none completed; the registry row was never written.
    const videos = videoUploads(state);
    expect(videos).toHaveLength(3);
    expect(videos.every((u) => !u.completed)).toBe(true);
    expect(state.aborts).toEqual(videos.map((u) => u.key));
    expect(state.updates.filter((u) => u.column === 'intro_videos')).toEqual([]);

    // The run continued to the next record: its photo uploaded and was recorded.
    expect(stdout).toMatch(/OK {3}pic r2 <- Alpha\/recB/u);
    expect(state.updates.map((u) => [u.column, u.id])).toEqual([['profile_pic_url', 'r2']]);
  }, 40_000);

  it('succeeds on the retry when the fresh URL works, and only then writes the row', async () => {
    const { stdout, exitCode, state } = await runScenario('recover');

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/RETRY video r1 .* attempt 1\/3 failed: terminated/u);
    expect(stdout).toMatch(/OK {3}video r1 <- Alpha\/recA \(8 KB, attempt 2\)/u);
    expect(state.recordFetches).toBe(1);
    const videos = videoUploads(state);
    expect(videos).toHaveLength(2);
    expect(videos.map((u) => u.completed)).toEqual([false, true]);
    expect(state.aborts).toEqual([videos[0]?.key]);
    expect(state.updates.filter((u) => u.column === 'intro_videos')).toHaveLength(1);
  }, 40_000);

  it('aborts a download that stalls instead of hanging the run', async () => {
    const { stdout, exitCode, state } = await runScenario('stall');

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(
      /FAIL video r1 <- Alpha\/recA: stalled: no bytes for 0\.15s \(after 3 attempts\)/u,
    );
    expect(state.aborts).toHaveLength(3);
    expect(state.updates.filter((u) => u.column === 'intro_videos')).toEqual([]);
    expect(stdout).toMatch(/OK {3}pic r2 <- Alpha\/recB/u);
  }, 40_000);
});
