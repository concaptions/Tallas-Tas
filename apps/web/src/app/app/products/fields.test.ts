import { demoEmailCampaigns, demoYoutubeCopy } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { emailCampaignsPath, youtubeCopywritingPath } from '@/lib/routes';

import {
  conceptCountLabel,
  conceptCountTone,
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
        href: `${emailCampaignsPath}?emailCampaign=ee11ee11-ee11-4e11-8e11-000000000001`,
        chip: { label: 'Template Design', tone: 'accent' },
      },
      {
        id: 'ee11ee11-ee11-4e11-8e11-000000000003',
        label: 'Valentine couples bundle',
        href: `${emailCampaignsPath}?emailCampaign=ee11ee11-ee11-4e11-8e11-000000000003`,
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
        href: `${youtubeCopywritingPath}?youtube-copy=a1b2c3d4-0012-4012-8012-000000000001`,
        chip: { label: 'Approved', tone: 'ok' },
      },
      {
        id: 'a1b2c3d4-0012-4012-8012-000000000004',
        label: 'Copy 4',
        href: `${youtubeCopywritingPath}?youtube-copy=a1b2c3d4-0012-4012-8012-000000000004`,
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
