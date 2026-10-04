import { describe, expect, it } from 'vitest';

import { testDb } from './testing';
import {
  activateUserTableView,
  createUserTableView,
  deleteUserTableView,
  getUserTableView,
  listUserTableViews,
  renameUserTableView,
  updateUserTableViewConfig,
} from './user-table-views';

const ALICE = 'user_alice';
const BOB = 'user_bob';

describe('user table views', () => {
  it('creates a view for one user, active, and lists it back in creation order', async () => {
    const db = await testDb();
    const first = await createUserTableView(db, ALICE, 'angles', 'Mine', {
      visibleFields: ['name', 'status'],
    });
    const second = await createUserTableView(db, ALICE, 'angles', 'Winning only');

    const rows = await listUserTableViews(db, ALICE, 'angles');
    expect(rows.map((row) => row.name)).toEqual(['Mine', 'Winning only']);
    expect(rows.map((row) => row.isActive)).toEqual([false, true]);
    expect(first.visibleFields).toEqual(['name', 'status']);
    expect(second.visibleFields).toBeNull();
    expect(second.brandId).toBeNull();
  });

  it('is scoped by user: another user cannot list, read, rename, re-point or delete it', async () => {
    const db = await testDb();
    const view = await createUserTableView(db, ALICE, 'themes', 'Alice themes');

    expect(await listUserTableViews(db, BOB, 'themes')).toEqual([]);
    expect(await getUserTableView(db, BOB, view.id)).toBeNull();
    expect(await renameUserTableView(db, BOB, view.id, 'Stolen')).toBeNull();
    expect(await updateUserTableViewConfig(db, BOB, view.id, { visibleFields: [] })).toBeNull();
    expect(await activateUserTableView(db, BOB, 'themes', view.id)).toBeNull();
    expect(await deleteUserTableView(db, BOB, view.id)).toBe(false);

    const kept = await getUserTableView(db, ALICE, view.id);
    expect(kept?.name).toBe('Alice themes');
    expect(kept?.visibleFields).toBeNull();
    expect(kept?.isActive).toBe(true);
  });

  it('keeps one active view per user and table, and none after activating null', async () => {
    const db = await testDb();
    const a = await createUserTableView(db, ALICE, 'ugc', 'A');
    const b = await createUserTableView(db, ALICE, 'ugc', 'B');
    const other = await createUserTableView(db, ALICE, 'angles', 'Angles view');

    await activateUserTableView(db, ALICE, 'ugc', a.id);
    let rows = await listUserTableViews(db, ALICE, 'ugc');
    expect(rows.find((row) => row.id === a.id)?.isActive).toBe(true);
    expect(rows.find((row) => row.id === b.id)?.isActive).toBe(false);
    // Another table's view is untouched.
    expect((await getUserTableView(db, ALICE, other.id))?.isActive).toBe(true);

    await activateUserTableView(db, ALICE, 'ugc', null);
    rows = await listUserTableViews(db, ALICE, 'ugc');
    expect(rows.every((row) => !row.isActive)).toBe(true);
  });

  it('persists a Fields toggle and a sort into the view, and soft-deletes', async () => {
    const db = await testDb();
    const view = await createUserTableView(db, ALICE, 'products', 'Compact');

    const updated = await updateUserTableViewConfig(db, ALICE, view.id, {
      visibleFields: ['name', 'link'],
      sort: { key: 'name', direction: 'desc' },
      frozenFields: ['name'],
      viewType: 'gallery',
    });
    expect(updated?.visibleFields).toEqual(['name', 'link']);
    expect(updated?.sort).toEqual({ key: 'name', direction: 'desc' });
    expect(updated?.viewType).toBe('gallery');
    expect(updated?.frozenFields).toEqual(['name']);

    // The gallery cover (action item 16): a new view records none, a choice is stored, and "page
    // default" is written back as NULL rather than as an empty string that is not a column key.
    expect(view.coverField).toBeNull();
    expect(
      (await updateUserTableViewConfig(db, ALICE, view.id, { coverField: 'video_intro_url' }))
        ?.coverField,
    ).toBe('video_intro_url');
    expect(
      (await updateUserTableViewConfig(db, ALICE, view.id, { coverField: null }))?.coverField,
    ).toBeNull();

    // Filters and grouping (AI-32): a new view has none and reads flat; a stored condition list
    // and a grouping column round-trip; clearing writes '[]' and NULL back, never a tombstone.
    expect(view.filters).toEqual([]);
    expect(view.groupBy).toBeNull();
    const filtered = await updateUserTableViewConfig(db, ALICE, view.id, {
      filters: [{ field: 'name', op: 'contains', value: 'sleep' }],
      groupBy: 'status',
    });
    expect(filtered?.filters).toEqual([{ field: 'name', op: 'contains', value: 'sleep' }]);
    expect(filtered?.groupBy).toBe('status');
    const cleared = await updateUserTableViewConfig(db, ALICE, view.id, {
      filters: [],
      groupBy: null,
    });
    expect(cleared?.filters).toEqual([]);
    expect(cleared?.groupBy).toBeNull();

    expect(await deleteUserTableView(db, ALICE, view.id)).toBe(true);
    expect(await listUserTableViews(db, ALICE, 'products')).toEqual([]);
    expect(await getUserTableView(db, ALICE, view.id)).toBeNull();
  });
});
