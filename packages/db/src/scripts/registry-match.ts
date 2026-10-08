import { and, eq, gte, isNull, sql } from 'drizzle-orm';

import type { Db } from '../db';
import { creatorRegistry, type RegistryCreator } from '../schema';

/**
 * How an external creator row (another client's Airtable base) is matched to the global registry:
 * the Instagram handle is the natural key; a lowercase-name match is the fallback, and — for the
 * import — only against an entry that has already worked with at least one brand, so two different
 * "John Smith"s who each appear once never collapse into one person.
 */
export interface RegistryMatchKey {
  readonly normalizedInstagram: string | null;
  readonly name: string;
}

export interface RegistryMatchOptions {
  /** When true, a name-only match must land on a row with `total_brands >= 1`. */
  readonly nameMatchRequiresBrands: boolean;
}

export type RegistryMatch =
  | { readonly by: 'instagram' | 'name'; readonly row: RegistryCreator }
  | { readonly by: 'none'; readonly row: null };

export async function findRegistryMatch(
  db: Db,
  key: RegistryMatchKey,
  options: RegistryMatchOptions,
): Promise<RegistryMatch> {
  if (key.normalizedInstagram !== null) {
    const [byIg] = await db
      .select()
      .from(creatorRegistry)
      .where(
        and(
          eq(creatorRegistry.normalizedInstagram, key.normalizedInstagram),
          isNull(creatorRegistry.deletedAt),
        ),
      )
      .limit(1);
    if (byIg) return { by: 'instagram', row: byIg };
  }
  const lower = key.name.trim().toLowerCase();
  if (lower === '') return { by: 'none', row: null };
  const [byName] = await db
    .select()
    .from(creatorRegistry)
    .where(
      and(
        eq(sql`lower(${creatorRegistry.name})`, lower),
        isNull(creatorRegistry.deletedAt),
        options.nameMatchRequiresBrands ? gte(creatorRegistry.totalBrands, 1) : undefined,
      ),
    )
    .orderBy(creatorRegistry.createdAt)
    .limit(1);
  return byName ? { by: 'name', row: byName } : { by: 'none', row: null };
}
