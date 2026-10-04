'use client';

import type { ReactNode } from 'react';
import type { ChipTone } from '@tas/domain/state';
import { cn, StatusChip } from '@tas/ui';

import type { GalleryItem } from './gallery-view';

/** The status a list row wears, where the page has one; tones come from `chipTone`, never here. */
export interface ListChip {
  readonly label: string;
  readonly tone: ChipTone;
}

interface ListViewProps {
  /**
   * The SAME items the gallery renders (`galleryItemsFrom`), so the list's labelled values derive
   * from the grid's column definitions exactly once: one Fields toggle hides a grid column, a card
   * line and a list value together, and `fieldOrder` has already ordered `fields`.
   */
  readonly items: readonly GalleryItem[];
  /** The field keys to show; `null` or absent shows every field the item carries. */
  readonly visibleFields?: readonly string[] | null;
  /** A status chip per record id, where the page has one (AI-17: "status chip where provided"). */
  readonly chips?: Readonly<Record<string, ListChip>>;
  /** Generated names (concepts) render in font-mono, per the UI governance rule on system output. */
  readonly monoNames?: boolean;
  readonly onItemClick?: (item: GalleryItem) => void;
  readonly selectedId?: string | null;
  readonly empty?: ReactNode;
  /** `data-slot` for each row (default `list-row`), so a page keeps its own test hooks. */
  readonly rowSlot?: string;
}

/** How many labelled values a row carries: the list is a scan, not a table. */
const LIST_FIELD_LIMIT = 2;

/**
 * The List view (AI-17): one record per row in a single compact column — the name, up to two
 * labelled values, and the record's status chip where the page provides one. It is the reading for
 * a narrow panel or a quick scan, between the grid (every column) and the gallery (a card).
 *
 * It renders the SAME `GalleryItem`s the gallery does, so visibility, order and labels are decided
 * once by the column resolver plus the viewer's view, never re-derived here; this component only
 * renders and reports clicks.
 */
export function ListView({
  items,
  visibleFields = null,
  chips,
  monoNames = false,
  onItemClick,
  selectedId = null,
  empty,
  rowSlot = 'list-row',
}: ListViewProps) {
  if (items.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12 text-sm text-text3"
        data-slot="list-empty"
      >
        {empty ?? 'Nothing to show yet.'}
      </div>
    );
  }

  return (
    <ul
      className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
      data-slot="list-view"
    >
      {items.map((item) => {
        const clickable = onItemClick !== undefined;
        const activate = clickable
          ? () => {
              onItemClick(item);
            }
          : undefined;
        const fields = (item.fields ?? [])
          .filter((field) => visibleFields === null || visibleFields.includes(field.key))
          .slice(0, LIST_FIELD_LIMIT);
        const chip = chips?.[item.id];
        return (
          <li
            key={item.id}
            data-slot={rowSlot}
            data-list-id={item.id}
            data-state={item.id === selectedId ? 'selected' : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? item.name : undefined}
            onClick={activate}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      activate?.();
                    }
                  }
                : undefined
            }
            className={cn(
              'flex min-w-0 items-center gap-3 border-b border-line/60 px-3 py-2 last:border-b-0 data-[state=selected]:bg-accent-soft',
              clickable && 'cursor-pointer hover:bg-surface3',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p
                data-slot="list-name"
                className={cn(
                  'truncate text-sm font-medium text-text',
                  monoNames && 'font-mono text-xs',
                )}
              >
                {item.name}
              </p>
              {item.subtitle && <p className="truncate text-xs text-text3">{item.subtitle}</p>}
            </div>
            {fields.length === 0 ? null : (
              <dl className="flex shrink-0 items-center gap-4">
                {fields.map((field) => (
                  <div
                    key={field.key}
                    className="flex max-w-48 min-w-0 flex-col"
                    data-slot="list-field"
                    data-field={field.key}
                  >
                    <dt className="truncate font-mono text-[10px] tracking-wide text-text3 uppercase">
                      {field.label}
                    </dt>
                    <dd className="min-w-0 truncate text-xs text-text2">{field.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {chip === undefined ? null : (
              <span className="shrink-0" data-slot="list-chip">
                <StatusChip tone={chip.tone} label={chip.label} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
