import Link from 'next/link';

import type { BrandScope } from '@/lib/data-source';
import type { DemoActor } from '@/lib/demo-mode';
import { appPath } from '@/lib/routes';

import { BrandSwitcher } from './brand-switcher';
import { OrgSwitcher } from './org-switcher';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export interface TopBarProps {
  brands: BrandScope;
  actor: DemoActor;
  demo: boolean;
}

/**
 * Product name, brand scope, then the theme toggle and the account menu. 56px tall, sticky.
 *
 * The surface is the signature purple gradient (`bg-brand-gradient`, the one utility tokens.css
 * names for `--accent-gradient`) — the "primary brand surfaces (top bar, primary CTA)" its spec
 * comment in globals.css promises (AI-13). The gradient is saturated purple in BOTH palettes, so
 * the bar pins `data-theme="dark"` on itself: the token layer re-themes any container (the same
 * mechanism the /design-system palette columns use), which keeps every child — product name,
 * switcher, toggle, menu — on light-on-dark tokens over the gradient in light mode too, with no
 * child restyled and no hex anywhere. Dropdowns are Radix portals rendered outside this subtree,
 * so the menus themselves keep following the page theme.
 */
export function TopBar({ brands, actor, demo }: TopBarProps) {
  return (
    <header
      data-slot="shell-top-bar"
      data-theme="dark"
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-brand-gradient px-3 sm:gap-3 sm:px-4"
    >
      <Link
        href={appPath}
        className="shrink-0 text-sm font-semibold tracking-tight text-text hover:opacity-80"
      >
        <span className="sm:hidden">TAS</span>
        <span className="hidden sm:inline">TAS Creative Platform</span>
      </Link>
      <div className="min-w-0 flex-1">
        <BrandSwitcher
          brands={brands.options}
          activeId={brands.active?.id ?? null}
          readOnly={demo}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* Clerk-only: no ClerkProvider exists in demo mode, so the switcher cannot mount there. */}
        {demo ? null : <OrgSwitcher />}
        <ThemeToggle />
        <UserMenu actor={actor} demo={demo} />
      </div>
    </header>
  );
}
