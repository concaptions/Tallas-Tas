'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  BRIEF_CLIENT_STATUS_DEFAULT,
  getBriefById,
  insertActivity,
  updateBrief,
  updateBriefClientStatus,
  updateBriefDimensions,
  type BriefInput,
} from '@tas/db';
import { diffFields } from '@tas/domain';
import {
  creativeTrack,
  isKnownOrLegacyDimension,
  normalizeCreativeDimensions,
} from '@tas/domain/creatives';
import {
  CLIENT_STATUS,
  canTransitionClient,
  canTransitionInternal,
  internalStatusFor,
  isClientTrackOpen,
  ON_HOLD,
  type ClientStatusKey,
  type CreativeTrack,
  type InternalStatusKey,
  type InternalStatusOrHoldKey,
} from '@tas/domain/state';
import { z } from 'zod';

import { currentActor } from '@/lib/actor';
import { withBrandScope } from '@/lib/creative-sheet-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { briefPath, creativeSheetPath } from '@/lib/routes';

/**
 * The Creative Sheet route's mutations. Since the single-source cutover (2026-10-09) a sheet row IS
 * a brief, so every write here lands on `creative_briefs` through the brief's own `@tas/db`
 * writers — the same columns the brief page, the queues and the client portal read. Nothing
 * writes `creative_sheet_items` any more. All three follow `creative-design/actions.ts`:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection;
 * 2. validate with zod: the two selects accept only KEYS of the state machine's vocabularies, the
 *    four checkboxes coerce from the panel's hidden `'true'` / `''` inputs, and the QA checklist is
 *    one `http(s)` URL per line;
 * 3. ask the domain whether the move is legal — `canTransitionInternal` on the brief's own track,
 *    the client gate and `canTransitionClient` — exactly as the brief page does, so the sheet can
 *    never put a creative where its page could not;
 * 4. write through the scoped `@tas/db` functions, log the activity, revalidate the sheet and the
 *    brief's page, and return a typed result. None of them ever throws to the client.
 *
 * The row's NAME is never submitted: it is the month formula over the brief's `created_at` and
 * name (CLAUDE.md non-negotiable 6). `spelling_feedback` is not submitted either — it is what the
 * AI check wrote, and the panel shows it read-only.
 */

/** The brief's three QA ticks and its spell-check trigger, as the panel names them. */
export type CreativeSheetCheck =
  'qaVideoEditor' | 'qaDesigner' | 'qaStrategist' | 'spellCheckRequested';

/** Every writable field the panel submits. `fields.ts` labels these; nothing else is editable. */
export type CreativeSheetFieldName =
  'internalStatus' | 'status' | 'qaChecklistDoc' | 'dimensions' | CreativeSheetCheck;

/**
 * The two status tracks the Kanban board can regroup by, and so the two a card drag may change.
 * `moveSchema` below accepts exactly these two.
 */
export type CreativeSheetStatusField = 'internalStatus' | 'status';

/**
 * Everything the board's group-by offers: the two tracks, and `editorStage` — the editor's board
 * (re-homed here 2026-10-09), whose drops go through `creative-design/actions.ts`.
 */
export type CreativeSheetKanbanField = CreativeSheetStatusField | 'editorStage';

export interface CreativeSheetActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface CreativeSheetActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CreativeSheetFieldName, string>>;
}

export type CreativeSheetActionResult = CreativeSheetActionSuccess | CreativeSheetActionFailure;

/** The activity log's entity and the fields a sheet save can change on it (EDIT-03). */
const BRIEF_ENTITY = 'creative_brief';
const SHEET_ACTIVITY_FIELDS = [
  'internalStatus',
  'clientStatus',
  'qaVideoEditor',
  'qaDesigner',
  'qaStrategist',
  'clickForAiSpellChecker',
] as const;

