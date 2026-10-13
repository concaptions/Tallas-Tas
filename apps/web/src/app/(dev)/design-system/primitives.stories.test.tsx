import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { BRIEF_QA_CHECK_LABELS } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import { QA_GATE_HEADING } from '@/app/app/creative-sheet/focus-mode';

import {
  CheckboxStory,
  DisabledWritePopoverStory,
  POPOVER_OPEN_CLASS,
  SectionLabelStory,
} from './primitives.stories';

/**
 * The primitive stories rendered as the server page renders them. What is pinned is what the
 * reviewer uses the page for: every state the boards draw is present, the popover is held open
 * where the caption says so, and nothing names a colour outside the token layer.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('CheckboxStory', () => {
  const html = renderToStaticMarkup(<CheckboxStory />);

  it('mounts the drawn Checkbox in its five states plus disabled (B2.V15)', () => {
    expect(html.match(/data-slot="checkbox"/g)).toHaveLength(6);
    expect(html).toContain('data-variant="na"');
    expect(html).toContain('data-state="some"');
    expect(html).toContain('lucide-minus');
    expect(html.match(/ checked=""/g)).toHaveLength(2);
    expect(html.match(/ disabled=""/g)).toHaveLength(2);
  });

  it('uses the token layer only', () => {
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('DisabledWritePopoverStory', () => {
  const html = renderToStaticMarkup(<DisabledWritePopoverStory />);

  it('renders the gate popover with its heading and the missing tick in bold (B1.V6 / B1.A6)', () => {
    expect(html.match(/data-slot="disabled-write-popover"/g)).toHaveLength(3);
    expect(html).toContain(QA_GATE_HEADING);
    expect(html).toContain(
      `<b class="font-semibold text-text">${BRIEF_QA_CHECK_LABELS.qaVideoEditor}</b>`,
    );
    expect(html).toContain(DEMO_WRITE_HINT);
    expect(html).toContain('lucide-triangle-alert');
  });

  it('holds two popovers open for review and leaves the third to hover', () => {
    // React escapes the `&` of the arbitrary variant in the rendered attribute.
    const rendered = POPOVER_OPEN_CLASS.replace('&', '&amp;');
    expect(html.split(rendered)).toHaveLength(3);
  });

  it('shows the success variant held with the muted write look', () => {
    expect(html).toContain('bg-ok text-on-ok');
    expect(html).toContain('disabled:bg-surface3');
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('SectionLabelStory', () => {
  const html = renderToStaticMarkup(<SectionLabelStory />);

  it('renders the slab as h2, h3 and p, and beside a chip', () => {
    expect(html).toContain('<h2 data-slot="section-label"');
    expect(html).toContain('<h3 data-slot="section-label"');
    expect(html).toContain('<p data-slot="section-label"');
    expect(html.match(/data-slot="section-label"/g)).toHaveLength(4);
    expect(html).toContain('after:bg-line');
    expect(html).toContain('data-slot="status-chip"');
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});
