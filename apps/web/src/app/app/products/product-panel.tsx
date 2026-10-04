'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import type { ProductListRow } from '@tas/db';
import { Button, disabledWriteClassName, DisabledWrite, Input, Label, StatusChip } from '@tas/ui';

import { LinkField, type LinkOption } from '@/components/links/link-field';

import { createProductAction, updateProductAction, type ProductActionResult } from './actions';
import {
  conceptCountLabel,
  conceptCountTone,
  NOT_SET,
  PRODUCT_FIELDS,
  type LinkedRecord,
  type ProductField,
  type ProductFieldName,
} from './fields';

/** The `?product=` value that means "the panel is open on a product that does not exist yet". */
export const NEW_PRODUCT = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** What the four record-link lists say when nothing links to the product yet. */
export const NO_EMAIL_CAMPAIGNS_NOTE =
  'No email campaign promotes this product yet. Link one from the campaign’s panel.';
export const NO_YOUTUBE_COPY_NOTE =
  'No YouTube copy is written for this product yet. Link one from the copy’s panel.';
/**
 * A brief's product is `creative_briefs.product_id`, which no form sets yet (the brief detail
 * reads it, the import writes it), so this sentence names no panel to go to.
 */
export const NO_CREATIVE_DESIGNS_NOTE = 'No creative design is briefed on this product yet.';
export const NO_CREATORS_NOTE =
  'No creator is booked for this product yet. Link one here or from the creator’s panel.';