const SAVE_FAILED = 'The creative could not be saved. Try again.';
const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NOT_IDENTIFIED = 'This creative could not be identified.';
const GONE = 'That creative is no longer available.';
const NEEDS_ATTENTION = 'Some fields need attention.';
const CLIENT_GATE_SHUT = 'The client track opens once internal status reaches Approved.';
const NOT_NEXT_INTERNAL = 'That is not the next step on the internal track.';
const NOT_NEXT_CLIENT = 'That is not the next step on the client track.';
const UNKNOWN_COLUMN = 'That column is not a status this sheet knows.';

/** An `http(s)` URL, or a message a strategist can act on. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** A select's value: the empty option means "leave it where it is"; anything else must be a key. */
const optionalStatus = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value));

/** The QA checklist textarea: one link per line, blank lines ignored, every line a real URL. */
const urlLines = z
  .string()
  .transform((text) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  )
  .refine(
    (lines) => lines.every(isHttpUrl),
    'Each QA checklist line must be a full link, starting with https://',
  );

/** The panel's hidden `'true'` / `''` inputs; anything but `'true'` is unticked. */
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === 'true');

const sheetItemSchema = z.object({
  internalStatus: optionalStatus,
  status: optionalStatus,
  qaChecklistDoc: urlLines,
  qaVideoEditor: checkbox,
  qaDesigner: checkbox,
  qaStrategist: checkbox,
  spellCheckRequested: checkbox,
});

type SheetFormValues = z.infer<typeof sheetItemSchema>;

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  return {
    internalStatus: single('internalStatus'),
    status: single('status'),
    qaChecklistDoc: single('qaChecklistDoc'),
    qaVideoEditor: single('qaVideoEditor'),
    qaDesigner: single('qaDesigner'),
    qaStrategist: single('qaStrategist'),
    spellCheckRequested: single('spellCheckRequested'),
  };
}

