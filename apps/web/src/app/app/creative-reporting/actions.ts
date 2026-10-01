'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertCreativeReport, updateCreativeReport, type CreativeReportInput } from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/creative-reporting-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { creativeReportingPath } from '@/lib/routes';

import { percentTextToCtr } from './fields';

/**
 * The Creative Reporting route's two mutations (Airtable "Creative Reporting", audit §2 row 14 and
 * §14). Both follow `products/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection;
 * 2. validate with zod: a report needs its "Name + Angle + Offer"; every metric is an optional
 *    non-negative number stored at its column's scale (CTR typed as a percent, stored as the
 *    fraction the base keeps); the ad link is `http(s)`, the ad design one URL per line; empty
 *    means NULL, never an empty string;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement and keep
 *    the brief link only when it is the brand's own;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 */

/** The eleven stored columns plus the brief link. `fields.ts` labels these; nothing else is editable. */
export type CreativeReportFieldName =
  | 'nameAngleOffer'
  | 'briefId'
  | 'notes'
  | 'adDesign'
  | 'adLink'
  | 'ctr'
  | 'thumbStopRate'
  | 'results'
  | 'cpa'
  | 'targetCpa'
  | 'roas'
  | 'targetRoas';

export interface CreativeReportActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface CreativeReportActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CreativeReportFieldName, string>>;
}

export type CreativeReportActionResult = CreativeReportActionSuccess | CreativeReportActionFailure;

const FIELD_NAMES: readonly CreativeReportFieldName[] = [
  'nameAngleOffer',
  'briefId',
  'notes',
  'adDesign',
  'adLink',
  'ctr',
  'thumbStopRate',
  'results',
  'cpa',
  'targetCpa',
  'roas',
  'targetRoas',
];

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const LINK_MESSAGE = 'Enter a full link, starting with https://';
const NUMBER_MESSAGE = 'Enter a number, zero or more.';

const optionalText = z.string().transform((value) => (value.trim() === '' ? null : value.trim()));

const optionalLink = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || isHttpUrl(value), LINK_MESSAGE);

/** One URL per line, stored as an array; no lines means NULL. */
const urlList = z
  .string()
  .transform((text) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  )
  .refine((lines) => lines.every(isHttpUrl), `Every line must be a full link. ${LINK_MESSAGE}`)
  .transform((lines) => (lines.length === 0 ? null : lines));

/** A `numeric(p, scale)` column: empty is NULL, a value is a non-negative number at that scale. */
function optionalDecimal(scale: number, max = Number.POSITIVE_INFINITY) {
  return z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .refine(
      (value) => value === null || (Number.isFinite(value) && value >= 0 && value <= max),
      NUMBER_MESSAGE,
    )
    .transform((value) => (value === null ? null : value.toFixed(scale)));
}

/** CTR arrives as a percent (`4.12`) and is stored as the fraction (`0.0412`) at scale 4. */
const optionalPercent = z
  .string()
  .trim()
  .refine((value) => {
    if (value === '') return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  }, 'Enter a percentage between 0 and 100.')
  .transform(percentTextToCtr);

const creativeReportSchema = z.object({
  nameAngleOffer: z.string().trim().min(1, 'A report needs its name, angle and offer.'),
  briefId: optionalText,
  notes: optionalText,
  adDesign: urlList,
  adLink: optionalLink,
  ctr: optionalPercent,
  thumbStopRate: optionalDecimal(2, 9999.99),
  results: optionalDecimal(1),
  cpa: optionalDecimal(2),
  targetCpa: optionalDecimal(2),
  roas: optionalDecimal(2),
  targetRoas: optionalDecimal(1),
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    FIELD_NAMES.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === 'string' ? value : ''];
    }),
  );
}

function failureFrom(error: z.ZodError): CreativeReportActionFailure {
  const fieldErrors: Partial<Record<CreativeReportFieldName, string>> = {};
  for (const issue of error.issues) {
    const [head] = issue.path;
    if (typeof head === 'string') {
      fieldErrors[head as CreativeReportFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: CreativeReportInput } | CreativeReportActionFailure {
  const parsed = creativeReportSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

const SAVE_FAILED = 'The report could not be saved. Try again.';
const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';

/** Creates a report in the actor's brand. */
export async function createCreativeReportAction(
  _previous: CreativeReportActionResult | null,
  formData: FormData,
): Promise<CreativeReportActionResult> {
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
      return { ok: false, error: SESSION_EXPIRED };
    }
    const created = await withBrandScope((db, brandId) =>
      insertCreativeReport(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(creativeReportingPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** Patches one report of the actor's brand; another brand's id simply never resolves. */
export async function updateCreativeReportAction(
  _previous: CreativeReportActionResult | null,
  formData: FormData,
): Promise<CreativeReportActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This report could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateCreativeReport(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That report is no longer available.' };
    }
    revalidatePath(creativeReportingPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}
