import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { THEME_FIELD_LABELS, UNRESOLVED_ASSIGNEE_HINT, type ThemeCardRow } from './fields';
import { ThemeCard } from './theme-card';

/** The card imports the toggle action, which calls `revalidatePath` — a Next-request-only API. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** Nothing here submits the form, so Clerk must never be reached. */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the card reached Clerk');
  }),
}));

/**
 * The card as HTML, the way the parity spec sees it: `:text-is("Notes")` matches an element whose
 * OWN text equals the label, so what is asserted below is the literal `<dt>` text, not a prop.
 * `demo: true` leaves the Archive form out, which is the one piece of the card that needs a
 * request to render.
 */
function html(overrides: Partial<ThemeCardRow> = {}): string {
  const theme: ThemeCardRow = {
    id: '44444444-4444-4444-8444-000000000001',
    name: 'Green Screen',
    category: 'Production Style',
    status: null,
    notes: null,
    referenceLinks: null,
    usedByBrandCount: 0,
    isActive: true,
    ...overrides,
  };
  return renderToStaticMarkup(<ThemeCard theme={theme} demo onToggled={() => {}} />);
}

/** Every `<dt>`'s own text, in document order. */
function labels(markup: string): string[] {
  return [...markup.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((match) => match[1] ?? '');
}

const EMPTY_LABELS = Object.values(THEME_FIELD_LABELS);

describe('ThemeCard', () => {
  it('labels every Gratsi stored field with its own <dt>, in the base’s order, and stays a card', () => {
    const markup = html();

    expect(labels(markup)).toEqual([
      'Notes',
      'Assignee',
      'Status',
      'Attachments',
      'Attachment Summary',
    ]);
    expect(labels(markup)).toEqual(EMPTY_LABELS);
    expect(markup).toContain('data-slot="theme-card"');
    expect(markup).toContain('data-slot="theme-name">Green Screen<');
    expect(markup).not.toContain('<table');
  });

  it('renders a dash under every empty label rather than dropping the row', () => {
    const markup = html();

    // Five labelled rows, five dashes: the note, the assignee, the status, the attachments and the
    // summary are all unset on this theme, and none of them disappears.
    expect(markup.match(/—/g)).toHaveLength(5);
    expect(markup).not.toContain('data-slot="theme-note"');
    expect(markup).not.toContain('data-slot="theme-attachment"');
  });

  it('keeps the category chip first and puts the status chip under the Status label', () => {
    const markup = html({ status: 'in_progress' });

    const chips = [
      ...markup.matchAll(/data-slot="status-chip" data-tone="([a-z]+)"[^>]*>([^<]*)</g),
    ];
    expect(chips.map((match) => [match[1], match[2]])).toEqual([
      ['info', 'Production Style'],
      ['accent', 'In Progress'],
    ]);
    // The status chip sits inside the Status row, after its label.
    expect(markup.indexOf('In Progress')).toBeGreaterThan(markup.indexOf('>Status<'));
    expect(markup.match(/—/g)).toHaveLength(4);
  });

  it('shows the resolved assignee as prose and an unresolved stored value in mono', () => {
    const resolved = html({ assigneeId: 'user_seed_csm', assigneeName: 'Callum Ashworth' });
    expect(resolved).toContain('data-slot="theme-assignee" data-resolved="true">Callum Ashworth<');
    expect(resolved).not.toContain(UNRESOLVED_ASSIGNEE_HINT);

    const stored = html({ assigneeId: 'Alex Rivera' });
    expect(stored).toMatch(
      /data-slot="theme-assignee" data-resolved="false" title="[^"]+" class="font-mono text-xs">Alex Rivera</,
    );
    expect(stored).toContain(UNRESOLVED_ASSIGNEE_HINT);
  });

  it('renders the note, the attachments as file-name chips with an overflow count, and the summary', () => {
    const markup = html({
      notes: '  Creator reacts over a screenshot.  ',
      attachments: [
        'https://cdn.example/a/hook-still.png',
        'https://cdn.example/b/script.pdf',
        'https://cdn.example/c/cut.mp4',
        'https://cdn.example/d/extra.jpg',
      ],
      aiAttachmentSummary: 'Four stills of a creator reacting to a review.',
      referenceLinks: ['https://foreplay.example/boards/green-screen-reaction'],
    });

    expect(markup).toContain('data-slot="theme-note" title="Creator reacts over a screenshot."');
    expect(markup.match(/data-slot="theme-attachment"/g)).toHaveLength(3);
    expect(markup).toContain('>hook-still.png</a>');
    expect(markup).toContain('>+1<');
    expect(markup).toContain(
      'data-slot="theme-attachment-summary" title="Four stills of a creator reacting to a review."',
    );
    // The reference links keep their own host-only chip row beside the labelled list.
    expect(markup).toContain('data-slot="theme-link"');
    expect(markup).toContain('>foreplay.example</a>');
    expect(markup.match(/—/g)).toHaveLength(2);
  });
});
