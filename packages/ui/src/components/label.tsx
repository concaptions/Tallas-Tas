'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '../lib/cn';

export interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
  /**
   * Whether the field this labels has to be filled before the form can be saved.
   *
   * THREE STATES, not two. `undefined` — the default, and what every existing caller passes —
   * renders no marker at all, so adding this prop moves nothing on any panel. `true` renders
   * "Required", `false` renders "Optional". Saying nothing and saying "Optional" are different
   * claims: a form that marks only its required fields leaves the reader guessing about the rest,
   * and a form that has not been audited at all should not imply that everything unmarked is safe
   * to skip. A page opts in field by field.
   *
   * It must be driven by whatever the SAVE PATH enforces — on Concepts that is
   * `REQUIRED_CONCEPT_FIELDS` from `@tas/domain/concepts`, the same set `validateConceptDraft`
   * rejects a draft for. A marker that disagrees with the server is worse than no marker.
   */
  readonly required?: boolean;
}

/**
 * The word, not an asterisk.
 *
 * An asterisk needs a legend somewhere on the page explaining it, and the legend is the first thing
 * a form loses when it is split across panels — which is where every one of these labels lives. The
 * word carries its own meaning, is read out as part of the label by a screen reader, and tells the
 * two states apart by tone rather than by size.
 *
 * NO `aria-required` HERE, deliberately. `<label>` has no ARIA role that supports it, so the
 * attribute would be ignored by assistive technology and flagged by an audit as an attribute not
 * allowed on the element. `aria-required` belongs on the CONTROL, which is where the Concept form
 * and the Persona panel set it; what this adds is the visible statement a sighted reader needs, and
 * it reaches a screen reader anyway by being inside the label.
 */
function Requirement({ required }: { readonly required: boolean }) {
  return (
    <span
      data-slot="label-requirement"
      data-required={required}
      className={cn(
        'text-[10px] leading-none font-normal tracking-wide uppercase',
        required ? 'text-accent' : 'text-text4',
      )}
    >
      {required ? 'Required' : 'Optional'}
    </span>
  );
}

function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium text-text2 select-none',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      {required === undefined ? null : <Requirement required={required} />}
    </LabelPrimitive.Root>
  );
}

export { Label };
