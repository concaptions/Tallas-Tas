import { describe, expect, it } from 'vitest';

import { briefThumbnail, creativeNameToken } from './thumbnail';

const NAME = 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2';

describe('creativeNameToken', () => {
  it('takes the §7 leading token off a generated name', () => {
    expect(creativeNameToken(NAME)).toBe('TV1');
    expect(creativeNameToken('AM1-B2-Make 9am Look Like 3am-Yapper Style-V1')).toBe('AM1');
  });

  it('splits on anything that is not alphanumeric, so a hand-typed name still yields a token', () => {
    expect(creativeNameToken('  spring sale hero ')).toBe('SPRI');
    expect(creativeNameToken('___RS1___')).toBe('RS1');
    expect(creativeNameToken('RS1_B4/V3')).toBe('RS1');
  });

  it('caps the token at four characters so the tile never has to shrink its type', () => {
    expect(creativeNameToken('Extraordinarily')).toBe('EXTR');
  });

  it('falls back to an em dash for a name with nothing in it', () => {
    expect(creativeNameToken('')).toBe('—');
    expect(creativeNameToken('   ')).toBe('—');
    expect(creativeNameToken('---')).toBe('—');
  });
});

describe('briefThumbnail', () => {
  it('prefers the design file, which points at the creative itself', () => {
    const tile = briefThumbnail({
      name: NAME,
      designFileUrl: 'https://frame.example/niagara/tv1-b1-v2-master',
      inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
    });
    expect(tile.source).toBe('design-file');
    expect(tile.label).toBe('frame.example');
    expect(tile.provider).toBe('other');
    expect(tile.url).toBe('https://frame.example/niagara/tv1-b1-v2-master');
    expect(tile.alt).toContain('Design file');
    expect(tile.alt).toContain(NAME);
  });

  it('labels an inspiration link with the provider word, not the card title', () => {
    const tile = briefThumbnail({
      name: NAME,
      designFileUrl: null,
      inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
    });
    expect(tile.source).toBe('inspiration');
    expect(tile.label).toBe('YouTube');
    expect(tile.provider).toBe('youtube');
    expect(tile.url).toBe('https://www.youtube.com/watch?v=nm1TxQj9IsQ');
    expect(tile.alt).toContain('Ad inspiration');
  });

  it('knows each provider the strategists paste', () => {
    const cases: readonly [string, string, string][] = [
      [
        'https://www.facebook.com/ads/library/?active_status=all&id=1204339857741622',
        'Meta',
        'meta-ad-library',
      ],
      ['https://www.tiktok.com/@brand/video/7312', 'TikTok', 'tiktok'],
      ['https://www.instagram.com/reel/CxyzAB123/', 'Instagram', 'instagram'],
      ['https://youtu.be/nm1TxQj9IsQ', 'YouTube', 'youtube'],
    ];
    for (const [url, label, provider] of cases) {
      const tile = briefThumbnail({ name: NAME, inspoLinks: [url] });
      expect(tile.label).toBe(label);
      expect(tile.provider).toBe(provider);
    }
  });

  it('uses the bare host for a link no provider table recognises', () => {
    const tile = briefThumbnail({ name: NAME, inspoLinks: ['https://vimeo.com/76979871'] });
    expect(tile.label).toBe('vimeo.com');
    expect(tile.provider).toBe('other');
  });

  it('takes the first real link and steps over the junk in front of it', () => {
    const tile = briefThumbnail({
      name: NAME,
      inspoLinks: [
        '',
        '   ',
        'not a url',
        'javascript:alert(1)',
        'https://www.tiktok.com/@b/video/1',
      ],
    });
    expect(tile.source).toBe('inspiration');
    expect(tile.label).toBe('TikTok');
  });

  it('falls back to the name token when there is nothing to link to', () => {
    const tile = briefThumbnail({ name: NAME, designFileUrl: null, inspoLinks: [] });
    expect(tile).toEqual({
      source: 'name',
      label: 'TV1',
      provider: null,
      url: null,
      alt: NAME,
    });
  });

  it('treats a malformed design file url as no design file rather than throwing', () => {
    for (const bad of ['', '   ', 'frame.example/no-protocol', 'mailto:art@tas.example', '://']) {
      const tile = briefThumbnail({ name: NAME, designFileUrl: bad, inspoLinks: [] });
      expect(tile.source).toBe('name');
      expect(tile.label).toBe('TV1');
    }
  });

  it('degrades past a malformed design file to a good inspiration link', () => {
    const tile = briefThumbnail({
      name: NAME,
      designFileUrl: 'not a url',
      inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
    });
    expect(tile.source).toBe('inspiration');
    expect(tile.label).toBe('YouTube');
  });

  it('survives every field being absent, undefined or null', () => {
    expect(briefThumbnail({ name: NAME }).source).toBe('name');
    expect(
      briefThumbnail({ name: NAME, designFileUrl: undefined, inspoLinks: undefined }).label,
    ).toBe('TV1');
    expect(briefThumbnail({ name: NAME, inspoLinks: null }).label).toBe('TV1');
  });

  it('always has something to draw and something to read out', () => {
    const tile = briefThumbnail({ name: '', designFileUrl: null, inspoLinks: [] });
    expect(tile.label).toBe('—');
    expect(tile.alt.length).toBeGreaterThan(0);
  });

  it('never fetches: a url that would 404 is classified all the same', () => {
    const tile = briefThumbnail({
      name: NAME,
      designFileUrl: 'https://frame.example/deleted/404',
    });
    expect(tile.source).toBe('design-file');
    expect(tile.label).toBe('frame.example');
  });
});
