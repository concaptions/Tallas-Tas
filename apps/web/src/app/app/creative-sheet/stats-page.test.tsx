// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The page-level role gate for `/app/creative-sheet?tab=stats` (Ticket 12). A viewer whose role
 * does not pass `canViewBriefStats` is redirected back to the sheet; the stats data loader is
 * never reached. Mocks keep the test off a database and off Clerk.
 */

const redirectMock = vi.fn((url: string): never => {
  throw new Error(`REDIRECT:${url}`);
});
const roleMock = vi.fn();
const statsLoader = vi.fn();

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/link', () => ({ default: ({ children }: { children?: unknown }) => children }));
vi.mock('@/lib/viewer-role', () => ({
  viewerRole: (): Promise<unknown> => Promise.resolve(roleMock()),
}));
vi.mock('@/lib/brief-stats-source', () => ({
  loadBriefStatsForWorkspace: (): Promise<unknown> => Promise.resolve(statsLoader()),
}));
vi.mock('@/lib/briefs-source', () => ({
  loadBriefs: () => Promise.resolve({ rows: [], source: 'demo' as const }),
  loadNextBriefNumber: () => Promise.resolve(1),
}));
vi.mock('@/lib/concepts-source', () => ({
  loadConcepts: () => Promise.resolve({ rows: [], source: 'demo' as const }),
}));
vi.mock('@/lib/creative-sheet-source', () => ({
  loadCreativeSheetColumns: () =>
    Promise.resolve({ columns: [], unconfigured: false, source: 'demo' as const }),
  loadCreativeSheetWorkspace: () =>
    Promise.resolve({
      rows: [],
      briefLookups: [],
      angleNames: [],
      productNames: [],
      concepts: [],
      modules: [],
      copyRows: [],
      comments: [],
      source: 'demo' as const,
    }),
}));
vi.mock('@/lib/user-view-actions', () => ({
  loadUserViews: () => Promise.resolve({ userId: null, views: [] }),
}));
vi.mock('@/lib/view-preference-actions', () => ({
  loadViewPreference: () =>
    Promise.resolve({ viewType: 'grid' as const, kanbanGroupByField: null }),
}));
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => true }));

afterEach(() => {
  redirectMock.mockClear();
  roleMock.mockReset();
  statsLoader.mockReset();
});

async function runStatsBranch(role: string | null): Promise<void> {
  roleMock.mockReturnValue(role);
  statsLoader.mockReturnValue({
    kpi: { inFlight: 0, approvedThisWeek: 0, avgRevisionHours: null, qaPassRatePct: null },
    perEditor: [],
    weeklyOutput: [],
    turnaround: [],
  });
  const mod = (await import('./page')) as unknown as {
    default: (props: { searchParams: Promise<Record<string, string>> }) => Promise<unknown>;
  };
  await mod.default({ searchParams: Promise.resolve({ tab: 'stats' }) });
}

describe('/app/creative-sheet?tab=stats role gate', () => {
  it('redirects a role that fails canViewBriefStats back to the sheet', async () => {
    try {
      await runStatsBranch('video_editor');
    } catch (error) {
      expect((error as Error).message).toBe('REDIRECT:/app/creative-sheet');
    }
    expect(redirectMock).toHaveBeenCalledWith('/app/creative-sheet');
    expect(statsLoader).not.toHaveBeenCalled();
  });

  it('redirects an unresolved role (null) back to the sheet', async () => {
    try {
      await runStatsBranch(null);
    } catch (error) {
      expect((error as Error).message).toBe('REDIRECT:/app/creative-sheet');
    }
    expect(redirectMock).toHaveBeenCalledWith('/app/creative-sheet');
  });

  it('loads the stats for an admin', async () => {
    try {
      await runStatsBranch('admin');
    } catch {
      // The page returns a React element; a redirect would be caught above.
    }
    expect(redirectMock).not.toHaveBeenCalled();
    expect(statsLoader).toHaveBeenCalledTimes(1);
  });

  it('loads the stats for a CSM', async () => {
    try {
      await runStatsBranch('csm');
    } catch {
      // noop — stats branch returns an element.
    }
    expect(redirectMock).not.toHaveBeenCalled();
    expect(statsLoader).toHaveBeenCalledTimes(1);
  });
});
