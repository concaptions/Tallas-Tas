import { demoCollections, demoEmailCampaigns, demoYoutubeCopy } from '@tas/db';
import { emailCampaignStatuses } from '@tas/db/schema';
import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import { emailCampaignsPath, youtubeCopywritingPath } from '@/lib/routes';

import { indexEmailCampaignsByCollection, indexYoutubeCopyByCollection } from './fields';

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
