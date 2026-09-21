'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  BRIEF_CLIENT_STATUS_DEFAULT,
  getBriefById,
  getConceptById,
  insertBrief,
  listBriefs,
  updateBrief,
  type BriefInput,
} from '@tas/db';
import {
  creativeNameForConcept,
  creativeTrack,
  dimensionsFor,
  isCreativeDimension,
  isCreativeFunnel,
  isCreativePriority,
  isCreativeType,
  isCreativeVersion,
  nextSequence,
  type CreativeDimensionKey,
  type CreativeFunnelKey,
  type CreativePriorityKey,
  type CreativeTypeKey,
} from '@tas/domain/creatives';
import {
  CLIENT_STATUS,
  canTransitionClient,
  canTransitionInternal,
  internalStatusFor,
  isClientTrackOpen,
  type ClientStatusKey,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';
import { z } from 'zod';

import { withBrandScope } from '@/lib/briefs-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { briefPath, briefsPath } from '@/lib/routes';

/**
 * The Creative Briefs route's three mutations (PRD §5.10). All three follow `angles/actions.ts` and
 * `concepts/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. parse the submitted `FormData` with zod, which owns the *shape*: which keys exist, that a
 *    funnel, type, priority, version and dimension are members of the `@tas/domain/creatives`
 *    vocabularies, and that an empty text field is stored as NULL rather than as an empty string;
 * 3. go through the domain functions for everything that is a rule — `creativeNameForConcept` for
 *    the name, `nextSequence` for the §7 number, `dimensionsFor` for the §8 defaults,
 *    `creativeTrack` for which ladder the brief is graded on, and `isClientTrackOpen` /
 *    `canTransition*` for the two-track gate. No rule is restated here;
 * 4. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 5. revalidate both routes and return a typed result. None of them ever throws to the client.
 *
 * THE NAME IS NEVER SUBMITTED. `creative_briefs.name` is the auto-generated PRD §7 string and must
 * not be typed by anyone (CLAUDE.md non-negotiable 4), so no action reads a `name` field. Every
 * write RE-COMPUTES it with `creativeNameForConcept` from `@tas/domain/creatives`, out of the
 * concept row it just read from the database rather than out of anything the form claimed that
 * concept was called. That is what makes a stored name unable to drift from its parts: rename the
 * concept and the next save of the brief renames the brief, and a tampered submission cannot invent
 * a name at all. `toggleQaAction` is the one write that does not recompute — a QA tick is not a
 * segment of the name, so it deliberately leaves the stored string exactly as it found it.
 *
 * THE STANDALONE CASE IS ORDINARY, NOT DEGRADED. `conceptId` may be null (PRD §8, CLAUDE.md
 * non-negotiable 5). A standalone brief supplies its own `batch` — there is no concept to copy one
 * from — and may carry the optional §7 product suffix, which is precisely what disambiguates a
 * creative whose concept does not already name the product. A LINKED brief takes its batch from its
 * concept and never takes a product suffix, exactly as the seeded fixtures are named.
 *
 * THE CLIENT TRACK IS GATED. A brief reaches the client track only once its internal status is
 * Approved (CLAUDE.md non-negotiable 6, PRD §9). The gate is `isClientTrackOpen` /
 * `canTransitionClient`; this file never compares a status to a literal and never re-states which
 * internal states open it. Which LADDER those statuses belong to comes from the brief's own type
 * through `creativeTrack`, so nothing here branches on `'Static'`.
 */

/** The fields the page can show a message under. */
export type BriefFieldName =
  | 'conceptId'
  | 'funnel'
  | 'type'
  | 'version'
  | 'sequence'
  | 'batch'
  | 'product'
  | 'priority'
  | 'assignee'
  | 'briefToDesign'
  | 'scriptContent'
  | 'elementsTested'
  | 'adContent'
  | 'inspiration'
  | 'offer'
  | 'language'
  | 'spellingFeedback2'
  | 'angleId'
  | 'productId'
  | 'inspoLinks'
  | 'dimensions'
  | 'internalStatus'
  | 'clientStatus'
  | 'qa';

/** The three QA checkboxes of ticket criterion 10, by the column each one ticks. */
export type BriefQaCheck = 'qaVideoEditor' | 'qaDesigner' | 'qaStrategist';

export interface BriefActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** The generated PRD §7 string that was stored, so the page can show what it saved. */
  readonly name: string;
  /** Changes with every save, so the page can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface BriefActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<BriefFieldName, string>>;
}

export type BriefActionResult = BriefActionSuccess | BriefActionFailure;

const NEEDS_ATTENTION = 'Some fields need attention before this can be saved.';

/** A text column: trimmed, and empty means NULL. */
const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** A nullable link column: the concept `<select>`'s "Standalone" option submits an empty string. */
const link = text;

const funnel = z
  .string()
  .trim()
  .refine(isCreativeFunnel, 'That is not one of the three funnels.')
  .transform((value): CreativeFunnelKey => value);

const type = z
  .string()
  .trim()
  .refine(isCreativeType, 'That is not one of the four creative types.')
  .transform((value): CreativeTypeKey => value);

/**
 * The Version dropdown (PRD §7, ticket criterion 7): V1…V6, and nothing else. A version outside the
 * dropdown is a tampered submission, not a strategist's mistake, so it is refused rather than
 * clamped — a clamped version would silently rename the creative.
 */
const version = z.coerce
  .number()
  .refine(isCreativeVersion, 'That is not a version the dropdown offers.');

const priority = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine(
    (value) => value === null || isCreativePriority(value),
    'That is not one of the four priorities.',
  )
  .transform((value): CreativePriorityKey | null => (value === null ? null : value));

/** One checked ratio of the §8 grid; an unknown ratio is not a ratio this build can deliver. */
const dimension = z
  .string()
  .trim()
  .refine(isCreativeDimension, 'That is not one of the delivery ratios.')
  .transform((value): CreativeDimensionKey => value);

/**
 * A submitted status, shape only. Absent means "leave it where it is", which is why both are
 * nullable rather than defaulted here: only the write path knows whether "where it is" is the
 * track's first step (create) or the row's current value (update). WHICH keys are legal depends on
 * the brief's type, so membership is checked against the track further down, not with a `z.enum`
 * over one of the two ladders.
 */
const status = text;

/**
 * Shape only. Every rule lives in `@tas/domain` and runs in the write path: the name formula, the
 * §7 number, the §8 dimension defaults and the two-track gate. `name` and `sequence` are absent on
 * purpose — both are generated, never submitted.
 */
const briefSchema = z.object({
  conceptId: link,
  funnel,
  type,
  version,
  batch: text,
  product: text,
  priority,
  assignee: text,
  briefToDesign: text,
  scriptContent: text,
  elementsTested: text,
  adContent: text,
  inspiration: text,
  offer: text,
  language: text,
  spellingFeedback2: text,
  angleId: link,
  productId: link,
  inspoLinks: z.array(z.string().trim()),
  dimensions: z.array(dimension),
  internalStatus: status,
  clientStatus: status,
});

type BriefFormValues = z.infer<typeof briefSchema>;

/**
 * `FormData` to the schema's input. `inspoLinks` and `dimensions` are repeated entries (one input
 * per link row, a checkbox group), so they are read with `getAll`; everything else is a single
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
    conceptId: single('conceptId'),
    funnel: single('funnel'),
    type: single('type'),
    version: single('version'),
    batch: single('batch'),
    product: single('product'),
    priority: single('priority'),
    assignee: single('assignee'),
    briefToDesign: single('briefToDesign'),
    scriptContent: single('scriptContent'),
    elementsTested: single('elementsTested'),
    adContent: single('adContent'),
    inspiration: single('inspiration'),
    offer: single('offer'),
    language: single('language'),
    spellingFeedback2: single('spellingFeedback2'),
    angleId: single('angleId'),
    productId: single('productId'),
    inspoLinks: many('inspoLinks'),
    dimensions: many('dimensions'),
    internalStatus: single('internalStatus'),
    clientStatus: single('clientStatus'),
  };
}

function failureFrom(error: z.ZodError): BriefActionFailure {
  const fieldErrors: Partial<Record<BriefFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as BriefFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

function fieldFailure(fieldErrors: Partial<Record<BriefFieldName, string>>): BriefActionFailure {
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

function parse(formData: FormData): { values: BriefFormValues } | BriefActionFailure {
  const parsed = briefSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

/** The step a brief of this track rests at before anything has happened to it. */
function trackStart(track: CreativeTrack): InternalStatusKey {
  const [first] = internalStatusFor(track);
  if (first === undefined) {
    throw new Error(`the ${track} internal track is empty`);
  }
  return first.key;
}

function isInternalStatusOf(track: CreativeTrack, value: string): value is InternalStatusKey {
  return internalStatusFor(track).some((entry) => entry.key === value);
}

function isClientStatus(value: string): value is ClientStatusKey {
  return CLIENT_STATUS.some((entry) => entry.key === value);
}

const CLIENT_GATE_SHUT = 'The client track opens once internal status reaches Approved.';

/**
 * THE GATE (CLAUDE.md non-negotiable 6, PRD §9), checked against the status this same write is
 * storing rather than against the row's old one: a save that approves a creative and moves the
 * client bar in one submission is legal, and a save that walks the internal status back shuts the
 * gate immediately.
 */
function clientGateRefusal(
  internal: InternalStatusKey,
  client: ClientStatusKey,
): BriefActionFailure | null {
  if (client === BRIEF_CLIENT_STATUS_DEFAULT || isClientTrackOpen(internal)) {
    return null;
  }
  return fieldFailure({ clientStatus: CLIENT_GATE_SHUT });
}

/** Standing still is always allowed; any actual move has to be the machine's next step. */
function clientMoveRefusal(
  internal: InternalStatusKey,
  from: ClientStatusKey,
  to: ClientStatusKey,
): BriefActionFailure | null {
  if (to === from) {
    return null;
  }
  return (
    clientGateRefusal(internal, to) ??
    (canTransitionClient(internal, from, to)
      ? null
      : fieldFailure({ clientStatus: 'That is not the next step on the client track.' }))
  );
}

/** Any internal move has to be one the state machine allows on this brief's own ladder. */
function internalMoveRefusal(
  track: CreativeTrack,
  from: InternalStatusKey,
  to: InternalStatusKey,
): BriefActionFailure | null {
  if (to === from || canTransitionInternal(track, from, to)) {
    return null;
  }
  return fieldFailure({ internalStatus: 'That is not the next step on the internal track.' });
}

/**
 * A submitted status narrowed against this brief's own ladder, or a refusal. `null` in means "leave
 * it where it is", so `fallback` is returned untouched.
 */
function internalStatusOr(
  track: CreativeTrack,
  submitted: string | null,
  fallback: InternalStatusKey,
): InternalStatusKey | BriefActionFailure {
  if (submitted === null) {
    return fallback;
  }
  return isInternalStatusOf(track, submitted)
    ? submitted
    : fieldFailure({ internalStatus: 'That is not a status on this brief internal track.' });
}

function clientStatusOr(
  submitted: string | null,
  fallback: ClientStatusKey,
): ClientStatusKey | BriefActionFailure {
  if (submitted === null) {
    return fallback;
  }
  return isClientStatus(submitted)
    ? submitted
    : fieldFailure({ clientStatus: 'That is not a status on the client track.' });
}

function isFailure(value: unknown): value is BriefActionFailure {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}

/** Who is writing. Live mode only: in demo mode every action has already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** The concept a brief is built on, as the name formula wants it — or `null`, the §8 standalone. */
interface ParentConcept {
  readonly name: string;
  readonly batch: string | null;
}

/**
 * The columns a brief write stores, given the parent concept (or `null`), the §7 number and the two
 * statuses. The name is built here and nowhere else, and the batch and the product suffix follow
 * from whether there is a concept: a linked brief copies its concept's batch and takes no product
 * suffix, a standalone brief supplies its own batch and may carry one.
 */
function toInput(
  values: BriefFormValues,
  concept: ParentConcept | null,
  sequence: number,
  internal: InternalStatusKey,
  client: ClientStatusKey,
): BriefInput {
  const batch = concept?.batch ?? values.batch;
  const product = concept === null ? values.product : null;
  const name = creativeNameForConcept(concept, {
    funnel: values.funnel,
    format: values.type,
    number: sequence,
    version: values.version,
    batch,
    product,
  });

  return {
    name,
    conceptId: values.conceptId,
    batch,
    funnel: values.funnel,
    type: values.type,
    version: values.version,
    sequence,
    priority: values.priority,
    assignee: values.assignee,
    briefToDesign: values.briefToDesign,
    scriptContent: values.scriptContent,
    elementsTested: values.elementsTested,
    adContent: values.adContent,
    inspiration: values.inspiration,
    offer: values.offer,
    language: values.language as BriefInput['language'],
    spellingFeedback2: values.spellingFeedback2,
    angleId: values.angleId,
    productId: values.productId,
    inspoLinks: values.inspoLinks.filter((entry) => entry !== ''),
    // An untouched form submits no ratio at all, which is a fresh brief rather than a brief with no
    // delivery: PRD §8's defaults for the type fill it, from the domain table, never from a literal.
    dimensions:
      values.dimensions.length === 0 ? [...dimensionsFor(values.type)] : [...values.dimensions],
    internalStatus: internal,
    clientStatus: client,
  };
}

/** Both routes the list and the detail page render, revalidated together after every write. */
function revalidateBrief(id: string): void {
  revalidatePath(briefsPath);
  revalidatePath(briefPath(id));
}

/**
 * Creates a brief in the actor's brand.
 *
 * The concept is read INSIDE the scope, so a concept id belonging to another brand — or to a
 * soft-deleted row — simply never resolves and the brief cannot be created against a parent that is
 * not really there. The §7 number comes from `nextSequence` over the brand's existing briefs, so it
 * increments per funnel-and-format pair and never reuses a soft-deleted row's number.
 */
export async function createBriefAction(
  _previous: BriefActionResult | null,
  formData: FormData,
): Promise<BriefActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }
  const { values } = parsed;

  // A new brief starts at the first step of its own ladder — which is why this is computed from the
  // type rather than taken from the column default, a video-track literal a static brief could not
  // rest on. Both statuses are therefore known without a database, so the gate is checked here,
  // before the actor lookup and before a connection, exactly as the demo refusal is.
  const track = creativeTrack(values.type);
  const internal = internalStatusOr(track, values.internalStatus, trackStart(track));
  if (isFailure(internal)) {
    return internal;
  }
  const client = clientStatusOr(values.clientStatus, BRIEF_CLIENT_STATUS_DEFAULT);
  if (isFailure(client)) {
    return client;
  }
  const refusal = clientMoveRefusal(internal, BRIEF_CLIENT_STATUS_DEFAULT, client);
  if (refusal !== null) {
    return refusal;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const concept =
        values.conceptId === null ? null : await getConceptById(db, brandId, values.conceptId);
      if (values.conceptId !== null && concept === null) {
        return fieldFailure({ conceptId: 'That concept is no longer available.' });
      }

      const sequence = nextSequence(await listBriefs(db, brandId), values.funnel, values.type);
      const input = toInput(values, concept, sequence, internal, client);
      const created = await insertBrief(db, brandId, input, actor);
      return { ok: true as const, id: created.id, name: created.name, savedAt: Date.now() };
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!outcome.ok) {
      return outcome;
    }
    revalidateBrief(outcome.id);
    return outcome;
  } catch {
    return { ok: false, error: 'The brief could not be saved. Try again.' };
  }
}

