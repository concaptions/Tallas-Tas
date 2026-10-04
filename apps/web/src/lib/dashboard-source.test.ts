import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  agencies,
  brandAssignments,
  brands,
  demoBriefs,
  demoConcepts,
  demoCreators,
  memberships,
  seed,
  users,
  type BriefListRow,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';

import { toBriefRow, type BriefSourceDeps } from './briefs-source';
import {
  buildRoleDashboard,
  hasSpellingIssues,
  loadActorBrandPanels,
  loadActorBrands,
  loadBrandPanels,
  loadRoleDashboard,
  roleDashboard,
  buildOverviewMetrics,
  buildPipeline,
  overviewMetrics,
} from './dashboard-source';
import { AmbiguousBrandError } from './data-source';

describe('hasSpellingIssues', () => {
  it('is true only for real flags, not a clean pass, blank, or null', () => {
    expect(hasSpellingIssues('Inconsistent hyphenation: day-time')).toBe(true);
    expect(hasSpellingIssues('No issues found.')).toBe(false);
    expect(hasSpellingIssues('  no issues found  ')).toBe(false);
    expect(hasSpellingIssues('   ')).toBe(false);
    expect(hasSpellingIssues('')).toBe(false);
    expect(hasSpellingIssues(null)).toBe(false);
  });
});

