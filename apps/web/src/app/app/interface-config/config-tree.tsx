'use client';

import type { InterfacePageRow } from '@tas/db';
import { StatusChip, StepRow, cn } from '@tas/ui';
import { accessEntry, accessTone, describeAccess, visibleFields } from '@tas/domain/interface';

import { fieldCountLabel } from './fields';

/**
 * The left column of `/app/interface-config`: one row per page of the client's interface, with that
 * page's fields nested underneath, and a switch on every row (ticket criteria 3 and 4).
 *
 * THE NESTING IS INDENTATION PLUS `border-line`, never a second border style and never a `<table>`
 * (criterion 3). A table would claim the fields are records of the same kind as the pages; they are
 * children of them, and the one vertical rule down the left of the nested list is what says so.
 *
 * EVERY ROW IS `StepRow` FROM `@tas/ui`. It is the repo's one row primitive for a thing with a
 * state, and its three states carry exactly the meaning this tree needs: `now` is a page that is on
 * and `done` a field the client currently sees, `next` is anything switched off. Nothing here
 * re-implements a row, a pill or a stepper (CLAUDE.md UI governance rule 3).
 *
 * A PAGE SWITCHED OFF MUTES ITS FIELDS WITHOUT CHANGING THEM (criterion 6). The nested list dims,
 * every field row states that the page is off, and each switch keeps its own value and stays
 * operable — so a CSM can prepare a page's field set before switching the page back on, and
 * switching it on restores exactly the set that was there.
 */
interface ConfigToggleProps {
  readonly checked: boolean;
  /** The page or field name. It is the switch's accessible name; nothing else labels it. */
  readonly label: string;
  readonly onToggle: () => void;
}

/**
 * The one switch on this page. `role="switch"` with `aria-checked`, `rounded-input` and never
 * `rounded-full` (criterion 4, and the design handoff's "no pill buttons").
 *
 * Deliberately NOT `Switch` from `@tas/ui`: that primitive is Radix, and its track and thumb are
 * shaped for a form field, while this one has to carry a `data-slot` the preview test addresses and
 * a checked state the tree drives from a pure domain toggle rather than from its own state. It adds
 * no new vocabulary — every colour is a token — so it stays local to this route rather than
 * becoming a second shared primitive.
 */
export function ConfigToggle({ checked, label, onToggle }: ConfigToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-slot="config-toggle"
      data-state={checked ? 'on' : 'off'}
      onClick={onToggle}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-input border p-0.5 transition-colors',
        'focus-visible:border-accent-line focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none',
        checked ? 'border-accent-line bg-accent' : 'border-line2 bg-surface4',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block size-4 rounded-input bg-bg transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

interface ConfigTreeProps {
  readonly pages: readonly InterfacePageRow[];
  readonly onTogglePage: (pageKey: string) => void;
  readonly onToggleField: (pageKey: string, fieldName: string) => void;
}

export function ConfigTree({ pages, onTogglePage, onToggleField }: ConfigTreeProps) {
  return (
    <ul className="flex flex-col gap-4">
      {pages.map((page) => {
        const shown = visibleFields(page).length;

        return (
          <li key={page.id} className="flex flex-col gap-2">
            <div
              data-slot="page-node"
              data-page-key={page.pageKey}
              data-state={page.enabled ? 'on' : 'off'}
              className="flex items-start gap-3"
            >
              <StepRow
                className="min-w-0 flex-1"
                label={page.label}
                state={page.enabled ? 'now' : 'next'}
                tip={
                  page.enabled
                    ? fieldCountLabel(shown, page.fields.length)
                    : 'Switched off. The client sees no tab and no card for this page.'
                }
                isLast
              />
              <ConfigToggle
                checked={page.enabled}
                label={page.label}
                onToggle={() => {
                  onTogglePage(page.pageKey);
                }}
              />
            </div>

            {page.fields.length === 0 ? (
              <p className="ml-4 border-l border-line pl-4 text-[11px] leading-snug text-text4">
                No configurable fields on this page — the client views, groups and filters it.
              </p>
            ) : (
              <ul
                data-slot="field-list"
                data-page-key={page.pageKey}
                className={cn(
                  'ml-4 flex flex-col gap-1 border-l border-line pl-4',
                  page.enabled ? null : 'opacity-55',
                )}
              >
                {page.fields.map((field) => (
                  <li
                    key={field.id}
                    data-slot="field-node"
                    data-field-name={field.fieldName}
                    data-state={field.visible ? 'on' : 'off'}
                    className="flex items-start gap-3"
                  >
                    <StepRow
                      className="min-w-0 flex-1"
                      label={field.label}
                      state={field.visible ? 'done' : 'next'}
                      tip={
                        page.enabled
                          ? accessEntry(field).description
                          : 'The page is switched off, so the client never reaches this field.'
                      }
                      badge={
                        <StatusChip
                          tone={accessTone(field)}
                          label={describeAccess(field)}
                          className="shrink-0"
                        />
                      }
                      isLast
                    />
                    <ConfigToggle
                      checked={field.visible}
                      label={field.label}
                      onToggle={() => {
                        onToggleField(page.pageKey, field.fieldName);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
