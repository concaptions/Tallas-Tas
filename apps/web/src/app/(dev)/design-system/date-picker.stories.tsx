'use client';

import { useState } from 'react';

import { DatePicker } from '@tas/ui';

/**
 * `DatePicker` (Phase B5 Fix A, 2026-10-15): a native `<input type="date">` wrapped in the token
 * surface. D-033 explains why native beats a dep: the 500 USD/yr budget is intact, keyboard and
 * screen-reader support arrive from the browser, and a richer picker is a one-ticket upgrade when
 * the team asks. Three states so the reviewer can click each: a set date, an empty one, disabled.
 */
export function DatePickerStory() {
  const [withValue, setWithValue] = useState<string | null>('2026-10-20');
  const [empty, setEmpty] = useState<string | null>(null);
  return (
    <div className="grid gap-6 rounded-card border border-line bg-surface p-5 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          set — 2026-10-20
        </span>
        <DatePicker value={withValue} onChange={setWithValue} ariaLabel="Due (set)" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          empty — placeholder
        </span>
        <DatePicker value={empty} onChange={setEmpty} ariaLabel="Due (empty)" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          disabled — read-only
        </span>
        <DatePicker value="2026-10-20" onChange={() => {}} ariaLabel="Due (disabled)" disabled />
      </div>
    </div>
  );
}
