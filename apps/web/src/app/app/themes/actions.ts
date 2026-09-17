'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertTheme, type ThemeInput } from '@tas/db';
import { isThemeCategory, validateThemeDraft, type ThemeDraftField } from '@tas/domain/themes';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { themesPath } from '@/lib/routes';
import { withGlobalScope } from '@/lib/themes-source';

/**
 * The Themes route's one mutation (PRD §5.5). It follows `personas/actions.ts` and
 * `angles/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. parse the submitted `FormData` with zod, which owns the *shape*: which keys exist, and that an
 *    empty Notes box is stored as NULL rather than as an empty string, so "unset" has one
 *    representation;
 * 3. run `validateThemeDraft` from `@tas/domain/themes`, which owns the *rules* — a name of at
 *    least two characters and a category inside the shared vocabulary. The New theme dialog calls
 *    the same function to disable its save, and a disabled button is a courtesy, not a guarantee,
 *    so the action re-runs it. No rule is restated here;
 * 4. write through `@tas/db`;
 * 5. revalidate the page and return a typed result. It never throws to the client.
 *
 * NO BRAND, ON PURPOSE. Every other route's actions resolve the actor's brand and hand it to a
 * scoped query. The theme library is GLOBAL (CLAUDE.md non-negotiable 3, PRD §5.5: "the theme
 * library is shared across every brand in the platform"), so this one goes through
 * `withGlobalScope` instead, never `withBrandScope`, and `brand_id` is never in the payload — the
 * `themes_global` check constraint would reject the row if it were. Do not "fix" the missing scope:
 * a per-brand theme library is the disconnected-Airtable-table problem this page exists to delete.
 *
 * CREATE ONLY. The Themes ticket puts "editing or deleting an existing theme" out of scope and ships
 * no edit panel, so there is no `updateThemeAction` here. One shipped with the page anyway: an
 * exported Server Action is a callable endpoint whether or not a component imports it, so a patch
 * against the library every brand reads was reachable over the network from a page that offers no
 * way to reach it, behind nothing stronger than "there is a session". It is deleted rather than
 * left for the edit ticket, which will add it back beside the panel that calls it and the role check
 * that guards it.
 *
 * Reference Links and Attachments are out of scope for this ticket, so the action neither reads nor
 * writes them.
 */

/**
 * The fields the dialog can show a message under: the ones the domain validator knows, plus Notes,
 * which the form writes but no rule can reject. Derived from `ThemeDraftField` so the two cannot
 * drift.
 */
export type ThemeFieldName = ThemeDraftField | 'notes';

export interface ThemeActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the dialog can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface ThemeActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<ThemeFieldName, string>>;
}

export type ThemeActionResult = ThemeActionSuccess | ThemeActionFailure;

/** A text column: trimmed, and empty means NULL. */
const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/**
 * Shape only. Every rule a strategist can break lives in `validateThemeDraft`, so `name` has no
 * `min` here and `category` is not checked against the vocabulary — that is step 3.
 */
const themeSchema = z.object({
  name: z.string().trim(),
  category: z.string().trim(),
  notes: text,
});

type ThemeFormValues = z.infer<typeof themeSchema>;

/** `FormData` to the schema's input; a missing key becomes `''` so "empty means NULL" runs. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  return { name: single('name'), category: single('category'), notes: single('notes') };
}

function failureFrom(error: z.ZodError): ThemeActionFailure {
  const fieldErrors: Partial<Record<ThemeFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as ThemeFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** The domain's messages, in the same envelope zod's take. */
function failureFromDraft(
  fieldErrors: Readonly<Partial<Record<ThemeDraftField, string>>>,
): ThemeActionFailure {
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Shape (zod), then rules (the domain function). Either one failing ends the write.
 *
 * `isThemeCategory` runs in the same guard as the draft check. It is not a second rule: the draft
 * check has already rejected anything outside the vocabulary, and the type guard is what turns the
 * submitted `string` into the stored union `ThemeInput` requires, with no cast.
 */
function parse(formData: FormData): { values: ThemeInput } | ThemeActionFailure {
  const parsed = themeSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }

  const values: ThemeFormValues = parsed.data;
  const draft = validateThemeDraft({ name: values.name, category: values.category });
  if (!draft.ok || !isThemeCategory(values.category)) {
    return failureFromDraft(draft.fieldErrors);
  }

  return {
    values: { name: values.name.trim(), category: values.category, notes: values.notes },
  };
}

/**
 * Creates a theme in the global library. The name is the strategist's own words — themes are the
 * one table whose name is typed rather than generated (non-negotiable 4 governs the *generated*
 * names, and a concept's Batch-Angle-Theme name reads this one).
 */
export async function createThemeAction(
  _previous: ThemeActionResult | null,
  formData: FormData,
): Promise<ThemeActionResult> {
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
    const created = await withGlobalScope((db) => insertTheme(db, parsed.values, actor));
    revalidatePath(themesPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The theme could not be saved. Try again.' };
  }
}
