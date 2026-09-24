'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  StatusChip,
} from '@tas/ui';

import { onboardPath } from '@/lib/routes';

import type { BrandSummary } from '@/lib/data-source';

import { selectBrandAction } from './brand-actions';
import { Icon } from './icons';

export interface BrandSwitcherProps {
  /** Every brand the actor may switch to, in query order. Empty when the workspace has none yet. */
  brands: readonly BrandSummary[];
  /** The brand the workspace is scoped to, or null when there is none. Always one of `brands`. */
  activeId: string | null;
  /** Demo mode has exactly one brand and no session to persist a choice against. */
  readOnly: boolean;
}

/**
 * The brand a page is scoped to, and — when the agency has more than one — the chooser that switches
 * between them. Selecting a brand calls `selectBrandAction`, which validates the id against the
 * actor's agency and stores it; the whole `/app` layout then re-renders scoped to the new brand, so
 * this menu drives the entire workspace, not just its own label.
 *
 * The status is a `StatusChip` from `@tas/ui`, never a re-implemented pill (CLAUDE.md, "UI
 * governance" 3). In demo mode there is no session to hold a selection, so the list is shown but the
 * rows are inert.
 */
export function BrandSwitcher({ brands, activeId, readOnly }: BrandSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const active = brands.find((brand) => brand.id === activeId) ?? null;
  const empty = active === null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-slot="brand-switcher"
          className="max-w-[46vw] gap-2 border-line bg-surface2 text-text2 hover:text-text sm:max-w-xs"
        >
          <Icon name="building" className="size-4 shrink-0 text-text3" />
          <span className="truncate">{empty ? 'No brands yet' : active.name}</span>
          {empty ? null : (
            <StatusChip tone="ok" label={active.status} className="hidden sm:inline-flex" />
          )}
          {isPending ? (
            <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-text3 border-t-transparent" />
          ) : (
            <Icon name="chevron" className="size-3.5 shrink-0 text-text3" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-text3">
          {brands.length > 1 ? 'Switch brand' : 'Brand'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {empty ? (
          <DropdownMenuItem disabled className="text-text3">
            No brands yet
          </DropdownMenuItem>
        ) : (
          brands.map((brand) => {
            const isActive = brand.id === active.id;
            const row = (
              <span className="flex w-full items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {isActive ? (
                    <Icon name="check" className="size-4 shrink-0 text-accent" />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{brand.name}</span>
                </span>
                <StatusChip tone="ok" label={brand.status} />
              </span>
            );

            // Demo mode, the active brand, or a single-brand agency: nothing to switch to, so the
            // row is a plain, inert item with no handler.
            if (readOnly || isActive) {
              return (
                <DropdownMenuItem
                  key={brand.id}
                  disabled={readOnly}
                  aria-current={isActive ? 'true' : undefined}
                  className="data-[disabled]:opacity-100"
                >
                  {row}
                </DropdownMenuItem>
              );
            }

            // The switch runs from Radix's `onSelect`, NEVER from a `<form>` inside the item. Selecting
            // an item closes the menu, which unmounts its content before the browser performs a
            // submit button's default action, so a form here never submits: the browser logs "Form
            // submission canceled because the form is not connected" and the server action is never
            // called. That was the brand-switching bug; reproduced and confirmed against a real
            // Next build. `brand-switcher.test.ts` keeps a form from coming back.
            return (
              <DropdownMenuItem
                key={brand.id}
                disabled={isPending}
                onSelect={() => {
                  startTransition(() => selectBrandAction(brand.id));
                }}
              >
                {row}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={onboardPath} className="flex items-center gap-2">
            <Icon name="building" className="size-4 shrink-0" />
            <span>Create a brand</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
