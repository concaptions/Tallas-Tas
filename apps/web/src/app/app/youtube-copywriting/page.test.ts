// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Oct 14 follow-up #4 (`docs/sprint-oct12.md`): the retired `/app/youtube-copywriting` route
 * redirects to `/app/copywriting` and must carry the visitor's query string. The previous
 * sectionGuard-based layout redirect dropped it because a layout in Next 15 does not receive
 * `searchParams`; moving the redirect into the page restores the forwarded `?utm_source=…`,
 * `?q=…`, etc. Two assertions pin the two shapes — a visitor's query string on, and no trailing
 * `?` when none was given — so a regression lands in CI, not in production.
 */

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/navigation', () => ({ permanentRedirect: redirectMock }));

import YoutubeCopywritingPage from './page';

afterEach(() => {
  redirectMock.mockClear();
});

async function render(params: Record<string, string | string[] | undefined>): Promise<string> {
  try {
    await YoutubeCopywritingPage({ searchParams: Promise.resolve(params) });
    throw new Error('page returned without redirecting');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('REDIRECT:')) throw error;
    return error.message.slice('REDIRECT:'.length);
  }
}

describe('YouTube Copywriting retired-redirect', () => {
  it('preserves the visitor query string on the redirect to /app/copywriting', async () => {
    const target = await render({ utm_source: 'slack' });
    expect(target).toBe('/app/copywriting?utm_source=slack');
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it('redirects without a trailing "?" when no query string was given', async () => {
    const target = await render({});
    expect(target).toBe('/app/copywriting');
    expect(target.endsWith('?')).toBe(false);
  });
});
