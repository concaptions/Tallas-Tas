'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { setFieldVisibility, setPageEnabled } from '@tas/db';
import { INTERFACE_PAGE_KEYS } from '@tas/domain';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/interface-config-source';
import { interfaceConfigPath } from '@/lib/routes';

/**
 * The Interface Config route's mutation (PRD §10). ONE action: the page holds its whole draft in
 * React state and saves it in a single write, so there is one endpoint and not three. Two per-row
 * toggle actions used to be exported here as well; nothing ever called them, and an exported Server
 * Action is a reachable endpoint rather than dead code, so they were deleted instead of left
 * unreachable. The row-level setters they used are still the only write path, reached through the
 * save below.
 *
 * It follows the house pattern of `personas/actions.ts` and `queue/client/actions.ts` exactly:
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
 * WHY THE SAVE DELEGATES NO RULE TO THE DOMAIN, and it is deliberate rather than an omission.
 * `@tas/domain`'s `toggleField` / `togglePage` FLIP a flag; this action is handed each flag's
 * TARGET value by a draft that already knows what every row is about to become, and a flip applied
 * to a row someone else has since changed would write the wrong value. What the domain owns
 * is what the flags MEAN — `visibleFields`, `enabledPages` and `clientCanEdit` decide what a client
 * sees and may change, and nothing in this file restates any of it. `client_editable` is not
 * writable here at all: PRD §10's table fixes it per field, so it is seed data, not a setting.
 *
 * DEMO MODE STILL TOGGLES, IT JUST DOES NOT SAVE (ticket criteria 5, 6 and 13). The page holds its
 * own draft configuration in React state and previews every change instantly with the pure domain
 * toggles; this action is only ever reached by the Save control, which is disabled through
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

/**
 * The "Save configuration" control (ticket criterion 13): the page's whole draft, applied in one
 * brand scope. Refused in demo mode before the JSON is even parsed.
 *
 * Every write goes through the two scoped `@tas/db` setters, so there is one write path. A row id from another brand resolves to `null` and is counted as
 * unwritten rather than reported as a different brand's row — the scope makes "not yours" and "not
 * there" the same answer, which is the property that makes it safe.
 */
export async function saveInterfaceConfigAction(
  _previous: InterfaceConfigActionResult | null,
  formData: FormData,
): Promise<InterfaceConfigActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_WRITE_REFUSAL);
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
