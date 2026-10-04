'use client';

import { useState } from 'react';

import { LinkField } from '@/components/links/link-field';

/**
 * The two-way link control with RICH options (AI-42; UI governance rule 4): an option may carry its
 * own route and its own status chip, and the field draws both beside the name.
 *
 * It exists because of what making a side editable used to cost. `creator_products` was editable
 * from the creator panel only; the product panel showed a read-only list where each creator was a
 * LINK to its record with its internal-track chip next to it, under a sentence telling the reader to
 * go and edit it elsewhere. Replacing that list with a plain `LinkField` would have made the side
 * editable and taken away the way there and the status — so the option carries them instead, and
 * nothing is lost by the field being editable. Both halves of `creator_products` are mounted here,
 * the product side with rich options and the creator side with plain ones, because a side only needs
 * what its own reader had.
 *
 * Local state only; the real field writes the junction through `setLinksAction` on every change. The
 * status chips are `StatusChip` from `@tas/ui` with tones from `@tas/domain/state`, as everywhere.
 */
const CREATOR_OPTIONS = [
  {
    id: 'c1',
    name: 'Danielle Okonkwo',
    href: '/app/ugc?creator=c1',
    chip: { label: 'Approved', tone: 'ok' as const },
  },
  {
    id: 'c2',
    name: 'Marcus Delacroix',
    href: '/app/ugc?creator=c2',
    chip: { label: 'In Review', tone: 'warn' as const },
  },
  {
    id: 'c3',
    name: 'Priya Raman',
    href: '/app/ugc?creator=c3',
    chip: { label: 'Not Started', tone: 'mute' as const },
  },
];

const PRODUCT_OPTIONS = [
  { id: 'p1', name: 'Gratsi Red — 3L' },
  { id: 'p2', name: 'Gratsi White — 3L' },
  { id: 'p3', name: 'Gratsi Rosé — 3L' },
];

export function LinkFieldRichStory() {
  const [creatorIds, setCreatorIds] = useState<readonly string[]>(['c1', 'c2']);
  const [productIds, setProductIds] = useState<readonly string[]>(['p1']);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LinkField
        link="product-creators"
        sourceId={null}
        options={CREATOR_OPTIONS}
        selectedIds={creatorIds}
        onChange={setCreatorIds}
        label="Creators"
        demo={false}
        slot="story-product-creators"
        empty="No creator is booked for this product yet. Link one here or from the creator's panel."
      />
      <LinkField
        link="creator-products"
        sourceId={null}
        options={PRODUCT_OPTIONS}
        selectedIds={productIds}
        onChange={setProductIds}
        label="Linked Products"
        demo={false}
        slot="story-creator-products"
        empty="No product booked yet. Link one here or from the product's page."
      />
    </div>
  );
}