function failureFrom(error: z.ZodError): CreativeSheetActionFailure {
  const fieldErrors: Partial<Record<CreativeSheetFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as CreativeSheetFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

function fieldFailure(
  fieldErrors: Partial<Record<CreativeSheetFieldName, string>>,
): CreativeSheetActionFailure {
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

function parse(formData: FormData): { values: SheetFormValues } | CreativeSheetActionFailure {
  const result = sheetItemSchema.safeParse(fieldsOf(formData));
  return result.success ? { values: result.data } : failureFrom(result.error);
}

async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** The sheet revalidates itself and the brief's own page, which shows the same columns. */
function revalidateSheetRow(id: string): void {
  revalidatePath(creativeSheetPath);
  revalidatePath(briefPath(id));
}

function isInternalStatusOf(track: CreativeTrack, value: string): value is InternalStatusKey {
  return internalStatusFor(track).some((entry) => entry.key === value);
}

function isInternalOrHold(track: CreativeTrack, value: string): value is InternalStatusOrHoldKey {
  return value === ON_HOLD.key || isInternalStatusOf(track, value);
}

function isClientStatus(value: string): value is ClientStatusKey {
  return CLIENT_STATUS.some((entry) => entry.key === value);
}

interface Position {
  readonly track: CreativeTrack;
  readonly internal: InternalStatusOrHoldKey;
  readonly client: ClientStatusKey;
}

/**
 * The brief's current position on both tracks, narrowed the way the brief page narrows them: a
 * stored value outside this brief's ladder reads as the ladder's first step, so a save never
 * silently moves a creative it only meant to edit.
 */
function currentPosition(brief: {
  readonly type: string;
  readonly internalStatus: string;
  readonly clientStatus: string;
}): Position {
  const track = creativeTrack(brief.type);
  const [first] = internalStatusFor(track);
  if (first === undefined) throw new Error(`the ${track} internal track is empty`);
  return {
    track,
    internal: isInternalOrHold(track, brief.internalStatus) ? brief.internalStatus : first.key,
    client: isClientStatus(brief.clientStatus) ? brief.clientStatus : BRIEF_CLIENT_STATUS_DEFAULT,
  };
}

/**
 * The two moves a save or a drop asks for, checked against the machine exactly as the brief page
 * checks them: standing still is always allowed; any actual move has to be the track's next step,
 * and no client move is legal while the gate is shut (or the creative is on hold).
 */
function statusRefusal(
  position: Position,
  internalNext: InternalStatusOrHoldKey,
  clientNext: ClientStatusKey,
): CreativeSheetActionFailure | null {
  if (
    internalNext !== position.internal &&
    !canTransitionInternal(position.track, position.internal, internalNext)
  ) {
    return fieldFailure({ internalStatus: NOT_NEXT_INTERNAL });
  }
  if (clientNext === position.client) {
    return null;
  }
  if (internalNext === ON_HOLD.key) {
    return fieldFailure({ status: CLIENT_GATE_SHUT });
  }
  if (clientNext !== BRIEF_CLIENT_STATUS_DEFAULT && !isClientTrackOpen(internalNext)) {
    return fieldFailure({ status: CLIENT_GATE_SHUT });
  }
  if (!canTransitionClient(internalNext, position.client, clientNext)) {
    return fieldFailure({ status: NOT_NEXT_CLIENT });
  }
  return null;
}

/**
 * Saves the panel: the two statuses through the machine, the four flags and the QA checklist, all
 * on the brief. A client-status change stamps `client_status_updated_at`, so the brief carries
 * the history the queues and the portal read.
 */
export async function updateCreativeSheetItemAction(
  _previous: CreativeSheetActionResult | null,
  formData: FormData,
): Promise<CreativeSheetActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: NOT_IDENTIFIED };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }
  const { values } = parsed;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const actorName = (await currentActor()).fullName;

    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getBriefById(db, brandId, id);
      if (current === null) {
        return { ok: false as const, error: GONE };
      }
      const position = currentPosition(current);

      let internalNext: InternalStatusOrHoldKey = position.internal;
      if (values.internalStatus !== null) {
        if (!isInternalOrHold(position.track, values.internalStatus)) {
          return fieldFailure({
            internalStatus: 'That is not a status on this creative’s internal track.',
          });
        }
        internalNext = values.internalStatus;
      }
      let clientNext: ClientStatusKey = position.client;
      if (values.status !== null) {
        if (!isClientStatus(values.status)) {
          return fieldFailure({ status: 'That is not a status on the client track.' });
        }
        clientNext = values.status;
      }
      const refusal = statusRefusal(position, internalNext, clientNext);
      if (refusal !== null) {
        return refusal;
      }

      const patch: Partial<BriefInput> = {
        internalStatus: internalNext,
        clientStatus: clientNext,
        ...(clientNext === position.client ? {} : { clientStatusUpdatedAt: new Date() }),
        qaVideoEditor: values.qaVideoEditor,
        qaDesigner: values.qaDesigner,
        qaStrategist: values.qaStrategist,
        clickForAiSpellChecker: values.spellCheckRequested,
        qaChecklistDoc: values.qaChecklistDoc,
      };
      const saved = await updateBrief(db, brandId, id, patch, actor);
      if (saved === null) {
        return { ok: false as const, error: GONE };
      }
      await insertActivity(
        db,
        brandId,
        BRIEF_ENTITY,
        saved.id,
        diffFields(current, patch, SHEET_ACTIVITY_FIELDS),
        { id: actor, name: actorName },
      );
      return { ok: true as const, id: saved.id, savedAt: Date.now() };
    });
    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (outcome.ok) {
      revalidateSheetRow(outcome.id);
    }
    return outcome;
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/**
 * One submitted dimension: a §8 ratio, or an imported placement name the row already carries. The
 * gate is the domain's `isKnownOrLegacyDimension` — the same one the brief page uses, so a value
 * the brief page could store, the sheet can — and the array is normalised and deduplicated by
 * `normalizeCreativeDimensions` before it is written.
 */
