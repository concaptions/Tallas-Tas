import { describe, expect, it } from 'vitest';

import { recordNavigation } from './record-nav';

describe('recordNavigation', () => {
  it('an empty list has no index and both neighbours null', () => {
    const nav = recordNavigation([], null);
    expect(nav.index).toBe(-1);
    expect(nav.total).toBe(0);
    expect(nav.prevId).toBeNull();
    expect(nav.nextId).toBeNull();
  });

  it('a single row has both neighbours null', () => {
    const nav = recordNavigation(['a'], 'a');
    expect(nav.index).toBe(0);
    expect(nav.total).toBe(1);
    expect(nav.prevId).toBeNull();
    expect(nav.nextId).toBeNull();
    expect(nav.counter).toBe('1 / 1');
  });

  it('the first row has no prev, next is the second', () => {
    const nav = recordNavigation(['a', 'b', 'c'], 'a');
    expect(nav.index).toBe(0);
    expect(nav.prevId).toBeNull();
    expect(nav.nextId).toBe('b');
  });

  it('the last row has no next, prev is the one before', () => {
    const nav = recordNavigation(['a', 'b', 'c'], 'c');
    expect(nav.index).toBe(2);
    expect(nav.prevId).toBe('b');
    expect(nav.nextId).toBeNull();
  });

  it('a middle row has both neighbours and the padded counter', () => {
    const nav = recordNavigation(['a', 'b', 'c', 'd'], 'c');
    expect(nav.index).toBe(2);
    expect(nav.prevId).toBe('b');
    expect(nav.nextId).toBe('d');
    expect(nav.counter).toBe('3 / 4');
  });

  it('a selected id not in the list falls to the first row (prev null, next the second)', () => {
    const nav = recordNavigation(['a', 'b'], 'x');
    expect(nav.index).toBe(0);
    expect(nav.prevId).toBeNull();
    expect(nav.nextId).toBe('b');
  });

  it('a null selected id falls to the first row', () => {
    const nav = recordNavigation(['a', 'b', 'c'], null);
    expect(nav.index).toBe(0);
    expect(nav.prevId).toBeNull();
    expect(nav.nextId).toBe('b');
  });
});
