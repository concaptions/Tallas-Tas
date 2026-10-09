import { demoBriefs, demoCreators, demoEmailCampaigns, demoYoutubeCopy } from '@tas/db';
import { internalStatusFor } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import { toBriefRow } from '@/lib/briefs-source';
import { briefPath, ugcPath } from '@/lib/routes';

import { internalStatusView } from '../creative-design/fields';
import {
  conceptCountLabel,
  conceptCountTone,
  creativeDesignLinks,
  creatorLinks,
  emailCampaignLinks,
  hostLabel,
  PRODUCT_FIELDS,
  youtubeCopyLinks,
} from './fields';

/** `demoProducts` ids: the blanket, the mask and the bundle, as every fixture module names them. */
const BLANKET_ID = '22222222-2222-4222-8222-000000000001';
const MASK_ID = '22222222-2222-4222-8222-000000000002';
const RESET_BUNDLE_ID = '22222222-2222-4222-8222-000000000003';
const UNKNOWN_ID = '99999999-9999-4999-8999-000000000000';

describe('PRODUCT_FIELDS', () => {
  it('is the three PRD §5.1 columns, in panel order', () => {
    expect(PRODUCT_FIELDS.map((field) => field.name)).toEqual(['name', 'link', 'collectionLink']);
  });

  it('marks the name and the landing page link required, the collection link optional', () => {
    expect(PRODUCT_FIELDS.map((field) => field.required)).toEqual([true, true, false]);
  });
});

describe('hostLabel', () => {
  it('shortens a long landing page URL to its host', () => {
    expect(hostLabel('https://niagarasleep.example/products/deep-sleep-weighted-blanket')).toBe(
      'niagarasleep.example',
    );
  });

  it('drops a www prefix so two links of one brand read the same', () => {
    expect(hostLabel('https://www.niagarasleep.example/collections/sleep-essentials')).toBe(
      'niagarasleep.example',
    );
  });

  it('keeps a port, which is part of the host', () => {
    expect(hostLabel('http://localhost:3000/products/one')).toBe('localhost:3000');
  });

  it('returns null for an absent collection link, so the cell renders the em dash', () => {
    expect(hostLabel(null)).toBeNull();
  });

  it('returns null for a whitespace-only value rather than an empty chip', () => {
    expect(hostLabel('   ')).toBeNull();
  });

  it('returns an unparseable value untouched instead of hiding it', () => {
    expect(hostLabel('niagarasleep.example')).toBe('niagarasleep.example');
  });
});

describe('conceptCountLabel', () => {
  it('renders zero as a number, never a blank or a dash', () => {
    expect(conceptCountLabel(0)).toBe('0 concepts');
  });

  it('is singular at one', () => {
    expect(conceptCountLabel(1)).toBe('1 concept');
  });

  it('is plural above one', () => {
    expect(conceptCountLabel(4)).toBe('4 concepts');
  });
});

describe('conceptCountTone', () => {
  it('is muted at zero and info above it', () => {
    expect(conceptCountTone(0)).toBe('mute');
    expect(conceptCountTone(1)).toBe('info');
  });
});

describe('emailCampaignLinks', () => {
  it('lists the campaigns whose junction names the product, in source order, as plain records', () => {
    const links = emailCampaignLinks(BLANKET_ID, demoEmailCampaigns);

    expect(links).toEqual([
      {
        id: 'ee11ee11-ee11-4e11-8e11-000000000001',
        label: 'BFCM Early Access — VIP list',
        chip: { label: 'Template Design', tone: 'accent' },
      },
      {
        id: 'ee11ee11-ee11-4e11-8e11-000000000003',
        label: 'Valentine couples bundle',
        chip: { label: 'Client: Edits Required', tone: 'warn' },
      },
    ]);
  });

  it('is empty for a product no campaign promotes, so the panel can say so', () => {
    expect(emailCampaignLinks(UNKNOWN_ID, demoEmailCampaigns)).toEqual([]);
  });

  it('gives a campaign with no status no chip, rather than a blank one', () => {
    const promoted = demoEmailCampaigns.find((row) => row.productIds.includes(BLANKET_ID));
    if (promoted === undefined) {
      throw new Error('fixture drift: no demo email campaign promotes the blanket');
    }
    const links = emailCampaignLinks(BLANKET_ID, [{ ...promoted, status: null }]);

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ id: promoted.id, label: promoted.name });
    expect(links[0]).not.toHaveProperty('chip');
  });

  it('is the other side of the junction: every product a campaign names lists that campaign back', () => {
    for (const campaign of demoEmailCampaigns) {
      for (const productId of campaign.productIds) {
        const ids = emailCampaignLinks(productId, demoEmailCampaigns).map((link) => link.id);
        expect(ids).toContain(campaign.id);
      }
    }
  });
});

