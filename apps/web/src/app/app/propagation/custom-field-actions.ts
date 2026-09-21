'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertCustomFieldSchema,
  listTeam,
  PROPAGATION_TABLES,
  resolveTemplateBrandId,
  softDeleteCustomFieldSchema,
  updateCustomFieldSchema,
  type Db,
} from '@tas/db';
import { canReviewPromotion } from '@tas/domain';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withAgencyScope } from '@/lib/propagation-source';
import { propagationPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

export interface CustomFieldActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface CustomFieldActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type CustomFieldActionResult = CustomFieldActionSuccess | CustomFieldActionFailure;

const VALID_TABLE_NAMES = Object.keys(PROPAGATION_TABLES);
const VALID_FIELD_TYPES = ['text', 'number', 'boolean', 'select', 'url'] as const;

const addFieldSchema = z.object({
  tableName: z.string().refine((v) => VALID_TABLE_NAMES.includes(v), 'Invalid table.'),
  fieldKey: z
    .string()
    .trim()
    .min(1, 'A field key is required.')
    .max(64, 'Keep the key under 64 characters.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores.'),
  fieldLabel: z
    .string()
    .trim()
    .min(1, 'A label is required.')
    .max(100, 'Keep the label under 100 characters.'),
  fieldType: z.enum(VALID_FIELD_TYPES),
  options: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  sortOrder: z
    .string()
    .trim()
    .default('0')
    .transform((v) => v || '0'),
});

function failure(error: string): CustomFieldActionFailure {
  return { ok: false, error };
}

async function requireAdmin(
  run: (db: Db, agencyId: string, userId: string) => Promise<CustomFieldActionResult>,
): Promise<CustomFieldActionResult> {
  const { userId } = await auth();
  if (userId === null) {
    return failure('Your session has expired. Sign in again.');
  }

  const result = await withAgencyScope(async (db, agencyId) => {
    const team = await listTeam(db, agencyId);
    const actor = teamPageActorFrom(team.find((row) => row.clerkUserId === userId));
    if (!canReviewPromotion(actor)) {
      return failure('Only an agency Admin can manage custom fields.');
    }
    return run(db, agencyId, userId);
  });

  return result ?? failure('This workspace has no agency yet.');
}

export async function addCustomFieldAction(
  _previous: CustomFieldActionResult | null,
  formData: FormData,
): Promise<CustomFieldActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = addFieldSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  try {
    return await requireAdmin(async (db, agencyId, userId) => {
      const templateBrandId = await resolveTemplateBrandId(db, agencyId);
      if (templateBrandId === null) {
        return failure('No template brand found for this agency.');
      }

      const row = await insertCustomFieldSchema(db, templateBrandId, parsed.data, userId);
      revalidatePath(propagationPath);
      return { ok: true, id: row.id, savedAt: Date.now() };
    });
  } catch {
    return failure('The field could not be saved. Try again.');
  }
}

export async function updateCustomFieldAction(
  _previous: CustomFieldActionResult | null,
  formData: FormData,
): Promise<CustomFieldActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return failure('Field could not be identified.');
  }

  const parsed = addFieldSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  try {
    return await requireAdmin(async (db, agencyId, userId) => {
      const templateBrandId = await resolveTemplateBrandId(db, agencyId);
      if (templateBrandId === null) {
        return failure('No template brand found for this agency.');
      }

      const row = await updateCustomFieldSchema(
        db,
        templateBrandId,
        id,
        {
          fieldLabel: parsed.data.fieldLabel,
          fieldType: parsed.data.fieldType,
          options: parsed.data.options,
          sortOrder: parsed.data.sortOrder,
        },
        userId,
      );
      if (row === undefined) return failure('That field is no longer available.');
      revalidatePath(propagationPath);
      return { ok: true, id: row.id, savedAt: Date.now() };
    });
  } catch {
    return failure('The field could not be saved. Try again.');
  }
}

export async function deleteCustomFieldAction(
  _previous: CustomFieldActionResult | null,
  formData: FormData,
): Promise<CustomFieldActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return failure('Field could not be identified.');
  }

  try {
    return await requireAdmin(async (db, agencyId) => {
      const templateBrandId = await resolveTemplateBrandId(db, agencyId);
      if (templateBrandId === null) {
        return failure('No template brand found for this agency.');
      }

      const deleted = await softDeleteCustomFieldSchema(db, templateBrandId, id);
      if (!deleted) return failure('That field is no longer available.');
      revalidatePath(propagationPath);
      return { ok: true, id, savedAt: Date.now() };
    });
  } catch {
    return failure('The field could not be removed. Try again.');
  }
}
