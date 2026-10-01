'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  getAngleById,
  getConceptById,
  getCreatorById,
  getPersonaById,
  getProductById,
  syncLinks,
  type Db,
  type LinkTable,
} from '@tas/db';
import { isLinkKind, LINK_REGISTRY, type LinkKind } from '@tas/domain';

import { DEMO_WRITE_REFUSAL, isDemoMode } from './demo-mode';
import { anglesPath, conceptsPath, personasPath, productsPath, ugcPath } from './routes';
import { withBrandScope } from './ugc-source';

/**
 * The one write behind every `LinkField` (Sprint 9, LINK-01). It takes a link kind, the record the
 * field sits on and the chosen ids, proves the source record is in the actor's brand (the junction
 * tables carry no `brand_id`, so the scoped getter is the tenancy check), writes the junction
 * through `syncLinks`, and revalidates BOTH sides' pages so the other record reads the link on its
 * next render. Nothing is copied onto either record.
 */
export interface SetLinksInput {
  readonly link: string;
  readonly sourceId: string;
  readonly targetIds: readonly string[];
}

export interface SetLinksSuccess {
  readonly ok: true;
  readonly targetIds: readonly string[];
}

export interface SetLinksFailure {
  readonly ok: false;
  readonly error: string;
}

export type SetLinksResult = SetLinksSuccess | SetLinksFailure;

/** The scoped read that proves `id` is one of the brand's own rows of `table`. */
async function ownsSource(db: Db, brandId: string, table: LinkTable, id: string): Promise<boolean> {
  switch (table) {
    case 'concept':
      return (await getConceptById(db, brandId, id)) !== null;
    case 'angle':
      return (await getAngleById(db, brandId, id)) !== null;
    case 'creator':
      return (await getCreatorById(db, brandId, id)) !== null;
    case 'product':
      return (await getProductById(db, brandId, id)) !== null;
    case 'persona':
      return (await getPersonaById(db, brandId, id)) !== null;
  }
}

/** The list pages of both sides, revalidated after a write so each reads the junction afresh. */
const PATH_OF: Readonly<Record<LinkTable, string>> = {
  concept: conceptsPath,
  angle: anglesPath,
  creator: ugcPath,
  product: productsPath,
  persona: personasPath,
};

export async function setLinksAction(input: SetLinksInput): Promise<SetLinksResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  if (!isLinkKind(input.link)) return { ok: false, error: 'Unknown link.' };
  const kind: LinkKind = input.link;
  if (input.sourceId.trim() === '')
    return { ok: false, error: 'Save the record before linking it.' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Your session has expired. Sign in again to save.' };

  const entry = LINK_REGISTRY[kind];
  try {
    const written = await withBrandScope(async (db, brandId) => {
      if (!(await ownsSource(db, brandId, entry.source, input.sourceId))) return null;
      return syncLinks(
        db,
        { junction: entry.junction, source: entry.source, target: entry.target },
        input.sourceId,
        input.targetIds,
      );
    });
    if (written === null) return { ok: false, error: 'That record is not in this workspace.' };
    revalidatePath(PATH_OF[entry.source]);
    revalidatePath(PATH_OF[entry.target]);
    if (entry.source === 'concept' || entry.target === 'concept') {
      revalidatePath(`${conceptsPath}/[conceptId]`, 'page');
    }
    return { ok: true, targetIds: written };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : 'The link was not saved.' };
  }
}
