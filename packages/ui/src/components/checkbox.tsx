'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { Check, Minus } from '../icons';
import { cn } from '../lib/cn';

/**
 * A styled NATIVE checkbox (Oct 12 UI overhaul, B2.V15 / B1.V7 / B3.V3, ruling 7).
 *
 * The boards draw a 16px box with a 4px radius, a `--line2` border on `--surface2`, an `--accent`
 * fill with a white tick when checked, a white bar when indeterminate and a dashed, transparent
 * "N/A" box for the QA tick that does not apply. A browser-painted `<input type="checkbox">` can
 * show none of that: with `appearance: auto` the OS control ignores border, radius and fill, which
 * is why the dashed N/A box never appeared in production. `appearance-none` hands the painting to
 * the classes while the element stays a real checkbox — keyboard toggling, form submission,
 * `:checked` / `:indeterminate`, Playwright's `.check()` and the screen-reader role all come from
 * the browser. Zero dependencies: `@radix-ui/react-checkbox` is not installed and is not needed.
 *
 * Every native input prop passes through to the `<input>` (`id`, `name`, `checked`, `onChange`,
 * `aria-label`, `data-slot`, `data-*`, `ref`), so the `row-select` / `select-all` locators and the
 * hidden-input form contract survive the swap. `className` lands on the wrapper, which is the box
 * a caller positions; the input's look is the primitive's.
 */
const checkboxVariants = cva(
  'peer size-4 shrink-0 cursor-pointer appearance-none rounded-sm border bg-surface2 outline-none transition-colors checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent focus-visible:ring-[3px] focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-line2',
        /** The struck-through QA tick that does not apply to this creative's track. */
        na: 'border-dashed border-line bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const glyphClassName =
  'pointer-events-none absolute inset-0 m-auto size-2.5 text-on-accent peer-disabled:opacity-50';

export type CheckboxProps = Omit<React.ComponentProps<'input'>, 'type'> &
  VariantProps<typeof checkboxVariants> & {
    /**
     * The header checkbox's "some rows selected" state. Set on the DOM property (there is no
     * attribute), so the browser paints `:indeterminate` and a screen reader announces "mixed".
     */
    indeterminate?: boolean;
    /** Rendered on the input; defaults to `some` while indeterminate so a spec can read the state. */
    'data-state'?: string;
  };

function Checkbox({
  className,
  variant,
  indeterminate = false,
  ref,
  'data-state': dataState,
  ...props
}: CheckboxProps) {
  // One callback ref serves both the caller's ref and the indeterminate property. Its identity
  // follows `indeterminate`, so React re-attaches it — and re-applies the property — on change.
  const attach = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (node !== null) {
        node.indeterminate = indeterminate;
      }
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref !== null && ref !== undefined) {
        ref.current = node;
      }
    },
    [indeterminate, ref],
  );

  return (
    <span
      data-slot="checkbox"
      data-variant={variant ?? 'default'}
      className={cn('relative inline-flex size-4 shrink-0', className)}
    >
      <input
        type="checkbox"
        ref={attach}
        data-slot="checkbox-input"
        data-state={dataState ?? (indeterminate ? 'some' : undefined)}
        // Through `cn`: the N/A variant's `bg-transparent` / `border-line` must REPLACE the
        // base `bg-surface2` / `border-line2`, which cva alone would leave side by side.
        className={cn(checkboxVariants({ variant }))}
        {...props}
      />
      {indeterminate ? (
        <Minus aria-hidden="true" className={glyphClassName} strokeWidth={3} />
      ) : (
        <Check
          aria-hidden="true"
          className={cn(glyphClassName, 'hidden peer-checked:block')}
          strokeWidth={3.5}
        />
      )}
    </span>
  );
}

export { Checkbox, checkboxVariants };
