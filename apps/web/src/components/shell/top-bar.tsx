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

/** Product name, brand scope, then the theme toggle and the account menu. 56px tall, sticky. */
export function TopBar({ brands, actor, demo }: TopBarProps) {
  return (
    <header
      data-slot="shell-top-bar"
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4"
    >
      <Link
        href={appPath}
        className="shrink-0 text-sm font-semibold tracking-tight text-text hover:text-accent"
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
