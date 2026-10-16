'use client';

import { BoldSidebar } from '@/components/shell/bold/bold-sidebar';

import type { BrandSummary } from '@/lib/data-source';
import type { DemoActor } from '@/lib/demo-mode';

/**
 * The Bold rail (redesign commit 2, spec §3.1), under an explicit `data-ui="bold"` wrapper so the
 * Bold token scope applies here exactly as the app shell stamps it for the template brand. A client
 * module: the rail reads `usePathname` for its active item.
 */
const STORY_BRANDS: readonly BrandSummary[] = [
  { id: 'story-template', name: 'TAS Template', status: 'active', isTemplate: true },
  { id: 'story-gratsi', name: 'Gratsi', status: 'active', isTemplate: false },
  { id: 'story-niagara', name: 'Niagara Sleep Solutions', status: 'active', isTemplate: false },
];

/** Inlined, not `DEMO_ACTOR`: `demo-mode.ts` reads `@tas/env` and must stay out of client bundles. */
const STORY_ACTOR: DemoActor = {
  fullName: 'Demo User',
  email: 'demo@tas-digital.com',
  initials: 'DU',
};

/** The floating indigo rail: admin nav on the template brand, no counts (deferred to pages). */
export function BoldSidebarStory() {
  return (
    <div data-ui="bold" className="h-[620px] overflow-hidden rounded-card bg-bg">
      <BoldSidebar
        role="admin"
        isTemplate
        brands={STORY_BRANDS}
        activeBrandId="story-template"
        actor={STORY_ACTOR}
        demo
      />
    </div>
  );
}
