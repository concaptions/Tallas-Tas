import { describe, expect, it } from 'vitest';

import { isHttpUrl, parseInspoLink } from './inspo-links';

describe('parseInspoLink · Meta Ad Library', () => {
  it('reads the ad id out of an ad library link', () => {
    expect(parseInspoLink('https://www.facebook.com/ads/library/?id=1234567890')).toEqual({
      kind: 'meta-ad-library',
      label: 'Meta Ad Library · 1234567890',
      host: 'facebook.com',
      id: '1234567890',
    });
  });

  it('falls back to the page id the library uses for a whole advertiser', () => {
    const link = parseInspoLink(
      'https://web.facebook.com/ads/library/?active_status=all&view_all_page_id=99',
    );
    expect(link).toEqual({
      kind: 'meta-ad-library',
      label: 'Meta Ad Library · 99',
      host: 'web.facebook.com',
      id: '99',
    });
  });

  it('keeps the kind with no id at all', () => {
    expect(parseInspoLink('https://facebook.com/ads/library/')).toEqual({
      kind: 'meta-ad-library',
      label: 'Meta Ad Library',
      host: 'facebook.com',
    });
  });

  it('does not claim a facebook link that is not the ad library', () => {
    expect(parseInspoLink('https://www.facebook.com/tasdigital/posts/42')).toEqual({
      kind: 'other',
      label: '42',
      host: 'facebook.com',
    });
  });
});

describe('parseInspoLink · YouTube', () => {
  it('reads the v parameter of a watch link', () => {
    expect(parseInspoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toEqual({
      kind: 'youtube',
      label: 'YouTube · dQw4w9WgXcQ',
      host: 'youtube.com',
      id: 'dQw4w9WgXcQ',
    });
  });

  it('reads the short youtu.be form', () => {
    expect(parseInspoLink('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      label: 'YouTube · dQw4w9WgXcQ',
      host: 'youtu.be',
      id: 'dQw4w9WgXcQ',
    });
  });

  it('keeps the kind for a youtube link that names no video', () => {
    expect(parseInspoLink('https://www.youtube.com/@tasdigital')).toEqual({
      kind: 'youtube',
      label: 'YouTube',
      host: 'youtube.com',
    });
  });
});

describe('parseInspoLink · TikTok', () => {
  it('reads the handle and the video id', () => {
    expect(parseInspoLink('https://www.tiktok.com/@brandhandle/video/7312345678901234567')).toEqual(
      {
        kind: 'tiktok',
        label: 'TikTok · @brandhandle',
        host: 'tiktok.com',
        id: '7312345678901234567',
      },
    );
  });

  it('keeps the handle when the path stops at the profile', () => {
    expect(parseInspoLink('https://www.tiktok.com/@brandhandle')).toEqual({
      kind: 'tiktok',
      label: 'TikTok · @brandhandle',
      host: 'tiktok.com',
    });
  });

  it('keeps the kind for a tiktok link with no handle', () => {
    expect(parseInspoLink('https://www.tiktok.com/discover/skincare')).toEqual({
      kind: 'tiktok',
      label: 'TikTok',
      host: 'tiktok.com',
    });
  });
});

describe('parseInspoLink · Instagram', () => {
  it('reads a post shortcode', () => {
    expect(parseInspoLink('https://www.instagram.com/p/CxYz123abc/')).toEqual({
      kind: 'instagram',
      label: 'Instagram · CxYz123abc',
      host: 'instagram.com',
      id: 'CxYz123abc',
    });
  });

  it('reads a reel shortcode', () => {
    expect(parseInspoLink('https://instagram.com/reel/CxYz123abc/?igsh=x')).toEqual({
      kind: 'instagram',
      label: 'Instagram · CxYz123abc',
      host: 'instagram.com',
      id: 'CxYz123abc',
    });
  });

  it('keeps the kind for a profile link', () => {
    expect(parseInspoLink('https://www.instagram.com/tasdigital/')).toEqual({
      kind: 'instagram',
      label: 'Instagram',
      host: 'instagram.com',
    });
  });
});

describe('parseInspoLink · other', () => {
  it('labels an unknown host with the last path segment', () => {
    expect(parseInspoLink('https://ads.example.com/campaigns/spring-sale')).toEqual({
      kind: 'other',
      label: 'spring-sale',
      host: 'ads.example.com',
    });
  });

  it('decodes a percent-encoded last segment', () => {
    expect(parseInspoLink('https://example.com/case%20study').label).toBe('case study');
  });

  it('labels a bare host with the host itself', () => {
    expect(parseInspoLink('https://example.com')).toEqual({
      kind: 'other',
      label: 'example.com',
      host: 'example.com',
    });
  });

  it('returns the raw text for a malformed URL', () => {
    expect(parseInspoLink('htp:/not a url')).toEqual({
      kind: 'other',
      label: 'htp:/not a url',
      host: '',
    });
  });

  it('returns the raw text for a non-http scheme', () => {
    expect(parseInspoLink('mailto:hello@tasdigital.com')).toEqual({
      kind: 'other',
      label: 'mailto:hello@tasdigital.com',
      host: '',
    });
  });

  it('refuses a javascript: URL rather than treating it as a link', () => {
    expect(parseInspoLink('javascript:alert(1)')).toEqual({
      kind: 'other',
      label: 'javascript:alert(1)',
      host: '',
    });
  });

  it('returns the empty string for the empty string', () => {
    expect(parseInspoLink('')).toEqual({ kind: 'other', label: '', host: '' });
  });

  it('never throws, whatever it is handed', () => {
    for (const value of ['', ' ', '//', 'http://', '://x', '🙂', 'ftp://files.example.com/a']) {
      expect(() => parseInspoLink(value)).not.toThrow();
      expect(parseInspoLink(value).kind).toBeTypeOf('string');
    }
  });

  it('does not match a look-alike host', () => {
    expect(parseInspoLink('https://nottiktok.com/@brand/video/1').kind).toBe('other');
  });
});

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com/a')).toBe(true);
  });

  it('refuses another scheme, a malformed string and an empty string', () => {
    expect(isHttpUrl('ftp://example.com')).toBe(false);
    expect(isHttpUrl('example.com')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});
