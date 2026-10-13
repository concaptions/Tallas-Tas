import { useId, type ReactNode } from 'react';

import { TriangleAlert } from '../icons';
import { cn } from '../lib/cn';

/** Why a write control is inert when the app runs without an identity provider. */
export const DEMO_WRITE_HINT = 'Sign in required to save changes';

/**
 * The disabled look for a write action. Without it a disabled primary button keeps its accent
 * fill and reads as clickable; this puts it on a muted surface with a `--text3` label instead.
 * Pass it to a `Button`'s `className` alongside `disabled`. `disabled:bg-none` clears the primary
 * variant's gradient IMAGE, which `disabled:bg-surface3` alone cannot (board 1's gated Submit to
 * Client is a muted surface, not a faded gradient).
 */
export const disabledWriteClassName =
  'disabled:border-line disabled:bg-surface3 disabled:bg-none disabled:text-text3 disabled:opacity-100 disabled:shadow-none';

export interface DisabledWriteProps {
  /** Tooltip text; the default explains demo mode. */
  hint?: string;
  /**
   * The hint's leading phrase to set in bold inside the popover (board 1 bolds the missing tick's
   * name: "Video Editor QA must be ticked…"). Only a LEADING match is emphasised; anything else
   * renders the hint unchanged, so a caller can pass it unconditionally.
   */
  hintEmphasis?: string;
  /** A warn-toned heading row above the hint in the popover (board 1: "QA checklist incomplete"). */
  heading?: string;
  /**
   * Renders the styled, CSS-only popover under the control on hover and keyboard focus (B1.V6,
   * ruling 8). Off by default, so no existing caller changes: the native `title` and `aria-label`
   * stay in both modes.
   */
  popover?: boolean;
  /** Set false to render the child untouched, so a caller can keep one code path. */
  active?: boolean;
  children: ReactNode;
  className?: string;
}

/** The hint with its leading phrase in bold, or the hint as it came. */
function emphasised(hint: string, phrase: string | undefined): ReactNode {
  if (phrase === undefined || phrase === '' || !hint.startsWith(phrase)) {
    return hint;
  }
  return (
    <>
      <b className="font-semibold text-text">{phrase}</b>
      {hint.slice(phrase.length)}
    </>
  );
}

/**
 * Wraps a disabled control so it can still explain itself. A disabled `button` receives no pointer
 * events, so its own `title` never opens: the tooltip has to live on an enabled element around it.
 *
 * With `popover`, the wrapper also becomes focusable and draws board 1's gate tooltip beneath the
 * control — `--surface4` on a `--line2` border, a 6px caret, the heading in `--warn` with a warning
 * triangle, the body in `--text2` — visible while the wrapper is hovered or holds focus. No
 * dependency: `group-hover` / `group-focus-within` on the wrapper do the showing, and the native
 * `title` keeps the OS tooltip for parity.
 */
export function DisabledWrite({
  hint = DEMO_WRITE_HINT,
  hintEmphasis,
  heading,
  popover = false,
  active = true,
  children,
  className,
}: DisabledWriteProps) {
  const tooltipId = useId();

  if (!active) {
    return <>{children}</>;
  }

  return (
    <span
      data-slot="disabled-write"
      title={hint}
      aria-label={hint}
      aria-describedby={popover ? tooltipId : undefined}
      tabIndex={popover ? 0 : undefined}
      className={cn('inline-flex cursor-not-allowed', popover && 'group/hint relative', className)}
    >
      {children}
      {popover ? (
        <span
          id={tooltipId}
          role="tooltip"
          data-slot="disabled-write-popover"
          className="pointer-events-none invisible absolute top-full right-0 z-30 mt-2 w-[252px] rounded-card border border-line2 bg-surface4 px-2.5 py-2 text-left font-normal tracking-normal whitespace-normal normal-case shadow-float group-hover/hint:visible group-focus-within/hint:visible after:absolute after:right-11 after:bottom-full after:border-[6px] after:border-transparent after:border-b-line2"
        >
          {heading === undefined ? null : (
            <span className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-warn">
              <TriangleAlert aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.2} />
              {heading}
            </span>
          )}
          <span className="block text-[11px] leading-relaxed text-text2">
            {emphasised(hint, hintEmphasis)}
          </span>
        </span>
      ) : null}
    </span>
  );
}