interface ProductPanelProps {
  readonly product: ProductListRow | null;
  /** The email campaigns promoting the product, built on the server; empty while creating. */
  readonly emailCampaigns: readonly LinkedRecord[];
  /** The YouTube copy written for the product, built the same way. */
  readonly youtubeCopy: readonly LinkedRecord[];
  /** The briefs whose `product_id` is this product (`creative_briefs.product_id`), built the same way. */
  readonly creativeDesigns: readonly LinkedRecord[];
  /** The creators booked for the product through `creator_products`, built the same way. */
  readonly creators: readonly LinkedRecord[];
  /**
   * Every creator of the brand, as the Creators link field's options — each carrying its own route
   * and status chip, so the field reads exactly as the read-only list it replaced.
   */
  readonly creatorOptions?: readonly LinkOption[];
  /** The brand's angles and the ids linked to this product, for the two-way Linked angles field. */
  readonly angleOptions?: readonly { readonly id: string; readonly name: string }[];
  readonly angleIds?: readonly string[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

interface LinkedRecordListProps {
  readonly records: readonly LinkedRecord[];
  readonly empty: string;
  /** The `data-slot` of the list, and the one each row carries. */
  readonly slot: string;
  readonly rowSlot: string;
  /** True when every label is generated system output, which always renders in `font-mono`. */
  readonly mono?: boolean;
}

/**
 * One read-only list of records another module links to this product: each row is the record's
 * label (a link to it where it lives) beside its status chip. Nothing here is a control — these
 * links are edited from the other end, and the empty sentence says where.
 */
function LinkedRecordList({ records, empty, slot, rowSlot, mono = false }: LinkedRecordListProps) {
  if (records.length === 0) {
    return (
      <div data-slot={slot} className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text3">{empty}</span>
      </div>
    );
  }

  const labelClassName = `${mono ? 'font-mono ' : ''}text-sm text-text underline-offset-2 hover:underline`;

  return (
    <ul data-slot={slot} className="flex flex-col gap-1.5">
      {records.map((record) => (
        <li
          key={record.id}
          data-slot={rowSlot}
          data-record-id={record.id}
          className="flex flex-wrap items-center gap-2"
        >
          {record.href === undefined ? (
            <span className={labelClassName}>{record.label}</span>
          ) : (
            <Link href={record.href} className={labelClassName}>
              {record.label}
            </Link>
          )}
          {record.chip === undefined ? null : (
            <StatusChip tone={record.chip.tone} label={record.chip.label} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** The stored value of one field, as the form's default. A null collection link is an empty input. */
function valueOf(product: ProductListRow | null, name: ProductFieldName): string {
  if (product === null) {
    return '';
  }
  const value = product[name];
  return typeof value === 'string' ? value : '';
}

/**
 * The right-side product panel. Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the table beside it stays visible and clickable while this is open, which is the
 * point of a panel. It is fixed to the right edge at 60% of the viewport, full width under 900px,
 * and it closes on Escape or on its close button.
 *
 * All three PRD §5.1 fields are editable in place; the form posts to the Server Actions. Under
 * "Linked work", the two LINK-01 fields — Linked angles and Creators — are editable from here and
 * from the other record's panel, because one junction read from either side is the same rows. The
 * rest is read-only: the concepts count is derived from `concepts.angleId` → `angles.productId`,
 * the email campaigns and YouTube copy are the other side of junctions their own modules own, and
 * the creative designs are the briefs whose `product_id` is this product. In demo mode every field
 * is read-only and the footer says so instead of saving.
 */
export function ProductPanel({
  product,
  emailCampaigns,
  youtubeCopy,
  creativeDesigns,
  creators,
  creatorOptions = [],
  demo,
  onClose,
  onSaved,
  angleOptions = [],
  angleIds = [],
}: ProductPanelProps) {
  const creating = product === null;
  const action = creating ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState<ProductActionResult | null, FormData>(
    action,
    null,
  );

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

  const fieldError = (name: ProductFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: ProductField) => {
    const id = `product-field-${field.name}`;
    const error = fieldError(field.name);

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        <Input
          id={id}
          name={field.name}
          readOnly={demo}
          aria-invalid={error !== undefined}
          placeholder={demo ? NOT_SET : field.placeholder}
          defaultValue={valueOf(product, field.name)}
        />
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="product-panel"
      aria-label={creating ? 'New product' : `Product: ${product.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New product' : 'Product'}
          </p>
          <h2 className="truncate text-lg font-semibold text-text" data-slot="product-panel-title">
            {creating ? 'New product' : product.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="product-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={product.id} />}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="product-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Product
              </h3>
              <div className="flex flex-col gap-4">{PRODUCT_FIELDS.map(renderField)}</div>
            </section>

            {creating ? null : (
              <section className="flex flex-col gap-3">
                <h3
                  data-slot="product-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  Linked work
                </h3>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] tracking-wide text-text3 uppercase">
                    Linked concepts
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span data-slot="product-concept-count">
                      <StatusChip
                        tone={conceptCountTone(product.conceptCount)}
                        label={conceptCountLabel(product.conceptCount)}
                      />
                    </span>
                    <span className="text-xs text-text3">
                      Live concepts whose angle points at this product. Read-only.
                    </span>
                  </div>
                </div>
                {/* The same LinkField the angle panel mounts for its products (LINK-01). */}
                <LinkField
                  link="product-angles"
                  sourceId={product.id}
                  options={angleOptions}
                  selectedIds={angleIds}
                  label="Linked angles"
                  demo={demo}
                  slot="product-angles"
                  empty="No angle points at this product yet. Link one here or from the angle's panel."
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] tracking-wide text-text3 uppercase">
                    Email campaigns
                  </span>
                  <LinkedRecordList
                    records={emailCampaigns}
                    empty={NO_EMAIL_CAMPAIGNS_NOTE}
                    slot="product-email-campaigns"
                    rowSlot="product-email-campaign"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] tracking-wide text-text3 uppercase">
                    YouTube copy
                  </span>
                  <LinkedRecordList
                    records={youtubeCopy}
                    empty={NO_YOUTUBE_COPY_NOTE}
                    slot="product-youtube-copy"
                    rowSlot="product-youtube-copy-row"
                    mono
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] tracking-wide text-text3 uppercase">
                    Creative Designs
                  </span>
                  <LinkedRecordList
                    records={creativeDesigns}
                    empty={NO_CREATIVE_DESIGNS_NOTE}
                    slot="product-creative-designs"
                    rowSlot="product-creative-design"
                    mono
                  />
                </div>
                {/* The same LinkField the creator panel mounts for its products (LINK-01): one
                    `creator_products` row per pair. It was a read-only list here and a row of toggle
                    buttons there, so the junction had one editable end and a sentence pointing at
                    it. Each option keeps the creator's route and internal-status chip, which is what
                    the list showed. */}
                <LinkField
                  link="product-creators"
                  sourceId={product.id}
                  options={creatorOptions}
                  selectedIds={creators.map((creator) => creator.id)}
                  label="Creators"
                  demo={demo}
                  slot="product-creators"
                  empty={NO_CREATORS_NOTE}
                />
              </section>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="product-demo-note">
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
              data-slot="product-save"
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
