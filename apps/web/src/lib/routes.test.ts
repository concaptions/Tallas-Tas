import { describe, expect, it } from 'vitest';

import { briefPath, clientQueuePath, internalQueuePath, isPublicPath } from './routes';

describe('isPublicPath', () => {
  it.each(['/app', '/app/brands/1', '/app/', '/sign-in-other', '/settings', internalQueuePath])(
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

describe('internalQueuePath', () => {
  it('sits under the queue segment, so the Client Queue can be its sibling', () => {
    expect(internalQueuePath).toBe('/app/queue/internal');
  });

  it('is not a prefix of the Creative Briefs route the cards link to, and is never public', () => {
    expect(briefPath('77777777-7777-4777-8777-000000000001')).toBe(
      '/app/briefs/77777777-7777-4777-8777-000000000001',
    );
    expect(briefPath('77777777-7777-4777-8777-000000000001').startsWith(internalQueuePath)).toBe(
      false,
    );
    expect(isPublicPath(internalQueuePath)).toBe(false);
  });
});

describe('clientQueuePath', () => {
  it('is the Internal Queue’s sibling under the same queue segment', () => {
    expect(clientQueuePath).toBe('/app/queue/client');
    expect(clientQueuePath.startsWith('/app/queue/')).toBe(true);
    expect(clientQueuePath).not.toBe(internalQueuePath);
  });

  it('is protected, and neither queue route is a prefix of the other', () => {
    expect(isPublicPath(clientQueuePath)).toBe(false);
    expect(clientQueuePath.startsWith(internalQueuePath)).toBe(false);
    expect(internalQueuePath.startsWith(clientQueuePath)).toBe(false);
  });
});
