'use client';

import { useState } from 'react';

import { ConceptBoard } from '@/app/app/concepts/concept-board';
import {
  conceptColumns,
  internalStatusView,
  type ConceptItem,
  type ConceptView,
} from '@/app/app/concepts/fields';
import { ViewToggle } from '@/app/app/concepts/view-toggle';
import { NamePreview } from '@/app/app/concepts/[conceptId]/name-preview';

/**
 * The three shapes the Concepts route introduces, mounted as the product mounts them (CLAUDE.md UI
 * governance rule 4). A client module because all three are interactive: the toggle holds the
 * chosen view and the board's cards are click targets, and a server component cannot hand either
 * one a callback.
 *
 * Nothing is re-implemented and nothing is faked: these are the identical components
 * `/app/concepts` renders, fed plain `ConceptItem`s so this page never imports `@tas/db`. The
 * statuses come from `internalStatusView`, which reads `@tas/domain/state`, so a tone shown here is
 * the tone the board shows.
 */
const TRACK = 'video' as const;

/** Four rows across four steps of the track, so every tone on the board is on this page. */
const SAMPLE_CONCEPTS: readonly ConceptItem[] = [
  {
    id: 'ds-concept-1',
    name: 'B2-It Is Not Just Your Age-Green Screen',
    batch: 'B2',
    angleName: 'It Is Not Just Your Age',
    themeName: 'Green Screen',
    status: internalStatusView(TRACK, 'video_editing_in_progress'),
    href: '#',
  },
  {
    id: 'ds-concept-2',
    name: 'B1-Your Body Clock Is Not Broken-Problem/Solution',
    batch: 'B1',
    angleName: 'Your Body Clock Is Not Broken',
    themeName: 'Problem/Solution',
    status: internalStatusView(TRACK, 'videos_revisions'),
    href: '#',
  },
  {
    id: 'ds-concept-3',
    name: 'B2-Make 9am Look Like 3am-POV: X vs Y',
    batch: 'B2',
    angleName: 'Make 9am Look Like 3am',
    themeName: 'POV: X vs Y',
    status: internalStatusView(TRACK, 'ad_submitted'),
    href: '#',
  },
  {
    id: 'ds-concept-4',
    name: 'B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style',
    batch: 'B3',
    angleName: 'Sleep In The Ninety Minutes You Actually Get',
    themeName: 'Yapper Style',
    status: internalStatusView(TRACK, 'approved'),
    href: '#',
  },
];

/** The toggle, live: two controls, neither a pill, and the selected one carries `aria-pressed`. */
export function ConceptsViewToggleStory() {
  const [view, setView] = useState<ConceptView>('table');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ViewToggle view={view} onChange={setView} />
      <span className="font-mono text-xs text-text3">?view={view}</span>
    </div>
  );
}

/** The board: one column per internal step, an empty column kept, the count on the status chip. */
export function ConceptsBoardStory() {
  return (
    <ConceptBoard
      columns={conceptColumns(TRACK, SAMPLE_CONCEPTS)}
      onOpen={() => {
        // A story has nowhere to navigate to; the product pushes `/app/concepts/<id>`.
      }}
    />
  );
}

/** The live auto-name, complete and half-filled, both from `conceptName`. */
export function ConceptNamePreviewStory() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-card border border-line bg-surface p-4">
        <NamePreview
          draft={{
            batch: 'B2',
            angleName: 'It Is Not Just Your Age',
            themeName: 'Green Screen',
          }}
        />
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <NamePreview draft={{ batch: 'B2', angleName: null, themeName: null }} />
      </div>
    </div>
  );
}
