'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, SoonChip } from '@tas/ui';
import type { ViewerRole } from '@tas/domain';

import { Icon } from './icons';
import { activeSectionKey, navGroupsForRole } from './nav';

/**
 * The product's left rail. Below `md` it collapses to a 56px icon rail (labels hidden, the whole
 * shell still fits 390px with no horizontal scroll); from `md` up it is a 224px labelled column.
 *
 * A section with no `href` is not built yet: muted, `aria-disabled`, marked with a `SoonChip` from
 * `@tas/ui`, rendered as a `div` so it cannot be clicked or focused.
 *
 * IT LISTS ONLY WHAT THE VIEWER'S ROLE INCLUDES (AI-57). `role` comes from the server — the shell
 * layout resolves it once per request and passes it down — because a client component cannot be
 * trusted to establish who it is rendering for. It is a prop and not a context read for the same
 * reason the groups are filtered in `navGroupsForRole` and not here: this component decides nothing.
 * A missing role lists nothing, which is the safe shape of being wrong.
 */
export interface SidebarProps {
  readonly role: ViewerRole | null;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const active = activeSectionKey(pathname);
  const groups = navGroupsForRole(role);

  return (
    <nav
      aria-label="Sections"
      data-slot="shell-sidebar"
      className="w-14 shrink-0 border-r border-line bg-surface md:w-56"
    >
      <div className="sticky top-14 flex flex-col gap-3 p-2">
        {groups.map((group) => (
          <ul key={group.key} aria-label={group.label} className="flex flex-col gap-0.5">
            {group.label === undefined ? null : (
              <li
                role="presentation"
                className="hidden px-2.5 pt-2 pb-1 font-mono text-[10px] tracking-wider text-text4 uppercase md:block"
              >
                {group.label}
              </li>
            )}
            {group.sections.map((section) => {
              const isActive = section.key === active;
              const shared =
                'flex items-center justify-center gap-3 rounded-input px-2.5 py-2 text-sm md:justify-start';
              // A content section shows its friendly emoji (P2D); everything else keeps its lucide icon.
              const glyph = section.emoji ? (
                <span
                  aria-hidden
                  className="grid size-4 shrink-0 place-items-center text-sm leading-none"
                >
                  {section.emoji}
                </span>
              ) : (
                <Icon name={section.icon} className="size-4 shrink-0" />
              );

              if (section.href === undefined) {
                return (
                  <li key={section.key}>
                    <div
                      aria-disabled="true"
                      title={`${section.label} — not available yet`}
                      className={cn(shared, 'cursor-not-allowed text-text4 select-none')}
                    >
                      {glyph}
                      <span className="hidden flex-1 truncate md:inline">{section.label}</span>
                      <SoonChip className="ml-auto hidden md:inline-flex" />
                    </div>
                  </li>
                );
              }

              return (
                <li key={section.key}>
                  <Link
                    href={section.href}
                    aria-current={isActive ? 'page' : undefined}
                    title={section.label}
                    className={cn(
                      shared,
                      'transition-colors',
                      isActive
                        ? 'bg-accent-soft font-medium text-accent'
                        : 'text-text2 hover:bg-surface3 hover:text-text',
                    )}
                  >
                    {glyph}
                    <span className="hidden flex-1 truncate md:inline">{section.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </nav>
  );
}
