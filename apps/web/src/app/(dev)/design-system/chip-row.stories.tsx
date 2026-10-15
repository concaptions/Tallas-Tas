'use client';

import { useState } from 'react';

import { ChipRow, type ChipOption } from '@tas/ui';

/**
 * `ChipRow` (Phase B5 Fix A, 2026-10-15): the primitive the sidebar, the new-brief dialog and the
 * grid cell read for a `singleSelect` or `multiSelect` field. Mounted on `/design-system` through
 * the apps/web stories index, so a reviewer can check every state against the real tokens before
 * the InlineField primitive composes it.
 */
const VOICEOVER_OPTIONS: readonly ChipOption[] = [
  { value: 'tts', label: 'Text-to-speech' },
  { value: 'human', label: 'Human' },
  { value: 'none', label: 'None' },
];

const PLATFORM_OPTIONS: readonly ChipOption[] = [
  { value: 'meta', label: 'Meta' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'google', label: 'Google' },
  { value: 'snapchat', label: 'Snapchat', disabled: true },
];

/** The single-select variant for a `singleSelect` field, both sizes, with a selected option. */
export function ChipRowSingleStory() {
  const [small, setSmall] = useState<readonly string[]>(['human']);
  const [medium, setMedium] = useState<readonly string[]>([]);
  return (
    <div className="grid gap-6 rounded-card border border-line bg-surface p-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          single, sm — sidebar
        </span>
        <ChipRow
          mode="single"
          size="sm"
          value={small}
          options={VOICEOVER_OPTIONS}
          onChange={setSmall}
          ariaLabel="Voiceover type (sm)"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          single, md — new-brief dialog
        </span>
        <ChipRow
          mode="single"
          size="md"
          value={medium}
          options={VOICEOVER_OPTIONS}
          onChange={setMedium}
          ariaLabel="Voiceover type (md)"
        />
      </div>
    </div>
  );
}

/** Multi-select over several platforms, with one archived option disabled on its own. */
export function ChipRowMultiStory() {
  const [value, setValue] = useState<readonly string[]>(['meta', 'tiktok']);
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5">
      <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
        multi — platforms (Snapchat archived)
      </span>
      <ChipRow
        mode="multi"
        value={value}
        options={PLATFORM_OPTIONS}
        onChange={setValue}
        ariaLabel="Platforms"
      />
    </div>
  );
}

/** The whole row refused — the shape the InlineField uses when `canEditBrief` is false. */
export function ChipRowDisabledStory() {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5">
      <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
        disabled — read-only
      </span>
      <ChipRow
        mode="single"
        value={['tts']}
        options={VOICEOVER_OPTIONS}
        onChange={() => {}}
        disabled
        ariaLabel="Voiceover type (disabled)"
      />
    </div>
  );
}
