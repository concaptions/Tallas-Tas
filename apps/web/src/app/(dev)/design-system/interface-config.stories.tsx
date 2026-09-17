'use client';

import { useState } from 'react';
import type { InterfacePageRow } from '@tas/db';
import {
  INTERFACE_PAGE_KEYS,
  defaultInterfaceConfig,
  findPage,
  toggleField,
  togglePage,
} from '@tas/domain/interface';

import { ConfigToggle, ConfigTree } from '@/app/app/interface-config/config-tree';
import { ConfigPreview } from '@/app/app/interface-config/config-preview';
import { CONCEPT_CARD_PAGE_KEY, conceptPreview } from '@/app/app/interface-config/fields';

/**
 * The shapes `/app/interface-config` introduces (CLAUDE.md UI governance rule 4): the switch, the
 * page/field tree built out of `StepRow`, and the client-interface preview with its concept card,
 * its tab strip and its empty state.
 *
 * Nothing is re-drawn here. These are the route's own components, mounted live — the tree and the
 * preview share one piece of state exactly as the page does, so the toggles work on this page too
 * and the preview reacts. Every label, key and position comes from `defaultInterfaceConfig()`, the
 * same pure module the page and the seed read, so no page key or field label is written here and a
 * story cannot show a field the product does not have.
 *
 * `AT` is fixed and the ids are `ds-*`, because these rows never touch a database: `InterfacePageRow`
 * is a `@tas/db` row type and its audit columns have to be present, not meaningful.
 */
const AT = new Date('2026-09-17T12:00:00.000Z');

function base(id: string) {
  return {
    id,
    brandId: 'ds-brand',
    createdAt: AT,
    updatedAt: AT,
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
  };
}

/** PRD §10's defaults as ROWS: the configuration a brand starts with, ids and all. */
function sampleConfig(): InterfacePageRow[] {
  return defaultInterfaceConfig().map((page, pageIndex) => {
    const pageId = `ds-page-${String(pageIndex)}`;
    return {
      ...base(pageId),
      pageKey: page.pageKey,
      label: page.label,
      enabled: page.enabled,
      position: page.position,
      fields: page.fields.map((field, fieldIndex) => ({
        ...base(`ds-field-${String(pageIndex)}-${String(fieldIndex)}`),
        pageId,
        fieldName: field.fieldName,
        label: field.label,
        visible: field.visible,
        clientEditable: field.clientEditable,
        position: field.position,
      })),
    };
  });
}

/** The page this story starts with switched off — the third of the five, read off the tuple. */
const MUTED_PAGE_KEY = INTERFACE_PAGE_KEYS[2];

/** The two concept fields it starts with hidden: the last two the defaults list. */
const HIDDEN_FIELD_NAMES = (findPage(defaultInterfaceConfig(), CONCEPT_CARD_PAGE_KEY)?.fields ?? [])
  .slice(-2)
  .map((field) => field.fieldName);

/** The page's own "Show every field", applied one pure toggle at a time. */
function showEveryField(
  config: readonly InterfacePageRow[],
  pageKey: string,
): readonly InterfacePageRow[] {
  const page = config.find((candidate) => candidate.pageKey === pageKey);
  if (page === undefined) {
    return config;
  }
  return page.fields
    .filter((field) => !field.visible)
    .reduce<readonly InterfacePageRow[]>(
      (current, field) => toggleField(current, pageKey, field.fieldName),
      config,
    );
}

/** The concept the preview card prints. Plain strings, so no database row reaches the browser. */
const SAMPLE_CONCEPT = conceptPreview({
  name: 'B2-It Is Not Just Your Age-Green Screen',
  batch: 'B2',
  category: 'New',
  conceptStyle: 'Editing',
  angleName: 'It Is Not Just Your Age',
  themeName: 'Green Screen',
  productName: 'Niagara Deep Sleep Weighted Blanket',
  personaName: 'Denise — peri-menopausal, awake at 3am with night sweats',
  description:
    'Women told their 3am waking is simply their age stop looking for a fix. Naming the mechanism gives them permission to buy one.',
  painPoints: 'Wakes at 3am soaked. Dreads the evening because she knows what is coming.',
  usp: 'Pressure without heat: the quilted channels hold weight evenly and still breathe.',
  hookExamples:
    '"My doctor wrote ‘peri-menopausal’ on the notes and sent me home." / "Three forty-seven. Every night."',
  clientStatus: 'pending_for_approval',
});

/**
 * The switch itself, in both states. `role="switch"` with `aria-checked`, `rounded-input`, never
 * `rounded-full` — the design handoff has no pill buttons, and this is the only new control the
 * route adds.
 */
export function ConfigToggleStory() {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <ConfigToggle
          checked={on}
          label="A field the client sees"
          onToggle={() => {
            setOn((value) => !value);
          }}
        />
        <span className="text-[13px] text-text2">on</span>
      </div>
      <div className="flex items-center gap-2">
        <ConfigToggle
          checked={off}
          label="A field the client does not see"
          onToggle={() => {
            setOff((value) => !value);
          }}
        />
        <span className="text-[13px] text-text2">off</span>
      </div>
    </div>
  );
}

/**
 * The two columns, live and sharing one draft, exactly as the page wires them: the tree writes the
 * draft through the pure domain toggles, the preview reads it back through `enabledPages` and
 * `visibleFields`. Toggle anything here and the card opposite changes.
 *
 * The sample starts with one page switched off and two concept fields hidden, so the route's two
 * muted states — a disabled page's dimmed field rows, and a hidden field's chip — are both on
 * screen without anyone having to click first.
 */
export function InterfaceConfigStory() {
  const [draft, setDraft] = useState<readonly InterfacePageRow[]>(() =>
    HIDDEN_FIELD_NAMES.reduce<readonly InterfacePageRow[]>(
      (config, fieldName) => toggleField(config, CONCEPT_CARD_PAGE_KEY, fieldName),
      togglePage(sampleConfig(), MUTED_PAGE_KEY),
    ),
  );
  const [activeKey, setActiveKey] = useState<string>(CONCEPT_CARD_PAGE_KEY);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        data-slot="config-tree"
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
      >
        <ConfigTree
          pages={draft}
          onTogglePage={(pageKey) => {
            setDraft((current) => togglePage(current, pageKey));
          }}
          onToggleField={(pageKey, fieldName) => {
            setDraft((current) => toggleField(current, pageKey, fieldName));
          }}
        />
      </section>
      <section
        data-slot="config-preview"
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
      >
        <ConfigPreview
          pages={draft}
          activeKey={activeKey}
          concept={SAMPLE_CONCEPT}
          onSelect={setActiveKey}
          onShowEveryField={(pageKey) => {
            setDraft((current) => showEveryField(current, pageKey));
          }}
        />
      </section>
    </div>
  );
}

/**
 * The empty state, which on this page is a real configuration rather than an error: every field of
 * the concept card switched off. The preview says what the client would see in words and offers the
 * one action that undoes it — never a blank panel, never raw JSON.
 */
export function InterfaceConfigEmptyStory() {
  const [draft, setDraft] = useState<readonly InterfacePageRow[]>(() =>
    sampleConfig().map((page) => ({
      ...page,
      fields: page.fields.map((field) => ({ ...field, visible: false })),
    })),
  );

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <ConfigPreview
        pages={draft}
        activeKey={CONCEPT_CARD_PAGE_KEY}
        concept={SAMPLE_CONCEPT}
        onSelect={() => undefined}
        onShowEveryField={(pageKey) => {
          setDraft((current) => showEveryField(current, pageKey));
        }}
      />
    </div>
  );
}