const dimensionsSchema = z
  .array(z.string().refine(isKnownOrLegacyDimension, 'That is not one of the delivery ratios.'))
  .transform((values) => normalizeCreativeDimensions(values));

/**
 * Replaces the creative's ratios the moment the panel's Dimensions field changes — there is no
 * Save button between the pick and this write, which is the point. Writes the brief's own
 * `dimensions` through `updateBriefDimensions`, the one write path, so the brief page shows the
 * same array the sheet does.
 */
export async function updateCreativeSheetItemDimensionsAction(
  id: string,
  dimensions: readonly string[],
): Promise<CreativeSheetActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: NOT_IDENTIFIED };
  }

  const parsed = dimensionsSchema.safeParse(dimensions);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'That is not one of the delivery ratios.',
      fieldErrors: { dimensions: 'That is not one of the delivery ratios.' },
    };
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateBriefDimensions(db, brandId, id, parsed.data, actor),
    );
    if (saved === null) {
      return { ok: false, error: GONE };
    }
    revalidateSheetRow(saved.id);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** A Kanban card drop: `id`, the track the board is grouped by and the column's `value`. */
const moveSchema = z.object({
  field: z.enum(['internalStatus', 'status']),
  value: z.string().trim().min(1),
});

/**
 * Moves one creative to another Kanban column: a single-track move on the brief, through the same
 * machine checks the panel applies. The internal track writes `internal_status`; the client track
 * writes `client_status` with its timestamp, through the brief's own client-status writer. The
 * trailing "Other" column (`''`) is never a drop target: there is no status to write.
 */
export async function moveCreativeSheetItemAction(
  _previous: CreativeSheetActionResult | null,
  formData: FormData,
): Promise<CreativeSheetActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: NOT_IDENTIFIED };
  }

  const parsed = moveSchema.safeParse({
    field: formData.get('field'),
    value: typeof formData.get('value') === 'string' ? formData.get('value') : '',
  });
  if (!parsed.success) {
    return { ok: false, error: UNKNOWN_COLUMN };
  }
  const { field, value } = parsed.data;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const actorName = (await currentActor()).fullName;

    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getBriefById(db, brandId, id);
      if (current === null) {
        return { ok: false as const, error: GONE };
      }
      const position = currentPosition(current);

      if (field === 'internalStatus') {
        if (!isInternalOrHold(position.track, value)) {
          return { ok: false as const, error: UNKNOWN_COLUMN };
        }
        if (statusRefusal(position, value, position.client) !== null) {
          return { ok: false as const, error: NOT_NEXT_INTERNAL };
        }
        const patch = { internalStatus: value };
        const saved = await updateBrief(db, brandId, id, patch, actor);
        if (saved === null) {
          return { ok: false as const, error: GONE };
        }
        await insertActivity(
          db,
          brandId,
          BRIEF_ENTITY,
          saved.id,
          diffFields(current, patch, ['internalStatus']),
          { id: actor, name: actorName },
        );
        return { ok: true as const, id: saved.id, savedAt: Date.now() };
      }

      if (!isClientStatus(value)) {
        return { ok: false as const, error: UNKNOWN_COLUMN };
      }
      const refusal = statusRefusal(position, position.internal, value);
      if (refusal !== null) {
        return { ok: false as const, error: refusal.fieldErrors?.status ?? NOT_NEXT_CLIENT };
      }
      const saved = await updateBriefClientStatus(db, brandId, id, value, null, actor);
      if (saved === null) {
        return { ok: false as const, error: GONE };
      }
      await insertActivity(
        db,
        brandId,
        BRIEF_ENTITY,
        saved.id,
        diffFields(current, { clientStatus: value }, ['clientStatus']),
        { id: actor, name: actorName },
      );
      return { ok: true as const, id: saved.id, savedAt: Date.now() };
    });
    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (outcome.ok) {
      revalidateSheetRow(outcome.id);
    }
    return outcome;
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}
