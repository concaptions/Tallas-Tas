'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertProduct, updateProduct, type ProductInput } from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/products-source';
import { productsPath } from '@/lib/routes';

/**
 * The Products route's two mutations (PRD §5.1). Both follow `personas/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod: a product needs a name and a landing page link, and the collection link is
 *    optional (empty is stored as NULL, never as an empty string, so "unset" has one
 *    representation and the table can render the em dash from `fields.ts`);
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * There is no import action yet: the Upload CSV button is disabled in demo mode through
 * `DisabledWrite`, and its live path lands with the bulk-upload phase. Download template is not a
 * write at all — it builds `toCsv(PRODUCT_CSV_COLUMNS, [])` in the browser and never calls a
 * Server Action.
 */

/** The three writable product columns. `fields.ts` labels these; nothing else is editable. */
export type ProductFieldName = 'name' | 'link' | 'collectionLink';

export interface ProductActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface ProductActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<ProductFieldName, string>>;
}

export type ProductActionResult = ProductActionSuccess | ProductActionFailure;

/** An `http(s)` URL, or a message a strategist can act on. Anything else is not a landing page. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const LINK_MESSAGE = 'Enter a full link, starting with https://';

/** The required landing page link: PRD §5.1 calls this the one part that cannot be left out. */
const requiredLink = z
  .string()
  .trim()
  .min(1, 'A product needs a landing page link.')
  .refine(isHttpUrl, LINK_MESSAGE);

/** The optional collection link: empty means NULL, a value must still be a real link. */
const optionalLink = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || isHttpUrl(value), LINK_MESSAGE);

const productSchema = z.object({
  name: z.string().trim().min(1, 'A product needs a name.'),
  link: requiredLink,
  collectionLink: optionalLink,
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): ProductActionFailure {
  const fieldErrors: Partial<Record<ProductFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as ProductFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: ProductInput } | ProductActionFailure {
  const parsed = productSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

/** Creates a product in the actor's brand. */
export async function createProductAction(
  _previous: ProductActionResult | null,
  formData: FormData,
): Promise<ProductActionResult> {
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
      insertProduct(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(productsPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The product could not be saved. Try again.' };
  }
}

/** Patches one product of the actor's brand; another brand's id simply never resolves. */
export async function updateProductAction(
  _previous: ProductActionResult | null,
  formData: FormData,
): Promise<ProductActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This product could not be identified.' };
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
      updateProduct(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That product is no longer available.' };
    }
    revalidatePath(productsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The product could not be saved. Try again.' };
  }
}
