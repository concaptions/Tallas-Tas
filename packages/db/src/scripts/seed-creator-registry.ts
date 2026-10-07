import { eq, isNull } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb } from '../db';
import { creatorRegistry, creators } from '../schema';

/**
 * One-time script: builds the global creator registry from existing per-brand creators.
 *
 * 1. Read all creators across all brands
 * 2. Group by normalizedInstagram (or by name if no IG)
 * 3. For each group: create one registry entry with the best data (most complete profile)
 * 4. Link each brand-scoped creator to its registry entry via registryCreatorId
 * 5. Update totalBrands on each registry entry
 *
 * Usage: DATABASE_URL=... pnpm --filter @tas/db seed-creator-registry
 */

function normalizeIg(username: string | null): string | null {
  if (!username) return null;
  const cleaned = username.trim().toLowerCase().replace(/^@/, '');
  return cleaned || null;
}

async function main(): Promise<void> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required.');
  }
  const db = createAutoDb(databaseUrl);

  try {
    const allCreators = await db.select().from(creators).where(isNull(creators.deletedAt));

    console.log(`Found ${String(allCreators.length)} brand-scoped creators`);

    const groups = new Map<string, { key: string; rows: typeof allCreators }>();

    for (const row of allCreators) {
      const ig = normalizeIg(row.instagramUsername);
      const groupKey = ig ?? `name:${row.name.trim().toLowerCase()}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.rows.push(row);
      } else {
        groups.set(groupKey, { key: groupKey, rows: [row] });
      }
    }

    console.log(`Grouped into ${String(groups.size)} unique creators`);

    let created = 0;
    let linked = 0;

    for (const group of groups.values()) {
      const best = group.rows.reduce((a, b) => {
        let aScore = 0;
        let bScore = 0;
        if (a.profilePicUrl) aScore += 1;
        if (b.profilePicUrl) bScore += 1;
        if (a.instagramUsername) aScore += 1;
        if (b.instagramUsername) bScore += 1;
        if (a.creatorLink) aScore += 1;
        if (b.creatorLink) bScore += 1;
        if (a.gender) aScore += 1;
        if (b.gender) bScore += 1;
        if (a.ageBracket) aScore += 1;
        if (b.ageBracket) bScore += 1;
        return bScore > aScore ? b : a;
      });

      const normalizedIg = normalizeIg(best.instagramUsername);

      const existing = normalizedIg
        ? await db
            .select({ id: creatorRegistry.id })
            .from(creatorRegistry)
            .where(eq(creatorRegistry.normalizedInstagram, normalizedIg))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : null;

      let registryId: string;

      if (existing) {
        registryId = existing.id;
      } else {
        const brandIds = new Set(group.rows.map((r) => r.brandId));
        const insertedRows = await db
          .insert(creatorRegistry)
          .values({
            brandId: null,
            name: best.name,
            instagramUsername: best.instagramUsername,
            profilePicUrl: best.profilePicUrl,
            creatorLink: best.creatorLink,
            platform: best.platform,
            ageBracket: best.ageBracket,
            gender: best.gender,
            ethnicity: best.ethnicity,
            shippingLocation: best.shippingLocation,
            normalizedInstagram: normalizedIg,
            totalBrands: brandIds.size,
            totalProjects: group.rows.length,
            tags: [],
            legacyAirtableId: best.legacyAirtableId,
          })
          .returning({ id: creatorRegistry.id });
        if (!insertedRows[0]) throw new Error('Insert into creator_registry returned no rows');
        registryId = insertedRows[0].id;
        created += 1;
      }

      for (const row of group.rows) {
        if (row.registryCreatorId === registryId) continue;
        await db
          .update(creators)
          .set({ registryCreatorId: registryId, updatedAt: new Date() })
          .where(eq(creators.id, row.id));
        linked += 1;
      }
    }

    console.log(
      `Created ${String(created)} registry entries, linked ${String(linked)} brand creators`,
    );
  } finally {
    await db.$client.end();
  }
}

await main();
