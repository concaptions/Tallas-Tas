'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { setFieldVisibility, setPageEnabled } from '@tas/db';
import { INTERFACE_PAGE_KEYS } from '@tas/domain';
import { z } from 'zod';

import { isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/interface-config-source';
import { interfaceConfigPath } from '@/lib/routes';

/**
 * The Interface Config route's mutations (PRD §10). All three follow the house pattern of
 * `personas/actions.ts` and `queue/client/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup, env read or connection —
 *    the demo deployment is unauthenticated, so a write must never reach a database;
 * 2. validate the submission with zod, which owns the shape: real uuids, real booleans, and page
 *    keys drawn from `INTERFACE_PAGE_KEYS` in `@tas/domain` rather than from the submission, so a
 *    tampered form cannot name a page the product does not have;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement — a row
 *    id belonging to another brand simply never resolves and comes back as `null`;
 * 4. revalidate the page and return a typed result. None of them ever throws to the client.
 *
 * WHY THE TOGGLES DELEGATE NO RULE TO THE DOMAIN, and it is deliberate rather than an omission.
 * `@tas/domain`'s `toggleField` / `togglePage` FLIP a flag; these actions are handed the flag's
 * TARGET value by a `role="switch"` that already knows what it is about to become, and a flip
 * applied to a row someone else has since changed would write the wrong value. What the domain owns
 * is what the flags MEAN — `visibleFields`, `enabledPages` and `clientCanEdit` decide what a client
 * sees and may change, and nothing in this file restates any of it. `client_editable` is not
 * writable here at all: PRD §10's table fixes it per field, so it is seed data, not a setting.
 *
 * DEMO MODE STILL TOGGLES, IT JUST DOES NOT SAVE (ticket criteria 5, 6 and 13). The page holds its
 * own draft configuration in React state and previews every change instantly with the pure domain
 * toggles; these actions are only ever reached by the Save control, which is disabled through
 * `DisabledWrite` + `disabledWriteClassName` in demo mode. The refusal below is therefore the belt
 * to that brace — a submission that gets here anyway is still refused before anything is read.
 */

export interface InterfaceConfigActionSuccess {
  readonly ok: true;
  /** The rows actually written, so the tree can reconcile without re-reading the page. */
  readonly ids: readonly string[];
  /** Changes with every save, so the page can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface InterfaceConfigActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type InterfaceConfigActionResult =
  InterfaceConfigActionSuccess | InterfaceConfigActionFailure;

/**
 * The message every write shows when there is no database to write to. The house string, and the
 * same sentence as the tooltip on the disabled Save control, so the page says one thing twice
 * rather than two things once.
 */
const DEMO_REFUSAL = 'Sign in required to save changes.';

/** A `role="switch"` submits its next value as a string; nothing else is a boolean here. */
const flag = z
  .union([z.literal('true'), z.literal('false')])
  .transform((value) => value === 'true');

/** One row of the configuration, addressed by its id and told what it should become. */
const toggleSchema = z.object({ id: z.uuid(), next: flag });

/**
 * The whole draft the Save control submits, as JSON: every page with its enabled flag and every
 * field with its visible flag. `pageKey` is validated against the domain's tuple and is not used to
 * address anything — it is there so a payload naming a sixth page is refused rather than written.
 */
const savePayloadSchema = z.object({
  pages: z
    .array(
      z.object({
        id: z.uuid(),
        pageKey: z.enum(INTERFACE_PAGE_KEYS),
        enabled: z.boolean(),
        fields: z.array(z.object({ id: z.uuid(), visible: z.boolean() })).max(200),
      }),
    )
    .min(1)
    .max(INTERFACE_PAGE_KEYS.length),
});

function failure(error: string): InterfaceConfigActionFailure {
  return { ok: false, error };
}

function success(ids: readonly string[]): InterfaceConfigActionSuccess {
  return { ok: true, ids, savedAt: Date.now() };
}

/** Who is writing. Live mode only: in demo mode every action has already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function entry(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/** Shows or hides one field on the client's interface. */
export async function setFieldVisibilityAction(
  _previous: InterfaceConfigActionResult | null,
  formData: FormData,
): Promise<InterfaceConfigActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_REFUSAL);
  }

  const parsed = toggleSchema.safeParse({
    id: entry(formData, 'id'),
    next: entry(formData, 'visible'),
  });
  if (!parsed.success) {
    return failure('That field could not be identified.');
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return failure('Your session has expired. Sign in again to save.');
    }
    const saved = await withBrandScope((db, brandId) =>
      setFieldVisibility(db, brandId, parsed.data.id, parsed.data.next, actor),
    );
    if (saved === null) {
      return failure('That field is no longer part of this interface.');
    }
    revalidatePath(interfaceConfigPath);
    return success([saved.id]);
  } catch {
    return failure('The interface configuration could not be saved. Try again.');
  }
}

/**
 * Switches one page of the client's interface on or off. The page's FIELDS keep their own flags
 * (PRD §10 switches the two levels independently), so a page switched back on returns with exactly
 * the field set the client was seeing before.
 */
export async function setPageEnabledAction(
  _previous: InterfaceConfigActionResult | null,
  formData: FormData,
): Promise<InterfaceConfigActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_REFUSAL);
  }

  const parsed = toggleSchema.safeParse({
    id: entry(formData, 'id'),
    next: entry(formData, 'enabled'),
  });
  if (!parsed.success) {
    return failure('That page could not be identified.');
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return failure('Your session has expired. Sign in again to save.');
    }
    const saved = await withBrandScope((db, brandId) =>
      setPageEnabled(db, brandId, parsed.data.id, parsed.data.next, actor),
    );
    if (saved === null) {
      return failure('That page is no longer part of this interface.');
    }
    revalidatePath(interfaceConfigPath);
    return success([saved.id]);
  } catch {
    return failure('The interface configuration could not be saved. Try again.');
  }
}

/**
 * The "Save configuration" control (ticket criterion 13): the page's whole draft, applied in one
 * brand scope. Refused in demo mode before the JSON is even parsed.
 *
 * Every write goes through the same two scoped setters as the individual toggles, so there is one
 * write path and not two. A row id from another brand resolves to `null` and is counted as
 * unwritten rather than reported as a different brand's row — the scope makes "not yours" and "not
 * there" the same answer, which is the property that makes it safe.
 */
export async function saveInterfaceConfigAction(
  _previous: InterfaceConfigActionResult | null,
  formData: FormData,
): Promise<InterfaceConfigActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_REFUSAL);
  }

  const raw = entry(formData, 'config');
  if (raw === undefined) {
    return failure('There was nothing to save.');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return failure('This configuration could not be read.');
  }

  const parsed = savePayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return failure('This configuration could not be read.');
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return failure('Your session has expired. Sign in again to save.');
    }
    const written = await withBrandScope(async (db, brandId) => {
      const ids: string[] = [];
      for (const page of parsed.data.pages) {
        const savedPage = await setPageEnabled(db, brandId, page.id, page.enabled, actor);
        if (savedPage !== null) {
          ids.push(savedPage.id);
        }
        for (const field of page.fields) {
          const savedField = await setFieldVisibility(db, brandId, field.id, field.visible, actor);
          if (savedField !== null) {
            ids.push(savedField.id);
          }
        }
      }
      return ids;
    });
    if (written === null) {
      return failure('This workspace has no brand yet.');
    }
    if (written.length === 0) {
      return failure('This interface configuration is no longer available.');
    }
    revalidatePath(interfaceConfigPath);
    return success(written);
  } catch {
    return failure('The interface configuration could not be saved. Try again.');
  }
}
