'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  CONCEPT_CLIENT_STATUS_DEFAULT,
  CONCEPT_INTERNAL_STATUS_DEFAULT,
  getAngleById,
  getConceptById,
  getThemeById,
  insertConcept,
  updateConcept,
  type ConceptInput,
} from '@tas/db';
import { isAngleFormat, type AngleFormatKey } from '@tas/domain/angles';
import {
  conceptName,
  isConceptApprovalStatus,
  isConceptProductionStatus,
  isConceptStyle,
  validateConceptDraft,
  type ConceptApprovalStatusKey,
  type ConceptDraftField,
  type ConceptProductionStatusKey,
  type ConceptStyleKey,
} from '@tas/domain/concepts';
import {
  CLIENT_STATUS,
  ON_HOLD,
  canTransitionClient,
  canTransitionInternal,
  internalStatusFor,
  isClientTrackOpen,
  type ClientStatusKey,
  type InternalStatusKey,
  type InternalStatusOrHoldKey,
} from '@tas/domain/state';
import { z } from 'zod';

import { CONCEPT_TRACK, withBrandScope } from '@/lib/concepts-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { conceptPath, conceptsPath } from '@/lib/routes';

/**
 * The Concepts route's two mutations (PRD §5.7). Both follow `angles/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. parse the submitted `FormData` with zod, which owns the *shape*: which keys exist, that a
 *    format is one of the four in the shared vocabulary, that a status is one the state machine
 *    defines, and that an empty text field is stored as NULL rather than as an empty string;
 * 3. run `validateConceptDraft` from `@tas/domain/concepts`, which owns the *rules* — Batch, Angle,
 *    Theme and Category required, every non-blank ad-inspiration entry a real link. The detail page
 *    calls the same function to disable its save, and a disabled button is a courtesy, not a
 *    guarantee, so the action re-runs it. No rule is restated here;
 * 4. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 5. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * Two things are specific to this route.
 *
 * THE NAME IS NEVER SUBMITTED. `concepts.name` is auto-generated and must not be typed by anyone
 * (CLAUDE.md non-negotiable 4), so neither action reads a `name` field. It re-derives the string
 * with `conceptName` from `@tas/domain/concepts`, from the angle and theme rows it just read out of
 * the database rather than from anything the form claimed they were called. That is what makes a
 * stored name unable to drift from its parts: rename the angle and the next save of the concept
 * renames the concept, and a tampered submission cannot invent a name at all.
 *
 * THE CLIENT TRACK IS GATED. A concept reaches the client track only once its internal status is
 * Approved (CLAUDE.md non-negotiable 6). The gate is `isClientTrackOpen` / `canTransitionClient`
 * from `@tas/domain/state`; this file never compares a status to a literal and never re-states which
 * internal states open the gate.
 */

/**
 * The fields the detail page can show a message under: the four the domain validator knows, plus
 * the ones this page writes that carry no draft rule. Derived from `ConceptDraftField` so the two
 * cannot drift.
 */
export type ConceptFieldName =
  | ConceptDraftField
  | 'conceptStyle'
  | 'formats'
  | 'hookExamples'
  | 'scriptIdea'
  | 'internalStatus'
  | 'clientStatus'
  | 'approvalStatus'
  | 'productionStatus'
  | 'formatsToCreate'
  | 'creatorId';

export interface ConceptActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** The generated `Batch-Angle-Theme` string that was stored, so the page can show what it saved. */
  readonly name: string;
  /** Changes with every save, so the page can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface ConceptActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<ConceptFieldName, string>>;
}

export type ConceptActionResult = ConceptActionSuccess | ConceptActionFailure;

const NEEDS_ATTENTION = 'Some fields need attention before this can be saved.';

/** A text column: trimmed, and empty means NULL. */
const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** A nullable link column: the `<select>`'s "None" option submits an empty string. */
const link = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/**
 * One checked format. The vocabulary is `isAngleFormat` from `@tas/domain/angles` — a concept
 * deliberately shares the angle's Static / Video / Carousel / Motion Graphic list rather than owning
 * a second copy of it. A value outside it is a tampered submission, not a strategist's mistake.
 */
const format = z
  .string()
  .refine(isAngleFormat, 'That is not one of the four formats.')
  .transform((value): AngleFormatKey => value);

/** Every internal key the column may hold: the linear track plus the non-linear `on_hold` branch. */
const internalStatusKeys: readonly string[] = [
  ...internalStatusFor(CONCEPT_TRACK).map((entry) => entry.key),
  ON_HOLD.key,
];

