import {
  NAV_SECTION_KEYS,
  REMOVED_WORKSPACES,
  REMOVED_WORKSPACE_REDIRECTS,
  isRemovedWorkspace,
} from '@tas/domain';
import { describe, expect, it } from 'vitest';

import {
  REMOVED_WORKSPACE_REFUSAL,
  assertWorkspaceLive,
  removedWorkspaceRedirect,
} from './removed-workspaces';
import { appPath, assetsPath, copywritingPath, creativeSheetPath } from './routes';

describe('removedWorkspaceRedirect', () => {
  it('sends the four targets to their live routes', () => {
    expect(removedWorkspaceRedirect('briefs')).toBe(creativeSheetPath);
    expect(removedWorkspaceRedirect('client-assets')).toBe(`${assetsPath}?tab=client-folders`);
    expect(removedWorkspaceRedirect('youtube-copywriting')).toBe(copywritingPath);
    expect(removedWorkspaceRedirect('performance')).toBe(appPath);
  });

  it('resolves every retired key to a route under /app, so no key is left without a landing page', () => {
    for (const key of REMOVED_WORKSPACES) {
      const target = removedWorkspaceRedirect(key);
      expect(target.startsWith(appPath), key).toBe(true);
      // Never back to itself: a redirect loop is the one way a retired page could still be reached.
      expect(target.startsWith(`/app/${key}`), key).toBe(false);
    }
  });

  it('carries the visitor query string over, and lets the target own a key both name', () => {
    expect(removedWorkspaceRedirect('youtube-copywriting', { 'youtube-copy': 'abc', q: 'x' })).toBe(
      `${copywritingPath}?youtube-copy=abc&q=x`,
    );
    expect(removedWorkspaceRedirect('client-assets', { folder: 'f1', tab: 'uploads' })).toBe(
      `${assetsPath}?folder=f1&tab=client-folders`,
    );
    // Repeated keys arrive as arrays and are dropped rather than guessed at.
    expect(removedWorkspaceRedirect('briefs', { view: ['grid', 'kanban'], q: 'a' })).toBe(
      `${creativeSheetPath}?q=a`,
    );
  });
});

describe('assertWorkspaceLive', () => {
  it('refuses every retired workspace with the one sentence', () => {
    for (const key of REMOVED_WORKSPACES) {
      expect(assertWorkspaceLive(key), key).toEqual({
        ok: false,
        error: REMOVED_WORKSPACE_REFUSAL,
      });
    }
  });

  it('lets every live section through', () => {
    for (const key of NAV_SECTION_KEYS) {
      if (isRemovedWorkspace(key)) continue;
      expect(assertWorkspaceLive(key), key).toBeNull();
    }
  });

  it('the refusal is a plain sentence', () => {
    expect(REMOVED_WORKSPACE_REFUSAL).not.toContain('<');
    expect(REMOVED_WORKSPACE_REFUSAL.endsWith('.')).toBe(true);
  });

  it('the domain map names a target for every retired key, and nothing else', () => {
    expect(Object.keys(REMOVED_WORKSPACE_REDIRECTS).sort()).toEqual([...REMOVED_WORKSPACES].sort());
  });
});
