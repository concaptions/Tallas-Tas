import { describe, expect, it } from 'vitest';

import { BOLD_UI_SCOPE, uiScope } from './ui-scope';

/**
 * The Bold rollout gate (commit 1): the template brand gets the `data-ui="bold"` scope, every
 * other case — a child brand, no active brand at all — stays unscoped so child brands keep the
 * current look (bold-redesign-spec.md, "Rollout constraints (2026-10-16)").
 */
describe('uiScope', () => {
  it('stamps the Bold scope when the active brand is the template', () => {
    expect(uiScope({ isTemplate: true })).toBe(BOLD_UI_SCOPE);
  });

  it('leaves a child brand unscoped', () => {
    expect(uiScope({ isTemplate: false })).toBeUndefined();
  });

  it('leaves a missing active brand unscoped', () => {
    expect(uiScope(null)).toBeUndefined();
    expect(uiScope(undefined)).toBeUndefined();
  });
});