/**
 * Patches one brief of the actor's brand; another brand's id simply never resolves.
 *
 * The §7 number is the row's own — it was assigned at creation and a creative keeps the number it
 * was printed with — but the NAME is rebuilt from scratch on every save, so changing the funnel, the
 * type, the version or the concept renames the creative in the same write that changes it.
 */
export async function updateBriefAction(
  _previous: BriefActionResult | null,
  formData: FormData,
): Promise<BriefActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This brief could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }
  const { values } = parsed;
  const track = creativeTrack(values.type);

  // The gate, as early as it can be asked. When the page submits both statuses — which the detail
  // page always does — the answer needs no row, so a client move behind a closed gate is refused
  // before the actor lookup and before a connection. When either is left out, "where it is" is the
  // row's, and the same check runs inside the scope below.
  if (values.internalStatus !== null && values.clientStatus !== null) {
    const internal = internalStatusOr(track, values.internalStatus, trackStart(track));
    if (isFailure(internal)) {
      return internal;
    }
    const client = clientStatusOr(values.clientStatus, BRIEF_CLIENT_STATUS_DEFAULT);
    if (isFailure(client)) {
      return client;
    }
    const gate = clientGateRefusal(internal, client);
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
      const [current, concept] = await Promise.all([
        getBriefById(db, brandId, id),
        values.conceptId === null
          ? Promise.resolve(null)
          : getConceptById(db, brandId, values.conceptId),
      ]);
      if (current === null) {
        return { ok: false as const, error: 'That brief is no longer available.' };
      }
      if (values.conceptId !== null && concept === null) {
        return fieldFailure({ conceptId: 'That concept is no longer available.' });
      }

      // The row's stored strings are `text`; narrow them against this brief's ladder before asking
      // the machine anything. A row resting on the column default — a video-track literal a static
      // brief cannot be on — is read as its own track's first step, the same reading the page gets
      // from `briefs-source.ts`, so a save never silently moves a brief it only meant to edit.
      const wasInternal: InternalStatusKey = isInternalStatusOf(track, current.internalStatus)
        ? current.internalStatus
        : trackStart(track);
      const wasClient: ClientStatusKey = isClientStatus(current.clientStatus)
        ? current.clientStatus
        : BRIEF_CLIENT_STATUS_DEFAULT;

      const internal = internalStatusOr(track, values.internalStatus, wasInternal);
      if (isFailure(internal)) {
        return internal;
      }
      const client = clientStatusOr(values.clientStatus, wasClient);
      if (isFailure(client)) {
        return client;
      }

      const internalRefusal = internalMoveRefusal(track, wasInternal, internal);
      if (internalRefusal !== null) {
        return internalRefusal;
      }
      const clientRefusal = clientMoveRefusal(internal, wasClient, client);
      if (clientRefusal !== null) {
        return clientRefusal;
      }

      const input = toInput(values, concept, current.sequence, internal, client);
      const saved = await updateBrief(db, brandId, id, input, actor);
      if (saved === null) {
        return { ok: false as const, error: 'That brief is no longer available.' };
      }
      return { ok: true as const, id: saved.id, name: saved.name, savedAt: Date.now() };
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!outcome.ok) {
      return outcome;
    }
    revalidateBrief(outcome.id);
    return outcome;
  } catch {
    return { ok: false, error: 'The brief could not be saved. Try again.' };
  }
}

