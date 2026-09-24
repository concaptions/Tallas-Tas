'use client';

import type { LaunchQueueItem } from '@/app/app/ads-to-launch/fields';
import { LaunchQueueRow } from '@/app/app/ads-to-launch/launch-queue-row';

/**
 * The launch-queue row (CLAUDE.md UI governance rule 4): the identical component `/app/ads-to-launch`
 * renders, in the three states a row can hold — client Approved with Mark as Launched, Launched with
 * Pause, Paused with Resume — each drawing the one control `launchTransition` allows. Controls are
 * mounted in their DISABLED (demo) state, as every design-system write control is: a live button here
 * would be a real Server Action behind a reference page.
 */
const SAMPLES: readonly LaunchQueueItem[] = [
  {
    id: 'ds-launch-ready',
    name: 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
    href: '#',
    track: 'video',
    format: 'Video',
    conceptName: 'B1-Your Body Clock Is Not Broken-Problem/Solution',
    angleName: 'Shift workers',
    statusLabel: 'Approved',
    statusTone: 'ok',
    priorityLabel: 'P1',
    launchedAtLabel: null,
    downloadUrl: 'https://frame.example/niagara/tv1-b1-v2-master',
    controls: [
      {
        key: 'launch',
        label: 'Mark as Launched',
        description: 'The ad is live in the account. Marks it Launched on both tracks.',
      },
    ],
  },
  {
    id: 'ds-launch-live',
    name: 'TS2-B2-Lux Meter-V1',
    href: '#',
    track: 'static',
    format: 'Static',
    conceptName: null,
    angleName: null,
    statusLabel: 'Launched',
    statusTone: 'accent',
    priorityLabel: null,
    launchedAtLabel: '2026-09-22 14:05 UTC',
    downloadUrl: null,
    controls: [
      {
        key: 'pause',
        label: 'Pause',
        description: 'The live ad was switched off. It can be resumed.',
      },
    ],
  },
  {
    id: 'ds-launch-paused',
    name: 'TV3-B1-Night Reset-V1',
    href: '#',
    track: 'video',
    format: 'Video',
    conceptName: 'B1-Night Reset-Routine',
    angleName: 'New parents',
    statusLabel: 'Paused',
    statusTone: 'warn',
    priorityLabel: null,
    launchedAtLabel: '2026-09-19 09:30 UTC',
    downloadUrl: null,
    controls: [{ key: 'resume', label: 'Resume', description: 'The paused ad is live again.' }],
  },
];

export function AdsToLaunchRowStory() {
  return (
    <ul className="flex flex-col gap-2">
      {SAMPLES.map((item) => (
        <LaunchQueueRow key={item.id} item={item} demo />
      ))}
    </ul>
  );
}
