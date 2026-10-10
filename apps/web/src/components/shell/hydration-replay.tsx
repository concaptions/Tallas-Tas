'use client';

import { useEffect } from 'react';

import { schedulePreHydrationReplay } from '@/lib/hydration-replay';

/** Mounted once in the root layout: from the first client effect, replays each recorded press once its target hydrates. */
export function HydrationReplay() {
  useEffect(() => schedulePreHydrationReplay(), []);
  return null;
}
