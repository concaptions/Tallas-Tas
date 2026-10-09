'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertYoutubeCopy,
  listYoutubeCopyNumbers,
  syncYoutubeCopyLinks,
  updateYoutubeCopy,
  type YoutubeCopyInput,
  type YoutubeCopyLinkIds,
} from '@tas/db';
import { nextCopyNumber } from '@tas/domain/copy';
import { COPY_STATUS_INITIAL, COPY_STATUS_KEYS } from '@tas/domain/state';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { assertWorkspaceLive } from '@/lib/removed-workspaces';
import { youtubeCopywritingPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/youtube-copywriting-source';

import {
  CTA_KEYS,
  DESCRIPTIONS_LIMIT_MESSAGE,
  DESCRIPTIONS_MAX,
  FUNNEL_KEYS,
  META_RATING_MAX,
  META_RATING_MESSAGE,
  META_RATING_MIN,
  NONE_VALUE,
  type YoutubeCopyFieldName,
} from './fields';

/**
 * The YouTube Copywriting route's two mutations (Airtable `tblVR1UmkbDoDzJ7z`). Both follow
 * `products/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod. Every select is a closed vocabulary: `z.enum` over the KEYS the columns are
 *    typed from, so a label or a typo is refused rather than stored. Descriptions carry the one
 *    rule Airtable states in the field's own name — at most 90 characters — with the same message
 *    the panel shows. A key the form did not submit at all is `undefined` and means "leave that
 *    column exactly as it is", which is what lets the kanban move post only `id` and `status`;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement, and
 *    sync the four record links through `syncYoutubeCopyLinks`, which drops any id outside the
 *    brand before it reaches a junction;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * THE COPY # IS NEVER SUBMITTED. `copy_number` is auto-generated (CLAUDE.md non-negotiable 6): a
 * create takes the next free number from `nextCopyNumber` in `@tas/domain/copy` over the brand's
 * stored numbers, an update keeps the number the row was given, and no form field is read for it.
 *
 * LINKS ARE SYNCED ONLY WHEN THE PANEL SAYS SO. An unchecked picker posts nothing, so "every chip
 * off" and "the pickers were not on the form" look the same in `FormData`; the panel adds a
 * `syncLinks` marker, and a form without it (the kanban move) leaves every junction as it is.
 */

export interface YoutubeCopyActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface YoutubeCopyActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<YoutubeCopyFieldName, string>>;
}

export type YoutubeCopyActionResult = YoutubeCopyActionSuccess | YoutubeCopyActionFailure;

const NEEDS_ATTENTION = 'Some fields need attention before this can be saved.';
const UNAVAILABLE = 'That copy is no longer available.';
const COULD_NOT_SAVE = 'The copy could not be saved. Try again.';

/** A submitted text value: trimmed, empty stored as NULL, absent left untouched. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .optional();

/** The one Airtable rule on this table, with the one message the panel shows. */
const descriptions = z
  .string()
  .trim()
  .max(DESCRIPTIONS_MAX, DESCRIPTIONS_LIMIT_MESSAGE)
  .transform((value) => (value === '' ? null : value))
  .optional();

/** A closed vocabulary with a "none" row: the sentinel and the empty string both store NULL. */
const emptyToNull = (value: unknown): unknown =>
  value === '' || value === NONE_VALUE ? null : value;

const cta = z
  .preprocess(emptyToNull, z.enum(CTA_KEYS, 'Choose a CTA from the list.').nullable())
  .optional();

const funnel = z
  .preprocess(emptyToNull, z.enum(FUNNEL_KEYS, 'Choose a funnel from the list.').nullable())
  .optional();

/** The status has no "none" row: a row is always in one of the five `COPY_STATUS` states. */
const status = z.enum(COPY_STATUS_KEYS, 'Choose a status from the list.').optional();

/** A checkbox, posted by the panel as "true" or "false"; absent means unchanged. */
const flag = z
  .string()
  .transform((value) => value === 'true')
  .optional();

/** The star rating: empty is NULL, anything else a whole number from 0 to 5. */
const metaRating = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number(value)))
  .refine(
    (value) =>
      value === null ||
      (Number.isInteger(value) && value >= META_RATING_MIN && value <= META_RATING_MAX),
    META_RATING_MESSAGE,
  )
  .optional();

const youtubeCopySchema = z.object({
  status,
  angle: optionalText,
  descriptions,
  headline: optionalText,
  newsFeed: optionalText,
  cta,
  funnel,
  clientComment: optionalText,
  used: flag,
  winning: flag,
  metaRating,
});

type YoutubeCopyFormValues = z.infer<typeof youtubeCopySchema>;

