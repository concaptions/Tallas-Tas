'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AwarenessStage, PersonaListRow } from '@tas/db';
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
  Textarea,
} from '@tas/ui';

import { createPersonaAction, updatePersonaAction, type PersonaActionResult } from './actions';
import {
  AWARENESS_OPTIONS,
  NOT_SET,
  personaPanelFrom,
  type PersonaFieldName,
  type PersonaPanelField,
} from './fields';
import type { ResolvedColumnView } from '@/components/views/resolved-columns';
import { LinkField } from '@/components/links/link-field';
import { RecordSheet, type RecordSheetNavigation } from '@/components/views';
import { productsPath } from '@/lib/routes';

/** The `?persona=` value that means "the panel is open on a persona that does not exist yet". */
export const NEW_PERSONA = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/**
 * The heading over the resolved fields. Grouping is NOT a concept the resolver has — a column has a
 * label and an order and nothing else — so the panel shows one section of the brand's stored fields
 * and one section per link column, rather than inventing groups the configuration cannot express.
 */
const FIELDS_HEADING = 'Persona';

/** One angle of the brand the Angles field can pick from. */
export interface AngleLinkOption {
  readonly id: string;
  readonly name: string;
}

/** One product of the brand the Product picker offers (Flow completion 2026-10-16). */
export interface ProductLinkOption {
  readonly id: string;
  readonly name: string;
}

/** The sentinel the single-select writes for "no product linked". */
export const NO_PRODUCT_VALUE = '__no-product__';
export const NO_PRODUCT_LABEL = 'No product linked';

