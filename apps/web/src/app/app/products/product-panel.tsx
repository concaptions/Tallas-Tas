'use client';

import { useActionState, useEffect } from 'react';
import type { ProductListRow } from '@tas/db';
import { Button, disabledWriteClassName, DisabledWrite, Input, Label, StatusChip } from '@tas/ui';

import { createProductAction, updateProductAction, type ProductActionResult } from './actions';
import {
  conceptCountLabel,
  conceptCountTone,
  NOT_SET,
  PRODUCT_FIELDS,
  type ProductField,
  type ProductFieldName,
} from './fields';

/** The `?product=` value that means "the panel is open on a product that does not exist yet". */
export const NEW_PRODUCT = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

interface ProductPanelProps {
  readonly product: ProductListRow | null;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
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
 * All three PRD §5.1 fields are editable in place; the form posts to the Server Actions. The linked
 * concepts count is read-only — it is derived from `concepts.angleId` → `angles.productId`, so it is
 * never something a strategist types. In demo mode the fields are read-only and the footer says so
 * instead of saving.
 */
export function ProductPanel({ product, demo, onClose, onSaved }: ProductPanelProps) {
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
