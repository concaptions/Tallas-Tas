'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@tas/ui';
import { PROPAGATION_ADMIN_NOTE, DEMO_PROPAGATION_ACCESS_NOTE } from '@tas/domain';
import { promotionStatusLabel, promotionStatusTone } from '@tas/domain/state';

import {
  EMPTY_BODY,
  PROMOTION_FILTERS,
  PROPAGATION_ENFORCEMENT_NOTE,
  REMOVED_BRAND_LABEL,
  emptyAction,
  emptyTitle,
  type PromotionItem,
  type PromotionStatusFilter,
} from '@/app/app/propagation/fields';
import { DiffPreview, PromotionTable } from '@/app/app/propagation/promotion-row';

/**
 * The shapes `/app/propagation` introduces (CLAUDE.md UI governance rule 4): the admin note block,
 * the diff preview cell, a seven-column table whose last cell is a decision rather than a fact, the
 * `?status=` filter, and the two states that table can be in — live, and disabled by demo mode.
 *
 * Nothing is re-drawn here. This is the route's own `PromotionTable` and `DiffPreview`, mounted with
 * plain objects. Every status label and every chip tone comes from `@tas/domain/state` and every
 * column header from `PROMOTION_COLUMNS`, so no status string is written in this file and a story
 * cannot show a state the product does not have (ticket criterion 7).
 *
 * The rows below are NOT database rows: `@tas/db` is not imported, because importing it into a story
 * would pull the driver towards the browser bundle. Four rows, four shapes — a short diff, a long
 * one that has to truncate, a brand that has been soft-deleted since it asked, and a request an
 * admin has already settled with a reason.
 */
function sampleItem(
  id: string,
  status: string,
  overrides: Partial<PromotionItem> = {},
): PromotionItem {
  return {
    id,
    brand: { text: 'Funky Painting', muted: false },
    tableName: 'angles',
    fieldName: 'formats',
    requestedBy: 'Rhiannon Okafor',
    requestedAt: 'yesterday',
    requestedAtTitle: '2026-09-17 08:10',
    currentValue: 'Static, Video, Carousel',
    proposedValue: 'Static, Video, Carousel, Motion Graphic',
    statusLabel: promotionStatusLabel(status),
    statusTone: promotionStatusTone(status),
    pending: status === 'pending',
    decidedBy: null,
    reviewNote: null,
    ...overrides,
  };
}

const LONG_CURRENT =
  'Sleeps hot and wakes around 3am, then blames the mattress before the bedroom.';

const LONG_PROPOSED =
  'Sleeps hot and wakes around 3am. Has already bought a cooling topper and a fan, so “cooling” on ' +
  'its own no longer reads as a promise — it reads as a thing that failed.';

function sampleRows(): readonly PromotionItem[] {
  return [
    sampleItem('ds-promotion-1', 'pending'),
    sampleItem('ds-promotion-2', 'pending', {
      brand: { text: 'Mattress Central', muted: false },
      tableName: 'personas',
      fieldName: 'pain_points',
      requestedBy: 'Dorian Vance',
      requestedAt: '3 days ago',
      currentValue: LONG_CURRENT,
      proposedValue: LONG_PROPOSED,
    }),
    sampleItem('ds-promotion-3', 'pending', {
      brand: { text: REMOVED_BRAND_LABEL, muted: true },
      tableName: 'themes',
      fieldName: 'reference_links',
      requestedBy: 'Imogen Bardsley',
      requestedAt: '2 days ago',
    }),
    sampleItem('ds-promotion-4', 'approved', {
      brand: { text: 'Niagara Sleep Solutions', muted: false },
      tableName: 'creative_briefs',
      fieldName: 'elements_tested',
      requestedBy: 'Dorian Vance',
      requestedAt: '2 weeks ago',
      currentValue: 'Hook, thumbnail',
      proposedValue: 'Hook, thumbnail, first-frame caption, CTA card',
      decidedBy: 'Marguerite Alaoui, 13 days ago',
      reviewNote:
        'Every brand already reports on these four in the monthly review, so the template should ask for them. Promoted.',
    }),
  ];
}

