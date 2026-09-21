'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import {
  Button,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusChip,
  Textarea,
} from '@tas/ui';
import { validateCopyDraft, type CopyDraft } from '@tas/domain/copy';

import { updateCopyAction, type CopyActionResult, type CopyFieldName } from './actions';
import {
  CLIENT_COMMENT_NOTE,
  COPY_FIELDS,
  COPY_HEADINGS,
  COUNTER_TONE_CLASS,
  CTA_OPTIONS,
  DEMO_FOOTER_NOTICE,
  FUNNEL_OPTIONS,
  NO_CONCEPT_LABEL,
  NO_CONCEPT_VALUE,
  NO_CREATIVE_LABEL,
  NO_CREATIVE_VALUE,
  NO_FUNNEL_LABEL,
  NO_FUNNEL_VALUE,
  STATUS_OPTIONS,
  counterLabel,
  counterTone,
  type ConceptChoice,
  type CopyField,
  type CopyItem,
  type CreativeChoice,
} from './fields';

/**
 * The right-side copy panel (PRD §5.11, ticket criteria 6 and 7).
 *
 * Deliberately not a modal, exactly as the Personas panel is not: no backdrop, no focus trap, no
 * `aria-modal`, so the table beside it stays visible and clickable while this is open. Fixed to the
 * right edge at 60% of the viewport, full width under 900px, closing on Escape or its close button.
 *
 * FOUR COPY FIELDS, IN ONE ORDER, FROM ONE DESCRIPTOR. Primary Copy, Headline, News Feed / Link
 * Description and CTA come from `COPY_FIELDS`; the panel renders that list and knows nothing else.
 * Each limited field carries a live counter that reads used-of-guide and turns `warn` at the guide
 * and `bad` past it — and never blocks: the PRD's numbers are tildes, so an over-long field saves
 * with a warning under it. The save is gated on `validateCopyDraft(draft).ok` and on nothing else,
 * which is the same function `updateCopyAction` re-runs before it writes.
 *
 * LINKED CREATIVE IS A SELECT, NEVER FREE TEXT. Its options are the brand's creative briefs by
 * their generated §7 names, plus an explicit "No creative" — `creative_brief_id` is nullable
 * (CLAUDE.md non-negotiable 5), so the unattached row is a choice a writer can make and unmake.
 *
 * CLIENT'S COMMENT IS READ-ONLY. PRD §5.11 gives that column to the client, so it is rendered as
 * prose when there is one and never submitted by any save.
 */

