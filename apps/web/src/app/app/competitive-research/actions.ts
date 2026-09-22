'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertCompetitiveResearch,
  updateCompetitiveResearch,
  type CompetitiveResearchInput,
} from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/competitive-research-source';
import { competitiveResearchPath } from '@/lib/routes';

/**
 * The Competitive Research route's two mutations. Follows `products/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod: a competitor needs a name, everything else is optional and an empty string
 *    is stored as NULL, never as `''`, so "unset" has one representation and the table can render
 *    the em dash from `fields.ts`;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 */

/** The seven writable competitive research columns. `fields.ts` labels these. */
export type CompetitiveResearchFieldName =
  'name' | 'type' | 'website' | 'instagram' | 'facebookPage' | 'metaAdsLibrary' | 'analysis';

export interface CompetitiveResearchActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface CompetitiveResearchActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CompetitiveResearchFieldName, string>>;
}

export type CompetitiveResearchActionResult =
  CompetitiveResearchActionSuccess | CompetitiveResearchActionFailure;

/** An optional free-text field: empty means NULL, anything else is stored as typed. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const competitiveResearchSchema = z.object({
  name: z.string().trim().min(1, 'A competitor needs a name.'),
  type: optionalText,
  website: optionalText,
  instagram: optionalText,
  facebookPage: optionalText,
  metaAdsLibrary: optionalText,
  analysis: optionalText,
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): CompetitiveResearchActionFailure {
  const fieldErrors: Partial<Record<CompetitiveResearchFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as CompetitiveResearchFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(
  formData: FormData,
): { values: CompetitiveResearchInput } | CompetitiveResearchActionFailure {
  const parsed = competitiveResearchSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return failureFrom(parsed.error);
  const { name, type, website, instagram, facebookPage, metaAdsLibrary, analysis } = parsed.data;
  return {
    values: {
      name,
      type: type ?? null,
      website: website ?? null,
      instagram: instagram ?? null,
      facebookPage: facebookPage ?? null,
      metaAdsLibrary: metaAdsLibrary ?? null,
      analysis: analysis ?? null,
    },
  };
}

/** Creates a competitive research entry in the actor's brand. */
export async function createCompetitiveResearchAction(
  _previous: CompetitiveResearchActionResult | null,
  formData: FormData,
): Promise<CompetitiveResearchActionResult> {
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
    const created = await withBrandScope((db, brandId) =>
      insertCompetitiveResearch(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(competitiveResearchPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The competitor could not be saved. Try again.' };
  }
}

/** Patches one competitive research entry of the actor's brand; another brand's id never resolves. */
export async function updateCompetitiveResearchAction(
  _previous: CompetitiveResearchActionResult | null,
  formData: FormData,
): Promise<CompetitiveResearchActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This competitor could not be identified.' };
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
    const saved = await withBrandScope((db, brandId) =>
      updateCompetitiveResearch(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That competitor is no longer available.' };
    }
    revalidatePath(competitiveResearchPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The competitor could not be saved. Try again.' };
  }
}
