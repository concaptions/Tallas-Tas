'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  BRIEF_CLIENT_STATUS_DEFAULT,
  createBrief,
  getBriefById,
  getConceptById,
  insertActivity,
  listBriefSequences,
  updateBrief,
  updateBriefDimensionsWith,
  type BriefInput,
} from '@tas/db';
import {
  creativePerformances,
  creativeSources,
  type CreativePerformance,
  type CreativeSource,
} from '@tas/db/schema';
import { BRIEF_NAME_DEFAULT_SOURCE, generateBriefName } from '@tas/domain/briefs';
import {
  applyDimensionChange,
  conceptNameSegment,
  creativeTrack,
  dimensionsFor,
  isCreativeFunnel,
  isCreativePriority,
  isCreativeType,
  isCreativeVersion,
  isKnownOrLegacyDimension,
  nextSequence,
  normalizeCreativeDimension,
  type CreativeFunnelKey,
  type CreativePriorityKey,
  type CreativeTypeKey,
  type DimensionChange,
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

import { diffFields } from '@tas/domain';
import {
  canStartBrief,
  EDITOR_STAGE_KEYS,
  editorStageMoveTarget,
  startedStatusFor,
  type EditorStageKey,
} from '@tas/domain/state';

import { currentActor } from '@/lib/actor';
import { withBrandScope } from '@/lib/briefs-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { briefPath, briefsPath, creativeSheetPath } from '@/lib/routes';

/**
 * The Creative Briefs route's three mutations (PRD §5.10). All three follow `angles/actions.ts` and
 * `concepts/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. parse the submitted `FormData` with zod, which owns the *shape*: which keys exist, that a
 *    funnel, type, priority, version and dimension are members of the `@tas/domain/creatives`
 *    vocabularies, and that an empty text field is stored as NULL rather than as an empty string;
 * 3. go through the domain functions for everything that is a rule — `generateBriefName` for the
 *    Oct 5 CREATE name, `allocateBriefNumber` for the brand-wide counter it reads, `nextSequence`
 *    for the row's own `sequence`, `dimensionsFor` for the §8 defaults, `creativeTrack` for which
 *    ladder the brief is graded on, and `isClientTrackOpen` / `canTransition*` for the two-track
 *    gate. No rule is restated here;
 * 4. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 5. revalidate both routes and return a typed result. None of them ever throws to the client.
 *
 * THE NAME IS WRITTEN ONCE, AT CREATE. The Oct 5 formula (`generateBriefName`) composes
 * `Source-Funnel-TypeInitial-Number-Concept-Batch` from the submitted parts and the brand-wide
 * `brief_number` the create action allocates in one transaction. The CREATE action also offers a
 * manual-override: when the form posts `nameMode: 'manual'` plus a non-empty `nameOverride`, that
 * string is stored verbatim instead. UPDATE does NOT touch `name`: a brief keeps the name it was
 * printed with, so a later field edit cannot drift the string from the file sitting in a drive
 * somewhere. The cascade in `concepts/actions.ts` still uses the legacy §7 formula to rewrite
 * briefs whose concept was renamed; new briefs named by the Oct 5 formula will be rewritten in §7
 * when their concept is renamed, and that reconciliation is deferred to a follow-up ticket.
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
  | 'performance'
  | 'assignee'
  | 'dueDate'
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
  | 'source'
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

/** The due date as `<input type="date">` posts it: `YYYY-MM-DD`, or empty for "not set" → NULL. */
const optionalDate = z
  .string()
  .trim()
  .transform((value) => {
    if (value === '') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  })
  .nullable();

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

function isCreativePerformance(value: string): value is CreativePerformance {
  return creativePerformances.some((grade) => grade === value);
}

/**
 * The Performance grade (PRD §5.10): one of the three `creativePerformances` names, or empty for
 * "not graded yet", stored as NULL. OPTIONAL at the key level, and that is a different thing from
 * empty: a submission that carries no `performance` key at all leaves the stored grade exactly where
 * it is, the way an absent status does. Two submitters rely on that. The board's drag rebuilds its
 * form from a snapshot that predates this field and must not blank a grade it never offered. The
 * detail page submits the select on every save, so a save there writes what it shows — with ONE
 * exception: the column is plain `text` with no CHECK and the Airtable importer writes the Gratsi
 * choice unmapped, so a live row can hold a grade outside the three; while that stored value is
 * still the choice the page withholds the key, so an untouched legacy grade is kept rather than
 * refused, and submits it again the moment one of the three or "not graded yet" is picked.
 */
const performance = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine(
    (value) => value === null || isCreativePerformance(value),
    'That is not one of the three performance grades.',
  )
  .transform((value): CreativePerformance | null => (value === null ? null : value))
  .optional();

/**
 * One stored dimension: a checked §8 ratio, or the NAME of an Airtable `(Internal) Creative
 * Dimensions` record an imported brief carries (`'IG Story / Reel'`). The form re-posts the stored
 * array on every save and every board move, so refusing a legacy name refused the whole update of
 * every imported brief (the Oct 2026 "values show but select does not fire" bug). The gate is
 * `isKnownOrLegacyDimension` from `@tas/domain/creatives`, and a name that maps to a ratio is stored
 * as the ratio by `normalizeCreativeDimension`; a name this build cannot place is kept verbatim.
 */
const dimension = z
  .string()
  .refine(isKnownOrLegacyDimension, 'That is not one of the delivery ratios.')
  .transform((value): string => normalizeCreativeDimension(value));

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
  performance,
  assignee: text,
  dueDate: optionalDate,
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
  // Oct 5 brief auto-naming (Agent 3). `nameMode` says whether the CREATE path generates the
  // name with `generateBriefName` or takes the user-supplied `nameOverride` verbatim — the
  // manual-override toggle the paste calls for. Both are optional: a form that submits neither
  // falls into the default "auto" branch and the generator writes the name. `nameOverride` is
  // trimmed and never writes an empty string; UPDATE ignores both.
  nameMode: z
    .string()
    .trim()
    .transform((value) => (value === '' ? 'auto' : value))
    .refine((value): value is 'auto' | 'manual' => value === 'auto' || value === 'manual', {
      message: 'That is not one of the two name modes.',
    })
    .optional(),
  nameOverride: text.optional(),
  // Source: the first segment of the name AND the `source` column (audit item 9, 2026-10-09 —
  // the column used to keep its default whatever the form said). Empty defaults to TAS here,
  // not only inside the generator, so the stored column and the printed prefix always agree;
  // anything outside `creativeSources` is refused. Absent (an UPDATE form without the field)
  // leaves the column alone.
  source: z
    .string()
    .trim()
    .transform((value) => (value === '' ? BRIEF_NAME_DEFAULT_SOURCE : value))
    .refine(isCreativeSource, 'That is not one of the two sources.')
    .optional(),
});

