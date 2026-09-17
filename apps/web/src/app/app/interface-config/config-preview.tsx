'use client';

import type { ReactNode } from 'react';
import type { InterfacePageRow } from '@tas/db';
import { Button, StatusChip, cn } from '@tas/ui';
import { accessTone, describeAccess, enabledPages, visibleFields } from '@tas/domain/interface';

import {
  CLIENT_PRIVACY_NOTE,
  CONCEPT_CARD_PAGE_KEY,
  EM_DASH,
  EMPTY_CARD_BODY,
  EMPTY_CARD_TITLE,
  NO_CONCEPT_BODY,
  NO_PAGES_BODY,
  NO_PAGES_TITLE,
  PAGE_PREVIEW_BODY,
  isMonoField,
  type ConceptPreview,
} from './fields';

/**
 * The right column of `/app/interface-config`: the client's interface in miniature (ticket
 * criterion 7).
 *
 * It is the real thing, not a diagram. The tab strip is the pages `enabledPages` returns, the
 * concept card prints the fields `visibleFields` returns, and both come from `@tas/domain/interface`
 * — the same two functions the client interface itself will call — so this preview cannot disagree
 * with what a client eventually sees. Nothing here filters on its own, and no page key or field
 * label is written as a literal (ticket criterion 9): the keys come from the domain's tuple and the
 * labels off the configuration rows.
 *
 * IT SHOWS NOTHING INTERNAL. No internal status, no budget, no creator cost, no partnership price;
 * the only status it draws is the CLIENT status, resolved through `@tas/domain/state`. That is
 * CLAUDE.md non-negotiable 10, and the note above the preview says it out loud, so a CSM knows the
 * guarantee is structural rather than a matter of which switches they happened to leave off.
 *
 * NOTHING IN HERE WRITES. No input, no form, no Server Action: this is a picture of the client
 * interface, and editing from a preview would be editing the client's data from the settings screen.
 */
interface ConfigPreviewProps {
  readonly pages: readonly InterfacePageRow[];
  readonly activeKey: string | null;
  readonly concept: ConceptPreview | null;
  readonly onSelect: (pageKey: string) => void;
  /** Switches every hidden field of the open page back on — the empty card's way out. */
  readonly onShowEveryField: (pageKey: string) => void;
}

interface EmptyCardProps {
  readonly title: string;
  readonly body: string;
  readonly action?: ReactNode;
}

/**
 * The worded empty state, with the one action that resolves it. Never a blank panel and never raw
 * JSON: an empty card is a legitimate configuration, so the preview has to be able to SAY that
 * rather than simply rendering nothing and looking broken.
 */
function EmptyCard({ title, body, action }: EmptyCardProps) {
  return (
    <div
      data-slot="preview-empty"
      className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line bg-surface2 p-4"
    >
      <p className="text-sm font-medium text-text2">{title}</p>
      <p className="text-[13px] leading-relaxed text-text3">{body}</p>
      {action}
    </div>
  );
}

export function ConfigPreview({
  pages,
  activeKey,
  concept,
  onSelect,
  onShowEveryField,
}: ConfigPreviewProps) {
  const shown = enabledPages(pages);
  // The open tab, or the first enabled page when the open one has just been switched off.
  const active = shown.find((page) => page.pageKey === activeKey) ?? shown[0] ?? null;
  const fields = active === null ? [] : visibleFields(active);

  return (
    <div className="flex flex-col gap-4">
      <p
        data-slot="preview-privacy-note"
        className="rounded-card border border-accent-line bg-accent-soft p-3 text-[13px] leading-relaxed text-text"
      >
        {CLIENT_PRIVACY_NOTE}
      </p>

      {active === null ? (
        <EmptyCard title={NO_PAGES_TITLE} body={NO_PAGES_BODY} />
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface2 p-3">
          <div
            data-slot="preview-tabs"
            role="tablist"
            aria-label="Client interface pages"
            className="flex flex-wrap gap-1.5"
          >
            {shown.map((page) => {
              const selected = page.pageKey === active.pageKey;
              return (
                <button
                  key={page.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  data-slot="preview-tab"
                  data-page-key={page.pageKey}
                  data-state={selected ? 'active' : 'idle'}
                  onClick={() => {
                    onSelect(page.pageKey);
                  }}
                  className={cn(
                    'rounded-input border px-2.5 py-1 text-[12px] transition-colors',
                    'focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none',
                    selected
                      ? 'border-accent-line bg-accent-soft text-text'
                      : 'border-line bg-surface text-text3 hover:text-text2',
                  )}
                >
                  {page.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" data-slot="preview-panel" data-page-key={active.pageKey}>
            <p className="mb-3 text-[12px] leading-snug text-text3">
              {PAGE_PREVIEW_BODY[active.pageKey]}
            </p>

            {fields.length === 0 ? (
              <EmptyCard
                title={EMPTY_CARD_TITLE}
                body={EMPTY_CARD_BODY}
                action={
                  active.fields.length === 0 ? undefined : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-slot="show-every-field"
                      onClick={() => {
                        onShowEveryField(active.pageKey);
                      }}
                    >
                      Show every field
                    </Button>
                  )
                }
              />
            ) : active.pageKey === CONCEPT_CARD_PAGE_KEY ? (
              <article
                data-slot="preview-concept-card"
                className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] tracking-wide text-text3 uppercase">
                    {active.label}
                  </span>
                  {concept === null ? null : (
                    <StatusChip tone={concept.status.tone} label={concept.status.label} />
                  )}
                </div>

                {concept === null ? (
                  <p className="text-[13px] leading-relaxed text-text3">{NO_CONCEPT_BODY}</p>
                ) : (
                  <dl className="flex flex-col gap-2.5">
                    {fields.map((field) => {
                      const value = concept.values[field.fieldName] ?? null;
                      return (
                        <div
                          key={field.id}
                          data-slot="preview-field"
                          data-field-name={field.fieldName}
                          className="flex flex-col gap-0.5"
                        >
                          <dt className="text-[10.5px] tracking-wide text-text3 uppercase">
                            {field.label}
                          </dt>
                          <dd
                            className={cn(
                              'text-[13px] leading-relaxed break-words',
                              value === null ? 'text-text4' : 'text-text2',
                              isMonoField(field.fieldName) ? 'font-mono' : null,
                            )}
                          >
                            {value ?? EM_DASH}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </article>
            ) : (
              <ul className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
                {fields.map((field) => (
                  <li
                    key={field.id}
                    data-slot="preview-field"
                    data-field-name={field.fieldName}
                    className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-text2"
                  >
                    <span className="min-w-0 break-words">{field.label}</span>
                    <StatusChip
                      tone={accessTone(field)}
                      label={describeAccess(field)}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
