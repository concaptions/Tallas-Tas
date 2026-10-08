import { eq, isNull } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb } from '../db';
import { creatorRegistry } from '../schema/creator-registry';
import { creators } from '../schema/creators';
import type { CreatorAgeBracket, CreatorPlatform } from '../schema/enums';

function normalizeInstagram(username: string | null): string | null {
  if (!username) return null;
  const cleaned = username.trim().toLowerCase().replace(/^@/, '');
  return cleaned || null;
}

/**
 * Populate `creator_registry` from existing per-brand `creators` rows.
 *
 *   DATABASE_URL="..." pnpm --filter @tas/db tsx src/scripts/seed-creator-registry.ts          dry run
 *   DATABASE_URL="..." pnpm --filter @tas/db tsx src/scripts/seed-creator-registry.ts --apply  commits
 *
 * For each unique creator (matched by normalized Instagram handle across brands), inserts one row
 * into `creator_registry` and sets `registryCreatorId` on every matching brand creator row.
 * Idempotent: skips creators whose `registryCreatorId` is already set, and skips registry rows
 * whose `normalizedInstagram` already exists.
 */

const ACTOR = 'script:seed-creator-registry';

class DryRunRollback extends Error {
  constructor() {
    super('dry run: rolling back');
  }
}

interface CreatorRow {
  id: string;
  name: string;
  instagramUsername: string | null;
  platform: CreatorPlatform[];
  creatorLink: string | null;
  ageBracket: CreatorAgeBracket | null;
  gender: string | null;
  ethnicity: string | null;
  shippingLocation: string | null;
  brandId: string;
  registryCreatorId: string | null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = createAutoDb(databaseUrl);

  let inserted = 0;
  let linked = 0;
  let skippedAlreadyLinked = 0;
  let skippedNoHandle = 0;

  try {
    try {
      await db.transaction(async (tx) => {
        const allCreators = (await tx
          .select({
            id: creators.id,
            name: creators.name,
            instagramUsername: creators.instagramUsername,
            platform: creators.platform,
            creatorLink: creators.creatorLink,
            ageBracket: creators.ageBracket,
            gender: creators.gender,
            ethnicity: creators.ethnicity,
            shippingLocation: creators.shippingLocation,
            brandId: creators.brandId,
            registryCreatorId: creators.registryCreatorId,
          })
          .from(creators)
          .where(isNull(creators.deletedAt))) as CreatorRow[];

        console.log(`Found ${String(allCreators.length)} active brand creator rows.`);

        const byHandle = new Map<string, CreatorRow[]>();

        for (const row of allCreators) {
          if (row.registryCreatorId) {
            skippedAlreadyLinked++;
            continue;
          }

          const normalized = normalizeInstagram(row.instagramUsername);
          if (!normalized) {
            skippedNoHandle++;
            continue;
          }

          const group = byHandle.get(normalized);
          if (group) {
            group.push(row);
          } else {
            byHandle.set(normalized, [row]);
          }
        }

        console.log(
          `  ${String(byHandle.size)} unique handles to process` +
            `  (${String(skippedAlreadyLinked)} already linked, ${String(skippedNoHandle)} without handle)`,
        );

        for (const [normalized, rows] of byHandle) {
          const existing = await tx
            .select({ id: creatorRegistry.id })
            .from(creatorRegistry)
            .where(eq(creatorRegistry.normalizedInstagram, normalized))
            .limit(1);

          let registryId: string;

          const first = existing[0];
          if (first) {
            registryId = first.id;
            console.log(`  exists  ${normalized} → ${registryId}`);
          } else {
            const representative = rows[0] as CreatorRow;
            const returned = await tx
              .insert(creatorRegistry)
              .values({
                name: representative.name,
                instagramUsername: representative.instagramUsername,
                normalizedInstagram: normalized,
                platform: representative.platform,
                creatorLink: representative.creatorLink,
                ageBracket: representative.ageBracket,
                gender: representative.gender,
                ethnicity: representative.ethnicity,
                shippingLocation: representative.shippingLocation,
                totalBrands: new Set(rows.map((r) => r.brandId)).size,
                createdBy: ACTOR,
                updatedBy: ACTOR,
              })
              .returning({ id: creatorRegistry.id });

            registryId = (returned[0] as { id: string }).id;
            inserted++;
            console.log(
              `  insert  ${normalized} → ${registryId}  (from ${String(rows.length)} brand rows)`,
            );
          }

          for (const row of rows) {
            await tx
              .update(creators)
              .set({ registryCreatorId: registryId, updatedBy: ACTOR })
              .where(eq(creators.id, row.id));
            linked++;
          }
        }

        if (!apply) throw new DryRunRollback();
      });
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }

    console.log(
      `\n${apply ? '[APPLIED]' : '[DRY RUN — ROLLED BACK]'}` +
        `  ${String(inserted)} registry rows inserted, ${String(linked)} brand creators linked` +
        `  (${String(skippedAlreadyLinked)} already linked, ${String(skippedNoHandle)} without handle)`,
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('seed-creator-registry.ts')) await main();
