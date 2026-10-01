'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { COPY_STATUS_INITIAL, copyStatusLabel, copyStatusTone } from '@tas/domain/state';
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

import {
  createYoutubeCopyAction,
  updateYoutubeCopyAction,
  type YoutubeCopyActionResult,
} from './actions';
import {
  campaignChipLabel,
  copyNumberLabel,
  DEMO_FOOTER_NOTICE,
  DESCRIPTIONS_MAX,
  EM_DASH,
  META_RATING_MAX,
  META_RATING_MIN,
  NONE_VALUE,
  NOT_SET,
  selectOptionsFor,
  YOUTUBE_COPY_FIELDS,
  YOUTUBE_COPY_HEADINGS,
  type CampaignOption,
  type LinkOption,
  type YoutubeCopyField,
  type YoutubeCopyFieldName,
  type YoutubeCopyFlagField,
  type YoutubeCopyGroup,
  type YoutubeCopyItem,
  type YoutubeCopySelectField,
  type YoutubeCopyTextField,
} from './fields';

/**
 * The right-side YouTube copy panel. Deliberately not a modal, exactly as the Products panel is
 * not: no backdrop, no focus trap, no `aria-modal` — the grid beside it stays visible and clickable
 * while this is open. Fixed to the right edge at 60% of the viewport, full width under 900px, and
 * it closes on Escape or on its close button.
 *
 * EVERY STORED FIELD IS HERE, FROM ONE DESCRIPTOR. `YOUTUBE_COPY_FIELDS` names each column and the
 * control it gets; this file renders that list and knows nothing else about the columns. The one
 * field it does not render from the list is the Copy #, which is generated and shown read-only in
 * `font-mono` (CLAUDE.md non-negotiable 6). Descriptions is a textarea with `maxLength` 90 and a
 * live counter; the action re-checks the same limit with the same message.
 *
 * THE FOUR RECORD LINKS ARE CHIP PICKERS, the pattern `ugc/creator-panel.tsx` set: each selected id
 * is a repeated hidden input, and a `syncLinks` marker tells the action the pickers were on the
 * form. Under each picker the saved row's LOOKUPS (Collection URL, Link from Product, Offer and
 * Code from Campaign) are shown read-only — computed in the query layer, never here.
 *
 * In demo mode every control is read-only and the footer says so instead of saving.
 */