describe('roleDashboard', () => {
  /**
   * The tile count per role, stated rather than computed: csm is TWO since action item 8 took the
   * "Angles in library" tile out, and admin is csm's two plus the spell-check tile.
   */
  const TILE_COUNT = {
    strategist: 3,
    video_editor: 3,
    designer: 3,
    csm: 2,
    media_buyer: 3,
    admin: 3,
  } as const;

  it('returns well-formed items for every role, as many as that role is defined to have', () => {
    for (const [role, expected] of Object.entries(TILE_COUNT)) {
      const d = roleDashboard(role as keyof typeof TILE_COUNT);
      expect(d.items, role).toHaveLength(expected);
      expect(d.roleLabel.length).toBeGreaterThan(0);
      for (const item of d.items) {
        expect(item.href).toMatch(/^\/app\//);
        expect(typeof item.count).toBe('number');
      }
    }
  });

  it('carries no library tile on any role — action item 8 removed it', () => {
    for (const role of Object.keys(TILE_COUNT) as (keyof typeof TILE_COUNT)[]) {
      const labels = roleDashboard(role).items.map((i) => i.label);
      expect(labels, role).not.toContain('Angles in library');
      expect(
        labels.some((label) => /angle/i.test(label)),
        role,
      ).toBe(false);
    }
  });

  it('strategist sees concepts needing briefs and QA sign-off counts', () => {
    const d = roleDashboard('strategist');
    expect(d.roleLabel).toBe('Creative Strategist');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Concepts needing briefs');
    expect(labels).toContain('Briefs needing QA sign-off');
  });

  it('editor sees briefs in production and copy pending review', () => {
    const d = roleDashboard('video_editor');
    expect(d.roleLabel).toBe('Creative Items');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Briefs in production');
    expect(labels).toContain('Copy pending review');
  });

  it('designer sees design in progress and missing design files', () => {
    const d = roleDashboard('designer');
    expect(d.roleLabel).toBe('Designer');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Design in progress');
    expect(labels).toContain('Briefs without design file');
  });

  it('csm sees briefs in progress and ready for client', () => {
    const d = roleDashboard('csm');
    expect(d.roleLabel).toBe('Client Success Manager');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Briefs in progress');
    expect(labels).toContain('Ready for client');
  });

  it('media buyer sees ads to launch and winning creatives', () => {
    const d = roleDashboard('media_buyer');
    expect(d.roleLabel).toBe('Media Buyer');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Ads to launch');
    expect(labels).toContain('Winning creatives');
  });

  it('admin keeps the CSM pipeline tiles and adds the spell-check-flags tile', () => {
    const admin = roleDashboard('admin');
    const csm = roleDashboard('csm');
    const adminLabels = admin.items.map((i) => i.label);
    for (const label of csm.items.map((i) => i.label)) {
      expect(adminLabels).toContain(label);
    }
    expect(adminLabels).toContain('Briefs with spell-check flags');
    expect(admin.roleLabel).toBe('Admin');
  });

  it('counts are consistent with known demo fixtures', () => {
    const mb = roleDashboard('media_buyer');
    const launchReady = mb.items.find((i) => i.label === 'Ads to launch');
    const winning = mb.items.find((i) => i.label === 'Winning creatives');
    expect(launchReady?.count).toBe(1);
    expect(winning?.count).toBe(1);
  });
});

/**
 * 2E: the Overview must count over REAL data for a real user, not the demo fixtures. `buildRoleDashboard`
 * is the pure core both paths share, so a count that moves with the data it is handed proves the tiles
 * are not hardcoded; `loadRoleDashboard` in demo mode proves the fixtures still flow when there is no db.
 */
function brief(overrides: Partial<BriefListRow>): BriefListRow {
  return {
    internalStatus: 'sent_to_video_editor',
    clientStatus: 'pending_for_approval',
    conceptId: null,
    qaStrategist: false,
    qaVideoEditor: false,
    qaDesigner: false,
    designFileUrl: null,
    performance: null,
    // The Admin set reads this column (`hasSpellingIssues`), so the stand-in has to carry it: a
    // partial fixture that leaves it undefined throws inside the builder rather than counting 0.
    spellingFeedback: null,
    ...overrides,
  } as BriefListRow;
}

describe('buildRoleDashboard counts over the data it is handed', () => {
  it('reflects the given briefs and concepts, not the fixtures', () => {
    const data = {
      briefs: [
        brief({ internalStatus: 'approved', clientStatus: 'approved' }),
        brief({ internalStatus: 'launched' }),
      ],
      concepts: [
        { id: 'c1', approvalStatus: null },
        { id: 'c2', approvalStatus: null },
        { id: 'c3', approvalStatus: null },
      ],
      copy: [{ status: 'pending_for_client_review' }, { status: 'approved' }],
      creators: [{ clientStatus: 'draft' }],
    };

    const buyer = buildRoleDashboard('media_buyer', data);
    expect(buyer.items.find((i) => i.label === 'Ads to launch')?.count).toBe(1);
    expect(buyer.items.find((i) => i.label === 'Currently live')?.count).toBe(1);

    const csm = buildRoleDashboard('csm', data);
    // Both briefs have cleared internal review, so the CSM's queue is empty and both are ready.
    expect(csm.items.find((i) => i.label === 'Briefs in progress')?.count).toBe(0);
    expect(csm.items.find((i) => i.label === 'Ready for client')?.count).toBe(2);
    // The three concepts in `data` are no longer counted anywhere on the CSM's tiles — nor on the
    // two sets built from this one: `adminItems` spreads it and `client` aliases it.
    expect(csm.items.map((i) => i.label)).not.toContain('Angles in library');
    expect(buildRoleDashboard('admin', data).items.map((i) => i.label)).not.toContain(
      'Angles in library',
    );
    expect(buildRoleDashboard('client', data).items.map((i) => i.label)).not.toContain(
      'Angles in library',
    );

    const editor = buildRoleDashboard('video_editor', data);
    expect(editor.items.find((i) => i.label === 'Copy pending review')?.count).toBe(1);
  });

  it('is empty-counted for empty data, never a fixture count', () => {
    const empty = buildRoleDashboard('admin', { briefs: [], concepts: [], copy: [], creators: [] });
    for (const item of empty.items) {
      expect(item.count).toBe(0);
    }
  });
});

describe('loadRoleDashboard', () => {
  it('is the fixtures in demo mode, matching the sync demo dashboard', async () => {
    const live = await loadRoleDashboard('admin', { demoMode: () => true });
    expect(live).toEqual(roleDashboard('admin'));
  });
});

describe('overview metric cards (TASK 6)', () => {
  const data = {
    briefs: [
      // clientStatus pinned off the pending value: the fixture default IS pending_for_approval,
      // and the awaiting_client card must count exactly the one brief the test marks.
      brief({ internalStatus: 'sent_to_video_editor', clientStatus: 'approved' }),
      brief({ internalStatus: 'sent_to_designer', clientStatus: 'approved' }),
      brief({ internalStatus: 'video_editing_in_progress', clientStatus: 'approved' }),
      brief({ internalStatus: 'static_design_in_progress', clientStatus: 'approved' }),
      brief({ internalStatus: 'ad_submitted', clientStatus: 'approved' }),
      brief({ internalStatus: 'approved', clientStatus: 'pending_for_approval' }),
      // The three cards action item 6 added. One revision per track, so a card that counted only
      // the video key would read 1 instead of 2; one client revision; one brief approved on BOTH
      // tracks, which is the only thing Ads to Launch may count (the `approved`/pending brief above
      // is internally approved and must not be in it).
      brief({ internalStatus: 'videos_revisions', clientStatus: 'approved' }),
      brief({ internalStatus: 'images_revisions', clientStatus: 'revisions_needed' }),
      brief({ internalStatus: 'approved', clientStatus: 'approved' }),
      // Sits one step PAST revisions: the editor has re-uploaded, so it is waiting on a reviewer.
      // Internal Revisions must not count it.
      brief({ internalStatus: 'revisions_submitted', clientStatus: 'approved' }),
    ],
    concepts: [
      { id: 'c1', approvalStatus: null },
      { id: 'c2', approvalStatus: 'pending_client' },
      { id: 'c3', approvalStatus: 'approved' },
    ],
    copy: [],
    creators: [
      { clientStatus: null },
      { clientStatus: 'pending_for_approval' },
      { clientStatus: 'draft' },
      { clientStatus: 'approved' },
    ],
  };

  it('admin sees all eleven reference cards, counted with the domain keys', () => {
    const cards = buildOverviewMetrics('admin', data);
    expect(cards.map((c) => c.key)).toEqual([
      'concepts_pending',
      'creators_pending',
      'sent_to_video_editor',
      'sent_to_designer',
      'video_editing_in_progress',
      'static_design_in_progress',
      'ad_submitted',
      'awaiting_client',
      'internal_revisions',
      'client_revisions',
      'ads_to_launch',
    ]);
    expect(cards.map((c) => c.count)).toEqual([2, 3, 1, 1, 1, 1, 1, 1, 2, 1, 1]);
  });

  it('counts both tracks of internal revisions, and never a re-upload (AI-6)', () => {
    const only = (internalStatus: string) =>
      buildOverviewMetrics('admin', { ...data, briefs: [brief({ internalStatus })] }).find(
        (c) => c.key === 'internal_revisions',
      )?.count;
    expect(only('videos_revisions')).toBe(1);
    expect(only('images_revisions')).toBe(1);
    expect(only('revisions_submitted')).toBe(0);
    expect(only('ad_submitted')).toBe(0);
  });

  it('Ads to Launch needs BOTH tracks approved, and links to exactly that pair (AI-6)', () => {
    const cards = buildOverviewMetrics('admin', data);
    const card = cards.find((c) => c.key === 'ads_to_launch');
    expect(card?.count).toBe(1);
    expect(card?.href).toBe('/app/creative-design?status=approved&client=approved&view=grid');

    // Approved on one track only is not a launch candidate, on either side.
    const halves = {
      ...data,
      briefs: [
        brief({ internalStatus: 'approved', clientStatus: 'pending_for_approval' }),
        brief({ internalStatus: 'ad_submitted', clientStatus: 'approved' }),
      ],
    };
    expect(
      buildOverviewMetrics('admin', halves).find((c) => c.key === 'ads_to_launch')?.count,
    ).toBe(0);
  });

  it('the revisions cards link where they can actually land (AI-6)', () => {
    const cards = buildOverviewMetrics('admin', data);
    // One client key, so the Briefs table can be filtered to it.
    expect(cards.find((c) => c.key === 'client_revisions')?.href).toBe(
      '/app/creative-design?client=revisions_needed&view=grid',
    );
    // TWO internal keys, one per track, and `?status=` takes one: the Internal Queue board groups
    // by internal status, so both revision columns are visible there. Never a one-track filter.
    expect(cards.find((c) => c.key === 'internal_revisions')?.href).toBe('/app/queue/internal');
  });

  it('brief cards click through to the table already filtered by KEY, never a label', () => {
    const cards = buildOverviewMetrics('admin', data);
    expect(cards.find((c) => c.key === 'sent_to_video_editor')?.href).toBe(
      '/app/creative-design?status=sent_to_video_editor&view=grid',
    );
    expect(cards.find((c) => c.key === 'awaiting_client')?.href).toBe(
      '/app/creative-design?client=pending_for_approval&view=grid',
    );
  });

  it('scopes the set to the role: the maker sees revisions, the buyer sees launches', () => {
    expect(buildOverviewMetrics('video_editor', data).map((c) => c.key)).toEqual([
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
      'internal_revisions',
      'client_revisions',
    ]);
    expect(buildOverviewMetrics('designer', data).map((c) => c.key)).toEqual([
      'sent_to_designer',
      'static_design_in_progress',
      'ad_submitted',
      'internal_revisions',
      'client_revisions',
    ]);
    expect(buildOverviewMetrics('media_buyer', data).map((c) => c.key)).toEqual([
      'ad_submitted',
      'awaiting_client',
      'ads_to_launch',
    ]);
  });

  /**
   * Non-negotiable 10: a client sees no internal data. `revisions_needed` is a member of
   * `CLIENT_STATUS`, so the Client Revisions card is the client's OWN status and belongs to them;
   * `internal_revisions` counts two statuses whose descriptions say the client never sees them, so
   * it must not reach the client set however the role lists are reshuffled.
   */
  it('gives the client their own revisions and no internal one', () => {
    expect(buildOverviewMetrics('client', data).map((c) => c.key)).toEqual([
      'awaiting_client',
      'client_revisions',
    ]);
  });

  it('renders over the demo fixtures without throwing, eleven cards for admin', () => {
    expect(overviewMetrics('admin')).toHaveLength(11);
    // The counts the fixtures actually hold. `demoBriefs` has one brief approved on both tracks
    // (the launch candidate) and NO brief in any revisions state — the same shape production is in
    // — so both revision cards read 0. Asserted rather than skipped: a card that reads 0 over data
    // with no revisions is correct, and a card that reads anything else over it is a miscount.
    const byKey = new Map(overviewMetrics('admin').map((c) => [c.key, c.count]));
    expect(byKey.get('ads_to_launch')).toBe(1);
    expect(byKey.get('internal_revisions')).toBe(0);
    expect(byKey.get('client_revisions')).toBe(0);
  });
});

/**
 * AI-09: the cross-client Overview. Production has six live brands and a CSM assigned to four of
 * them who was shown ONE brand's counts; these tests run the whole live path — session scope →
 * assignments → per-brand scoped reads — on a seeded PGlite database, where only Niagara holds
 * rows, so a count landing on the wrong brand's panel is visible as a non-zero where a zero
 * belongs. The seeded fixtures: Callum (`user_seed_csm`) is CSM on all four brands, Dorian
 * (`user_seed_strategist`) strategist on three, Marguerite (`user_seed_admin`) the admin with no
 * assignment rows at all.
 */
describe('the cross-client panels (AI-09)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** A seeded live-mode database plus the deps that make the loaders read it as `clerkUserId`. */
  async function seededLive(
    clerkUserId: string | null,
  ): Promise<{ db: Db; deps: BriefSourceDeps }> {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = await testDb();
    await seed(db);
    return { db, deps: liveDeps(db, clerkUserId) };
  }

  function liveDeps(db: Db, clerkUserId: string | null): BriefSourceDeps {
    return {
      demoMode: () => false,
      connect: () => ({ db, close: () => Promise.resolve() }),
      actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId }),
    };
  }

  /** The seeded user row for a Clerk id, past `noUncheckedIndexedAccess`. */
  async function userByClerkId(db: Db, clerkUserId: string) {
    const row = (await db.select().from(users)).find((user) => user.clerkUserId === clerkUserId);
    if (row === undefined) throw new Error(`no seeded user ${clerkUserId}`);
    return row;
  }

  it('loads one panel per assigned brand, each counted over ITS OWN rows', async () => {
    const { deps } = await seededLive('user_seed_csm');

    const panels = await loadActorBrandPanels('csm', deps);

    // Callum's whole book, in brand-name order — never just the active brand.
    expect(panels.map((panel) => panel.brandName)).toEqual([
      'Funky Painting',
      'Gratsi',
      'Mattress Central',
      'Niagara Sleep Solutions',
    ]);
    // A CSM scans the whole pipeline: all eleven cards, per brand.
    for (const panel of panels) {
      expect(panel.metrics).toHaveLength(11);
    }
    // Only Niagara is seeded with content, and its panel counts exactly the rows the single-brand
    // Overview counts over the same data (`toBriefRow` is the same narrowing `loadBriefs` applies).
    const niagara = panels.find((panel) => panel.brandName === 'Niagara Sleep Solutions');
    expect(niagara?.metrics).toEqual(
      buildOverviewMetrics('csm', {
        briefs: demoBriefs.map(toBriefRow),
        concepts: demoConcepts,
        creators: demoCreators,
      }),
    );
    const total = (cards: readonly { count: number }[] | undefined) =>
      (cards ?? []).reduce((sum, card) => sum + card.count, 0);
    expect(total(niagara?.metrics)).toBeGreaterThan(0);
    // The empty brands read zero everywhere: nothing of Niagara's leaked across the scope.
    for (const name of ['Funky Painting', 'Gratsi', 'Mattress Central']) {
      const panel = panels.find((candidate) => candidate.brandName === name);
      expect(total(panel?.metrics), name).toBe(0);
    }
  });

  it('threads an explicit brand list through, in its order, scoped to the given role', async () => {
    const { db, deps } = await seededLive('user_seed_csm');
    const brandRows = await loadActorBrands(deps);
    const gratsi = brandRows.find((brand) => brand.name === 'Gratsi');
    const niagara = brandRows.find((brand) => brand.name === 'Niagara Sleep Solutions');
    if (gratsi === undefined || niagara === undefined) throw new Error('seeded brands missing');
    expect(db).toBeDefined();

    const panels = await loadBrandPanels('media_buyer', [niagara, gratsi], deps);

    expect(panels.map((panel) => panel.brandName)).toEqual(['Niagara Sleep Solutions', 'Gratsi']);
    // The media buyer's three cards, not the CSM's eleven — the role travels with the list.
    for (const panel of panels) {
      expect(panel.metrics.map((card) => card.key)).toEqual([
        'ad_submitted',
        'awaiting_client',
        'ads_to_launch',
      ]);
    }
  });

  it('an actor with NO assignments gets no panels: the admin keeps the single-brand Overview', async () => {
    const { deps } = await seededLive('user_seed_admin');

    expect(await loadActorBrands(deps)).toEqual([]);
    expect(await loadActorBrandPanels('admin', deps)).toEqual([]);
  });

  it('a single-brand actor keeps the single-brand Overview too, with no per-brand re-read', async () => {
    const { db, deps } = await seededLive('user_seed_newcomer');
    const agencyRows = await db.select().from(agencies);
    const agency = agencyRows[0];
    if (agency === undefined) throw new Error('no seeded agency');
    const dorian = await userByClerkId(db, 'user_seed_strategist');
    const [newcomer] = await db
      .insert(users)
      .values({
        clerkUserId: 'user_seed_newcomer',
        email: 'newcomer@tasdigital.example',
        fullName: 'Aoife Brennan',
      })
      .returning();
    if (newcomer === undefined) throw new Error('newcomer insert returned no row');
    await db
      .insert(memberships)
      .values({ userId: newcomer.id, agencyId: agency.id, role: 'member' });
    const assignment = (await db.select().from(brandAssignments)).find(
      (row) => row.userId === dorian.id,
    );
    if (assignment === undefined) throw new Error('no seeded assignment to copy');
    await db
      .insert(brandAssignments)
      .values({ userId: newcomer.id, brandId: assignment.brandId, role: 'csm' });

    expect(await loadActorBrands(deps)).toHaveLength(1);
    expect(await loadActorBrandPanels('csm', deps)).toEqual([]);
  });

  it("never panels another agency's brand, even when an assignment row points there", async () => {
    const { db, deps } = await seededLive('user_seed_csm');
    const [rivalAgency] = await db
      .insert(agencies)
      .values({ name: 'Rival Creative', slug: 'rival-creative' })
      .returning();
    if (rivalAgency === undefined) throw new Error('rival agency insert returned no row');
    const [rivalBrand] = await db
      .insert(brands)
      .values({ agencyId: rivalAgency.id, name: 'Aardvark Coffee', slug: 'aardvark-coffee' })
      .returning();
    if (rivalBrand === undefined) throw new Error('rival brand insert returned no row');
    const callum = await userByClerkId(db, 'user_seed_csm');
    await db
      .insert(brandAssignments)
      .values({ userId: callum.id, brandId: rivalBrand.id, role: 'csm' });

    const names = (await loadActorBrands(deps)).map((brand) => brand.name);

    expect(names).toHaveLength(4);
    expect(names).not.toContain('Aardvark Coffee');
  });

  it('still refuses an actor in two agencies with neither selected: AmbiguousBrandError', async () => {
    const { db, deps } = await seededLive('user_two_agencies');
    const agencyRows = await db.select().from(agencies);
    const agency = agencyRows[0];
    if (agency === undefined) throw new Error('no seeded agency');
    const [other] = await db
      .insert(agencies)
      .values({ name: 'Second Agency', slug: 'second-agency' })
      .returning();
    if (other === undefined) throw new Error('second agency insert returned no row');
    const [torn] = await db
      .insert(users)
      .values({
        clerkUserId: 'user_two_agencies',
        email: 'torn@example.example',
        fullName: 'Torn Between',
      })
      .returning();
    if (torn === undefined) throw new Error('torn insert returned no row');
    await db.insert(memberships).values([
      { userId: torn.id, agencyId: agency.id, role: 'member' },
      { userId: torn.id, agencyId: other.id, role: 'member' },
    ]);

    await expect(loadActorBrandPanels('csm', deps)).rejects.toBeInstanceOf(AmbiguousBrandError);
  });

  it('demo mode loads no cross-client panels and constructs no client', async () => {
    const connect = vi.fn<(databaseUrl: string) => never>(() => {
      throw new Error('the demo branch opened a database connection');
    });
    const deps: BriefSourceDeps = { demoMode: () => true, connect };

    expect(await loadActorBrands(deps)).toEqual([]);
    expect(await loadActorBrandPanels('csm', deps)).toEqual([]);
    expect(
      await loadBrandPanels(
        'csm',
        [
          { id: 'brand-x', name: 'Brand X' },
          { id: 'brand-y', name: 'Brand Y' },
        ],
        deps,
      ),
    ).toEqual([]);
    expect(connect).not.toHaveBeenCalled();
  });

  it('a live request with no signed-in user reads nothing and opens nothing', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const connect = vi.fn<(databaseUrl: string) => never>(() => {
      throw new Error('an anonymous request opened a database connection');
    });
    const deps: BriefSourceDeps = {
      demoMode: () => false,
      connect,
      actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId: null }),
    };

    expect(await loadActorBrandPanels('csm', deps)).toEqual([]);
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('buildPipeline (TASK 6)', () => {
  it('walks the video ladder then the static-only steps, and the counts sum to the briefs', () => {
    const briefs = [
      brief({ internalStatus: 'sent_to_video_editor' }),
      brief({ internalStatus: 'sent_to_designer' }),
      brief({ internalStatus: 'launched' }),
    ];
    const steps = buildPipeline(briefs);
    expect(steps.map((s) => s.key)).toEqual([
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
      'videos_revisions',
      'revisions_submitted',
      'approved',
      'launched',
      'sent_to_designer',
      'static_design_in_progress',
      'images_revisions',
    ]);
    expect(steps.reduce((sum, s) => sum + s.count, 0)).toBe(briefs.length);
    expect(steps.find((s) => s.key === 'sent_to_designer')?.count).toBe(1);
  });
});
