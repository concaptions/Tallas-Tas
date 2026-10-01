import { StatusChip } from '@tas/ui';

import { ANGLE_STATUS_OPTIONS, STATUS_LABEL, angleStatusView } from '@/app/app/angles/fields';

/**
 * The one status-bearing control the Angles panel introduces (CLAUDE.md UI governance rule 4): the
 * approval Status chip in every tone the vocabulary carries, plus the unset state that 12 of
 * Gratsi's 43 live angles are in. Labels, keys and tones come from `angles/fields.ts` — the same
 * `ANGLE_STATUS_OPTIONS` the panel's Select renders — so a tone shown here is the tone the panel
 * shows; nothing is re-drawn.
 */
export function AngleStatusStory() {
  const unset = angleStatusView(null);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2" aria-label={`${STATUS_LABEL} tones`}>
        {ANGLE_STATUS_OPTIONS.map((option) => (
          <li key={option.key} className="flex items-center gap-2">
            <StatusChip tone={option.tone} label={option.label} />
            <code className="font-mono text-[11px] text-text3">{option.key}</code>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text3">
        Unset: {unset === null ? <span className="font-mono">—</span> : unset.label} (the column is
        nullable; the panel shows the placeholder &ldquo;Not set&rdquo;).
      </p>
    </div>
  );
}
