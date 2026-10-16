'use client';

import { useState } from 'react';
import { BoldBanner, BoldEmptyState, BoldToast, Button } from '@tas/ui';
import { Globe } from '@tas/ui/icons';

import type { ReactNode } from 'react';

/**
 * The Bold feedback primitives (redesign commit 3c, spec §3.11–§3.13), live under an explicit
 * `data-ui="bold"` wrapper. A client module: the toast is controlled, so the story owns the one
 * flag its surface will own.
 */
function BoldFrame({ children }: { children: ReactNode }) {
  return (
    <div data-ui="bold" className="flex flex-col gap-5 rounded-card bg-bg p-5">
      {children}
    </div>
  );
}

/** The gradient banner (§3.12) and the empty state (§3.13). */
export function BoldBannerEmptyStory() {
  return (
    <BoldFrame>
      <BoldBanner
        icon={<Globe aria-hidden="true" />}
        action={
          <Button size="sm" variant="secondary">
            Learn more
          </Button>
        }
      >
        Themes are a global library: edits here reach every brand.
      </BoldBanner>
      <BoldEmptyState
        title="No concepts yet"
        description="Create the first concept from an approved angle — the name is generated for you."
        action={<Button size="sm">New concept</Button>}
      />
    </BoldFrame>
  );
}

/** The 3.2s self-dismissing toast (§3.11). Fire it; it stays fixed top-right while it lives. */
export function BoldToastStory() {
  const [open, setOpen] = useState(false);
  return (
    <BoldFrame>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          Show toast
        </Button>
        <span className="text-xs text-text3">Dark indigo card, green check, 3.2s.</span>
      </div>
      <BoldToast
        open={open}
        onDismiss={() => {
          setOpen(false);
        }}
      >
        Creative saved
      </BoldToast>
    </BoldFrame>
  );
}