describe('youtubeCopyLinks', () => {
  it('lists the copy rows linked to the product with the generated title and the COPY_STATUS chip', () => {
    const links = youtubeCopyLinks(BLANKET_ID, demoYoutubeCopy);

    expect(links).toEqual([
      {
        id: 'a1b2c3d4-0012-4012-8012-000000000001',
        label: 'Copy 1',
        chip: { label: 'Approved', tone: 'ok' },
      },
      {
        id: 'a1b2c3d4-0012-4012-8012-000000000004',
        label: 'Copy 4',
        chip: { label: 'Revisions Needed', tone: 'warn' },
      },
    ]);
  });

  it('matches on the linked product id, so a row names the bundle without naming its parts', () => {
    expect(youtubeCopyLinks(RESET_BUNDLE_ID, demoYoutubeCopy).map((link) => link.label)).toEqual([
      'Copy 3',
    ]);
    expect(youtubeCopyLinks(MASK_ID, demoYoutubeCopy).map((link) => link.label)).toEqual([
      'Copy 2',
      'Copy 4',
    ]);
  });

  it('is empty for a product no copy row links to', () => {
    expect(youtubeCopyLinks(UNKNOWN_ID, demoYoutubeCopy)).toEqual([]);
  });

  it('is the other side of the junction: every product a copy row links to lists that row back', () => {
    for (const copy of demoYoutubeCopy) {
      for (const product of copy.linkedProducts) {
        const ids = youtubeCopyLinks(product.id, demoYoutubeCopy).map((link) => link.id);
        expect(ids).toContain(copy.id);
      }
    }
  });
});

describe('creativeDesignLinks', () => {
  /**
   * The fixtures carry no `productId` (every demo brief hangs off its concept), so the reverse link
   * is built on top of them, as the page would see it after an import: every video brief is briefed
   * on the blanket and the standalone static on the mask. `toBriefRow` is the page's own narrowing.
   */
  const briefs = demoBriefs.map(toBriefRow);
  const standalone = briefs.find((row) => row.conceptId === null);
  if (standalone === undefined) {
    throw new Error('fixture drift: no standalone demo brief');
  }
  const rows = briefs.map((row) => {
    if (row.id === standalone.id) return { ...row, productId: MASK_ID };
    return row.track === 'video' ? { ...row, productId: BLANKET_ID } : row;
  });

  it('lists the briefs whose product_id is the product, in source order, as plain records', () => {
    const briefed = rows.filter((row) => row.productId === BLANKET_ID);
    expect(briefed.length).toBeGreaterThan(1);

    const links = creativeDesignLinks(BLANKET_ID, rows);

    expect(links).toEqual(
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
    // The link is the brief's own detail route, never a panel parameter.
    expect(links[0]?.href).toBe(`/app/creative-design/${links[0]?.id ?? ''}`);
  });

  it('grades a static brief on the static track, as its own page does', () => {
    const [link, ...more] = creativeDesignLinks(MASK_ID, rows);
    const entry = internalStatusFor('static').find(
      (step) => step.key === standalone.internalStatus,
    );

    expect(more).toEqual([]);
    expect(link?.id).toBe(standalone.id);
    expect(link?.chip).toEqual({
      label: entry?.label,
      tone: internalStatusView('static', standalone.internalStatus).tone,
    });
    expect(link?.chip?.label).toBe('Approved');
  });

  it('is empty for a product no brief is briefed on, so the panel can say so', () => {
    expect(creativeDesignLinks(RESET_BUNDLE_ID, rows)).toEqual([]);
    expect(creativeDesignLinks(UNKNOWN_ID, rows)).toEqual([]);
  });

  it('is empty for every fixture product today, because no demo brief carries a product_id', () => {
    for (const id of [BLANKET_ID, MASK_ID, RESET_BUNDLE_ID]) {
      expect(creativeDesignLinks(id, briefs)).toEqual([]);
    }
  });
});

describe('creatorLinks', () => {
  /** The fixtures book no creator on a product, so the junction is built on top of them. */
  const danielle = demoCreators.find((row) => row.name === 'Danielle Okonkwo');
  const marcus = demoCreators.find((row) => row.name !== 'Danielle Okonkwo');
  if (danielle === undefined || marcus === undefined) {
    throw new Error('fixture drift: the demo creators are missing');
  }
  const rows = demoCreators.map((row) => {
    if (row.id === danielle.id) return { ...row, productIds: [BLANKET_ID, MASK_ID] };
    return row.id === marcus.id ? { ...row, productIds: [MASK_ID] } : row;
  });

  it('lists the creators whose junction names the product, linked to the UGC panel with the internal-track chip', () => {
    expect(creatorLinks(BLANKET_ID, rows)).toEqual([
      {
        id: danielle.id,
        label: 'Danielle Okonkwo',
        href: `${ugcPath}?creator=${danielle.id}`,
        chip: { label: 'Approved', tone: 'ok' },
      },
    ]);
  });

  it('is the other side of the junction: a creator booked for two products lists on both, in row order', () => {
    const ids = creatorLinks(MASK_ID, rows).map((link) => link.id);
    const expected = rows.filter((row) => row.productIds.includes(MASK_ID)).map((row) => row.id);

    expect(ids).toEqual(expected);
    expect(ids).toContain(danielle.id);
    expect(ids).toContain(marcus.id);
  });

  it('is empty for a product no creator is booked for, so the panel can say so', () => {
    expect(creatorLinks(RESET_BUNDLE_ID, rows)).toEqual([]);
    expect(creatorLinks(UNKNOWN_ID, rows)).toEqual([]);
  });

  it('is empty for every fixture product today, because no demo creator carries a product link', () => {
    for (const id of [BLANKET_ID, MASK_ID, RESET_BUNDLE_ID]) {
      expect(creatorLinks(id, demoCreators)).toEqual([]);
    }
  });
});
