import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from './middleware';
import middleware from './middleware';

const mocks = vi.hoisted(() => ({
  clerkKeys: vi.fn(),
  clerkMiddleware: vi.fn(),
}));

vi.mock('@/lib/clerk-keys', () => ({ clerkKeys: mocks.clerkKeys }));
vi.mock('@clerk/nextjs/server', () => ({ clerkMiddleware: mocks.clerkMiddleware }));

const event = {} as never;
const request = (pathname: string) => new NextRequest(`https://tas.example${pathname}`);

/** The `(handler, options)` pair the middleware built `clerkMiddleware` with. */
function clerkCall(): [
  (auth: ReturnType<typeof fakeAuth>, request: NextRequest) => Promise<void>,
  Record<string, string>,
] {
  const call = mocks.clerkMiddleware.mock.calls[0];
  expect(call).toBeDefined();
  return call as never;
}

/** A stand-in for Clerk's `auth` argument: records whether `protect()` was awaited. */
function fakeAuth() {
  return { protect: vi.fn(() => Promise.resolve()) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the matcher', () => {
  it('runs on the Node.js runtime and skips Next internals and static files', () => {
    expect(config.runtime).toBe('nodejs');
    expect(config.matcher).toHaveLength(3);
    expect(config.matcher[0]).toContain('_next');
    expect(config.matcher[1]).toBe('/(api|trpc)(.*)');
  });

  /**
   * Clerk's hosted sign-in handshake comes back through `/__clerk/...`. The first matcher excludes
   * anything that looks like a static file, so the path is listed explicitly rather than left to
   * chance: without it the handshake never reaches the middleware and sign-in cannot complete.
   */
  it('lets Clerk’s auto-proxy path through to the middleware', () => {
    expect(config.matcher).toContain('/__clerk/:path*');
    expect(config.matcher.indexOf('/__clerk/:path*')).toBeGreaterThan(
      config.matcher.indexOf('/(api|trpc)(.*)'),
    );
  });
});

describe('demo mode (no Clerk publishable key)', () => {
  beforeEach(() => {
    mocks.clerkKeys.mockReturnValue(undefined);
  });

  it.each(['/app', '/app/personas', '/design-system', '/', '/sign-in'])(
    'lets %s through instead of redirecting to sign-in: there is no session to protect',
    (pathname) => {
      const response = middleware(request(pathname), event) as NextResponse;

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    },
  );

  it('never builds a Clerk middleware', () => {
    void middleware(request('/app'), event);

    expect(mocks.clerkMiddleware).not.toHaveBeenCalled();
  });
});

describe('with a Clerk publishable key present', () => {
  beforeEach(() => {
    mocks.clerkKeys.mockReturnValue({ publishableKey: 'pk_test_x', secretKey: 'sk_test_x' });
    mocks.clerkMiddleware.mockImplementation(() => vi.fn(() => NextResponse.next()));
  });

  it('hands the request to Clerk, configured with the publishable key and the auth routes', () => {
    void middleware(request('/app'), event);

    expect(mocks.clerkMiddleware).toHaveBeenCalledTimes(1);
    expect(clerkCall()[1]).toEqual({
      publishableKey: 'pk_test_x',
      signInUrl: '/sign-in',
      signUpUrl: '/sign-up',
    });
  });

  it('still protects a private path', async () => {
    void middleware(request('/app/personas'), event);
    const handler = clerkCall()[0];
    const auth = fakeAuth();

    await handler(auth, request('/app/personas'));

    expect(auth.protect).toHaveBeenCalledTimes(1);
  });

  it('leaves a public path alone', async () => {
    void middleware(request('/sign-in'), event);
    const handler = clerkCall()[0];
    const auth = fakeAuth();

    await handler(auth, request('/sign-in'));

    expect(auth.protect).not.toHaveBeenCalled();
  });
});
