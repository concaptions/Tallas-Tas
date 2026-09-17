'use client';

import Link from 'next/link';
import { StatusChip } from '@tas/ui';
import { COPY_LIMITS } from '@tas/domain/copy';
import { COPY_STATUS, copyStatusLabel, copyStatusTone } from '@tas/domain/state';

import {
  COUNTER_TONE_CLASS,
  EM_DASH,
  counterLabel,
  counterTone,
} from '@/app/app/copywriting/fields';

/**
 * The three shapes the Copywriting route introduces (CLAUDE.md UI governance rule 4): the five copy
 * status chips, the linked-creative cell in both of its states, and the live character counter at
 * each of its three tones.
 *
 * Nothing is re-implemented here. The chips are `StatusChip` toned by `copyStatusTone`, the counter
 * is the route's own `counterTone` / `counterLabel` over `@tas/domain/copy`'s limits, and the cell
 * markup is the table's. A tone shown here is the tone the page shows.
 */

/** The five PRD §5.11 states, each as the table renders it — never `chipTone(label)`. */
export function CopyStatusChipsStory() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COPY_STATUS.map((entry) => (
        <StatusChip
          key={entry.key}
          tone={copyStatusTone(entry.key)}
          label={copyStatusLabel(entry.key)}
        />
      ))}
    </div>
  );
}

/** The Linked Creative cell: a mono chip that links to the brief, and the unattached em dash. */
export function CopyLinkedCreativeStory() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Link
        href="/app/briefs/77777777-7777-4777-8777-000000000001"
        className="inline-flex rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text2 hover:border-accent-line hover:text-accent"
      >
        TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2
      </Link>
      <span className="text-text3">{EM_DASH}</span>
    </div>
  );
}

/** One counter sample per tone, built from the real Headline guide rather than a typed number. */
const COUNTER_SAMPLES: readonly { note: string; text: string }[] = [
  { note: 'room left', text: 'Your Rota Is Broken.' },
  { note: 'exactly at the guide', text: 'a'.repeat(COPY_LIMITS.headline) },
  { note: 'past the guide', text: 'a'.repeat(COPY_LIMITS.headline + 6) },
];

/** The counter under a limited field: muted, `warn` at the guide, `bad` past it. Never a block. */
export function CopyCounterStory() {
  return (
    <div className="flex flex-col gap-2">
      {COUNTER_SAMPLES.map((sample) => (
        <div key={sample.note} className="flex items-baseline gap-3">
          <span
            className={`font-mono text-[11px] ${COUNTER_TONE_CLASS[counterTone(sample.text, 'headline')]}`}
          >
            {counterLabel(sample.text, 'headline')}
          </span>
          <span className="text-xs text-text3">{sample.note}</span>
        </div>
      ))}
    </div>
  );
}
