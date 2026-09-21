import { describe, expect, it } from 'vitest';

import { slugify, validateBrandDraft, type BrandDraft } from './validate-brand-draft';

const validDraft: BrandDraft = {
  name: 'Niagara Sleep Solutions',
  slug: 'niagara-sleep-solutions',
  website: 'https://niagara.example.com',
  team: [{ userId: 'u1', role: 'csm' }],
};

describe('validateBrandDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateBrandDraft(validDraft)).toEqual([]);
  });

  it('rejects an empty name', () => {
    const errors = validateBrandDraft({ ...validDraft, name: '  ' });
    expect(errors).toEqual([{ field: 'name', message: 'Brand name is required.' }]);
  });

  it('rejects a name over 100 characters', () => {
    const errors = validateBrandDraft({ ...validDraft, name: 'A'.repeat(101) });
    expect(errors).toEqual([
      { field: 'name', message: 'Brand name must be 100 characters or fewer.' },
    ]);
  });

  it('rejects an empty slug', () => {
    const errors = validateBrandDraft({ ...validDraft, slug: '' });
    expect(errors).toEqual([{ field: 'slug', message: 'URL slug is required.' }]);
  });

  it('rejects a slug with uppercase or spaces', () => {
    const errors = validateBrandDraft({ ...validDraft, slug: 'Bad Slug' });
    expect(errors).toEqual([
      { field: 'slug', message: 'Slug must be lowercase letters, numbers and hyphens only.' },
    ]);
  });

  it('accepts an empty website', () => {
    expect(validateBrandDraft({ ...validDraft, website: '' })).toEqual([]);
  });

  it('rejects an invalid website URL', () => {
    const errors = validateBrandDraft({ ...validDraft, website: 'not-a-url' });
    expect(errors).toEqual([{ field: 'website', message: 'Website must be a valid URL.' }]);
  });

  it('collects multiple errors', () => {
    const errors = validateBrandDraft({ ...validDraft, name: '', slug: '', website: 'bad' });
    expect(errors).toHaveLength(3);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Niagara Sleep Solutions')).toBe('niagara-sleep-solutions');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('collapses multiple special chars into one hyphen', () => {
    expect(slugify('a & b / c')).toBe('a-b-c');
  });
});