interface YoutubeCopyPanelProps {
  /** The open row, or null for a row that does not exist yet. */
  readonly item: YoutubeCopyItem | null;
  readonly collections: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  readonly campaigns: readonly CampaignOption[];
  readonly copyTypes: readonly LinkOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The panel's editable state: text as typed, selects as keys (null for "none"), ids as lists. */
interface Draft {
  readonly texts: Readonly<Record<YoutubeCopyTextField, string>>;
  readonly selects: Readonly<Record<YoutubeCopySelectField, string | null>>;
  readonly flags: Readonly<Record<YoutubeCopyFlagField, boolean>>;
  readonly metaRating: string;
  readonly collectionIds: readonly string[];
  readonly productIds: readonly string[];
  readonly campaignOfferIds: readonly string[];
  readonly copyTypeIds: readonly string[];
}

/** The row as the panel starts editing it; a new row starts at the column defaults. */
function draftOf(item: YoutubeCopyItem | null): Draft {
  return {
    texts: {
      angle: item?.angle ?? '',
      headline: item?.headline ?? '',
      descriptions: item?.descriptions ?? '',
      newsFeed: item?.newsFeed ?? '',
      clientComment: item?.clientComment ?? '',
    },
    selects: {
      cta: item?.cta ?? null,
      funnel: item?.funnel ?? null,
      status: item?.status ?? COPY_STATUS_INITIAL,
    },
    flags: { used: item?.used ?? false, winning: item?.winning ?? false },
    metaRating: item?.metaRating === null || item === null ? '' : String(item.metaRating),
    collectionIds: item?.linkedCollections.map((link) => link.id) ?? [],
    productIds: item?.linkedProducts.map((link) => link.id) ?? [],
    campaignOfferIds: item?.linkedCampaigns.map((link) => link.id) ?? [],
    copyTypeIds: item?.linkedCopyTypes.map((link) => link.id) ?? [],
  };
}

type IdListKey = 'collectionIds' | 'productIds' | 'campaignOfferIds' | 'copyTypeIds';

function toggled(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((candidate) => candidate !== id) : [...ids, id];
}

const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';
const HEADING_CLASS = 'border-b border-line pb-1 text-sm font-medium text-text2';
const CHIP_ON =
  'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed';
const CHIP_OFF =
  'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed';

/** One chip picker: every option of the brand, the selected ones pressed, each a repeated hidden input. */
function ChipPicker({
  slot,
  name,
  label,
  options,
  selected,
  demo,
  empty,
  onToggle,
}: {
  readonly slot: string;
  readonly name: IdListKey;
  readonly label: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly selected: readonly string[];
  readonly demo: boolean;
  readonly empty: string;
  readonly onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL_CLASS}>{label}</span>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="flex flex-wrap gap-2" data-slot={slot}>
        {options.length === 0 ? (
          <p className="text-sm text-text3">{empty}</p>
        ) : (
          options.map((option) => {
            const on = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={demo}
                aria-pressed={on}
                data-slot={`${slot}-toggle`}
                onClick={() => {
                  onToggle(option.id);
                }}
                className={on ? CHIP_ON : CHIP_OFF}
              >
                {option.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** One read-only lookup line under a picker: the values the saved links resolve to. */
function Lookup({
  name,
  label,
  values,
}: {
  name: string;
  label: string;
  values: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-0.5" data-slot="youtube-copy-lookup" data-lookup={name}>
      <span className={LABEL_CLASS}>{label}</span>
      <span className="font-mono text-xs break-all text-text2">
        {values.length === 0 ? EM_DASH : values.join(' · ')}
      </span>
    </div>
  );
}

export function YoutubeCopyPanel({
  item,
  collections,
  products,
  campaigns,
  copyTypes,
  demo,
  onClose,
  onSaved,
}: YoutubeCopyPanelProps) {
  const creating = item === null;
  const action = creating ? createYoutubeCopyAction : updateYoutubeCopyAction;
  const [state, formAction, pending] = useActionState<YoutubeCopyActionResult | null, FormData>(
    action,
    null,
  );
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));

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
      onSaved(state.id);
    }
  }, [state, onSaved]);

  const setText = useCallback((name: YoutubeCopyTextField, value: string) => {
    setDraft((current) => ({ ...current, texts: { ...current.texts, [name]: value } }));
  }, []);

  const setSelect = useCallback((name: YoutubeCopySelectField, value: string | null) => {
    setDraft((current) => ({ ...current, selects: { ...current.selects, [name]: value } }));
  }, []);

  const setFlag = useCallback((name: YoutubeCopyFlagField, value: boolean) => {
    setDraft((current) => ({ ...current, flags: { ...current.flags, [name]: value } }));
  }, []);

  const toggleId = useCallback((key: IdListKey, id: string) => {
    setDraft((current) => ({ ...current, [key]: toggled(current[key], id) }));
  }, []);

  const fieldError = (name: YoutubeCopyFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const title = creating ? copyNumberLabel(null) : item.title;

  const renderField = (field: YoutubeCopyField) => {
    const id = `youtube-copy-field-${field.name}`;
    const error = fieldError(field.name);
    let control;
    let counter = null;

    switch (field.kind) {
      case 'text':
        control = (
          <Input
            id={id}
            name={field.name}
            readOnly={demo}
            aria-invalid={error !== undefined}
            placeholder={demo ? NOT_SET : undefined}
            value={draft.texts[field.name]}
            onChange={(event) => {
              setText(field.name, event.target.value);
            }}
          />
        );
        break;
      case 'textarea': {
        const limited = field.name === 'descriptions';
        const length = draft.texts[field.name].length;
        if (limited) {
          counter = (
            <span
              data-slot="youtube-copy-counter"
              className={`font-mono text-[11px] ${length >= DESCRIPTIONS_MAX ? 'text-warn' : 'text-text3'}`}
            >
              {String(length)} of {String(DESCRIPTIONS_MAX)}
            </span>
          );
        }
        control = (
          <Textarea
            id={id}
            name={field.name}
            readOnly={demo}
            maxLength={limited ? DESCRIPTIONS_MAX : undefined}
            aria-invalid={error !== undefined}
            placeholder={demo ? NOT_SET : undefined}
            value={draft.texts[field.name]}
            onChange={(event) => {
              setText(field.name, event.target.value);
            }}
            className="min-h-20 leading-relaxed"
          />
        );
        break;
      }
      case 'select': {
        const { options, noneLabel } = selectOptionsFor(field.name);
        const value = draft.selects[field.name] ?? NONE_VALUE;
        control = (
          <>
            <Select
              value={value}
              onValueChange={(next) => {
                setSelect(field.name, next === NONE_VALUE ? null : next);
              }}
              disabled={demo}
            >
              <SelectTrigger id={id} className="w-full" aria-label={field.label}>
                <SelectValue placeholder={noneLabel ?? field.label} />
              </SelectTrigger>
              <SelectContent>
                {noneLabel === null ? null : (
                  <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
                )}
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name={field.name} value={draft.selects[field.name] ?? ''} />
            {field.name === 'status' ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip
                  tone={copyStatusTone(draft.selects.status ?? '')}
                  label={copyStatusLabel(draft.selects.status ?? '')}
                />
              </div>
            ) : null}
          </>
        );
        break;
      }
      case 'checkbox':
        control = (
          <>
            <input
              id={id}
              type="checkbox"
              checked={draft.flags[field.name]}
              disabled={demo}
              onChange={(event) => {
                setFlag(field.name, event.target.checked);
              }}
              className="size-4 accent-accent"
            />
            <input type="hidden" name={field.name} value={String(draft.flags[field.name])} />
          </>
        );
        break;
      case 'rating':
        control = (
          <Input
            id={id}
            name={field.name}
            type="number"
            min={META_RATING_MIN}
            max={META_RATING_MAX}
            step={1}
            readOnly={demo}
            aria-invalid={error !== undefined}
            value={draft.metaRating}
            onChange={(event) => {
              setDraft((current) => ({ ...current, metaRating: event.target.value }));
            }}
            className="w-24 font-mono"
          />
        );
        break;
    }

    return (
      <div
        key={field.name}
        className={field.kind === 'checkbox' ? 'flex items-center gap-2' : 'flex flex-col gap-1.5'}
        data-slot="youtube-copy-field"
        data-field={field.name}
      >
        {field.kind === 'checkbox' ? (
          <>
            {control}
            <Label htmlFor={id} className={LABEL_CLASS}>
              {field.label}
            </Label>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor={id} className={LABEL_CLASS}>
                {field.label}
              </Label>
              {counter}
            </div>
            {control}
            {field.hint === null ? null : <p className="text-xs text-text3">{field.hint}</p>}
          </>
        )}
        {error === undefined ? null : (
          <p data-slot="youtube-copy-error" className="text-xs text-bad">
            {error}
          </p>
        )}
      </div>
    );
  };

  const groups: readonly YoutubeCopyGroup[] = ['copy', 'targeting', 'performance', 'client'];

  return (
    <aside
      data-slot="youtube-copy-panel"
      aria-label={creating ? 'New YouTube copy' : `YouTube copy: ${item.title}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New copy' : 'YouTube Copywriting'}
          </p>
          <h2
            className="truncate font-mono text-lg font-semibold text-text"
            data-slot="youtube-copy-panel-title"
          >
            {title}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="youtube-copy-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="syncLinks" value="true" />

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3 data-slot="youtube-copy-group-heading" className={HEADING_CLASS}>
                {YOUTUBE_COPY_HEADINGS.copy}
              </h3>
              <div className="flex flex-col gap-4">
                <div
                  className="flex flex-col gap-1.5"
                  data-slot="youtube-copy-field"
                  data-field="copyNumber"
                >
                  <span id="youtube-copy-field-copyNumber-label" className={LABEL_CLASS}>
                    Copy #
                  </span>
                  <p
                    id="youtube-copy-field-copyNumber"
                    aria-labelledby="youtube-copy-field-copyNumber-label"
                    className="font-mono text-sm text-text"
                  >
                    {title}
                  </p>
                  <p className="text-xs text-text3">
                    Auto-generated: the next free number is assigned on save. Never typed.
                  </p>
                </div>
                {YOUTUBE_COPY_FIELDS.filter((field) => field.group === 'copy').map(renderField)}
              </div>
            </section>

            {groups.slice(1).map((group) => (
              <section key={group} className="flex flex-col gap-3">
                <h3 data-slot="youtube-copy-group-heading" className={HEADING_CLASS}>
                  {YOUTUBE_COPY_HEADINGS[group]}
                </h3>
                <div className="flex flex-col gap-4">
                  {YOUTUBE_COPY_FIELDS.filter((field) => field.group === group).map(renderField)}
                </div>
              </section>
            ))}

            <section className="flex flex-col gap-4">
              <h3 data-slot="youtube-copy-group-heading" className={HEADING_CLASS}>
                {YOUTUBE_COPY_HEADINGS.links}
              </h3>
              <ChipPicker
                slot="collection-picker"
                name="collectionIds"
                label="Collections"
                options={collections.map((option) => ({ id: option.id, label: option.name }))}
                selected={draft.collectionIds}
                demo={demo}
                empty="No collections in this brand yet."
                onToggle={(id) => {
                  toggleId('collectionIds', id);
                }}
              />
              {creating ? null : (
                <Lookup
                  name="collection-url"
                  label="Collection URL"
                  values={item.linkedCollections.map((link) => link.url ?? EM_DASH)}
                />
              )}
              <ChipPicker
                slot="product-picker"
                name="productIds"
                label="Product"
                options={products.map((option) => ({ id: option.id, label: option.name }))}
                selected={draft.productIds}
                demo={demo}
                empty="No products in this brand yet."
                onToggle={(id) => {
                  toggleId('productIds', id);
                }}
              />
              {creating ? null : (
                <Lookup
                  name="product-link"
                  label="Link (from Product)"
                  values={item.linkedProducts.map((link) => link.link)}
                />
              )}
              <ChipPicker
                slot="campaign-picker"
                name="campaignOfferIds"
                label="Campaign Code"
                options={campaigns.map((option) => ({
                  id: option.id,
                  label: campaignChipLabel(option),
                }))}
                selected={draft.campaignOfferIds}
                demo={demo}
                empty="No campaigns in this brand yet."
                onToggle={(id) => {
                  toggleId('campaignOfferIds', id);
                }}
              />
              {creating ? null : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Lookup
                    name="campaign"
                    label="Campaign (from Campaign)"
                    values={item.linkedCampaigns.map((link) => link.name)}
                  />
                  <Lookup
                    name="campaign-code"
                    label="Code (from Campaign)"
                    values={item.linkedCampaigns.map((link) => link.code ?? EM_DASH)}
                  />
                  <Lookup
                    name="offer"
                    label="Offer"
                    values={item.linkedCampaigns.map((link) => link.offer ?? EM_DASH)}
                  />
                </div>
              )}
              <ChipPicker
                slot="copy-type-picker"
                name="copyTypeIds"
                label="Copy Type"
                options={copyTypes.map((option) => ({ id: option.id, label: option.name }))}
                selected={draft.copyTypeIds}
                demo={demo}
                empty="No copy types in this brand yet."
                onToggle={(id) => {
                  toggleId('copyTypeIds', id);
                }}
              />
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="youtube-copy-demo-note">
              {DEMO_FOOTER_NOTICE}
            </p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <DisabledWrite active={demo}>
            <Button
              type="submit"
              size="sm"
              disabled={demo || pending}
              data-slot="youtube-copy-save"
              className={disabledWriteClassName}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DisabledWrite>
        </footer>
      </form>
    </aside>
  );
}
