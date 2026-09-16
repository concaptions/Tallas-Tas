'use client';

import { SignOutButton } from '@clerk/nextjs';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tas/ui';

import type { DemoActor } from '@/lib/demo-mode';

import { Icon } from './icons';

export interface UserMenuProps {
  actor: DemoActor;
  /** Demo mode: there is no session, so there is nothing to sign out of. */
  demo: boolean;
}

/**
 * The actor the app is acting as. A stub in demo mode (`DEMO_ACTOR`), the Clerk user otherwise.
 * `Profile` is a stub until the settings ticket; `Sign out` only exists when a session can exist, so
 * `SignOutButton` — which needs a `ClerkProvider` above it — is never rendered in demo mode.
 */
export function UserMenu({ actor, demo }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-slot="user-menu"
          aria-label={`Account: ${actor.fullName}`}
          className="rounded-input border border-line bg-surface2 font-mono text-[11px] tracking-wide text-text2 hover:text-text"
        >
          {actor.initials}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-text">{actor.fullName}</span>
          <span className="truncate font-mono text-[11px] font-normal text-text3">
            {actor.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Icon name="user" className="size-4" />
          Profile
        </DropdownMenuItem>
        {demo ? (
          <DropdownMenuItem disabled title="No identity provider is configured">
            Sign out
          </DropdownMenuItem>
        ) : (
          <SignOutButton>
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </SignOutButton>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
