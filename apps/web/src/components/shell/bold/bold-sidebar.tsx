'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, SoonChip } from '@tas/ui';
import {
  Bell,
  Bot,
  Box,
  Building2,
  ClipboardList,
  Folder,
  GitMerge,
  House,
  Lightbulb,
  Link as LinkIcon,
  Megaphone,
  Monitor,
  Palette,
  PenLine,
  Rows3,
  Ruler,
  Search,
  Table,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from '@tas/ui/icons';
import { roleLabel, type ViewerRole } from '@tas/domain';

import { appPath } from '@/lib/routes';

import type { BrandSummary } from '@/lib/data-source';
import type { DemoActor } from '@/lib/demo-mode';

import { BrandSwitcher } from '../brand-switcher';
import { activeSectionKey, navGroupsForView } from '../nav';

import type { IconName } from '../icons';

/**
 * The Bold shell's nav glyphs (spec §3 "Iconography": lucide, 18px, stroke 1.75), one per
 * `NavSection.icon` the nav tree actually uses. The nav MODEL is not forked — groups and sections
 * come from `navGroupsForView`, the same call the legacy sidebar makes — only the glyph set maps
 * from the shell's inline-SVG names onto the artifact's icon language. A name without a row (the
 * chrome glyphs: sun, moon, chevron, check) falls back to `House`; none of them names a section.
 */
const NAV_ICON: Partial<Record<IconName, LucideIcon>> = {
  overview: House,
  products: Box,
  collections: Folder,
  personas: Users,
  angles: Target,
  themes: Palette,
  concepts: Lightbulb,
  'ai-characters': Bot,
  'competitive-research': Search,
  briefs: Table,
  ugc: Video,
  user: Users,
  assets: Folder,
  copywriting: PenLine,
  campaigns: Megaphone,
  performance: TrendingUp,
  'ad-spy': Search,
  'creator-ranking': Trophy,
  'creative-dimensions': Ruler,
  'queue-internal': Rows3,
  'queue-client': Rows3,
  team: Users,
  interface: Monitor,
  notifications: Bell,
  'upload-links': LinkIcon,
  propagation: GitMerge,
  'onboarding-forms': ClipboardList,
  building: Building2,
  'design-system': Palette,
};

export interface BoldSidebarProps {
  readonly role: ViewerRole | null;
  readonly isTemplate: boolean;
  /** Everything the brand-switcher card needs; the switching logic is the legacy component's. */
  readonly brands: readonly BrandSummary[];
  readonly activeBrandId: string | null;
  readonly actor: DemoActor;
  readonly demo: boolean;
  /** ≤900px only: whether the rail is open as the fixed overlay. Ignored at desktop width. */
  readonly open: boolean;
  /** Closes the overlay; also fired when a nav link is followed. A no-op at desktop width. */
  readonly onClose: () => void;
}

/**
 * The Bold floating indigo rail (redesign commit 2; spec §3.1): sticky rounded-24 column on the
 * `--side-*` token group, white-pill active item, brand-switcher card, footer identity row. It
 * renders ONLY under the template brand's `data-ui="bold"` scope — `AppShell` branches on the same
 * `isTemplate` signal that stamps the scope, so no child brand ever mounts it.
 *
 * Per-item record counts and the Template-updates pending pill are NOT here: the data plumbing is
 * its own change, deferred to the pages commits (spec "Rollout constraints" 5). No fake numbers.
 *
 * ≤900px the rail leaves the grid and becomes a fixed overlay (`min(290px, 86vw)`, radius
 * `0 24px 24px 0` — spec §1.4) that `BoldShell` opens from the Bold top bar's hamburger and closes
 * on Escape, scrim click and navigation.
 */
export function BoldSidebar({
  role,
  isTemplate,
  brands,
  activeBrandId,
  actor,
  demo,
  open,
  onClose,
}: BoldSidebarProps) {
  const pathname = usePathname();
  const active = activeSectionKey(pathname);
  const groups = navGroupsForView(role, isTemplate);

  return (
    <aside
      data-slot="bold-sidebar"
      className={cn(
        'z-50 flex-col gap-[18px] overflow-y-auto bg-side-bg px-3.5 py-5 text-side-ink',
        // Desktop (≥901px): the floating rail — sticky top 12, 12px outer margin, rounded 24
        // (spec §1.4 "Sidebar").
        'min-[901px]:sticky min-[901px]:top-3 min-[901px]:my-3 min-[901px]:ml-3 min-[901px]:h-[calc(100vh-24px)] min-[901px]:rounded-3xl',
        // ≤900px: a fixed overlay, `min(290px, 86vw)`, rounded on its free edge (spec §1.4).
        'max-[900px]:fixed max-[900px]:inset-y-0 max-[900px]:left-0 max-[900px]:w-[min(290px,86vw)] max-[900px]:rounded-r-3xl',
        // Closed hides the overlay only; the desktop rail is always on. No transform animation,
        // so `prefers-reduced-motion` has nothing it needs to kill here.
        open ? 'flex' : 'hidden min-[901px]:flex',
      )}
    >
      <Link
        href={appPath}
        onClick={onClose}
        className="flex shrink-0 items-center gap-2.5 px-1"
        title="TAS Creative Platform"
      >
        <span
          aria-hidden="true"
          className="bg-brand-gradient grid size-8 shrink-0 place-items-center rounded-[10px] text-[11px] font-extrabold text-on-accent shadow-[0_6px_20px_-6px_var(--accent-2)]"
        >
          TAS
        </span>
        <span className="truncate text-[16px] font-bold text-side-ink">Creative Platform</span>
      </Link>

      <div className="shrink-0">
        <BrandSwitcher
          brands={brands}
          activeId={activeBrandId}
          readOnly={demo}
          variant="rail-card"
        />
      </div>

      <nav aria-label="Sections" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {groups.map((group) => (
          <ul key={group.key} aria-label={group.label} className="flex flex-col gap-0.5">
            {group.label === undefined ? null : (
              <li
                role="presentation"
                className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-[.1em] text-side-ink2 uppercase"
              >
                {group.label}
              </li>
            )}
            {group.sections.map((section) => {
              const isActive = section.key === active;
              const Glyph = NAV_ICON[section.icon] ?? House;
              const glyph = (
                <Glyph aria-hidden="true" strokeWidth={1.75} className="size-[18px] shrink-0" />
              );
              const shared =
                'flex items-center gap-2.5 rounded-input px-2.5 py-2 text-sm font-medium';

              if (section.href === undefined) {
                return (
                  <li key={section.key}>
                    <div
                      aria-disabled="true"
                      title={`${section.label} — not available yet`}
                      className={cn(shared, 'cursor-not-allowed text-side-ink2/60 select-none')}
                    >
                      {glyph}
                      <span className="flex-1 truncate">{section.label}</span>
                      <SoonChip className="ml-auto" />
                    </div>
                  </li>
                );
              }

              return (
                <li key={section.key}>
                  <Link
                    href={section.href}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    title={section.label}
                    className={cn(
                      shared,
                      'transition-colors',
                      // The artifact's active state: white pill, rail-indigo ink — both from the
                      // side token group, never a literal (spec §1.1 `--side-active` row).
                      isActive
                        ? 'bg-side-ink font-semibold text-side-bg'
                        : 'text-side-ink2 hover:bg-side-active hover:text-side-ink',
                    )}
                  >
                    {glyph}
                    <span className="flex-1 truncate">{section.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </nav>

      <div
        data-slot="bold-sidebar-identity"
        className="flex shrink-0 items-center gap-2.5 border-t border-side-ink/12 px-1 pt-4"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-side-ink/10 font-mono text-[11px] tracking-wide text-side-ink"
        >
          {actor.initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-side-ink">{actor.fullName}</span>
          <span className="truncate text-[11px] text-side-ink2">
            {role === null ? actor.email : roleLabel(role)}
          </span>
        </span>
      </div>
    </aside>
  );
}
