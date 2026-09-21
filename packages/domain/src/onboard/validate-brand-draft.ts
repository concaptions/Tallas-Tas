/**
 * Validation for the brand onboarding wizard (PRD §3). Pure functions, no I/O.
 *
 * The wizard collects: brand name, slug, website, and team assignments. Interface config
 * and notification settings are seeded from defaults — the CSM tunes them later on the
 * existing pages.
 */

import type { BrandRole } from '../roles';

export interface BrandDraft {
  readonly name: string;
  readonly slug: string;
  readonly website: string;
  readonly team: readonly TeamAssignmentDraft[];
}

export interface TeamAssignmentDraft {
  readonly userId: string;
  readonly role: BrandRole;
}

export interface BrandDraftError {
  readonly field: string;
  readonly message: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateBrandDraft(draft: BrandDraft): BrandDraftError[] {
  const errors: BrandDraftError[] = [];

  if (draft.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Brand name is required.' });
  }
  if (draft.name.trim().length > 100) {
    errors.push({ field: 'name', message: 'Brand name must be 100 characters or fewer.' });
  }

  if (draft.slug.trim().length === 0) {
    errors.push({ field: 'slug', message: 'URL slug is required.' });
  } else if (!SLUG_PATTERN.test(draft.slug)) {
    errors.push({
      field: 'slug',
      message: 'Slug must be lowercase letters, numbers and hyphens only.',
    });
  }

  if (draft.website.trim().length > 0) {
    try {
      new URL(draft.website);
    } catch {
      errors.push({ field: 'website', message: 'Website must be a valid URL.' });
    }
  }

  return errors;
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