interface CopyPanelProps {
  readonly item: CopyItem;
  readonly creatives: readonly CreativeChoice[];
  readonly concepts: readonly ConceptChoice[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

/**
 * One typed field's edit, as a patch. A `switch` rather than a computed key, so the three text
 * columns stay the only ones a textarea can write and nothing casts.
 */
function textPatch(name: CopyField['name'], value: string): Partial<CopyDraft> {
  const next = value === '' ? null : value;
  switch (name) {
    case 'primaryCopy':
      return { primaryCopy: next };
    case 'headline':
      return { headline: next };
    case 'linkDescription':
      return { linkDescription: next };
    default:
      return {};
  }
}

/** The row as the panel starts editing it. Exactly the domain's draft shape, nothing added. */
function draftOf(item: CopyItem): CopyDraft {
  return {
    primaryCopy: item.primaryCopy,
    headline: item.headline,
    linkDescription: item.linkDescription,
    cta: item.cta,
    status: item.status,
    creativeBriefId: item.creativeBriefId,
    conceptId: item.conceptId,
  };
}

/** The detail fields that live alongside the domain draft but are not validated by it. */
interface DetailDraft {
  funnel: string | null;
  used: boolean;
  winning: boolean;
  metaRating: number | null;
}

function detailDraftOf(item: CopyItem): DetailDraft {
  return {
    funnel: item.funnel,
    used: item.used,
    winning: item.winning,
    metaRating: item.metaRating,
  };
}

export function CopyPanel({ item, creatives, concepts, demo, onClose, onSaved }: CopyPanelProps) {
  const [state, formAction, pending] = useActionState<CopyActionResult | null, FormData>(
    updateCopyAction,
    null,
  );
  const [draft, setDraft] = useState<CopyDraft>(() => draftOf(item));
  const [detailDraft, setDetailDraft] = useState<DetailDraft>(() => detailDraftOf(item));

  const validation = useMemo(() => validateCopyDraft(draft), [draft]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (state !== null && state.ok) {
      onSaved();
    }
  }, [state, onSaved]);

  const patch = (values: Partial<CopyDraft>) => {
    setDraft((current) => ({ ...current, ...values }));
  };

  /** A message under a field: the save's own error first, then the draft's own rule. */
  const errorFor = (name: CopyFieldName): string | undefined =>
    (state !== null && !state.ok ? state.fieldErrors?.[name] : undefined) ??
    validation.fieldErrors[name];

  const renderCopyField = (field: CopyField) => {
    const id = `copy-field-${field.name}`;
    const error = errorFor(field.name);
    const warning = field.limit === null ? undefined : validation.fieldWarnings[field.limit];
    const value = draft[field.name] ?? '';

    return (
      <div key={field.name} className="flex flex-col gap-1.5" data-slot="copy-field">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
            {field.label}
          </Label>
          {field.limit === null ? null : (
            <span
              data-slot="copy-counter"
              data-field={field.name}
              className={`font-mono text-[11px] ${COUNTER_TONE_CLASS[counterTone(value, field.limit)]}`}
            >
              {counterLabel(value, field.limit)}
            </span>
          )}
        </div>

        {field.kind === 'cta' ? (
          <>
            <Select
              value={draft.cta}
              onValueChange={(next) => {
                patch({ cta: next });
              }}
              disabled={demo}
            >
              <SelectTrigger id={id} className="w-full" aria-label={field.label}>
                <SelectValue placeholder={field.label} />
              </SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="cta" value={draft.cta} />
          </>
        ) : (
          <Textarea
            id={id}
            name={field.name}
            value={value}
            readOnly={demo}
            aria-invalid={error !== undefined}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              patch(textPatch(field.name, event.target.value));
            }}
            className="min-h-20 leading-relaxed"
          />
        )}

        <p id={`${id}-hint`} className="text-xs text-text3">
          {field.hint}
        </p>
        {warning === undefined ? null : (
          <p data-slot="copy-warning" className="text-xs text-warn">
            {warning}
          </p>
        )}
        {error === undefined ? null : (
          <p data-slot="copy-error" className="text-xs text-bad">
            {error}
          </p>
        )}
      </div>
    );
  };

  const creativeValue = draft.creativeBriefId ?? NO_CREATIVE_VALUE;
  const conceptValue = draft.conceptId ?? NO_CONCEPT_VALUE;
  const savedWarnings = state !== null && state.ok ? Object.keys(state.warnings).length : 0;

  return (
    <aside
      data-slot="copy-panel"
      aria-label={`Copy: ${item.title}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Copywriting</p>
          <h2
            className="truncate font-mono text-lg font-semibold text-text"
            data-slot="copy-panel-title"
          >
            {item.title}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="copy-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="id" value={item.id} />

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="copy-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                {COPY_HEADINGS.copy}
              </h3>
              <div className="flex flex-col gap-4">{COPY_FIELDS.map(renderCopyField)}</div>
            </section>

            <section className="flex flex-col gap-3">
              <h3
                data-slot="copy-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                {COPY_HEADINGS.creative}
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="copy-field-creativeBriefId"
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  Linked Creative
                </Label>
                <Select
                  value={creativeValue}
                  onValueChange={(next) => {
                    patch({ creativeBriefId: next === NO_CREATIVE_VALUE ? null : next });
                  }}
                  disabled={demo}
                >
                  <SelectTrigger
                    id="copy-field-creativeBriefId"
                    className="w-full"
                    aria-label="Linked Creative"
                    data-slot="copy-creative-select"
                  >
                    <SelectValue placeholder={NO_CREATIVE_LABEL} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CREATIVE_VALUE}>{NO_CREATIVE_LABEL}</SelectItem>
                    {creatives.map((creative) => (
                      <SelectItem key={creative.id} value={creative.id} className="font-mono">
                        {creative.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="creativeBriefId"
                  value={draft.creativeBriefId ?? ''}
                  data-slot="copy-creative-value"
                />
                <p className="text-xs text-text3">
                  The creative this copy runs against. A copy row can exist without one.
                </p>
                {errorFor('creativeBriefId') === undefined ? null : (
                  <p data-slot="copy-error" className="text-xs text-bad">
                    {errorFor('creativeBriefId')}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="copy-field-conceptId"
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  Concept
                </Label>
                <Select
                  value={conceptValue}
                  onValueChange={(next) => {
                    patch({ conceptId: next === NO_CONCEPT_VALUE ? null : next });
                  }}
                  disabled={demo}
                >
                  <SelectTrigger
                    id="copy-field-conceptId"
                    className="w-full"
                    aria-label="Concept"
                    data-slot="copy-concept-select"
                  >
                    <SelectValue placeholder={NO_CONCEPT_LABEL} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONCEPT_VALUE}>{NO_CONCEPT_LABEL}</SelectItem>
                    {concepts.map((concept) => (
                      <SelectItem key={concept.id} value={concept.id} className="font-mono">
                        {concept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="conceptId"
                  value={draft.conceptId ?? ''}
                  data-slot="copy-concept-value"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="copy-field-status"
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  Status
                </Label>
                <Select
                  value={draft.status}
                  onValueChange={(next) => {
                    patch({ status: next });
                  }}
                  disabled={demo}
                >
                  <SelectTrigger
                    id="copy-field-status"
                    className="w-full"
                    aria-label="Status"
                    data-slot="copy-status-select"
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="status" value={draft.status} />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={item.statusTone} label={item.statusLabel} />
                  <span className="text-xs text-text3">
                    {STATUS_OPTIONS.find((option) => option.value === draft.status)?.description ??
                      ''}
                  </span>
                </div>
                {errorFor('status') === undefined ? null : (
                  <p data-slot="copy-error" className="text-xs text-bad">
                    {errorFor('status')}
                  </p>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3
                data-slot="copy-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                {COPY_HEADINGS.details}
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="copy-field-funnel"
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  Funnel
                </Label>
                <Select
                  value={detailDraft.funnel ?? NO_FUNNEL_VALUE}
                  onValueChange={(next) => {
                    setDetailDraft((current) => ({
                      ...current,
                      funnel: next === NO_FUNNEL_VALUE ? null : next,
                    }));
                  }}
                  disabled={demo}
                >
                  <SelectTrigger
                    id="copy-field-funnel"
                    className="w-full"
                    aria-label="Funnel"
                    data-slot="copy-funnel-select"
                  >
                    <SelectValue placeholder={NO_FUNNEL_LABEL} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FUNNEL_VALUE}>{NO_FUNNEL_LABEL}</SelectItem>
                    {FUNNEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="funnel" value={detailDraft.funnel ?? ''} />
                <p className="text-xs text-text3">
                  Where this copy sits in the funnel: TOF, MOF, BOF or Retargeting.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="copy-field-used" className="flex cursor-pointer items-center gap-2">
                  <input
                    id="copy-field-used"
                    type="checkbox"
                    checked={detailDraft.used}
                    disabled={demo}
                    onChange={(event) => {
                      setDetailDraft((current) => ({
                        ...current,
                        used: event.target.checked,
                      }));
                    }}
                    className="accent-accent"
                  />
                  <span className="text-[11px] tracking-wide text-text3 uppercase">Used</span>
                </label>
                <input type="hidden" name="used" value={String(detailDraft.used)} />

                <label
                  htmlFor="copy-field-winning"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    id="copy-field-winning"
                    type="checkbox"
                    checked={detailDraft.winning}
                    disabled={demo}
                    onChange={(event) => {
                      setDetailDraft((current) => ({
                        ...current,
                        winning: event.target.checked,
                      }));
                    }}
                    className="accent-accent"
                  />
                  <span className="text-[11px] tracking-wide text-text3 uppercase">Winning</span>
                </label>
                <input type="hidden" name="winning" value={String(detailDraft.winning)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="copy-field-metaRating"
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  Meta Rating
                </Label>
                <Input
                  id="copy-field-metaRating"
                  name="metaRating"
                  type="number"
                  min={1}
                  max={10}
                  value={detailDraft.metaRating ?? ''}
                  readOnly={demo}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setDetailDraft((current) => ({
                      ...current,
                      metaRating: raw === '' ? null : Number.parseInt(raw, 10),
                    }));
                  }}
                  className="w-24"
                />
                <p className="text-xs text-text3">
                  Meta&apos;s ad quality score (1 to 10), if available.
                </p>
              </div>

              {item.spellingFeedback === null ? null : (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] tracking-wide text-text3 uppercase">
                    Spelling Feedback
                  </Label>
                  <p
                    data-slot="copy-spelling-feedback"
                    className="rounded-card border border-line bg-surface2 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line text-text2"
                  >
                    {item.spellingFeedback}
                  </p>
                  <p className="text-xs text-text3">
                    AI-generated spelling and grammar feedback. Read-only.
                  </p>
                </div>
              )}
            </section>

            {item.clientComment === null ? null : (
              <section className="flex flex-col gap-3">
                <h3
                  data-slot="copy-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {COPY_HEADINGS.clientComment}
                </h3>
                <p
                  data-slot="copy-client-comment"
                  className="rounded-card border border-line bg-surface2 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line text-text2"
                >
                  {item.clientComment}
                </p>
                <p className="text-xs text-text3">{CLIENT_COMMENT_NOTE}</p>
              </section>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="copy-demo-note">
              {DEMO_FOOTER_NOTICE}
            </p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : savedWarnings > 0 ? (
            <p className="mr-auto text-xs text-warn">
              Saved. {String(savedWarnings)} {savedWarnings === 1 ? 'field is' : 'fields are'} past
              the guide.
            </p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <DisabledWrite active={demo}>
            <Button
              type="submit"
              size="sm"
              disabled={demo || pending || !validation.ok}
              data-slot="copy-save"
              className={disabledWriteClassName}
            >
              {pending ? 'Saving...' : 'Save'}
            </Button>
          </DisabledWrite>
        </footer>
      </form>
    </aside>
  );
}
