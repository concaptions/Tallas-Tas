'use client';

import type { KeyboardEvent } from 'react';
import { StatusChip } from '@tas/ui';

import { EM_DASH, type ConceptColumn, type ConceptItem } from './fields';

interface ConceptBoardProps {
  readonly columns: readonly ConceptColumn[];
  readonly onOpen: (item: ConceptItem) => void;
}

/**
 * The same concepts, grouped by internal status (ticket criterion 3).
 *
 * One column per step of the track, in the order `internalStatusFor` returns and always all of
 * them — an empty column says "nothing is waiting here", which is the single most useful thing a
 * pipeline board tells a strategist, so it is rendered with its zero rather than dropped.
 *
 * The column heading is the status LABEL and its `StatusChip` carries the count: the chip is the
 * status, so the count rides on it rather than on a second pill of a colour this file chose. Every
 * label and tone arrives on the `ConceptStatusView` the page built from `@tas/domain/state`; nothing
 * here maps a status to anything.
 *
 * A card is the same click target a table row is — it opens `/app/concepts/<id>`, a real route — so
 * it carries `role="button"`, a tab stop and Enter/Space, exactly as the table rows do.
 */
export function ConceptBoard({ columns, onOpen }: ConceptBoardProps) {
  const onCardKey = (event: KeyboardEvent<HTMLElement>, item: ConceptItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(item);
    }
  };

  return (
    <div
      data-slot="concept-board"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {columns.map((column) => (
        <section
          key={column.status.key}
          data-slot="concept-column"
          data-status={column.status.key}
          aria-label={column.status.label}
          className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface2 p-3"
        >
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3
              data-slot="concept-column-label"
              className="min-w-0 text-[11px] font-medium tracking-wide text-text2 uppercase"
            >
              {column.status.label}
            </h3>
            <span data-slot="concept-column-count">
              <StatusChip tone={column.status.tone} label={String(column.items.length)} />
            </span>
          </header>

          {column.items.length === 0 ? (
            <p data-slot="concept-column-empty" className="py-2 text-xs text-text4">
              Nothing here yet.
            </p>
          ) : (
            column.items.map((item) => (
              <article
                key={item.id}
                data-slot="concept-card"
                data-concept-id={item.id}
                role="button"
                tabIndex={0}
                aria-label={item.name}
                onClick={() => {
                  onOpen(item);
                }}
                onKeyDown={(event) => {
                  onCardKey(event, item);
                }}
                className="flex cursor-pointer flex-col gap-1.5 rounded-card border border-line bg-surface p-3 hover:border-line2"
              >
                <p
                  data-slot="concept-card-name"
                  className="font-mono text-xs leading-snug break-words text-text"
                >
                  {item.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text3">
                  <span data-slot="concept-card-batch" className="font-mono">
                    {item.batch ?? EM_DASH}
                  </span>
                  <span aria-hidden="true" className="text-text4">
                    ·
                  </span>
                  <span data-slot="concept-card-theme" className="min-w-0 break-words">
                    {item.themeName ?? EM_DASH}
                  </span>
                </div>
                <p data-slot="concept-card-angle" className="text-xs leading-snug text-text4">
                  {item.angleName ?? EM_DASH}
                </p>
              </article>
            ))
          )}
        </section>
      ))}
    </div>
  );
}
