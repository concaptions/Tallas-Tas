'use server';

import { auth } from '@clerk/nextjs/server';
import {
  activateUserTableView,
  createAutoDb,
  createUserTableView,
  deleteUserTableView,
  listUserTableViews,
  renameUserTableView,
  updateUserTableViewConfig,
  type UserTableViewConfigInput,
} from '@tas/db';
import {
  parseUserViewConfig,
  supportsView,
  validateUserViewName,
  type UserView,
  type UserViewConfig,
  type ViewType,
} from '@tas/domain';
import { serverEnv } from '@tas/env';

import { isDemoMode } from './demo-mode';
import { requestConnection } from './request-db';

/**
 * Per-user saved views (Sprint 7, VIEWS-01): the Server Actions behind the Views menu and the
 * Fields popover. Every write resolves the Clerk user id here and hands it to `@tas/db`, whose
 * functions key every statement on it — so a request can only ever touch the caller's own views.
 * In demo mode there is no user and nothing to write: the loader returns no views and `userId:
 * null`, and the client keeps that visitor's views in their own browser instead.
 */
export interface UserViewsResult {
  /** The Clerk user id the views belong to, or null in demo mode (views then live in the browser). */
  readonly userId: string | null;
  readonly views: readonly UserView[];
}

interface ViewRow {
  readonly id: string;
  readonly name: string;
  readonly viewType: string;
  readonly visibleFields: string[] | null;
  readonly fieldOrder: string[];
  readonly frozenFields: string[];
  readonly sort: { key: string; direction: 'asc' | 'desc' } | null;
  readonly filter: string;
  readonly coverField: string | null;
  readonly isActive: boolean;
}

function toUserView(row: ViewRow, tableKey: string): UserView {
  const config = parseUserViewConfig(row);
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    ...config,
    viewType: supportsView(tableKey, config.viewType) ? config.viewType : 'grid',
  };
}

/** The viewer's saved views of one table; a page calls this beside its data loaders. */
export async function loadUserViews(tableKey: string): Promise<UserViewsResult> {
  const none: UserViewsResult = { userId: null, views: [] };
  if (isDemoMode()) return none;

  const { userId } = await auth();
  if (!userId) return none;

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return none;

  const { db } = requestConnection(databaseUrl);
  const rows = await listUserTableViews(db, userId, tableKey);
  return { userId, views: rows.map((row) => toUserView(row, tableKey)) };
}

export interface UserViewActionSuccess {
  readonly ok: true;
  readonly view: UserView | null;
}

export interface UserViewActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type UserViewActionResult = UserViewActionSuccess | UserViewActionFailure;

/** One connection per action, closed after; the user id comes from the session, never the input. */
async function withUser<T>(
  run: (db: ReturnType<typeof createAutoDb>, userId: string) => Promise<T>,
): Promise<T | UserViewActionFailure> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Sign in to save views.' };
  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return { ok: false, error: 'No database is configured.' };
  const db = createAutoDb(databaseUrl);
  try {
    return await run(db, userId);
  } finally {
    await db.$client.end();
  }
}

/** The config columns a client may send, narrowed through the domain parser before any write. */
function configInput(
  tableKey: string,
  config: Partial<UserViewConfig> | undefined,
): UserTableViewConfigInput {
  if (config === undefined) return {};
  const parsed = parseUserViewConfig(config);
  const input: {
    viewType?: string;
    visibleFields?: string[] | null;
    fieldOrder?: string[];
    frozenFields?: string[];
    sort?: { key: string; direction: 'asc' | 'desc' } | null;
    filter?: string;
    coverField?: string | null;
  } = {};
  if (config.viewType !== undefined) {
    input.viewType = supportsView(tableKey, parsed.viewType) ? parsed.viewType : 'grid';
  }
  if (config.visibleFields !== undefined) {
    input.visibleFields = parsed.visibleFields === null ? null : [...parsed.visibleFields];
  }
  if (config.fieldOrder !== undefined) input.fieldOrder = [...parsed.fieldOrder];
  if (config.frozenFields !== undefined) input.frozenFields = [...parsed.frozenFields];
  if (config.sort !== undefined) input.sort = parsed.sort;
  if (config.filter !== undefined) input.filter = parsed.filter;
  if (config.coverField !== undefined) input.coverField = parsed.coverField;
  return input;
}

export interface CreateUserViewInput {
  readonly tableKey: string;
  readonly name: string;
  readonly config?: Partial<UserViewConfig>;
}

export async function createUserViewAction(
  input: CreateUserViewInput,
): Promise<UserViewActionResult> {
  const name = validateUserViewName(input.name);
  if (!name.ok) return { ok: false, error: name.error ?? 'Invalid name.' };
  if (isDemoMode()) return { ok: true, view: null };
  return withUser(async (db, userId) => {
    const row = await createUserTableView(
      db,
      userId,
      input.tableKey,
      name.name,
      configInput(input.tableKey, input.config),
    );
    return { ok: true, view: toUserView(row, input.tableKey) };
  });
}

export interface RenameUserViewInput {
  readonly tableKey: string;
  readonly id: string;
  readonly name: string;
}

export async function renameUserViewAction(
  input: RenameUserViewInput,
): Promise<UserViewActionResult> {
  const name = validateUserViewName(input.name);
  if (!name.ok) return { ok: false, error: name.error ?? 'Invalid name.' };
  if (isDemoMode()) return { ok: true, view: null };
  return withUser(async (db, userId) => {
    const row = await renameUserTableView(db, userId, input.id, name.name);
    return row === null
      ? { ok: false, error: 'That view is not yours or no longer exists.' }
      : { ok: true, view: toUserView(row, input.tableKey) };
  });
}

export interface UpdateUserViewConfigInput {
  readonly tableKey: string;
  readonly id: string;
  readonly config: Partial<UserViewConfig>;
}

export async function updateUserViewConfigAction(
  input: UpdateUserViewConfigInput,
): Promise<UserViewActionResult> {
  if (isDemoMode()) return { ok: true, view: null };
  return withUser(async (db, userId) => {
    const row = await updateUserTableViewConfig(
      db,
      userId,
      input.id,
      configInput(input.tableKey, input.config),
    );
    return row === null
      ? { ok: false, error: 'That view is not yours or no longer exists.' }
      : { ok: true, view: toUserView(row, input.tableKey) };
  });
}

export interface ActivateUserViewInput {
  readonly tableKey: string;
  /** The view to make active, or null for the table's default lens. */
  readonly id: string | null;
}

export async function activateUserViewAction(
  input: ActivateUserViewInput,
): Promise<UserViewActionResult> {
  if (isDemoMode()) return { ok: true, view: null };
  return withUser(async (db, userId) => {
    const row = await activateUserTableView(db, userId, input.tableKey, input.id);
    if (input.id !== null && row === null) {
      return { ok: false, error: 'That view is not yours or no longer exists.' };
    }
    return { ok: true, view: row === null ? null : toUserView(row, input.tableKey) };
  });
}

export interface DeleteUserViewInput {
  readonly id: string;
}

export async function deleteUserViewAction(
  input: DeleteUserViewInput,
): Promise<UserViewActionResult> {
  if (isDemoMode()) return { ok: true, view: null };
  return withUser(async (db, userId) => {
    const deleted = await deleteUserTableView(db, userId, input.id);
    return deleted
      ? { ok: true, view: null }
      : { ok: false, error: 'That view is not yours or no longer exists.' };
  });
}

/** Re-exported so a client component types its props without importing the domain package twice. */
export type { ViewType };
