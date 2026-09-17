import { describe, expect, it } from 'vitest';

import { inspirationLink, inspirationLinks, isEmbeddable } from './inspiration';

/** The links `@tas/db` actually stored on the six seeded briefs, in list order. */
const FIXTURE_LINKS = [
  'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1204339857741622',
  'https://www.youtube.com/watch?v=nm1TxQj9IsQ',
  'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=982254173318827',
  'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
  'https://www.instagram.com/reel/C7pLd4vNqR2/',
  'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=760118443925514',
];

describe('inspirationLink · classification', () => {
  it('classifies every provider across the seeded fixtures', () => {
    expect(FIXTURE_LINKS.map((url) => inspirationLink(url).provider)).toEqual([
      'meta-ad-library',
      'youtube',
      'meta-ad-library',
      'tiktok',
      'instagram',
      'meta-ad-library',
    ]);
  });

  it('keeps the pasted url verbatim for the "open the original" href', () => {
    const url = FIXTURE_LINKS[1] ?? '';
    expect(inspirationLink(url).url).toBe(url);
  });

  it('reads the ad id out of a Meta Ad Library link', () => {
    const link = inspirationLink(FIXTURE_LINKS[0] ?? '');
    expect(link.id).toBe('1204339857741622');
    expect(link.host).toBe('facebook.com');
    expect(link.label).toBe('Meta Ad Library · 1204339857741622');
  });

  it('reads the handle and the video id out of a TikTok link', () => {
    const link = inspirationLink(FIXTURE_LINKS[3] ?? '');
    expect(link.id).toBe('7385012994771635745');
    expect(link.label).toBe('TikTok · @thepostpartumplan');
  });

  it('reads the shortcode out of an Instagram reel', () => {
    expect(inspirationLink(FIXTURE_LINKS[4] ?? '').id).toBe('C7pLd4vNqR2');
  });

  it('falls back to `other` for a provider nobody has taught it', () => {
    const link = inspirationLink('https://foreplay.example/boards/green-screen-reaction');
    expect(link.provider).toBe('other');
    expect(link.host).toBe('foreplay.example');
    expect(link.embedUrl).toBeNull();
  });
});

describe('inspirationLink · embed urls', () => {
  it('embeds a YouTube watch url', () => {
    expect(inspirationLink('https://www.youtube.com/watch?v=nm1TxQj9IsQ').embedUrl).toBe(
      'https://www.youtube.com/embed/nm1TxQj9IsQ',
    );
  });

  it('embeds the youtu.be short form the same way', () => {
    expect(inspirationLink('https://youtu.be/nm1TxQj9IsQ').embedUrl).toBe(
      'https://www.youtube.com/embed/nm1TxQj9IsQ',
    );
  });

  it('embeds a TikTok video', () => {
    expect(inspirationLink(FIXTURE_LINKS[3] ?? '').embedUrl).toBe(
      'https://www.tiktok.com/embed/v2/7385012994771635745',
    );
  });

  it('embeds an Instagram reel and an Instagram post through the same path', () => {
    expect(inspirationLink('https://www.instagram.com/reel/C7pLd4vNqR2/').embedUrl).toBe(
      'https://www.instagram.com/p/C7pLd4vNqR2/embed',
    );
    expect(inspirationLink('https://www.instagram.com/p/C7pLd4vNqR2/').embedUrl).toBe(
      'https://www.instagram.com/p/C7pLd4vNqR2/embed',
    );
  });

  it('never embeds the Meta Ad Library — it refuses to be framed, so it is a card', () => {
    for (const url of FIXTURE_LINKS.filter((link) => link.includes('ads/library'))) {
      const link = inspirationLink(url);
      expect(link.provider).toBe('meta-ad-library');
      expect(link.embedUrl).toBeNull();
      expect(isEmbeddable(link)).toBe(false);
    }
  });

  it('falls back to a card when a known provider names no video', () => {
    expect(inspirationLink('https://www.youtube.com/').embedUrl).toBeNull();
    expect(inspirationLink('https://www.tiktok.com/@thepostpartumplan').embedUrl).toBeNull();
    expect(inspirationLink('https://www.instagram.com/thepostpartumplan/').embedUrl).toBeNull();
  });

  it('exercises both branches across the fixtures: three cards, three embeds', () => {
    const links = FIXTURE_LINKS.map(inspirationLink);
    const embeddable = links.filter(isEmbeddable);
    expect(embeddable.map((link) => link.provider)).toEqual(['youtube', 'tiktok', 'instagram']);
    expect(links.filter((link) => !isEmbeddable(link)).map((link) => link.provider)).toEqual([
      'meta-ad-library',
      'meta-ad-library',
      'meta-ad-library',
    ]);
  });
});

describe('inspirationLink · degrading, never throwing', () => {
  it('degrades a string that is not a url to a card with the raw text as its label', () => {
    const link = inspirationLink('not a url');
    expect(link).toEqual({
      url: 'not a url',
      provider: 'other',
      label: 'not a url',
      host: '',
      embedUrl: null,
    });
  });

  it('degrades a non-http scheme rather than putting it in an iframe', () => {
    for (const url of ['javascript:alert(1)', 'mailto:someone@example.com', 'data:text/html,hi']) {
      const link = inspirationLink(url);
      expect(link.provider).toBe('other');
      expect(link.embedUrl).toBeNull();
    }
  });

  it('never throws, whatever it is handed', () => {
    for (const url of ['', ' ', '///', 'http://', 'https://%', 'https://youtube.com/watch?v=']) {
      expect(() => inspirationLink(url)).not.toThrow();
      expect(inspirationLink(url).embedUrl).toBeNull();
    }
  });

  it('omits the id rather than carrying an empty one', () => {
    expect(inspirationLink('https://www.youtube.com/')).not.toHaveProperty('id');
  });
});

describe('inspirationLinks · a whole stored array', () => {
  it('keeps the order the strategist pasted, because the order is the ranking', () => {
    const urls = [FIXTURE_LINKS[3] ?? '', FIXTURE_LINKS[4] ?? ''];
    expect(inspirationLinks(urls).map((link) => link.url)).toEqual(urls);
  });

  it('is empty for the fixture that carries no inspiration, so the empty state shows', () => {
    expect(inspirationLinks([])).toEqual([]);
  });

  it('drops a blank entry rather than rendering one invisible card', () => {
    expect(inspirationLinks(['', '   ', FIXTURE_LINKS[1] ?? ''])).toHaveLength(1);
  });

  it('reads the whole seeded set', () => {
    expect(inspirationLinks(FIXTURE_LINKS)).toHaveLength(FIXTURE_LINKS.length);
  });
});
