import { describe, expect, it } from 'vitest';

import { isPublicPath } from './routes';

describe('isPublicPath', () => {
  it.each(['/app', '/app/brands/1', '/app/', '/sign-in-other', '/settings'])(
    'protects %s',
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );

  it.each(['/', '/sign-in', '/sign-in/factor-one', '/sign-up', '/sign-up/x'])(
    'leaves %s public',
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(true);
    },
  );
});
