import { and, eq } from 'drizzle-orm';

import { listCustomFieldSchemas } from './custom-field-schemas';
import type { Db } from './db';
import { seedContentFromTemplate } from './propagation';
import {
  agencies,
  brandAssignments,
  brands,
  customFieldSchemas,
  interfaceFields,
  interfacePages,
  memberships,
  notificationSettings,
  users,
  type Brand,
  type BrandAssignment,
} from './schema';
import { notificationTriggers } from './schema/enums';
import { withBrand } from './tenancy';

import type { BrandRole, InterfacePageKey } from './schema/enums';

/** The shape `@tas/domain/interface`'s `defaultInterfaceConfig()` returns, duplicated here to avoid the db → domain dependency edge. */
export interface InterfacePageDefault {
  readonly pageKey: InterfacePageKey;
  readonly label: string;
  readonly enabled: boolean;
  readonly position: number;
  readonly fields: readonly InterfaceFieldDefault[];
}

interface InterfaceFieldDefault {
  readonly fieldName: string;
  readonly label: string;
  readonly visible: boolean;
  readonly clientEditable: boolean;
  readonly position: number;
}

export interface OnboardBrandInput {
  readonly agencyId: string;
  readonly templateBrandId: string;
  readonly name: string;
  readonly slug: string;
  readonly website?: string;
  readonly actorId: string;
  readonly team: readonly { readonly userId: string; readonly role: BrandRole }[];
  readonly interfaceDefaults: readonly InterfacePageDefault[];
}

export interface OnboardBrandResult {
  readonly brand: Brand;
  readonly assignments: BrandAssignment[];
}

/**
 * Creates a new brand under an agency, seeded from the parent template (PRD §3). Runs inside the
 * caller's transaction. Seeds interface config defaults (PRD §10) and notification settings
 * defaults (PRD §12) so the brand is immediately usable.
 */
export async function onboardBrand(db: Db, input: OnboardBrandInput): Promise<OnboardBrandResult> {
  const [brand] = await db
    .insert(brands)
    .values({
      agencyId: input.agencyId,
      templateBrandId: input.templateBrandId,
      name: input.name,
      slug: input.slug,
      website: input.website ?? null,
      isTemplate: false,
      status: 'active',
      createdBy: input.actorId,
      updatedBy: input.actorId,
    })
    .returning();

  if (brand === undefined) {
    throw new Error('Brand insert returned no row');
  }

  const assignments: BrandAssignment[] = [];
  if (input.team.length > 0) {
    const rows = await db
      .insert(brandAssignments)
      .values(
        input.team.map((member) => ({
          brandId: brand.id,
          userId: member.userId,
          role: member.role,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })),
      )
      .returning();
    assignments.push(...rows);
  }

  await seedInterfaceDefaults(
    db,
    brand.id,
    input.templateBrandId,
    input.actorId,
    input.interfaceDefaults,
  );
  await seedNotificationDefaults(db, brand.id, input.actorId);
  await seedContentFromTemplate(db, input.templateBrandId, brand.id, input.actorId);
  await seedCustomFieldSchemas(db, input.templateBrandId, brand.id, input.actorId);

  return { brand, assignments };
}

async function seedInterfaceDefaults(
  db: Db,
  brandId: string,
  templateBrandId: string,
  actorId: string,
  defaults: readonly InterfacePageDefault[],
): Promise<void> {
  const templateScope = withBrand(db, templateBrandId);
  const templatePages = await templateScope.select(interfacePages).orderBy(interfacePages.position);
  const scope = withBrand(db, brandId);

  if (templatePages.length > 0) {
    await copyInterfaceFromTemplate(scope, templateScope, templatePages, actorId);
  } else {
    await seedInterfaceFromDefaults(scope, actorId, defaults);
  }
}

