import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EM_DASH } from '../fields';
import {
  ConceptCollectionsSection,
  FieldRequirement,
  collectionHref,
  type ConceptCollectionItem,
} from './concept-detail';

/** The detail imports the Server Actions, which call `revalidatePath` — a Next-request-only API. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** Nothing here submits the form, so Clerk must never be reached. */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the detail reached Clerk');
  }),
}));

const BFCM: ConceptCollectionItem = {
  id: '11223344-1122-4334-8556-000000000001',
  name: 'BFCM 2026 Collection',
};
const SUMMER: ConceptCollectionItem = {
  id: '11223344-1122-4334-8556-000000000002',
  name: 'Summer Sale Collection',
};

/**
 * The rail section as HTML, the way the parity spec sees it: `:text-is("Collections")` matches an
 * element whose OWN text equals the label, so what is asserted below is the literal `<h2>` text.
 */
function html(collections: readonly ConceptCollectionItem[]): string {
  return renderToStaticMarkup(<ConceptCollectionsSection collections={collections} />);
}

describe('collectionHref', () => {
  it('opens the Collections page on the collection, through the key its workspace reads', () => {
    expect(collectionHref(BFCM.id)).toBe(
      '/app/collections?collection=11223344-1122-4334-8556-000000000001',
    );
  });

  it('encodes an id that is not a uuid rather than letting it break the query string', () => {
    expect(collectionHref('a b&c')).toBe('/app/collections?collection=a%20b%26c');
  });
});

describe('ConceptCollectionsSection', () => {
  it('labels the list "Collections" with its own <h2>, with the dash and no list when there are none', () => {
    const markup = html([]);

    expect(markup).toContain('data-slot="concept-collections"');
    expect(markup).toMatch(/<h2[^>]*>Collections<\/h2>/);
    expect(markup).toContain(`data-slot="concept-collections-empty">${EM_DASH}<`);
    expect(markup).not.toContain('data-slot="concept-collections-list"');
    expect(markup).not.toContain('data-slot="concept-collection"');
  });

  it('lists every collection as a link into its own panel, in row order, named as typed', () => {
    const markup = html([BFCM, SUMMER]);

    expect(markup).toMatch(/<h2[^>]*>Collections<\/h2>/);
    expect(markup).not.toContain('data-slot="concept-collections-empty"');
    expect(markup.match(/data-slot="concept-collection"/g)).toHaveLength(2);
    expect(markup).toContain(`href="${collectionHref(BFCM.id)}"`);
    expect(markup).toContain(`href="${collectionHref(SUMMER.id)}"`);
    expect(markup.indexOf('BFCM 2026 Collection')).toBeLessThan(
      markup.indexOf('Summer Sale Collection'),
    );
    // A collection's name is typed, never generated, so it is not system output in mono.
    expect(markup).not.toMatch(/font-mono[^>]*>BFCM 2026 Collection</);
  });

  it('is read-only: nothing in the section can be typed into or submitted', () => {
    const markup = html([BFCM]);

    expect(markup).not.toMatch(/<(input|textarea|select|button|form)\b/);
  });
});

describe('FieldRequirement', () => {
  const marker = (required: boolean): string =>
    renderToStaticMarkup(<FieldRequirement required={required} />);

  it('says the word rather than drawing an asterisk, so it needs no legend of its own', () => {
    expect(marker(true)).toContain('>Required<');
    expect(marker(false)).toContain('>Optional<');
    expect(marker(true)).not.toContain('*');
    expect(marker(false)).not.toContain('*');
  });

  it('carries the state as a data attribute, which is how the e2e spec counts the two kinds', () => {
    expect(marker(true)).toContain('data-slot="field-requirement"');
    expect(marker(true)).toContain('data-required="true"');
    expect(marker(false)).toContain('data-required="false"');
  });

  it('takes both tones from the token layer — accent for required, text4 for optional', () => {
    expect(marker(true)).toContain('text-accent');
    expect(marker(false)).toContain('text-text4');
    // A semantic class either way: no hex, and the two states are told apart by tone, not by size.
    expect(marker(true)).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(marker(false)).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('appends a caller class instead of replacing the tone, so the Angle wrapper can position it', () => {
    const positioned = renderToStaticMarkup(
      <FieldRequirement required className="absolute top-0 right-0" />,
    );

    expect(positioned).toContain('absolute top-0 right-0');
    expect(positioned).toContain('text-accent');
  });
});
