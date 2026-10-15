'use client';

import { useActionState, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  disabledWriteClassName,
  DisabledWrite,
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
import { clientApprovalLabel, clientApprovalTone } from '@tas/domain/state';

import { RecordSheet, type RecordSheetNavigation } from '@/components/views';
import { briefPath, productsPath } from '@/lib/routes';

import { updateCopyAction, type CopyActionResult, type CopyFieldName } from './actions';
import {
  CAMPAIGNS_READ_ONLY_NOTE,
  COPY_FIELDS,
  COPY_HEADINGS,
  COPY_TYPES_HINT,
  COUNTER_TONE_CLASS,
  CTA_OPTIONS,
  DEMO_FOOTER_NOTICE,
  EM_DASH,
  FUNNEL_OPTIONS,
  NO_CAMPAIGNS_NOTE,
  NO_CONCEPT_LABEL,
  NO_CONCEPT_VALUE,
  NO_COPY_TYPES_NOTE,
  NO_CREATIVE_LABEL,
  NO_CREATIVE_VALUE,
  NO_FUNNEL_LABEL,
  NO_FUNNEL_VALUE,
  NO_PRODUCT_LABEL,
  NO_PRODUCT_VALUE,
  STATUS_OPTIONS,
  counterLabel,
  counterTone,
  type ConceptChoice,
  type CopyField,
  type CopyItem,
  type CopyTypeChoice,
  type CreativeChoice,
  type ProductChoice,
} from './fields';

/**
 * The right-side copy panel (PRD §5.11, ticket criteria 6 and 7). The SHELL is the shared
 * `RecordSheet` since Ticket 9 (part 3): header with counter + prev/next, keyboard ArrowLeft /
 * ArrowRight through the grid-visible set, close through its built-in button and overlay. The
 * form, the `useActionState` save, the demo-note slot and the pending-create wiring are unchanged.
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
 *
 * COPY TYPES ARE A CHIP PICKER THE COPY SIDE OWNS (Airtable "Copy Type", `copywriting_copy_types`),
 * the UGC creator panel's concept-toggle pattern: one `aria-pressed` toggle per type of the brand,
 * the selection posted as repeated `copyTypeIds` hidden inputs. The first of those is EMPTY-VALUED
 * on purpose: it marks that the picker was on the form at all, so the action can tell "nothing
 * pressed" (clear every tag) from "this save never carried the picker" (leave the tags alone) —
 * the same "absent means unchanged" contract every other key of this form keeps.
 *
 * CAMPAIGNS & OFFERS IS A READ-ONLY LIST. The copy side owns that link too, but `@tas/db` ships no
 * writer for `copywriting_campaigns` yet, so the panel shows what the page handed it and says why
 * there is no picker (`CAMPAIGNS_READ_ONLY_NOTE`) rather than offering a toggle with nothing to
 * submit to.
 *
 * COLLECTIONS IS GONE (Oct 12 client sync, Ticket 1): the Linked Collection control and the
 * reverse-read chip list were retired with the Collections workspace. A copy links to a Creative
 * and to a Product, nothing else.
 */

interface CopyPanelProps {
  readonly item: CopyItem;
  readonly creatives: readonly CreativeChoice[];
  readonly concepts: readonly ConceptChoice[];
  /** The brand's products, for the Oct 5 Linked Product single-select. Empty on a brand with none. */
  readonly products: readonly ProductChoice[];
  readonly copyTypes: readonly CopyTypeChoice[];
  readonly demo: boolean;
  /** The row is still being created (SMOKE-25): shown at the press, read-only until its id is real. */
  readonly creating?: boolean;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  /** The shared sidebar's prev/next walk through the grid-visible set (Ticket 9, part 3). */
  readonly nav?: RecordSheetNavigation;
  readonly onNavigate?: (id: string) => void;
}

/** What a disabled control says while the row is being created. */
export const CREATING_HINT = 'Saving the new copy — editable in a moment.';

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

/**
 * The detail fields that live alongside the domain draft but are not validated by it. Used,
 * Winning, Meta Rating and the Client's Comment left the form on Oct 12 (client sync, Ticket 15);
 * their columns stay until the drop migration is applied.
 */
interface DetailDraft {
  funnel: string | null;
}

function detailDraftOf(item: CopyItem): DetailDraft {
  return { funnel: item.funnel };
}

export function CopyPanel({
  item,
  creatives,
  concepts,
  products,
  copyTypes,
  demo,
  creating = false,
  onClose,
  onSaved,
  nav,
  onNavigate,
}: CopyPanelProps) {
  // Demo mode and a row still being created lock the same controls; only the hint differs.
  const locked = demo || creating;
  const [state, formAction, pending] = useActionState<CopyActionResult | null, FormData>(
    updateCopyAction,
    null,
  );
  const [draft, setDraft] = useState<CopyDraft>(() => draftOf(item));
  const [detailDraft, setDetailDraft] = useState<DetailDraft>(() => detailDraftOf(item));
  const [selectedCopyTypeIds, setSelectedCopyTypeIds] = useState<readonly string[]>(
    item.copyTypeIds,
  );
  const [productId, setProductId] = useState<string | null>(item.productId);
  // Flow completion 2026-10-16: once the editor touches the Linked Product by hand, concept /
  // brief changes stop overriding it. `item.productId !== null` means the saved row already has a
  // product chosen — we honour that as if the editor had just set it. False only when both the
  // saved row has no product AND no change has been made in this edit session yet.
  const [productManuallySet, setProductManuallySet] = useState(item.productId !== null);

  const validation = useMemo(() => validateCopyDraft(draft), [draft]);

  const toggleCopyType = useCallback((id: string) => {
    setSelectedCopyTypeIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
    );
  }, []);

  // Escape and overlay-dismiss are handled by the shared RecordSheet (Ticket 9, part 3); no
  // panel-local keydown listener is needed any more.

  useEffect(() => {
    if (state !== null && state.ok) {
      onSaved();
    }
  }, [state, onSaved]);

  const patch = (values: Partial<CopyDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...values };
      // Flow completion 2026-10-16: when the editor picks a Creative or a Concept, prefill the
      // Linked Product from that pick's own `productId` — unless they have already set one by
      // hand (`productManuallySet`). The brief's own `product_id` wins over the concept's
      // through-angle inheritance if both change at once, because the brief is the more specific
      // link; otherwise either one fills it.
      if (!productManuallySet) {
        let picked: string | null = null;
        if ('creativeBriefId' in values && values.creativeBriefId !== null) {
          const brief = creatives.find((creative) => creative.id === values.creativeBriefId);
          if (brief?.productId !== null && brief?.productId !== undefined) {
            picked = brief.productId;
          }
        }
        if (picked === null && 'conceptId' in values && values.conceptId !== null) {
          const concept = concepts.find((option) => option.id === values.conceptId);
          if (concept?.productId !== null && concept?.productId !== undefined) {
            picked = concept.productId;
          }
        }
        if (picked !== null) {
          setProductId(picked);
        }
      }
      return next;
    });
  };

  /**
   * A message under a field: the save's own error first, then the draft's own rule. The validation
   * tracks only the domain's `CopyDraft` fields; the link field (`productId`) is only in the
   * server-returned error map, so the fallback is only consulted for a draft field.
   */
  const errorFor = (name: CopyFieldName): string | undefined => {
    const fromState = state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;
    if (fromState !== undefined) return fromState;
    return name === 'productId' ? undefined : validation.fieldErrors[name];
  };

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
              disabled={locked}
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
            readOnly={locked}
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
  const selectedCreative =
    draft.creativeBriefId === null
      ? null
      : (creatives.find((creative) => creative.id === draft.creativeBriefId) ?? null);
  const savedWarnings = state !== null && state.ok ? Object.keys(state.warnings).length : 0;

  return (
    <RecordSheet
      open
      onClose={onClose}
      nav={nav}
      onNavigate={onNavigate}
      title={item.title}
      titleSlot="copy-panel-title"
      width="form"
      description={`Copy: ${item.title}`}
    >
      {creating ? (
        <p className="mb-3 text-xs text-text3" role="status" data-slot="copy-panel-creating">
          {CREATING_HINT}
        </p>
      ) : null}
      <form action={formAction} className="-m-4 flex min-h-full flex-col">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="copyTypeIds" value="" data-slot="copy-types-marker" />
        {selectedCopyTypeIds.map((copyTypeId) => (
          <input key={copyTypeId} type="hidden" name="copyTypeIds" value={copyTypeId} />
        ))}

        <div className="flex-1 px-4 py-5 sm:px-6">
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
                  disabled={locked}
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
                {/*
                 * The linked brief, as a chip-link that opens the detail page: the task's
                 * "click-the-chip-to-navigate" behaviour for a single-value FK. The select handles
                 * picking; the chip is how a reader gets from the copy to the creative without
                 * leaving the drop-down open. Null means no creative is linked — the chip would
                 * have nothing to point at, so the row renders nothing instead of a dead link.
                 */}
                {selectedCreative === null ? null : (
                  <Link
                    href={briefPath(selectedCreative.id)}
                    data-slot="copy-creative-chip"
                    data-brief-id={selectedCreative.id}
                    className="inline-flex self-start rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text2 hover:border-accent-line hover:text-accent"
                  >
                    Open {selectedCreative.name}
                  </Link>
                )}
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
                  disabled={locked}
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

              {/*
               * The Linked Product control (Oct 5): a single-select over the brand's products that
               * writes `copywriting.product_id` directly through `updateCopy` (the FK is on this
               * row, so no cross-table setter is needed). The chip under
               * the select opens the product's panel on the Products page, same shape as the
               * Linked Creative chip above.
               */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="copy-field-productId"
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  Linked Product
                </Label>
                <Select
                  value={productId ?? NO_PRODUCT_VALUE}
                  onValueChange={(next) => {
                    setProductId(next === NO_PRODUCT_VALUE ? null : next);
                    // Flow completion 2026-10-16: the editor's own choice freezes the field so a
                    // later Creative or Concept pick cannot overwrite it.
                    setProductManuallySet(true);
                  }}
                  disabled={locked}
                >
                  <SelectTrigger
                    id="copy-field-productId"
                    className="w-full"
                    aria-label="Linked Product"
                    data-slot="copy-product-select"
                  >
                    <SelectValue placeholder={NO_PRODUCT_LABEL} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PRODUCT_VALUE}>{NO_PRODUCT_LABEL}</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="productId"
                  value={productId ?? ''}
                  data-slot="copy-product-value"
                />
                {productId === null ? null : (
                  <Link
                    href={`${productsPath}?product=${encodeURIComponent(productId)}`}
                    data-slot="copy-product-chip"
                    data-product-id={productId}
                    className="inline-flex self-start rounded-input border border-line bg-surface2 px-1.5 py-0.5 text-[11px] text-text2 hover:border-accent-line hover:text-accent"
                  >
                    Open {products.find((product) => product.id === productId)?.name ?? productId}
                  </Link>
                )}
                {errorFor('productId') === undefined ? null : (
                  <p data-slot="copy-error" className="text-xs text-bad">
                    {errorFor('productId')}
                  </p>
                )}
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
                  disabled={locked}
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

              {/*
                SMOKE-34 (item 5a, 2026-10-11): the Oct 5 "client status" badge + dropdown that sat
                here edited the SAME `status` column as the select above — two controls, one
                column, read as a contradiction (the shape SMOKE-27 removed from concepts). Gone.
                What the client decided is `client_approval_status`, the one client vocabulary,
                shown here as the grid shows it.
              */}
              <div
                className="flex flex-col gap-1.5 border-t border-line pt-3"
                data-slot="copy-client-approval"
                data-value={item.clientApprovalStatus ?? ''}
              >
                <span className="text-[11px] tracking-wide text-text3 uppercase">
                  Client Approval
                </span>
                {item.clientApprovalStatus === null ? (
                  <span className="text-sm text-text4">{EM_DASH}</span>
                ) : (
                  <StatusChip
                    tone={clientApprovalTone(item.clientApprovalStatus)}
                    label={clientApprovalLabel(item.clientApprovalStatus)}
                  />
                )}
                <p className="text-xs text-text3">
                  The client&apos;s decision on this copy, as the Client Approval column shows it.
                </p>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3
                id="copy-copy-types-heading"
                data-slot="copy-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                {COPY_HEADINGS.copyTypes}
              </h3>
              {copyTypes.length === 0 ? (
                <p data-slot="copy-copy-types" className="text-sm text-text3">
                  {NO_COPY_TYPES_NOTE}
                </p>
              ) : (
                <div
                  role="group"
                  aria-labelledby="copy-copy-types-heading"
                  data-slot="copy-copy-types"
                  className="flex flex-wrap gap-2"
                >
                  {copyTypes.map((copyType) => {
                    const on = selectedCopyTypeIds.includes(copyType.id);
                    return (
                      <button
                        key={copyType.id}
                        type="button"
                        disabled={locked}
                        aria-pressed={on}
                        data-slot="copy-type-toggle"
                        onClick={() => {
                          toggleCopyType(copyType.id);
                        }}
                        className={
                          on
                            ? 'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed'
                            : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed'
                        }
                      >
                        {copyType.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-text3">{COPY_TYPES_HINT}</p>
            </section>

            <section className="flex flex-col gap-3">
              <h3
                data-slot="copy-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                {COPY_HEADINGS.campaigns}
              </h3>
              <div className="flex flex-wrap items-center gap-2" data-slot="copy-campaigns">
                {item.campaigns.length === 0 ? (
                  <span className="text-xs text-text3">{NO_CAMPAIGNS_NOTE}</span>
                ) : (
                  item.campaigns.map((campaign) =>
                    campaign.href === null ? (
                      <StatusChip key={campaign.id} tone="info" label={campaign.label} />
                    ) : (
                      <Link key={campaign.id} href={campaign.href} className="inline-flex">
                        <StatusChip tone="info" label={campaign.label} />
                      </Link>
                    ),
                  )
                )}
              </div>
              <p className="text-xs text-text3">{CAMPAIGNS_READ_ONLY_NOTE}</p>
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
                  disabled={locked}
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
          <DisabledWrite active={locked} hint={creating ? CREATING_HINT : undefined}>
            <Button
              type="submit"
              size="sm"
              disabled={locked || pending || !validation.ok}
              data-slot="copy-save"
              className={disabledWriteClassName}
            >
              {pending ? 'Saving...' : 'Save'}
            </Button>
          </DisabledWrite>
        </footer>
      </form>
    </RecordSheet>
  );
}
