import { demoCreativeSheetItems } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { buildSheetItems } from './build-items';

/**
 * The comment stamp beside an author is computed here, on the server, in the board's wording
 * (B1.A21): `10 Oct, 3:42 PM` for the text and the relative phrase for the title. A client that
 * formatted it itself would disagree with the server and break hydration.
 */
describe('buildSheetItems comments', () => {
  it('stamps a comment the way board 1 writes it, with the relative wording beside it', () => {
    const row = demoCreativeSheetItems[0];
    if (row === undefined) throw new Error('demoCreativeSheetItems is empty');

    const [view] = buildSheetItems(
      {
        rows: [row],
        briefLookups: [],
        angleNames: [],
        productNames: [],
        concepts: [],
        modules: [],
        copyRows: [],
        comments: [
          {
            id: 'c1',
            recordId: row.id,
            authorName: 'Sarah K.',
            body: 'Love the hook.',
            createdAt: new Date('2026-10-10T15:42:00.000Z'),
          },
        ],
      },
      new Date('2026-10-12T15:42:00.000Z'),
    );

    expect(view?.comments).toEqual([
      {
        id: 'c1',
        authorName: 'Sarah K.',
        body: 'Love the hook.',
        at: '10 Oct, 3:42 PM',
        ago: '2 days ago',
      },
    ]);
  });
});