const clientStatusKeys: readonly string[] = CLIENT_STATUS.map((entry) => entry.key);

function isInternalStatus(value: string): value is InternalStatusOrHoldKey {
  return internalStatusKeys.includes(value);
}

function isClientStatus(value: string): value is ClientStatusKey {
  return clientStatusKeys.includes(value);
}

/**
 * A submitted status. Absent means "leave it where it is", which is why both are nullable rather
 * than defaulted here: only the write path knows whether "where it is" is the column default (create)
 * or the row's current value (update).
 */
const internalStatus = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine(
    (value) => value === null || isInternalStatus(value),
    'That is not a status on the internal track.',
  );

const clientStatus = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine(
    (value) => value === null || isClientStatus(value),
    'That is not a status on the client track.',
  );

/**
 * Shape only. Every rule a strategist can break lives in `validateConceptDraft`, so `batch` and
 * `category` have no membership check here and the link array is not checked for `http(s)` — that
 * is step 3. `name` is absent on purpose: it is generated, never submitted.
 */
const conceptSchema = z.object({
  batch: link,
  angleId: link,
  themeId: link,
  category: link,
  conceptStyle: link,
  formats: z.array(format),
  adInspoLinks: z.array(z.string().trim()),
  hookExamples: text,
  scriptIdea: text,
  internalStatus,
  clientStatus,
  approvalStatus: link,
  productionStatus: link,
  formatsToCreate: z.array(z.string().trim()),
  creatorId: link,
});

type ConceptFormValues = z.infer<typeof conceptSchema>;

/**
 * `FormData` to the schema's input. `formats` and `adInspoLinks` are repeated entries (a checkbox
 * group and one input per link row), so they are read with `getAll`; everything else is a single
 * value, and a missing key becomes `''` so the schema's "empty means NULL" branch runs.
 */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const many = (key: string): string[] =>
    formData.getAll(key).filter((value) => typeof value === 'string');

  return {
    batch: single('batch'),
    angleId: single('angleId'),
    themeId: single('themeId'),
    category: single('category'),
    conceptStyle: single('conceptStyle'),
    formats: many('formats'),
    adInspoLinks: many('adInspoLinks'),
    hookExamples: single('hookExamples'),
    scriptIdea: single('scriptIdea'),
    internalStatus: single('internalStatus'),
    clientStatus: single('clientStatus'),
    approvalStatus: single('approvalStatus'),
    productionStatus: single('productionStatus'),
    formatsToCreate: many('formatsToCreate'),
    creatorId: single('creatorId'),
  };
}

