'use client';

import Link from 'next/link';
import { cn } from '@tas/ui';
import { Bell, Eye, Menu, Search } from '@tas/ui/icons';

import { clientPortalPath, notificationsPath } from '@/lib/routes';

import type { DemoActor } from '@/lib/demo-mode';

import { OrgSwitcher } from '../org-switcher';
import { ThemeToggle } from '../theme-toggle';
import { UserMenu } from '../user-menu';

/** The artifact's `.ibtn`: a 44px square control on the panel surface (spec §3.2, §1.3/§1.4). */
const IBTN =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-input border border-line bg-surface text-text2 shadow-(--shadow) transition-colors hover:text-text';

export interface BoldTopBarProps {
  readonly actor: DemoActor;
  readonly demo: boolean;
  /** Opens the ≤900px overlay rail. The hamburger is hidden at desktop width. */
  readonly onMenuOpen: () => void;
}

/**
 * The Bold top bar (redesign commit 2; spec §3.2): hamburger (≤900px), search pill with the
 * `Ctrl K` hint, then the ibtn cluster — theme toggle, bell, "Client view", account menu. Bold
 * scope only; the legacy `TopBar` is untouched and keeps serving every child brand.
 *
 * Legacy behaviours re-homed, none dropped: the product-name link to `/app` lives in the rail's
 * logo row, the brand switcher is the rail's brand card, `OrgSwitcher` / `ThemeToggle` /
 * `UserMenu` mount here unchanged (triggers restyled only), and the demo banner renders below
 * this bar from `BoldShell`.
 *
 * No command palette exists in the product yet, so the search pill is honest about it: a
 * disabled-styled control with a tooltip, not a dead button pretending to work. The pages
 * commits wire it.
 */
export function BoldTopBar({ actor, demo, onMenuOpen }: BoldTopBarProps) {
  return (
    <header
      data-slot="bold-top-bar"
      className="flex items-center gap-2.5 px-4 pt-[18px] sm:gap-3 sm:px-8"
    >
      <button
        type="button"
        onClick={onMenuOpen}
        aria-label="Open navigation"
        className={cn(IBTN, 'min-[901px]:hidden')}
      >
        <Menu aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
      </button>

      <button
        type="button"
        aria-disabled="true"
        title="Search coming with the pages commits"
        className="flex h-11 min-w-0 flex-1 cursor-default items-center gap-2.5 rounded-input border border-line bg-surface px-3.5 text-left shadow-(--shadow) sm:max-w-md"
      >
        <Search aria-hidden="true" strokeWidth={1.75} className="size-[18px] shrink-0 text-text3" />
        <span className="truncate text-sm text-text3">Search creatives, concepts, people…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-[6px] border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text3 sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Clerk-only: no ClerkProvider exists in demo mode, so the switcher cannot mount there. */}
        {demo ? null : <OrgSwitcher />}
        <ThemeToggle className={IBTN} />
        <Link
          href={notificationsPath}
          aria-label="Notifications"
          title="Notifications"
          className={cn(IBTN, 'relative')}
        >
          <Bell aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
          {/* The artifact's unread dot — static chrome until the pages commits plumb real counts. */}
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-3 size-2 rounded-full bg-accent-2"
          />
        </Link>
        <Link
          href={clientPortalPath}
          className="hidden h-11 shrink-0 items-center gap-2 rounded-input border border-line bg-surface px-4 text-sm font-semibold text-text2 shadow-(--shadow) transition-colors hover:text-text sm:inline-flex"
        >
          <Eye aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
          Client view
        </Link>
        <UserMenu actor={actor} demo={demo} />
      </div>
    </header>
  );
}
