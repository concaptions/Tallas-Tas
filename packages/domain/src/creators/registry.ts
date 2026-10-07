/**
 * Creator Registry — cross-brand creator pool operations.
 *
 * The registry is a GLOBAL table. When a strategist adds a registry creator to a brand,
 * a new row is inserted into the per-brand `creators` table with `registryCreatorId` set.
 *
 * De-duplication: if a creator has an Instagram username, normalize it (lowercase, strip @)
 * and use it as the natural key. Two entries with the same IG are the same person.
 */

export function normalizeInstagramUsername(username: string | null | undefined): string | null {
  if (!username) return null;
  const cleaned = username.trim().toLowerCase().replace(/^@/, '');
  return cleaned || null;
}

export interface RegistrySearchFilters {
  query?: string;
  platform?: string[];
  gender?: string;
  ageBracket?: string;
  minBrands?: number;
  tags?: string[];
}

export interface RegistryCreatorInput {
  name: string;
  instagramUsername: string | null;
  platform: string[];
  gender: string | null;
  ageBracket: string | null;
  totalBrands: number;
  tags: string[];
}

export function matchRegistryCreator(
  creator: RegistryCreatorInput,
  filters: RegistrySearchFilters,
): number {
  let score = 0;

  if (filters.query) {
    const q = filters.query.toLowerCase();
    if (creator.name.toLowerCase().includes(q)) score += 10;
    if (creator.instagramUsername?.toLowerCase().includes(q)) score += 10;
    if (score === 0) return 0;
  } else {
    score = 1;
  }

  if (filters.platform?.length) {
    if (!filters.platform.some((p) => creator.platform.includes(p))) return 0;
    score += 5;
  }

  if (filters.gender && creator.gender !== filters.gender) return 0;
  if (filters.ageBracket && creator.ageBracket !== filters.ageBracket) return 0;
  if (filters.minBrands && creator.totalBrands < filters.minBrands) return 0;

  score += Math.min(creator.totalBrands, 5);

  return score;
}
