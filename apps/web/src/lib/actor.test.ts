import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ currentUser: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.currentUser }));

import { currentActor } from './actor';
import { DEMO_ACTOR } from './demo-mode';

describe('currentActor', () => {
  it('returns the stub actor and never calls Clerk in demo mode', async () => {
    // No NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in the test environment, so this is demo mode.
    await expect(currentActor()).resolves.toEqual(DEMO_ACTOR);
    expect(mocks.currentUser).not.toHaveBeenCalled();
  });
});