function failureFrom(error: z.ZodError): ConceptActionFailure {
  const fieldErrors: Partial<Record<ConceptFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as ConceptFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

/** The domain's messages, in the same envelope zod's take. */
function failureFromDraft(
  fieldErrors: Readonly<Partial<Record<ConceptDraftField, string>>>,
): ConceptActionFailure {
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

/**
 * A draft that passed both gates. `angleId` and `themeId` are known non-null here because
 * `validateConceptDraft` requires both — the pairing IS the concept — so the write path can look
 * their rows up without re-checking.
 */
interface ParsedConcept {
  readonly values: ConceptFormValues;
  readonly angleId: string;
  readonly themeId: string;
}

/** Shape (zod), then rules (the domain function). Either one failing ends the write. */
function parse(formData: FormData): ParsedConcept | ConceptActionFailure {
  const parsed = conceptSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }

  const draft = validateConceptDraft({
    batch: parsed.data.batch,
    angleId: parsed.data.angleId,
    themeId: parsed.data.themeId,
    category: parsed.data.category,
    adInspoLinks: parsed.data.adInspoLinks,
  });
  if (!draft.ok) {
    return failureFromDraft(draft.fieldErrors);
  }

  const { angleId, themeId } = parsed.data;
  if (angleId === null || themeId === null) {
    // Unreachable: the validator above requires both. Kept so the narrowing is proved, not asserted.
    return failureFromDraft({
      angleId: 'Pick the angle this concept is built on.',
      themeId: 'Pick the theme this angle is paired with.',
    });
  }

  return { values: parsed.data, angleId, themeId };
}

/**
 * The columns this page writes, given the name the write path just generated. A blank
 * ad-inspiration row is an empty input, never a stored `''`; `conceptStyle` is the one vocabulary
 * field with no draft rule, so an unknown value is dropped to NULL rather than stored.
 */
function toInput(
  values: ConceptFormValues,
  name: string,
  internal: InternalStatusOrHoldKey,
  client: ClientStatusKey,
): ConceptInput {
  const style: ConceptStyleKey | null =
    values.conceptStyle !== null && isConceptStyle(values.conceptStyle)
      ? values.conceptStyle
      : null;
  const approval: ConceptApprovalStatusKey | null =
    values.approvalStatus !== null && isConceptApprovalStatus(values.approvalStatus)
      ? values.approvalStatus
      : null;
  const production: ConceptProductionStatusKey | null =
    values.productionStatus !== null && isConceptProductionStatus(values.productionStatus)
      ? values.productionStatus
      : null;
  return {
    name,
    batch: values.batch,
    angleId: values.angleId,
    themeId: values.themeId,
    category: values.category,
    conceptStyle: style,
    formats: values.formats,
    adInspoLinks: values.adInspoLinks.filter((entry) => entry !== ''),
    hookExamples: values.hookExamples,
    scriptIdea: values.scriptIdea,
    internalStatus: internal,
    clientStatus: client,
    approvalStatus: approval,
    productionStatus: production,
    formatsToCreate: values.formatsToCreate.filter((entry) => entry !== ''),
    creatorId: values.creatorId,
  };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

const CLIENT_GATE_SHUT = 'The client track opens once internal status reaches Approved.';

/**
 * THE GATE (CLAUDE.md non-negotiable 6, PRD §9), checked with no database behind it.
 *
 * A concept whose internal status is not Approved has no client track at all, so it may only ever
 * rest on the client track's FIRST state. Anything past that — the whole of the client bar the
 * strategist can click — requires `isClientTrackOpen` on the internal status this same write is
 * storing, not on the row's old one: a save that approves a creative and moves the client bar in one
 * submission is legal, and a save that walks the internal status back shuts the gate immediately.
 *
 * This is a statement about the STATE, which is why it needs no `from` and can run before the actor
 * lookup and before a connection is opened — the refusal a tampered submission gets must not depend
 * on a database being reachable. `on_hold` is not a member of either linear list, so it can never be
 * Approved and the gate is shut for it too. The finer question ("is that the NEXT step?") is
 * `canTransitionClient` and needs the row, so it runs later, inside the scope.
 */
function clientGateRefusal(
  internal: InternalStatusOrHoldKey,
  client: ClientStatusKey,
): ConceptActionFailure | null {
  if (client === CONCEPT_CLIENT_STATUS_DEFAULT) {
    return null;
  }
  if (isInternalStatusKey(internal) && isClientTrackOpen(internal)) {
    return null;
  }
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors: { clientStatus: CLIENT_GATE_SHUT } };
}

/** Standing still is always allowed; any actual move has to be the machine's next step. */
function clientMoveRefusal(
  internal: InternalStatusOrHoldKey,
  from: ClientStatusKey,
  to: ClientStatusKey,
): ConceptActionFailure | null {
  if (to === from) {
    return null;
  }
  const gate = clientGateRefusal(internal, to);
  if (gate !== null) {
    return gate;
  }
  if (!isInternalStatusKey(internal) || !canTransitionClient(internal, from, to)) {
    return {
      ok: false,
      error: NEEDS_ATTENTION,
      fieldErrors: { clientStatus: 'That is not the next step on the client track.' },
    };
  }
  return null;
}

/** `on_hold` is a stored value but not a step, so it is not an `InternalStatusKey`. */
function isInternalStatusKey(value: InternalStatusOrHoldKey): value is InternalStatusKey {
  return internalStatusFor(CONCEPT_TRACK).some((entry) => entry.key === value);
}

/** Any internal move has to be one the state machine allows; standing still always is. */
function internalMoveRefusal(
  from: InternalStatusOrHoldKey,
  to: InternalStatusOrHoldKey,
): ConceptActionFailure | null {
  if (to === from || canTransitionInternal(CONCEPT_TRACK, from, to)) {
    return null;
  }
  return {
    ok: false,
    error: NEEDS_ATTENTION,
    fieldErrors: { internalStatus: 'That is not the next step on the internal track.' },
  };
}

/**
 * Creates a concept in the actor's brand.
 *
 * The name is generated inside the scope, from the angle and theme rows this brand can actually see:
 * an angle id belonging to another brand simply never resolves, and a soft-deleted global theme does
 * not either, so a concept cannot be created against a pairing that is not really there.
 */
export async function createConceptAction(
  _previous: ConceptActionResult | null,
  formData: FormData,
): Promise<ConceptActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  // A new concept starts where the columns start; the form may only move it from there. Both
  // statuses are therefore known without a database, so the gate is checked here — before the actor
  // lookup and before a connection — exactly as the demo refusal is.
  const internal = parsed.values.internalStatus ?? CONCEPT_INTERNAL_STATUS_DEFAULT;
  const client = parsed.values.clientStatus ?? CONCEPT_CLIENT_STATUS_DEFAULT;
  const refusal = clientMoveRefusal(internal, CONCEPT_CLIENT_STATUS_DEFAULT, client);
  if (refusal !== null) {
    return refusal;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const [angle, theme] = await Promise.all([
        getAngleById(db, brandId, parsed.angleId),
        getThemeById(db, parsed.themeId),
      ]);
      if (angle === null) {
        return failureFromDraft({ angleId: 'That angle is no longer available.' });
      }
      if (theme === null) {
        return failureFromDraft({ themeId: 'That theme is no longer available.' });
      }

      const name = conceptName({
        batch: parsed.values.batch,
        angleName: angle.name,
        themeName: theme.name,
      });
      const created = await insertConcept(
        db,
        brandId,
        toInput(parsed.values, name, internal, client),
        actor,
      );
      return { ok: true as const, id: created.id, name, savedAt: Date.now() };
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!outcome.ok) {
      return outcome;
    }
    revalidatePath(conceptsPath);
    revalidatePath(conceptPath(outcome.id));
    return outcome;
  } catch {
    return { ok: false, error: 'The concept could not be saved. Try again.' };
  }
}

