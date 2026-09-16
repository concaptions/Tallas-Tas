'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, SoonChip } from '@tas/ui';

import { Icon } from './icons';
import { NAV_SECTIONS, activeSectionKey } from './nav';

/**
 * The product's left rail. Below `md` it collapses to a 56px icon rail (labels hidden, the whole
 * shell still fits 390px with no horizontal scroll); from `md` up it is a 224px labelled column.
 *
 * A section with no `href` is not built yet: muted, `aria-disabled`, marked with a `SoonChip` from
 * `@tas/ui`, rendered as a `div` so it cannot be clicked or focused.
 */
export function Sidebar() {
  const pathname = usePathname();
  const active = activeSectionKey(pathname);

  return (
    <nav
      aria-label="Sections"
      data-slot="shell-sidebar"
      className="w-14 shrink-0 border-r border-line bg-surface md:w-56"
    >
      <ul className="sticky top-14 flex flex-col gap-0.5 p-2">
        {NAV_SECTIONS.map((section) => {
          const isActive = section.key === active;
          const shared =
            'flex items-center justify-center gap-3 rounded-input px-2.5 py-2 text-sm md:justify-start';

          if (section.href === undefined) {
            return (
              <li key={section.key}>
                <div
                  aria-disabled="true"
                  title={`${section.label} — not available yet`}
                  className={cn(shared, 'cursor-not-allowed text-text4 select-none')}
                >
                  <Icon name={section.icon} className="size-4 shrink-0" />
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
                <Icon name={section.icon} className="size-4 shrink-0" />
                <span className="hidden flex-1 truncate md:inline">{section.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
