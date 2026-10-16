import type { ReactNode } from 'react';
import { ArGlyph, BoldTag, Button, Input, StatusChip, Switch, type ArGlyphRatio } from '@tas/ui';
import { Palette, Search, Video } from '@tas/ui/icons';
import { CLIENT_STATUS, INTERNAL_STATUS, chipTone } from '@tas/domain/state';

/**
 * The Bold primitive skins (redesign commit 3, spec §3.4–§3.11), each under an explicit
 * `data-ui="bold"` wrapper so the scoped rules in `packages/ui/src/styles/bold.css` apply here
 * exactly as the app shell stamps them for the template brand. The components are the product's
 * own — same DOM, Bold paint — which is the point: a child brand rendering the same JSX without
 * the wrapper keeps the legacy look (`bold-scope.test.ts`). Statuses come from `@tas/domain/state`
 * and tones from `chipTone`; no magic strings. A server module: nothing here needs a handler.
 */
function BoldFrame({ children }: { children: ReactNode }) {
  return (
    <div data-ui="bold" className="flex flex-col gap-4 rounded-card bg-bg p-5">
      {children}
    </div>
  );
}

/** Chips (§3.5): every stored status through `chipTone`, then the ring and plain dot variants. */
export function BoldChipsStory() {
  return (
    <BoldFrame>
      <div className="flex flex-wrap items-center gap-2">
        {INTERNAL_STATUS.map((entry) => (
          <StatusChip key={entry.key} tone={chipTone(entry.label)} label={entry.label} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CLIENT_STATUS.map((entry) => (
          <StatusChip
            key={entry.key}
            tone={chipTone(entry.label)}
            label={entry.label}
            variant="ring"
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={chipTone('Approved')} label="Approved" variant="plain" />
        <StatusChip tone={chipTone('Draft')} label="Draft" variant="plain" />
      </div>
    </BoldFrame>
  );
}

/** Buttons (§3.4): 44px/r14 via the scope, the pri gradient + glow, 36px/r11 sm, 44px icon. */
export function BoldButtonsStory() {
  return (
    <BoldFrame>
      <div className="flex flex-wrap items-center gap-3">
        <Button>New creative</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Danger</Button>
        <Button variant="success">Approve</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="sm" variant="outline">
          Small outline
        </Button>
        <Button size="icon" variant="outline" aria-label="Search">
          <Search aria-hidden="true" />
        </Button>
      </div>
    </BoldFrame>
  );
}

/** Field focus (§3.8) and the 44×26 gradient switch (§3.9) — focus or toggle them to see it. */
export function BoldControlsStory() {
  return (
    <BoldFrame>
      <div className="flex max-w-sm flex-col gap-3">
        <Input placeholder="Focus me: accent border + 4px accent-soft ring" />
        <div className="flex items-center gap-3">
          <Switch id="ds-bold-switch" defaultChecked />
          <label htmlFor="ds-bold-switch" className="text-sm text-text2">
            Checked — accent gradient
          </label>
          <Switch id="ds-bold-switch-off" />
          <label htmlFor="ds-bold-switch-off" className="text-sm text-text2">
            Off
          </label>
        </div>
      </div>
    </BoldFrame>
  );
}

/** Tags (§3.6) and the aspect-ratio glyphs (§3.10). */
export function BoldTagsStory() {
  const ratios: readonly ArGlyphRatio[] = ['9:16', '4:5', '1:1', '16:9'];
  return (
    <BoldFrame>
      <div className="flex flex-wrap items-center gap-2">
        <BoldTag>Hydration</BoldTag>
        <BoldTag icon={<Video aria-hidden="true" />}>Video</BoldTag>
        <BoldTag icon={<Palette aria-hidden="true" />}>Night sky</BoldTag>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        {ratios.map((ratio) => (
          <ArGlyph key={ratio} ratio={ratio} />
        ))}
      </div>
    </BoldFrame>
  );
}

/**
 * The toast skin (§3.11): the `role="status"` notice line is the product's toast surface, and the
 * Bold scope paints it as the artifact's dark indigo card. The markup below carries the same
 * `data-slot` the product's notice does (`SelectionBar` mounts the real one fixed to the viewport,
 * which a reference page cannot). The check icon and 3.2s self-dismiss are `BoldToast` (commit 3b).
 */
export function BoldToastSkinStory() {
  return (
    <BoldFrame>
      <div role="status" data-slot="selection-notice" className="w-fit text-xs">
        2 copies created.
      </div>
    </BoldFrame>
  );
}
