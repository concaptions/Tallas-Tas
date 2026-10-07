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

export function matchRegistryCreator(
  creator: {
    name: string;
    instagramUsername: string | null;
    platform: string[];
    gender: string | null;
    ageBracket: string | null;
    totalBrands: number;
    tags: string[];
  },
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