const FIELD_KEYS: readonly YoutubeCopyFieldName[] = [
  'status',
  'angle',
  'descriptions',
  'headline',
  'newsFeed',
  'cta',
  'funnel',
  'clientComment',
  'used',
  'winning',
  'metaRating',
];

/** The panel's marker that its four pickers were on the form, so their (possibly empty) lists count. */
const SYNC_LINKS_KEY = 'syncLinks';

const idList = z.array(z.string().trim().min(1));

const linksSchema = z.object({
  collectionIds: idList,
  productIds: idList,
  campaignOfferIds: idList,
  copyTypeIds: idList,
});

/**
 * `FormData` to the schema's input. A key the form did not submit is left out entirely rather than
 * turned into `''`, so `undefined` survives into the parsed values and means "unchanged".
 */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of FIELD_KEYS) {
    if (formData.has(key)) {
      const value = formData.get(key);
      fields[key] = typeof value === 'string' ? value : '';
    }
  }
  return fields;
}

/** Every string value posted under `key`: the repeated hidden inputs of one chip picker. */
function many(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === 'string');
}

function failureFrom(error: z.ZodError): YoutubeCopyActionFailure {
  const fieldErrors: Partial<Record<YoutubeCopyFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as YoutubeCopyFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

interface Parsed {
  readonly values: YoutubeCopyFormValues;
  /** The four id lists, or null when the pickers were not on the form. */
  readonly links: YoutubeCopyLinkIds | null;
}

function parse(formData: FormData): Parsed | YoutubeCopyActionFailure {
  const parsed = youtubeCopySchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }
  if (!formData.has(SYNC_LINKS_KEY)) {
    return { values: parsed.data, links: null };
  }
  const links = linksSchema.safeParse({
    collectionIds: many(formData, 'collectionIds'),
    productIds: many(formData, 'productIds'),
    campaignOfferIds: many(formData, 'campaignOfferIds'),
    copyTypeIds: many(formData, 'copyTypeIds'),
  });
  return links.success
    ? { values: parsed.data, links: links.data }
    : { ok: false, error: 'The linked records could not be read. Reopen the panel and try again.' };
}

/** The submitted columns only: an absent key is left out so the update does not touch it. */
function toPatch(values: YoutubeCopyFormValues): Partial<YoutubeCopyInput> {
  const patch: Partial<YoutubeCopyInput> = {};
  if (values.status !== undefined) patch.status = values.status;
  if (values.angle !== undefined) patch.angle = values.angle;
  if (values.descriptions !== undefined) patch.descriptions = values.descriptions;
  if (values.headline !== undefined) patch.headline = values.headline;
  if (values.newsFeed !== undefined) patch.newsFeed = values.newsFeed;
  if (values.cta !== undefined) patch.cta = values.cta;
  if (values.funnel !== undefined) patch.funnel = values.funnel;
  if (values.clientComment !== undefined) patch.clientComment = values.clientComment;
  if (values.used !== undefined) patch.used = values.used;
  if (values.winning !== undefined) patch.winning = values.winning;
  if (values.metaRating !== undefined) patch.metaRating = values.metaRating;
  return patch;
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Creates a row in the actor's brand, numbered with the next free Copy #. */
export async function createYoutubeCopyAction(
  _previous: YoutubeCopyActionResult | null,
  formData: FormData,
): Promise<YoutubeCopyActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('youtube-copywriting');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const created = await withBrandScope(async (db, brandId) => {
      const copyNumber = nextCopyNumber(await listYoutubeCopyNumbers(db, brandId));
      const row = await insertYoutubeCopy(
        db,
        brandId,
        { copyNumber, status: COPY_STATUS_INITIAL, ...toPatch(parsed.values) },
        actor,
      );
      if (parsed.links !== null) {
        await syncYoutubeCopyLinks(db, brandId, row.id, parsed.links);
      }
      return row;
    });
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(youtubeCopywritingPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: COULD_NOT_SAVE };
  }
}

/**
 * Patches one row of the actor's brand; another brand's id simply never resolves, and its links
 * are never touched either, because the sync runs only after the scoped update found the row.
 */
export async function updateYoutubeCopyAction(
  _previous: YoutubeCopyActionResult | null,
  formData: FormData,
): Promise<YoutubeCopyActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('youtube-copywriting');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This copy could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope(async (db, brandId) => {
      const row = await updateYoutubeCopy(db, brandId, id, toPatch(parsed.values), actor);
      if (row !== null && parsed.links !== null) {
        await syncYoutubeCopyLinks(db, brandId, row.id, parsed.links);
      }
      return row;
    });
    if (saved === null) {
      return { ok: false, error: UNAVAILABLE };
    }
    revalidatePath(youtubeCopywritingPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: COULD_NOT_SAVE };
  }
}
