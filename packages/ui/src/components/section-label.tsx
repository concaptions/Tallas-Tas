import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The boards' `.slab` (B2.V10, B4.V5): a 10px / 600 / `.09em` uppercase heading in `--text4` with a
 * 1px `--line` rule filling the rest of the row. One recipe for every section heading — Focus Mode,
 * the Sheet sidebar, the QA checklist, the two-track bars, the Activity card — where the product
 * had three. Exported as a class string too, for a heading that already is some other element.
 * Tailwind 4 gives the `after:` pseudo-element its empty `content` automatically.
 */
const sectionLabelBaseClassName =
  'flex items-center gap-2 text-[10px] font-semibold tracking-[.09em] uppercase text-text4';
const sectionLabelRuleClassName = 'after:h-px after:flex-1 after:bg-line';
export const sectionLabelClassName = `${sectionLabelBaseClassName} ${sectionLabelRuleClassName}`;

export interface SectionLabelProps extends HTMLAttributes<HTMLElement> {
  /** The element: `h3` by default, `h2` for a page-level section, `p` where it is not a heading. */
  as?: 'h2' | 'h3' | 'p';
  /**
   * The trailing rule. Board 2's sections draw it; board 1's Focus Mode slabs do not, so Focus Mode
   * passes `false` and keeps the same type recipe.
   */
  rule?: boolean;
  children: ReactNode;
}

export function SectionLabel({
  as: Tag = 'h3',
  rule = true,
  className,
  children,
  ...props
}: SectionLabelProps) {
  return (
    <Tag
      data-slot="section-label"
      data-rule={rule ? undefined : 'false'}
      className={cn(sectionLabelBaseClassName, rule && sectionLabelRuleClassName, className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
