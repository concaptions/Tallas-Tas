import {
  demoBriefs,
  demoCollections,
  demoConcepts,
  demoCopy,
  demoEmailCampaigns,
  demoYoutubeCopy,
} from '@tas/db';
import { emailCampaignStatuses } from '@tas/db/schema';
import { copyTitle } from '@tas/domain/copy';
import { copyStatusLabel, copyStatusTone, internalStatusFor } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import { toBriefRow } from '@/lib/briefs-source';
import { CONCEPT_TRACK, toConceptRow } from '@/lib/concepts-source';
import {
  briefPath,
  conceptPath,
  emailCampaignsPath,
  metaCopywritingPath,
  youtubeCopywritingPath,
} from '@/lib/routes';

import { internalStatusView as conceptInternalStatusView } from '../concepts/fields';
import { internalStatusView } from '../creative-design/fields';
import {
  indexConceptsByCollection,
  indexCreativeDesignsByCollection,
  indexEmailCampaignsByCollection,
  indexYoutubeCopyByCollection,
  metaCopyLink,
} from './fields';

/**
 * The two junction inversions, run over the demo fixtures the page serves in demo mode: a fixture
 * that links to a collection must surface on that collection, and one that links to none must
 * surface nowhere. The ids are the fixtures' own, read by name so a renumbered fixture cannot
 * silently pass.
 */
const BFCM = demoCollections.find((row) => row.name === 'BFCM 2026 Collection');
const SUMMER = demoCollections.find((row) => row.name === 'Summer Cooling Collection');

function id(row: { readonly id: string } | undefined, what: string): string {
  if (row === undefined) throw new Error(`demo ${what} fixture is missing`);
  return row.id;
}

describe('indexEmailCampaignsByCollection', () => {
  const index = indexEmailCampaignsByCollection(demoEmailCampaigns);

  it('lists the email campaign that promotes the BFCM collection, with a link to its panel', () => {
    const linked = index.get(id(BFCM, 'collection')) ?? [];
    const early = demoEmailCampaigns.find((row) => row.name === 'BFCM Early Access — VIP list');

    expect(linked.map((record) => record.label)).toEqual(['BFCM Early Access — VIP list']);
    expect(linked[0]?.id).toBe(id(early, 'email campaign'));
    expect(linked[0]?.href).toBe(
      `${emailCampaignsPath}?emailCampaign=${id(early, 'email campaign')}`,
    );
  });

  it("carries the campaign's workflow status as the chip, label and tone from the route's vocabulary", () => {
    const linked = index.get(id(BFCM, 'collection')) ?? [];
    const label = emailCampaignStatuses.find((entry) => entry.key === 'template_design')?.label;

    expect(linked[0]?.chip).toEqual({ label, tone: 'accent' });
  });

  it('lists the summer push on the summer collection and nothing else', () => {
    const linked = index.get(id(SUMMER, 'collection')) ?? [];
    expect(linked.map((record) => record.label)).toEqual(['Summer cooling push']);
  });

  it('has no entry for a collection nothing links to, so the page renders the empty sentence', () => {
    expect(index.get('11223344-1122-4334-8556-000000000099')).toBeUndefined();
  });

  it('indexes every fixture link exactly once', () => {
    const total = [...index.values()].reduce((sum, records) => sum + records.length, 0);
    const expected = demoEmailCampaigns.reduce((sum, row) => sum + row.collectionIds.length, 0);
    expect(total).toBe(expected);
  });
});

describe('indexYoutubeCopyByCollection', () => {
  const index = indexYoutubeCopyByCollection(demoYoutubeCopy);

  it('lists the auto-generated "Copy N" titles that link to the BFCM collection, in row order', () => {
    const linked = index.get(id(BFCM, 'collection')) ?? [];
    expect(linked.map((record) => record.label)).toEqual(['Copy 1', 'Copy 3']);
  });

  it('links each title to the YouTube Copywriting panel by its own parameter', () => {
    const linked = index.get(id(BFCM, 'collection')) ?? [];
    const first = demoYoutubeCopy.find((row) => row.copyNumber === 1);

    expect(linked[0]?.href).toBe(
      `${youtubeCopywritingPath}?youtube-copy=${id(first, 'youtube copy')}`,
    );
  });

  it('carries the shared COPY_STATUS label and tone as the chip', () => {
    const linked = index.get(id(SUMMER, 'collection')) ?? [];
    expect(linked.map((record) => record.label)).toEqual(['Copy 2']);
    expect(linked[0]?.chip).toEqual({
      label: copyStatusLabel('pending_for_client_review'),
      tone: copyStatusTone('pending_for_client_review'),
    });
  });

  it('leaves a copy with no collection out of every list', () => {
    const titles = [...index.values()].flat().map((record) => record.label);
    expect(titles).not.toContain('Copy 4');
  });
});

