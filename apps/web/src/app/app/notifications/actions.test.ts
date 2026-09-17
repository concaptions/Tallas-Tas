import { demoNotifications } from '@tas/db';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TRIGGER_KEYS } from '@tas/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setNotificationChannelAction } from './actions';

/** The action calls `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** A connection would only ever be attempted after validation; nothing here should get that far. */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the action reached Clerk');
  }),
}));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

const [firstTrigger] = demoNotifications;
if (firstTrigger === undefined) {
  throw new Error('the demo notification settings are empty');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to switch Slack off, with the message the disabled control shows', async () => {
    const result = await setNotificationChannelAction(
      null,
      form({ trigger: firstTrigger.triggerKey, channel: 'slack', enabled: 'false' }),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses before it even looks at the trigger, so a junk submission gets the same answer', async () => {
    const result = await setNotificationChannelAction(
      null,
      form({ trigger: 'not-a-trigger', channel: 'carrier-pigeon', enabled: 'maybe' }),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses every trigger and both channels, never throwing to the client', async () => {
    for (const trigger of NOTIFICATION_TRIGGER_KEYS) {
      for (const channel of NOTIFICATION_CHANNELS) {
        await expect(
          setNotificationChannelAction(null, form({ trigger, channel, enabled: 'true' })),
        ).resolves.toEqual({ ok: false, error: 'Sign in required to save changes.' });
      }
    }
  });
});

describe('with Clerk configured', () => {
  it('rejects a trigger key that is not one of PRD §12s eight, before any actor or database call', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await setNotificationChannelAction(
      null,
      form({ trigger: 'brief_assigned_to_someone_else', channel: 'slack', enabled: 'true' }),
    );

    expect(result).toEqual({ ok: false, error: 'That notification could not be identified.' });
  });

  it('rejects a channel that is neither Slack nor email', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await setNotificationChannelAction(
      null,
      form({ trigger: firstTrigger.triggerKey, channel: 'sms', enabled: 'true' }),
    );

    expect(result).toEqual({ ok: false, error: 'That notification channel does not exist.' });
  });

  it('rejects an `enabled` that is not the switch’s target value', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await setNotificationChannelAction(
      null,
      form({ trigger: firstTrigger.triggerKey, channel: 'email', enabled: 'toggle' }),
    );

    expect(result).toEqual({ ok: false, error: 'That switch could not be read.' });
  });

  it('rejects a submission with nothing in it at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await setNotificationChannelAction(null, form({}));

    expect(result).toEqual({ ok: false, error: 'That switch could not be read.' });
  });

  it('never throws: a valid submission with no database answers with a typed failure', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await setNotificationChannelAction(
      null,
      form({ trigger: firstTrigger.triggerKey, channel: 'slack', enabled: 'false' }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('the action reached a database');
    }
    expect(result.error).toMatch(/Slack DM could not be saved/u);
  });
});
