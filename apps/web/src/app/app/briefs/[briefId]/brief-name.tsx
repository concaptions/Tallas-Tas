'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@tas/ui';

import { COPIED_LABEL, COPY_LABEL, NAME_GENERATED_NOTE } from '../fields';

interface BriefNameProps {
  /** The §7 name, already built by `creativeName` upstream. This component never assembles one. */
  readonly name: string;
}

/**
 * The generated creative name (PRD §7, ticket criterion 4).
 *
 * A HEADING, not a field. The name is not an input that happens to be disabled: there is no input
 * holding it anywhere on the page, hidden or otherwise, and the Server Action re-derives it from
 * the concept row it reads itself rather than from anything the form claims. `font-mono`, because
 * auto-generated system output always is (design handoff, "Typography and shape").
 *
 * The copy button confirms IN PLACE — the label becomes "Copied" for two seconds and returns — so
 * the confirmation is attached to the thing that was copied instead of floating in a corner. The
 * timer is cleared on unmount, and a clipboard that refuses (an insecure origin, a browser that
 * withholds permission) leaves the label alone rather than lying about what happened.
 */
export function BriefName({ name }: BriefNameProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  /**
   * The async Clipboard API, and nothing else: `document.execCommand('copy')` is the other way and
   * it is deprecated, so the lint rules refuse it. A browser that withholds clipboard permission
   * therefore leaves the label at "Copy", which is the honest report — the name is selectable text
   * in the heading above, so there is still a way to take it.
   */
  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(name)
      .then(() => {
        setCopied(true);
      })
      .catch(() => {
        setCopied(false);
      });
  }, [name]);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative name</p>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1
          data-slot="brief-name"
          className="min-w-0 font-mono text-xl leading-snug break-words text-text sm:text-2xl"
        >
          {name}
        </h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copy}
          aria-label={`${COPY_LABEL} creative name`}
          data-slot="brief-name-copy"
        >
          {copied ? COPIED_LABEL : COPY_LABEL}
        </Button>
      </div>
      <p data-slot="brief-name-note" className="text-xs text-text3">
        {NAME_GENERATED_NOTE}
      </p>
    </div>
  );
}