describe('indexConceptsByCollection', () => {
  /**
   * The concept fixtures carry their `concept_collections` ids already, so the inversion runs over
   * them as the page serves them: `toConceptRow` is the page's own narrowing and `CONCEPT_TRACK`
   * the track the page hands in.
   */
  const concepts = demoConcepts.map(toConceptRow);
  const index = indexConceptsByCollection(concepts, CONCEPT_TRACK);
  const linkedTo = (collectionId: string) =>
    concepts.filter((row) => row.collectionIds.includes(collectionId));

  it('lists every concept linked to BFCM, in row order, by its generated Batch-Angle-Theme name', () => {
    const expected = linkedTo(id(BFCM, 'collection'));
    expect(expected.length).toBeGreaterThan(1);

    const linked = index.get(id(BFCM, 'collection')) ?? [];
    expect(linked.map((record) => record.label)).toEqual(expected.map((row) => row.name));
    expect(linked.map((record) => record.id)).toEqual(expected.map((row) => row.id));
  });

  it('links each name to the concept detail route and chips its internal status on the concepts track', () => {
    const [first] = linkedTo(id(BFCM, 'collection'));
    if (first === undefined) throw new Error('fixture drift: no demo concept links to BFCM');
    const status = conceptInternalStatusView(CONCEPT_TRACK, first.internalStatus);

    const [record] = index.get(id(BFCM, 'collection')) ?? [];
    expect(record?.href).toBe(conceptPath(first.id));
    expect(record?.chip).toEqual({ label: status.label, tone: status.tone });
  });

  it('lists a concept linked to two collections on both of them', () => {
    const shared = concepts.find((row) => row.collectionIds.length > 1);
    if (shared === undefined)
      throw new Error('fixture drift: no demo concept spans two collections');

    expect(shared.collectionIds).toEqual([id(BFCM, 'collection'), id(SUMMER, 'collection')]);
    for (const collectionId of shared.collectionIds) {
      expect((index.get(collectionId) ?? []).map((record) => record.id)).toContain(shared.id);
    }
  });

  it('leaves a concept with no collection out of every list', () => {
    const unlinked = concepts.filter((row) => row.collectionIds.length === 0);
    expect(unlinked.length).toBeGreaterThan(0);

    const listed = new Set([...index.values()].flat().map((record) => record.id));
    for (const row of unlinked) {
      expect(listed.has(row.id)).toBe(false);
    }
  });

  it('indexes every fixture link exactly once', () => {
    const total = [...index.values()].reduce((sum, records) => sum + records.length, 0);
    const expected = concepts.reduce((sum, row) => sum + row.collectionIds.length, 0);
    expect(total).toBe(expected);
  });
});

describe('indexCreativeDesignsByCollection', () => {
  /**
   * The fixtures carry no `collectionId`, so the reverse link is built on top of them, as the page
   * would see it after an import: every video brief is briefed on BFCM, the standalone static on the
   * summer collection, and the rest on nothing. `toBriefRow` is the page's own narrowing.
   */
  const briefs = demoBriefs.map(toBriefRow);
  const standalone = briefs.find((row) => row.conceptId === null);
  if (standalone === undefined) throw new Error('fixture drift: no standalone demo brief');
  const rows = briefs.map((row) => {
    if (row.id === standalone.id) return { ...row, collectionId: id(SUMMER, 'collection') };
    return row.track === 'video' ? { ...row, collectionId: id(BFCM, 'collection') } : row;
  });
  const index = indexCreativeDesignsByCollection(rows);

  it('lists the briefs briefed on BFCM, in row order, with the detail route and the track chip', () => {
    const briefed = rows.filter((row) => row.collectionId === id(BFCM, 'collection'));
    expect(briefed.length).toBeGreaterThan(1);

    expect(index.get(id(BFCM, 'collection'))).toEqual(
      briefed.map((row) => {
        const status = internalStatusView(row.track, row.internalStatus);
        return {
          id: row.id,
          label: row.name,
          href: briefPath(row.id),
          chip: { label: status.label, tone: status.tone },
        };
      }),
    );
  });

  it('grades the static on the summer collection on the static track, as its own page does', () => {
    const linked = index.get(id(SUMMER, 'collection')) ?? [];
    const entry = internalStatusFor('static').find(
      (step) => step.key === standalone.internalStatus,
    );

    expect(linked.map((record) => record.id)).toEqual([standalone.id]);
    expect(linked[0]?.chip?.label).toBe(entry?.label);
    expect(linked[0]?.chip?.label).toBe('Approved');
  });

  it('leaves a brief with no collection out of every list', () => {
    const listed = new Set([...index.values()].flat().map((record) => record.id));
    for (const row of rows.filter((candidate) => candidate.collectionId === null)) {
      expect(listed.has(row.id)).toBe(false);
    }
  });

  it('has no entry for any fixture collection today, because no demo brief carries a collection_id', () => {
    const fixtures = indexCreativeDesignsByCollection(briefs);
    expect(fixtures.size).toBe(0);
    expect(fixtures.get(id(BFCM, 'collection'))).toBeUndefined();
  });
});

describe('metaCopyLink', () => {
  it("resolves the BFCM collection's copywriting_id to the Meta copy's generated title, panel link and status chip", () => {
    const copy = demoCopy.find((row) => row.id === BFCM?.copywritingId);
    if (copy === undefined) throw new Error('fixture drift: BFCM points at no demo Meta copy');

    expect(metaCopyLink(BFCM?.copywritingId ?? null, demoCopy)).toEqual({
      id: copy.id,
      label: copyTitle(copy.copyNumber),
      href: `${metaCopywritingPath}?copy=${copy.id}`,
      chip: { label: copyStatusLabel(copy.status), tone: copyStatusTone(copy.status) },
    });
    expect(copyTitle(copy.copyNumber)).toBe('Copy #1');
  });

  it('is null for the summer collection, which has no copywriting_id, so the panel says so', () => {
    expect(SUMMER?.copywritingId).toBeNull();
    expect(metaCopyLink(SUMMER?.copywritingId ?? null, demoCopy)).toBeNull();
  });

  it('is null when the id resolves to no row of the brand, so a dangling link reads like no link', () => {
    expect(metaCopyLink('11223344-1122-4334-8556-000000000099', demoCopy)).toBeNull();
    expect(metaCopyLink(BFCM?.copywritingId ?? null, [])).toBeNull();
  });
});