interface PersonaPanelProps {
  readonly persona: PersonaListRow | null;
  /** The brand's Personas columns from `resolveColumns`: which fields this panel shows, and their
   * labels. The same data the grid is built from, so a header and its field label cannot drift. */
  readonly columns: readonly ResolvedColumnView[];
  /** The brand's angles, for the two-way Angles field (`angle_personas`). */
  readonly angles?: readonly AngleLinkOption[];
  /** The angle ids currently linked to the persona, from the same junction the angle panel writes. */
  readonly angleIds?: readonly string[];
  /**
   * The brand's products, for the Product single-select (Flow completion 2026-10-16). Empty on a
   * brand with no products; the "No product linked" chip remains the only option in that case.
   */
  readonly products?: readonly ProductLinkOption[];
  readonly demo: boolean;
  /** The sheet's prev/next walk, from `recordNavigation` over the grid's `onScreenOrder`. */
  readonly nav?: RecordSheetNavigation;
  readonly onNavigate?: (id: string) => void;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one field, as the form's default. */
function valueOf(persona: PersonaListRow | null, name: PersonaFieldName): string {
  if (persona === null) {
    return '';
  }
  const value = persona[name];
  return typeof value === 'string' ? value : '';
}

/**
 * The right-side persona panel. The outer shell is now the shared `RecordSheet` (Ticket 9): header
 * with the record counter and the prev/next buttons that walk the grid's on-screen order, keyboard
 * ArrowLeft/ArrowRight for the same walk, and the sheet's built-in close button and overlay dismiss.
 *
 * WHICH FIELDS IT SHOWS IS CONFIGURATION, not code: `personaPanelFrom` turns the brand's resolved
 * columns into the form's fields, in the resolver's order and under the resolver's labels, and maps
 * each `column_key` to the camelCase field the Server Action validates. The action's schema stays
 * wider than any brand's form on purpose (every column, `.nullish()`), so a brand whose resolver
 * returns more columns can save them and an absent field is left alone by `updatePersona`'s patch.
 */
export function PersonaPanel({
  persona,
  columns,
  angles = [],
  angleIds = [],
  products = [],
  demo,
  nav,
  onNavigate,
  onClose,
  onSaved,
}: PersonaPanelProps) {
  const creating = persona === null;
  const action = creating ? createPersonaAction : updatePersonaAction;
  const [state, formAction, pending] = useActionState<PersonaActionResult | null, FormData>(
    action,
    null,
  );
  const [stage, setStage] = useState<AwarenessStage | ''>(persona?.stageOfAwareness ?? '');
  const [productId, setProductId] = useState<string | null>(persona?.productId ?? null);
  const layout = useMemo(() => personaPanelFrom(columns), [columns]);

  useEffect(() => {
    if (state !== null && state.ok) {
      onSaved(state.id);
    }
  }, [state, onSaved]);

  const fieldError = (name: PersonaFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: PersonaPanelField) => {
    const id = `persona-field-${field.name}`;
    const error = fieldError(field.name);
    const shared = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      'aria-required': field.required ? true : undefined,
      placeholder: NOT_SET,
      defaultValue: valueOf(persona, field.name),
    };

    return (
      <div key={field.columnKey} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
        </Label>
        {field.kind === 'stage' ? (
          <>
            <Select
              value={stage === '' ? undefined : stage}
              onValueChange={(next) => {
                setStage(next as AwarenessStage);
              }}
              disabled={demo}
            >
              <SelectTrigger id={id} className="w-full" aria-label={field.label}>
                <SelectValue placeholder={NOT_SET} />
              </SelectTrigger>
              <SelectContent>
                {AWARENESS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name={field.name} value={stage} />
          </>
        ) : field.kind === 'input' ? (
          <Input {...shared} />
        ) : (
          <Textarea {...shared} className="min-h-20 leading-relaxed" />
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  const title = creating ? 'New persona' : persona.name;

  return (
    <RecordSheet
      open
      onClose={onClose}
      nav={nav}
      onNavigate={onNavigate}
      title={title}
      titleSlot="persona-panel-title"
      width="form"
      description={creating ? 'New persona' : `Persona: ${persona.name}`}
    >
      <div data-slot="persona-panel" className="flex min-h-0 flex-1 flex-col">
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          {creating ? null : <input type="hidden" name="id" value={persona.id} />}

          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="persona-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                {FIELDS_HEADING}
              </h3>
              <div className="flex flex-col gap-4">{layout.fields.map(renderField)}</div>
            </section>

            {/*
             * Linked Product (Flow completion 2026-10-16): a single-select over the brand's
             * products that writes `personas.product_id` directly through `updatePersonaAction`
             * (the FK is on this row, so no cross-table setter is needed). The chip under the
             * select opens the product's panel. Shown unconditionally — Product is not a
             * resolver-gated column; it is a core cross-reference the strategist wants on every
             * persona.
             */}
            <section className="flex flex-col gap-3">
              <h3
                data-slot="persona-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Linked Product
              </h3>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="persona-field-productId"
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  Linked Product
                </Label>
                <Select
                  value={productId ?? NO_PRODUCT_VALUE}
                  onValueChange={(next) => {
                    setProductId(next === NO_PRODUCT_VALUE ? null : next);
                  }}
                  disabled={demo}
                >
                  <SelectTrigger
                    id="persona-field-productId"
                    className="w-full"
                    aria-label="Linked Product"
                    data-slot="persona-product-select"
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
                  data-slot="persona-product-value"
                />
                {productId === null ? null : (
                  <Link
                    href={`${productsPath}?product=${encodeURIComponent(productId)}`}
                    data-slot="persona-product-chip"
                    data-product-id={productId}
                    className="inline-flex self-start rounded-input border border-line bg-surface2 px-1.5 py-0.5 text-[11px] text-text2 hover:border-accent-line hover:text-accent"
                  >
                    Open {products.find((product) => product.id === productId)?.name ?? productId}
                  </Link>
                )}
                {fieldError('productId') === undefined ? null : (
                  <p className="text-xs text-bad">{fieldError('productId')}</p>
                )}
              </div>
            </section>

            {creating || layout.anglesLabel === null ? null : (
              <section className="flex flex-col gap-3">
                <h3
                  data-slot="persona-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {layout.anglesLabel}
                </h3>
                {/* The same LinkField the angle panel uses for its personas: one `angle_personas`
                    row per pair, written on the spot, so the angle shows this persona next render. */}
                <LinkField
                  link="persona-angles"
                  sourceId={persona.id}
                  options={angles}
                  selectedIds={angleIds}
                  label="Linked angles"
                  demo={demo}
                  slot="persona-angles"
                  empty="No angle is written from this persona yet. Link one here or from the angle's panel."
                />
              </section>
            )}

            {/* A configured column this panel has no editor for is stated rather than dropped. */}
            {layout.missing.length > 0 ? (
              <p data-slot="persona-missing-fields" className="text-xs text-text3">
                Configured for this brand but not editable here:{' '}
                <span className="font-mono">{layout.missing.join(', ')}</span>. Add an entry to
                PERSONA_COLUMN_EDITORS in fields.ts.
              </p>
            ) : null}
          </div>

          <footer className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
            {demo ? (
              <p className="mr-auto text-xs text-text3" data-slot="persona-demo-note">
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
                data-slot="persona-save"
                className={disabledWriteClassName}
              >
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </DisabledWrite>
          </footer>
        </form>
      </div>
    </RecordSheet>
  );
}
