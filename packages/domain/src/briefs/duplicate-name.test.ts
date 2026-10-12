import { describe, expect, it } from 'vitest';

import { duplicateManualName } from './duplicate-name';

describe('duplicateManualName', () => {
  it('bumps the version segment wherever it sits, leaving the rest verbatim', () => {
    expect(duplicateManualName('TV01-B3-CasualHangouts-V2-GratsiRED', 3)).toBe(
      'TV01-B3-CasualHangouts-V3-GratsiRED',
    );
    expect(duplicateManualName('TS02-B3-CasualHangouts-V1', 2)).toBe('TS02-B3-CasualHangouts-V2');
    expect(duplicateManualName('V1-Hero', 2)).toBe('V2-Hero');
  });

  it('does not mistake the formula’s V007 head for a version, and appends one instead', () => {
    expect(duplicateManualName('TAS-TOF-V007-Pain-UGC-B1', 2)).toBe('TAS-TOF-V007-Pain-UGC-B1-V2');
    expect(duplicateManualName('Hero cut (client request)', 4)).toBe(
      'Hero cut (client request)-V4',
    );
  });
});
