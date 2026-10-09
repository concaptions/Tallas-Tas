'use client';

import { useState } from 'react';
import { RatingStars } from '@tas/ui';

/**
 * The editable star control for the design-system page. The page and its story modules are server
 * components, and a function prop cannot cross into a client component from there (Next prerender
 * fails with "Event handlers cannot be passed to Client Component props"), so the state and the
 * `onChange` live here, on the client side of the boundary.
 */
export function RatingStarsDemo({
  initial,
  label,
  disabled = false,
}: {
  readonly initial: number | null;
  readonly label: string;
  readonly disabled?: boolean;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return <RatingStars value={value} onChange={setValue} disabled={disabled} label={label} />;
}