async function copyInterfaceFromTemplate(
  scope: ReturnType<typeof withBrand>,
  templateScope: ReturnType<typeof withBrand>,
  templatePages: (typeof interfacePages.$inferSelect)[],
  actorId: string,
): Promise<void> {
  const newPages = await scope
    .insert(
      interfacePages,
      templatePages.map((page) => ({
        pageKey: page.pageKey,
        label: page.label,
        enabled: page.enabled,
        position: page.position,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    )
    .returning();

  const templateFields = await templateScope
    .select(interfaceFields)
    .orderBy(interfaceFields.position);

  if (templateFields.length === 0) {
    return;
  }

  const pageIdMap = new Map<string, string>();
  for (const templatePage of templatePages) {
    const newPage = newPages.find((p) => p.pageKey === templatePage.pageKey);
    if (newPage !== undefined) {
      pageIdMap.set(templatePage.id, newPage.id);
    }
  }

  await scope.insert(
    interfaceFields,
    templateFields
      .filter((field) => pageIdMap.has(field.pageId))
      .map((field) => {
        const newPageId = pageIdMap.get(field.pageId);
        if (newPageId === undefined) throw new Error('unreachable: filter guarantees key');
        return {
          pageId: newPageId,
          fieldName: field.fieldName,
          label: field.label,
          visible: field.visible,
          clientEditable: field.clientEditable,
          position: field.position,
          createdBy: actorId,
          updatedBy: actorId,
        };
      }),
  );
}

async function seedInterfaceFromDefaults(
  scope: ReturnType<typeof withBrand>,
  actorId: string,
  defaults: readonly InterfacePageDefault[],
): Promise<void> {
  const newPages = await scope
    .insert(
      interfacePages,
      defaults.map((page) => ({
        pageKey: page.pageKey,
        label: page.label,
        enabled: page.enabled,
        position: page.position,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    )
    .returning();

  const allFields = defaults.flatMap((page) => {
    const newPage = newPages.find((p) => p.pageKey === page.pageKey);
    if (newPage === undefined) return [];
    return page.fields.map((field) => ({
      pageId: newPage.id,
      fieldName: field.fieldName,
      label: field.label,
      visible: field.visible,
      clientEditable: field.clientEditable,
      position: field.position,
      createdBy: actorId,
      updatedBy: actorId,
    }));
  });

  if (allFields.length > 0) {
    await scope.insert(interfaceFields, allFields);
  }
}

async function seedNotificationDefaults(db: Db, brandId: string, actorId: string): Promise<void> {
  const scope = withBrand(db, brandId);
  await scope.insert(
    notificationSettings,
    notificationTriggers.map((trigger, position) => ({
      triggerKey: trigger.key,
      slackEnabled: true,
      emailEnabled: false,
      position,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  );
}

async function seedCustomFieldSchemas(
  db: Db,
  templateBrandId: string,
  childBrandId: string,
  actorId: string,
): Promise<void> {
  const templateSchemas = await listCustomFieldSchemas(db, templateBrandId);
  if (templateSchemas.length === 0) return;

  const scope = withBrand(db, childBrandId);
  await scope.insert(
    customFieldSchemas,
    templateSchemas.map((schema) => ({
      tableName: schema.tableName,
      fieldKey: schema.fieldKey,
      fieldType: schema.fieldType,
      fieldLabel: schema.fieldLabel,
      options: schema.options,
      sortOrder: schema.sortOrder,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  );
}

export async function findAgencyByClerkOrg(
  db: Db,
  clerkOrgId: string,
): Promise<{ agencyId: string; templateBrandId: string } | null> {
  const [agency] = await db.select().from(agencies).where(eq(agencies.clerkOrgId, clerkOrgId));
  if (agency === undefined) {
    return null;
  }

  const [template] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.agencyId, agency.id), eq(brands.isTemplate, true)));

  if (template === undefined) {
    return null;
  }

  return { agencyId: agency.id, templateBrandId: template.id };
}

export async function listAvailableTeamMembers(
  db: Db,
  agencyId: string,
): Promise<{ id: string; fullName: string; email: string }[]> {
  return db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(memberships.agencyId, agencyId));
}