/** Patches one concept of the actor's brand; another brand's id simply never resolves. */
export async function updateConceptAction(
  _previous: ConceptActionResult | null,
  formData: FormData,
): Promise<ConceptActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This concept could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  // The gate, as early as it can be asked. When the page submits both statuses — which the detail
  // page always does — the answer needs no row, so a client move behind a closed gate is refused
  // before the actor lookup and before a connection. When the internal status is left out, "where
  // it is" is the row's, and the same check runs inside the scope below.
  if (parsed.values.internalStatus !== null && parsed.values.clientStatus !== null) {
    const gate = clientGateRefusal(parsed.values.internalStatus, parsed.values.clientStatus);
    if (gate !== null) {
      return gate;
    }
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const [current, angle, theme] = await Promise.all([
        getConceptById(db, brandId, id),
        getAngleById(db, brandId, parsed.angleId),
        getThemeById(db, parsed.themeId),
      ]);
      if (current === null) {
        return { ok: false as const, error: 'That concept is no longer available.' };
      }
      if (angle === null) {
        return failureFromDraft({ angleId: 'That angle is no longer available.' });
      }
      if (theme === null) {
        return failureFromDraft({ themeId: 'That theme is no longer available.' });
      }

      // The row's stored strings are `text`; narrow them against the machine before asking it.
      const wasInternal: InternalStatusOrHoldKey = isInternalStatus(current.internalStatus)
        ? current.internalStatus
        : CONCEPT_INTERNAL_STATUS_DEFAULT;
      const wasClient: ClientStatusKey = isClientStatus(current.clientStatus)
        ? current.clientStatus
        : CONCEPT_CLIENT_STATUS_DEFAULT;
      const internal = parsed.values.internalStatus ?? wasInternal;
      const client = parsed.values.clientStatus ?? wasClient;

      const internalRefusal = internalMoveRefusal(wasInternal, internal);
      if (internalRefusal !== null) {
        return internalRefusal;
      }
      const clientRefusal = clientMoveRefusal(internal, wasClient, client);
      if (clientRefusal !== null) {
        return clientRefusal;
      }

      const name = conceptName({
        batch: parsed.values.batch,
        angleName: angle.name,
        themeName: theme.name,
      });
      const saved = await updateConcept(
        db,
        brandId,
        id,
        toInput(parsed.values, name, internal, client),
        actor,
      );
      if (saved === null) {
        return { ok: false as const, error: 'That concept is no longer available.' };
      }
      return { ok: true as const, id: saved.id, name, savedAt: Date.now() };
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!outcome.ok) {
      return outcome;
    }
    revalidatePath(conceptsPath);
    revalidatePath(conceptPath(outcome.id));
    return outcome;
  } catch {
    return { ok: false, error: 'The concept could not be saved. Try again.' };
  }
}
