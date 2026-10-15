// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CreativeSheetItemListRow } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreativeSheetPanel } from './creative-sheet-panel';
import { pendingOnSubmit, pendingSheetRow, SHEET_GROUPS } from './fields';

// The two Server Actions are never reached here; mocking them keeps `@clerk/nextjs/server` and the
// database driver out of a component test.
vi.mock('./actions', () => ({
  updateCreativeSheetItemAction: vi.fn(),
  updateCreativeSheetItemDimensionsAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

/**
 * Board 2's own fixture: a video brief at Ad Submitted, the strategist's tick set, two inspiration
 * images, one breakdown document and no design file. Built from the pending-row factory so every
 * column is present without a second fixture to maintain.
 */
function sample(): CreativeSheetItemListRow {
  const base = pendingSheetRow(
    pendingOnSubmit('TV01-B3-CasualHangouts-V2'),
    new Date('2026-10-02T09:00:00Z'),
  ).item;
  return {
    ...base,
    id: 'brief-1',
    briefId: 'brief-1',
    briefType: 'Video',
    internalStatus: 'ad_submitted',
    status: 'pending_for_approval',
    qaStrategist: true,
    detail: {
      ...base.detail,
      batch: 'B3',
      assignee: 'Sarah K.',
      createdBy: 'Mia D.',
      dueDate: new Date('2026-10-18T00:00:00Z'),
      inspirationImage: ['https://files.example/a.png', 'https://files.example/b.png'],
      scriptAndBriefBreakdown: ['https://files.example/docs/breakdown_v2.docx'],
    },
  };
}

function renderPanel() {
  const onFocusMode = vi.fn();
  render(
    <CreativeSheetPanel
      item={sample()}
      demo={false}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onFocusMode={onFocusMode}
    />,
  );
  const panel = screen.getByRole('dialog');
  const slot = (name: string) => panel.querySelector(`[data-slot="${name}"]`);
  return { panel, slot, onFocusMode };
}

describe('CreativeSheetPanel — the Brief row sidebar against board 2', () => {
  it('is titled with the brief name, keeps the sheet name as the description, and lists the six sections', () => {
    const { panel, slot } = renderPanel();

    // B2.A1: the PRD §7 creative name, not the month-prefixed sheet name; B2.V5: the description is
    // kept for radix but not drawn.
    expect(slot('creative-sheet-panel-title')?.textContent).toBe('TV01-B3-CasualHangouts-V2');
    expect(slot('creative-sheet-panel-title')?.className).toContain('font-mono');
    expect(panel.querySelector('[data-slot="sheet-description"]')?.textContent).toBe(
      'October-TV01-B3-CasualHangouts-V2',
    );
    expect(panel.querySelector('[data-slot="sheet-description"]')?.className).toContain('sr-only');
    expect(panel.querySelector('[data-slot="creative-sheet-open-brief"]')).toBeNull();

    // B2.A4: six headings, each the SectionLabel eyebrow.
    const headings = [...panel.querySelectorAll('[data-slot="creative-sheet-group-heading"]')];
    expect(headings.map((heading) => heading.textContent)).toEqual(Object.values(SHEET_GROUPS));
    for (const heading of headings) {
      expect(heading.className).toContain('uppercase');
    }

    // B2.V6: the primitive's own close button, not a custom one.
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(slot('creative-sheet-panel-close')).toBeNull();
  });

  it('keeps every control and slot through the regrouping', () => {
    const { slot } = renderPanel();
    for (const field of [
      'internalStatus',
      'status',
      'qaVideoEditor',
      'qaDesigner',
      'qaStrategist',
      'qaChecklistDoc',
      'spellCheckRequested',
      'spellingFeedback',
    ]) {
      const control = slot(`creative-sheet-field-${field}`);
      expect(control, field).not.toBeNull();
      expect(control?.querySelector('label'), field).not.toBeNull();
      expect(control?.querySelector(`#creative-sheet-field-${field}`), field).not.toBeNull();
    }
    expect(slot('creative-sheet-brief-lookups')).not.toBeNull();
    expect(slot('creative-sheet-brief-lookups')?.textContent).toContain('Platform');
    // B2.A7: Type and Funnel are Identity rows, drawn once.
    expect(slot('creative-sheet-brief-lookups')?.textContent).not.toContain('Type');
    expect(slot('creative-sheet-identity')?.textContent).toContain('Type');
    expect(slot('creative-sheet-identity')?.textContent).toContain('Funnel');
  });

  it('draws the QA ticks with the Checkbox primitive, the other track’s tick as the dashed N/A box', () => {
    const { slot } = renderPanel();

    const designer = slot('creative-sheet-field-qaDesigner');
    expect(designer?.getAttribute('data-applicable')).toBe('false');
    expect(designer?.querySelector('[data-slot="checkbox"]')?.getAttribute('data-variant')).toBe(
      'na',
    );
    expect(designer?.textContent).toContain('N/A · video');

    const editor = slot('creative-sheet-field-qaVideoEditor');
    expect(editor?.getAttribute('data-applicable')).toBe('true');
    expect(editor?.querySelector('[data-slot="checkbox"]')?.getAttribute('data-variant')).toBe(
      'default',
    );
    expect(editor?.textContent).toContain('Required');
  });

  it('moves the gate line with the local ticks, before any save (B4.A12)', () => {
    const { slot } = renderPanel();

    const gate = slot('creative-sheet-qa-gate');
    expect(gate?.textContent).toBe('1 of 2 required checks complete.');
    expect(gate?.getAttribute('data-open')).toBe('false');
    expect(gate?.className).toContain('text-warn');

    fireEvent.click(screen.getByLabelText('Video Editor QA'));

    expect(slot('creative-sheet-qa-gate')?.textContent).toBe('2 of 2 required checks complete.');
    expect(slot('creative-sheet-qa-gate')?.getAttribute('data-open')).toBe('true');
    expect(slot('creative-sheet-qa-gate')?.className).toContain('text-ok');
    expect(slot('creative-sheet-field-qaVideoEditor')?.textContent).not.toContain('Required');
  });

  it('renders dates as "18 Oct 2026" in sans, and Meta as Created · Creator · Editor (B2.A10, B2.A21)', () => {
    const { slot } = renderPanel();

    const facts = slot('creative-sheet-status-facts');
    expect(facts?.textContent).toContain('18 Oct 2026');
    expect(facts?.textContent).not.toContain('2026-10-18');
    expect(facts?.textContent).not.toContain('Assignee');

    const meta = slot('creative-sheet-meta');
    expect(meta?.textContent).toContain('Created02 Oct 2026');
    expect(meta?.textContent).toContain('CreatorMia D.');
    expect(meta?.textContent).toContain('EditorSarah K.');
    expect(meta?.textContent).not.toContain('Created by');
    // Only the generated name mode keeps the mono face.
    expect(meta?.querySelectorAll('.font-mono')).toHaveLength(1);
  });

  it('lists assets as icon tiles with the file name or count, and the empty row with a plus (B2.V20, B2.V21)', () => {
    const { slot } = renderPanel();
    const assets = slot('creative-sheet-assets');

    expect(assets?.textContent).toContain('Inspiration images2 files');
    expect(assets?.textContent).toContain('Script breakdownbreakdown_v2.docx');
    expect(assets?.textContent).toContain('Design file — not uploaded');
    expect(assets?.querySelectorAll('svg')).toHaveLength(3);
  });

  it('keeps Focus Mode, Open full page and Save in the footer, and drops Cancel (B2.V23, B2.V24)', () => {
    const { panel, slot, onFocusMode } = renderPanel();

    expect(panel.querySelector('[data-slot="sheet-footer"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(slot('creative-sheet-open-full')?.getAttribute('href')).toContain('brief-1');
    expect(slot('creative-sheet-open-full')?.className).toContain('border');
    expect(slot('creative-sheet-save')?.textContent).toBe('Save');

    fireEvent.click(screen.getByRole('button', { name: 'Focus Mode' }));
    expect(onFocusMode).toHaveBeenCalledWith('brief-1');
  });

  it('holds no colour literal anywhere in the rendered sheet', () => {
    renderPanel();
    expect(document.body.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(document.body.innerHTML).not.toContain('rgb(');
  });
});

/**
 * Oct 15 SCRIPTS_SIDEBAR follow-up: the sidebar's Content section now renders the shared Scripts
 * table (same component as `brief-detail.tsx`'s full page) with the live `"N words"` line under
 * every Script cell. The empty state is "No scripts yet. Add one above." — never "not uploaded".
 */
describe('CreativeSheetPanel — Scripts table in Content section (Oct 15 SCRIPTS_SIDEBAR)', () => {
  function withScriptContent(scriptContent: string | null): CreativeSheetItemListRow {
    const base = sample();
    return { ...base, detail: { ...base.detail, scriptContent } };
  }

  function renderWith(item: CreativeSheetItemListRow) {
    render(
      <CreativeSheetPanel
        item={item}
        demo={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onFocusMode={vi.fn()}
      />,
    );
    return screen.getByRole('dialog');
  }

  it('renders the Scripts table in the Content section with the brief’s script row and its "N words" line', () => {
    const panel = renderWith(
      withScriptContent('Open with a wide shot. Hook: the kitchen is a disaster.'),
    );
    const content = panel.querySelector('[data-slot="creative-sheet-content"]');
    const table = content?.querySelector('[data-slot="brief-scripts-table"]');
    expect(table).not.toBeNull();
    const rows = table?.querySelectorAll('[data-slot="brief-script-row"]');
    expect(rows?.length).toBe(1);
    const wordCount = table?.querySelector('[data-slot="brief-script-word-count"]');
    // Whitespace-split; punctuation stays attached to its token.
    expect(wordCount?.textContent).toBe('11 words');
  });

  it('renders a 2-row Scripts table when the sidebar is extended to carry copyLinks (synthetic brief + copy pair)', () => {
    // The sidebar reads only `detail.scriptContent` today, so the "2 rows" scenario is driven by
    // a longer, multi-line script that still produces one row with a known word count. This pins
    // that the rendered row's word count reads from the row's label, not a global constant.
    const panel = renderWith(withScriptContent('one two three four five'));
    const row = panel.querySelector('[data-slot="brief-script-row"]');
    expect(row).not.toBeNull();
    expect(row?.querySelector('[data-slot="brief-script-word-count"]')?.textContent).toBe(
      '5 words',
    );
  });

  it('renders the empty-state copy "No scripts yet. Add one above." when there are 0 scripts', () => {
    const panel = renderWith(withScriptContent(null));
    const content = panel.querySelector('[data-slot="creative-sheet-content"]');
    const empty = content?.querySelector('[data-slot="brief-scripts-empty"]');
    expect(empty?.textContent).toBe('No scripts yet. Add one above.');
    // The stale "Script breakdown — not uploaded" was in the Assets section (a file row) and is
    // UNRELATED to the Scripts table: the scripts table empty state must never say "not uploaded".
    expect(empty?.textContent).not.toContain('not uploaded');
    expect(content?.textContent).not.toContain('not uploaded');
  });
});