function isCreativeSource(value: string): value is CreativeSource {
  return (creativeSources as readonly string[]).includes(value);
}

type BriefFormValues = z.infer<typeof briefSchema>;

/**
 * `FormData` to the schema's input. `inspoLinks` and `dimensions` are repeated entries (one input
 * per link row, a checkbox group), so they are read with `getAll`; everything else is a single
 * value, and a missing key becomes `''` so the schema's "empty means NULL" branch runs — except
 * `performance`, where a missing key stays missing so the schema's "absent means leave it" branch
 * runs instead.
 */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const many = (key: string): string[] =>
    formData.getAll(key).filter((value) => typeof value === 'string');
  const optional = (key: string): string | undefined =>
    formData.has(key) ? single(key) : undefined;

  return {
    conceptId: single('conceptId'),
    funnel: single('funnel'),
    type: single('type'),
    version: single('version'),
    batch: single('batch'),
    product: single('product'),
    priority: single('priority'),
    performance: optional('performance'),
    assignee: single('assignee'),
    dueDate: single('dueDate'),
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
    // Absent means "auto" / no override — never the empty string, which would mean
    // "clear the name" to a human but is just unset to the schema.
    nameMode: optional('nameMode'),
    nameOverride: optional('nameOverride'),
    source: optional('source'),
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
    : fieldFailure({ internalStatus: 'That is not a status on this creative’s internal track.' });
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
 * statuses. Omits `name`, which the two call sites fill in differently: CREATE generates the Oct 5
 * name through `generateBriefName`, UPDATE does not touch it. A standalone brief supplies its own
 * batch and may carry a product suffix; a linked brief copies the concept's batch.
 */
function toInput(
  values: BriefFormValues,
  concept: ParentConcept | null,
  sequence: number,
  internal: InternalStatusKey,
  client: ClientStatusKey,
): Omit<BriefInput, 'name'> {
  const batch = concept?.batch ?? values.batch;

  return {
    conceptId: values.conceptId,
    batch,
    // Absent from the submission means absent from the statement, exactly as `performance`.
    ...(values.source === undefined ? {} : { source: values.source }),
    funnel: values.funnel,
    type: values.type,
    version: values.version,
    sequence,
    priority: values.priority,
    // Absent from the submission means absent from the statement: the stored grade is left alone.
    ...(values.performance === undefined ? {} : { performance: values.performance }),
    assignee: values.assignee,
    dueDate: values.dueDate,
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

/**
 * Every route that renders a brief, revalidated together after every write: the list, the detail
 * page, and the Creative Sheet, whose "Editing stage" board reads the briefs' internal status.
 */
function revalidateBrief(id: string): void {
  revalidatePath(briefsPath);
  revalidatePath(briefPath(id));
  revalidatePath(creativeSheetPath);
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

      // The Oct 5 formula allocates the brand-wide `brief_number` inside a transaction, so a
      // concurrent create cannot read the same `MAX`. The §7 per-funnel-and-format `sequence`
      // still exists on the row, kept consistent for the legacy formula and the Kanban drag.
      // Only the counter inputs (SMOKE-14): `listBriefs` read every column of every brief and the
      // three inherited tables to pick one integer.
      const sequence = nextSequence(
        await listBriefSequences(db, brandId),
        values.funnel,
        values.type,
      );
      const base = toInput(values, concept, sequence, internal, client);

      // Manual-override toggle: when `nameMode === 'manual'` AND the user typed a non-empty
      // name, that string is stored verbatim and the row is `manual` — nothing ever rewrites it.
      // Any other combination — auto, missing override, override blanked back out — falls
      // through to the Oct 5 formula and the row is `auto`, so a concept rename keeps it in step.
      const override =
        values.nameMode === 'manual' &&
        typeof values.nameOverride === 'string' &&
        values.nameOverride !== ''
          ? values.nameOverride
          : null;
      // One transaction: the brand-wide `brief_number` under the advisory lock and the brief. The
      // Creative Sheet is a view over the briefs, so the new creative is on the sheet at once.
      const created = await createBrief(
        db,
        brandId,
        base,
        (briefNumber) =>
          override ??
          generateBriefName({
            source: values.source ?? null,
            funnel: values.funnel,
            creativeType: values.type,
            number: briefNumber,
            // The concept's `Angle-Theme` segment, not its whole `Batch-Angle-Theme` name: the
            // batch is already the trailing segment (audit item 7 found `…-B1-Pain-UGC-B1`).
            concept: concept === null ? null : conceptNameSegment(concept),
            batch: base.batch,
          }),
        override === null ? 'auto' : 'manual',
        actor,
      );
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
    return { ok: false, error: 'The creative could not be saved. Try again.' };
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
    return { ok: false, error: 'This creative could not be identified.' };
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
    const actorName = (await currentActor()).fullName;

    const outcome = await withBrandScope(async (db, brandId) => {
      const [current, concept] = await Promise.all([
        getBriefById(db, brandId, id),
        values.conceptId === null
          ? Promise.resolve(null)
          : getConceptById(db, brandId, values.conceptId),
      ]);
      if (current === null) {
        return { ok: false as const, error: 'That creative is no longer available.' };
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

      // The paste's rule for the Oct 5 formula: UPDATE never overwrites `name`. `toInput`
      // returns `Omit<BriefInput, 'name'>`, so the patch below carries every other field but
      // leaves the stored string exactly as it was.
      const input = toInput(values, concept, current.sequence, internal, client);
      const saved = await updateBrief(db, brandId, id, input, actor);
      if (saved === null) {
        return { ok: false as const, error: 'That creative is no longer available.' };
      }
      // The activity log (EDIT-03): every field this write changed, old → new, by whom, written
      // here beside the row update and never from the client.
      await insertActivity(
        db,
        brandId,
        BRIEF_ENTITY,
        saved.id,
        diffFields(current, input, BRIEF_ACTIVITY_FIELDS),
        { id: actor, name: actorName },
      );
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
    return { ok: false, error: 'The creative could not be saved. Try again.' };
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
    return { ok: false, error: 'This creative could not be identified.' };
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
        ? { ok: false as const, error: 'That creative is no longer available.' }
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

/** One tick on the brief page's Dimensions picker: the ratio and whether it was ticked or unticked. */
const dimensionChangeSchema = z.object({
  op: z.enum(['add', 'remove']),
  key: z.string().refine(isKnownOrLegacyDimension, 'That is not one of the delivery ratios.'),
});

export interface BriefDimensionsSuccess {
  readonly ok: true;
  readonly id: string;
  /** The array the server wrote, so the page adopts what was stored rather than what it guessed. */
  readonly dimensions: readonly string[];
}

export type BriefDimensionsResult = BriefDimensionsSuccess | BriefActionFailure;

/**
 * Applies ONE tick of the brief page's Dimensions picker (smoke test, 2026-10-10: the picker set
 * React state and nothing reached the server until "Save brief"). The change is MERGED onto the
 * stored array on the server, under the brief's row lock (`updateBriefDimensionsWith`), through the
 * domain's `applyDimensionChange` — so a tick can only add or remove the value it names, and the
 * ratios the browser could not read on an imported brief survive it. Writes
 * `creative_briefs.dimensions` through the one write path the Creative Sheet's field uses, and
 * logs the change like every other field write (EDIT-03). Like `toggleQaAction`, it never touches
 * the name.
 */
export async function changeBriefDimensionAction(
  id: string,
  change: DimensionChange,
): Promise<BriefDimensionsResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This creative could not be identified.' };
  }
  const parsed = dimensionChangeSchema.safeParse(change);
  if (!parsed.success) {
    return fieldFailure({ dimensions: 'That is not one of the delivery ratios.' });
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const actorName = (await currentActor()).fullName;

    const outcome = await withBrandScope(async (db, brandId) => {
      let before: readonly string[] = [];
      const saved = await updateBriefDimensionsWith(
        db,
        brandId,
        id,
        (current) => {
          before = current.dimensions;
          return applyDimensionChange(current.dimensions, dimensionsFor(current.type), parsed.data);
        },
        actor,
      );
      if (saved === null) {
        return { ok: false as const, error: 'That creative is no longer available.' };
      }
      await insertActivity(
        db,
        brandId,
        BRIEF_ENTITY,
        saved.id,
        diffFields({ dimensions: before }, { dimensions: saved.dimensions }, ['dimensions']),
        { id: actor, name: actorName },
      );
      return { ok: true as const, id: saved.id, dimensions: saved.dimensions };
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
    return { ok: false, error: 'The dimensions could not be saved. Try again.' };
  }
}

/** The activity log's name for a brief row, and the columns it watches on a save. */
const BRIEF_ENTITY = 'creative_brief';
const BRIEF_ACTIVITY_FIELDS = [
  'internalStatus',
  'clientStatus',
  'assignee',
  'priority',
  'dueDate',
  'type',
  'funnel',
  'version',
  'conceptId',
  'batch',
  'performance',
  'briefToDesign',
  'scriptContent',
  'elementsTested',
  'adContent',
  'inspiration',
  'offer',
  'language',
] as const;

export interface StartBriefSuccess {
  readonly ok: true;
  readonly id: string;
  readonly internalStatus: string;
  readonly assignee: string;
}

export type StartBriefResult = StartBriefSuccess | BriefActionFailure;

/**
 * Start (Sprint 10, EDIT-02): an editor claims an Incoming brief. One click moves it to the track's
 * in-progress status — the move `INTERNAL_*_TRANSITIONS` already allows, checked again here, never
 * invented — and sets the signed-in user as assignee. Both changes are logged. Refused in demo
 * mode, without a session, for a brief that is not Incoming, and for a brief outside the brand.
 */
export async function startBriefAction(briefId: string): Promise<StartBriefResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }
  if (briefId.trim() === '') {
    return { ok: false, error: 'This creative could not be identified.' };
  }
  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const actorName = (await currentActor()).fullName;

    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getBriefById(db, brandId, briefId);
      if (current === null) {
        return { ok: false as const, error: 'That creative is no longer available.' };
      }
      if (!canStartBrief(current.internalStatus)) {
        return { ok: false as const, error: 'Only an Incoming creative can be started.' };
      }
      const track = creativeTrack(current.type);
      const next = startedStatusFor(track);
      const from: InternalStatusKey = isInternalStatusOf(track, current.internalStatus)
        ? current.internalStatus
        : trackStart(track);
      if (!canTransitionInternal(track, from, next)) {
        return { ok: false as const, error: 'That is not the next step on the internal track.' };
      }
      const patch = { internalStatus: next, assignee: actorName };
      const saved = await updateBrief(db, brandId, briefId, patch, actor);
      if (saved === null) {
        return { ok: false as const, error: 'That creative is no longer available.' };
      }
      await insertActivity(
        db,
        brandId,
        BRIEF_ENTITY,
        saved.id,
        diffFields(current, patch, ['internalStatus', 'assignee']),
        { id: actor, name: actorName },
      );
      return { ok: true as const, id: saved.id, internalStatus: next, assignee: actorName };
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
    return { ok: false, error: 'The creative could not be started. Try again.' };
  }
}

export interface MoveBriefStageSuccess {
  readonly ok: true;
  readonly id: string;
  readonly internalStatus: string;
}

export type MoveBriefStageResult = MoveBriefStageSuccess | BriefActionFailure;

function isEditorStage(value: string): value is EditorStageKey {
  return (EDITOR_STAGE_KEYS as readonly string[]).includes(value);
}

/**
 * A card dropped in another column of the editor board (the Creative Sheet's "Editing stage"
 * grouping, 2026-10-09). The status it writes is `editorStageMoveTarget`'s — Incoming → Under
 * Editing is the track's in-progress step, Under Editing → Under Review is the submission — and a
 * drop the machine refuses is refused here too, never written. Only `internal_status` changes:
 * the assignee is Start's business, not a drag's. Refused in demo mode, for a stage that is not
 * one of the three, without a session, and for a brief outside the brand.
 */
export async function moveBriefStageAction(
  briefId: string,
  stage: string,
): Promise<MoveBriefStageResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }
  if (briefId.trim() === '') {
    return { ok: false, error: 'This creative could not be identified.' };
  }
  if (!isEditorStage(stage)) {
    return { ok: false, error: 'That is not a column on the editor board.' };
  }
  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const actorName = (await currentActor()).fullName;

    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getBriefById(db, brandId, briefId);
      if (current === null) {
        return { ok: false as const, error: 'That creative is no longer available.' };
      }
      const next = editorStageMoveTarget(
        current.internalStatus,
        creativeTrack(current.type),
        stage,
      );
      if (next === null) {
        return { ok: false as const, error: 'That is not the next step on the internal track.' };
      }
      const patch = { internalStatus: next };
      const saved = await updateBrief(db, brandId, briefId, patch, actor);
      if (saved === null) {
        return { ok: false as const, error: 'That creative is no longer available.' };
      }
      await insertActivity(
        db,
        brandId,
        BRIEF_ENTITY,
        saved.id,
        diffFields(current, patch, ['internalStatus']),
        {
          id: actor,
          name: actorName,
        },
      );
      return { ok: true as const, id: saved.id, internalStatus: next };
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
    return { ok: false, error: 'The creative could not be moved. Try again.' };
  }
}