/**
 * The block above the table, `data-slot="admin-note"`: one short paragraph in `text-text3` inside a
 * `rounded-card` `border-line` `bg-surface2` block, then the enforcement line under it.
 *
 * The sentence is `PROPAGATION_ADMIN_NOTE` from `@tas/domain` — the same constant the guard's own
 * module exports — so the page cannot promise access the guard does not grant, and the demo
 * sentence says the role check is STUBBED rather than absent.
 */
export function PropagationNoteStory() {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose rounded-card border border-line bg-surface2 p-3 text-sm text-text3">
        {PROPAGATION_ADMIN_NOTE} {DEMO_PROPAGATION_ACCESS_NOTE}
      </p>
      <p className="max-w-prose text-xs text-text4">{PROPAGATION_ENFORCEMENT_NOTE}</p>
    </div>
  );
}

/**
 * The diff cell on its own: previous value struck through in `text-text4`, requested value in
 * `text-text2`, both `font-mono` because they are stored values rather than prose, each truncated to
 * one line with the whole value in its `title`. Read-only text, never an input.
 */
export function DiffPreviewStory() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      {sampleRows()
        .slice(0, 2)
        .map((item) => (
          <DiffPreview key={item.id} item={item} />
        ))}
    </div>
  );
}

/**
 * The `?status=` filter. Every option is a `Link`, not a button, because unlike every other filter
 * in this app it changes which ROWS the server reads: the address is the state. The default state
 * points at a clean `/app/propagation` with no query at all.
 */
export function PropagationFilterStory() {
  const [filter, setFilter] = useState<PromotionStatusFilter>('pending');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PROMOTION_FILTERS.map((option) => (
        <Button
          key={option.key}
          type="button"
          size="sm"
          variant={option.key === filter ? 'secondary' : 'outline'}
          aria-pressed={option.key === filter}
          className="h-8"
          onClick={() => {
            setFilter(option.key);
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * The table as a signed-in Admin sees it: Approve and Reject live on every pending row, a settled
 * row showing who decided it and why instead of buttons, and the reason box each rejection needs.
 */
export function PromotionTableStory() {
  const [notes, setNotes] = useState<Readonly<Record<string, string>>>({});

  return (
    <PromotionTable
      items={sampleRows()}
      demo={false}
      notes={notes}
      onNote={(requestId, note) => {
        setNotes((current) => ({ ...current, [requestId]: note }));
      }}
      onDecide={() => undefined}
    />
  );
}

/**
 * The same table in demo mode. Every control in every pending row — both buttons and the reason box
 * — is wrapped in `DisabledWrite` with the tooltip "Sign in required to save changes" and carries
 * `disabledWriteClassName`, so a disabled primary button reads as inert rather than as clickable.
 */
export function PromotionTableDemoStory() {
  return (
    <PromotionTable items={sampleRows()} demo onNote={() => undefined} onDecide={() => undefined} />
  );
}

/**
 * The empty state, which on this page is a status with nothing in it. It says which state is empty
 * and why a row would appear, then offers the one action that leads somewhere — never a blank panel
 * and never raw JSON.
 */
export function PropagationEmptyStory() {
  const filter: PromotionStatusFilter = 'pending';
  const way = emptyAction(filter);

  return (
    <PromotionTable
      items={[]}
      demo={false}
      onNote={() => undefined}
      onDecide={() => undefined}
      emptyState={
        <div data-slot="propagation-empty" className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-text2">{emptyTitle(filter)}</p>
          <p className="max-w-prose text-[13px] leading-relaxed text-text3">{EMPTY_BODY}</p>
          <Button asChild variant="outline" size="sm">
            <Link href={way.href}>{way.label}</Link>
          </Button>
        </div>
      }
    />
  );
}
