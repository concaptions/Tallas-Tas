import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('joins class names and drops falsy values', () => {
    expect(cn('flex', undefined, false, 'gap-2')).toBe('flex gap-2');
  });

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
  });
});
