import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BRIEF_STATS_STORIES,
  BriefsStatsEmptyStory,
  BriefsStatsFullStory,
  BriefsStatsPartialStory,
} from './briefs-stats.stories';

/**
 * The Creative Sheet stats tab's story contract (Ticket 12). The stories must render under the
 * token layer only — no raw hex colour, no `rgb(` literal — so the chart tracks light and dark
 * mode without a theme flip in code.
 *
 * The chart library ships its own typography and layout defaults that `recharts` renders in the
 * browser; this test reads the SOURCE for colour literals, which is the one place a reviewer could
 * reasonably introduce one.
 */

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

const SOURCES = [
  join(__dirname, 'briefs-stats.stories.tsx'),
  join(__dirname, '..', '..', 'app', 'creative-sheet', 'stats-tab.tsx'),
  join(__dirname, '..', '..', 'app', 'creative-sheet', 'stats-copy.ts'),
];

describe('briefs-stats stories source', () => {
  for (const path of SOURCES) {
    it(`${path.split('/').slice(-2).join('/')} has no raw hex or rgb colour literal`, () => {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(COLOUR_LITERAL);
    });
  }
});

describe('BRIEF_STATS_STORIES catalogue', () => {
  it('exposes the three documented states so the design-system page can mount them', () => {
    expect(Object.keys(BRIEF_STATS_STORIES).sort()).toEqual(['empty', 'full', 'partial']);
    expect(BRIEF_STATS_STORIES.empty).toBe(BriefsStatsEmptyStory);
    expect(BRIEF_STATS_STORIES.partial).toBe(BriefsStatsPartialStory);
    expect(BRIEF_STATS_STORIES.full).toBe(BriefsStatsFullStory);
  });
});
