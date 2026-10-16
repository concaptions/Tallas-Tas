'use client';

import { useState } from 'react';

import { BoldSidebar } from '@/components/shell/bold/bold-sidebar';
import { BoldTopBar } from '@/components/shell/bold/bold-top-bar';

import type { BrandSummary } from '@/lib/data-source';
import type { DemoActor } from '@/lib/demo-mode';

/**
 * The Bold shell chrome (redesign commits 2/2b, spec §3.1–§3.2), under an explicit `data-ui="bold"`
 * wrapper so the Bold token scope applies here exactly as the app shell stamps it for the template
 * brand. A client module: the rail reads `usePathname` for its active item and the top-bar demo
 * keeps overlay state a reader can poke.
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

const noop = () => undefined;

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
        open={false}
        onClose={noop}
      />
    </div>
  );
}

/** The Bold top bar (commit 2b), with a live hamburger that opens the rail as ≤900px would. */
export function BoldTopBarStory() {
  const [open, setOpen] = useState(false);
  return (
    <div data-ui="bold" className="relative overflow-hidden rounded-card bg-bg pb-6">
      <BoldTopBar
        actor={STORY_ACTOR}
        demo
        onMenuOpen={() => {
          setOpen(true);
        }}
      />
      {open ? (
        <div className="mt-4 px-4">
          <BoldSidebar
            role="admin"
            isTemplate
            brands={STORY_BRANDS}
            activeBrandId="story-template"
            actor={STORY_ACTOR}
            demo
            open
            onClose={() => {
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
