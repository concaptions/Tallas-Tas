'use client';

import Link from 'next/link';

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

import { Icon } from './icons';

export interface BrandSwitcherProps {
  /** The working brand, or `null` when the workspace has none yet. */
  brand: BrandSummary | null;
  /** Demo mode has exactly one brand and no way to create another. */
  readOnly: boolean;
}

/**
 * The brand a page is scoped to. One brand exists in V0, so the menu is a statement of scope rather
 * than a chooser; per-membership brands land with the switcher ticket. The status is a `StatusChip`
 * from `@tas/ui`, never a re-implemented pill (CLAUDE.md, "UI governance" 3).
 */
export function BrandSwitcher({ brand, readOnly }: BrandSwitcherProps) {
  const empty = brand === null;

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
          <span className="truncate">{empty ? 'No brands yet' : brand.name}</span>
          {empty ? null : (
            <StatusChip tone="ok" label={brand.status} className="hidden sm:inline-flex" />
          )}
          <Icon name="chevron" className="size-3.5 shrink-0 text-text3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-text3">Brand</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {empty ? (
          <DropdownMenuItem disabled className="text-text3">
            No brands yet
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={readOnly}
            className="flex items-center justify-between gap-2 data-[disabled]:opacity-100"
          >
            <span className="truncate">{brand.name}</span>
            <StatusChip tone="ok" label={brand.status} />
          </DropdownMenuItem>
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
