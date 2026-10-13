import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SectionLabel, sectionLabelClassName } from './section-label';

/** The one section-heading recipe (B2.V10 / B4.V5): the board's `.slab`, with its trailing rule. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('SectionLabel', () => {
  it('renders an h3 by default, carrying the recipe and the slot', () => {
    render(<SectionLabel>QA Checklist</SectionLabel>);
    const heading = screen.getByRole('heading', { level: 3, name: 'QA Checklist' });

    expect(heading.dataset['slot']).toBe('section-label');
    for (const token of sectionLabelClassName.split(' ')) {
      expect(heading.className).toContain(token);
    }
  });

  it('draws the rule as a pseudo-element on the --line token, not as a border', () => {
    expect(sectionLabelClassName).toContain('after:h-px');
    expect(sectionLabelClassName).toContain('after:flex-1');
    expect(sectionLabelClassName).toContain('after:bg-line');
    expect(sectionLabelClassName).not.toContain('border-b');
  });

  it('takes another element and merges the caller’s classes and attributes', () => {
    render(
      <SectionLabel as="h2" id="brief-activity-heading" className="mb-3">
        Activity
      </SectionLabel>,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Activity' });

    expect(heading.id).toBe('brief-activity-heading');
    expect(heading.className).toContain('mb-3');
    expect(heading.className).toContain('uppercase');
  });

  it('can be a paragraph where the text is a label and not a heading', () => {
    const { container } = render(<SectionLabel as="p">Identity</SectionLabel>);

    expect(container.querySelector('p[data-slot="section-label"]')?.textContent).toBe('Identity');
  });

  it('drops the trailing rule on request and keeps the type recipe (board 1 slabs)', () => {
    const html = renderToStaticMarkup(<SectionLabel rule={false}>Identity</SectionLabel>);

    expect(html).toContain('data-rule="false"');
    expect(html).not.toContain('after:');
    expect(html).toContain('tracking-[.09em]');
  });

  it('holds no colour literal', () => {
    expect(renderToStaticMarkup(<SectionLabel>QA Checklist</SectionLabel>)).not.toMatch(
      COLOUR_LITERAL,
    );
  });
});
