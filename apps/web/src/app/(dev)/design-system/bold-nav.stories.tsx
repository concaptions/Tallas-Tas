'use client';

import { useState } from 'react';
import { BoldPills, BoldSeg, BoldSubnav, BoldTabs } from '@tas/ui';
import { LayoutGrid, Rows3 } from '@tas/ui/icons';

import type { ReactNode } from 'react';

/**
 * The Bold navigation primitives (redesign commit 3b, spec §3.7), live under an explicit
 * `data-ui="bold"` wrapper. A client module: tabs, pills and seg are controlled, so each story
 * keeps the one piece of state its page will own. Counts here are story fixtures — the product's
 * counts arrive with the pages commits.
 */
function BoldFrame({ children }: { children: ReactNode }) {
  return (
    <div data-ui="bold" className="flex flex-col gap-5 rounded-card bg-bg p-5">
      {children}
    </div>
  );
}

const TABS = [
  { key: 'pipeline', label: 'Pipeline', count: 8 },
  { key: 'pool', label: 'Creator pool', count: 12 },
  { key: 'ads', label: 'Partnership ads', count: 4 },
];

const PILLS = [
  { key: 'all', label: 'All', count: 24 },
  { key: 'winning', label: 'Winning', count: 3 },
  { key: 'emotional', label: 'Emotional', count: 9 },
  { key: 'functional', label: 'Functional', count: 12 },
];

const SEG = [
  { key: 'grid', label: 'Grid', icon: <Rows3 aria-hidden="true" /> },
  { key: 'gallery', label: 'Gallery', icon: <LayoutGrid aria-hidden="true" /> },
];

const SUBNAV = [
  { key: 'general', label: 'General' },
  { key: 'team', label: 'Team' },
  { key: 'notifications', label: 'Notifications' },
];

/** Tabs, filter pills, the inset seg and the underline subnav — all controlled, all keyboardable. */
export function BoldNavStory() {
  const [tab, setTab] = useState('pipeline');
  const [pill, setPill] = useState('all');
  const [seg, setSeg] = useState('grid');
  const [section, setSection] = useState('general');
  return (
    <BoldFrame>
      <BoldTabs items={TABS} value={tab} onChange={setTab} label="UGC views" />
      <BoldPills items={PILLS} value={pill} onChange={setPill} label="Filter angles" />
      <div className="flex items-center gap-4">
        <BoldSeg items={SEG} value={seg} onChange={setSeg} label="Sheet layout" />
      </div>
      <BoldSubnav items={SUBNAV} value={section} onChange={setSection} label="Settings sections" />
    </BoldFrame>
  );
}