/** The three QA columns, as the checkbox group submits them (ticket criterion 10). */
const qaCheck = z.enum(['qaVideoEditor', 'qaDesigner', 'qaStrategist']);

/** A checkbox posts its new state explicitly, so a double submit is idempotent, not a toggle race. */
const qaSchema = z.object({
  check: qaCheck,
  checked: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

/**
 * Ticks or unticks ONE of the three QA checkboxes on one brief of the actor's brand.
 *
 * Deliberately not part of `updateBriefAction`: a reviewer ticking "Graphic Designer QA" is saying
 * one thing about one column, and routing it through the full form write would make it re-store
 * every rich-text field the page happens to be holding. It is also the one write that does NOT
 * recompute the name — a QA tick is not a segment of the PRD §7 string — so the stored name is left
 * exactly as it was found rather than rebuilt from a form that was never submitted.
 *
 * The new state is submitted, not inferred, so two clicks that race land on the same value instead
 * of cancelling out.
 */
export async function toggleQaAction(
  _previous: BriefActionResult | null,
  formData: FormData,
): Promise<BriefActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This brief could not be identified.' };
  }

  const parsed = qaSchema.safeParse({
    check: formData.get('check'),
    checked: formData.get('checked'),
  });
  if (!parsed.success) {
    return fieldFailure({ qa: 'That is not one of the three QA checks.' });
  }
  const { check, checked } = parsed.data;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const saved = await updateBrief(db, brandId, id, { [check]: checked }, actor);
      return saved === null
        ? { ok: false as const, error: 'That brief is no longer available.' }
        : { ok: true as const, id: saved.id, name: saved.name, savedAt: Date.now() };
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!outcome.ok) {
      return outcome;
    }
    revalidateBrief(outcome.id);
    return outcome;
  } catch {
    return { ok: false, error: 'The QA checklist could not be saved. Try again.' };
  }
}
