import { renderToStaticMarkup } from 'react-dom/server';
import { demoAngles, demoCreators, demoThemes, type ConceptInput, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConceptAction } from '../actions';
import { ConceptDetail, type AngleOption, type ThemeOption } from './concept-detail';

/**
 * THE BOUNDARY: what the form POSTS against what the Server Action READS.
 *
 * Every other test on this route stands on one side of it. `actions.test.ts` builds its own
 * `FormData` from the names the action reads, and the Playwright spec runs in demo mode where Save
 * is disabled and nothing is ever submitted. So a form control whose `name` the action does not
 * read was invisible to the whole suite — and one was wrong: the Theme select posted `themeIds`
 * (its field key) while `fieldsOf` read `themeId`, which made the "pick a theme" rule unsatisfiable
 * and rejected EVERY save of a fully filled form.
 *
 * This test renders the real form, harvests the fields a browser would submit, and hands exactly
 * those to the real action. It fails if either side renames a control without the other following,
 * which is the only thing that can reintroduce the defect.
 */

interface Seam {
  inserted: ConceptInput[];
}

const seam = vi.hoisted<Seam>(() => ({ inserted: [] }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: 'user_2TESTACTOR' }),
}));

/** The form is rendered, never driven: nothing in it may reach the router. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app/concepts/new',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/concepts-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/concepts-source')>()),
  withBrandScope: <T,>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    getAngleById: (_db: Db, _brandId: string, id: string): ReturnType<typeof actual.getAngleById> =>
      Promise.resolve(actual.demoAngles.find((row) => row.id === id) ?? null),
    getThemeById: (_db: Db, id: string): ReturnType<typeof actual.getThemeById> =>
      Promise.resolve(actual.demoThemes.find((row) => row.id === id) ?? null),
    insertConcept: (_db: Db, _brandId: string, values: ConceptInput): Promise<{ id: string }> => {
      seam.inserted.push(values);
      return Promise.resolve({ id: 'concept-created' });
    },
    syncConceptAngles: (): Promise<void> => Promise.resolve(),
    syncConceptThemes: (): Promise<void> => Promise.resolve(),
    syncConceptCreators: (): Promise<void> => Promise.resolve(),
    listBriefsByConceptId: (): ReturnType<typeof actual.listBriefsByConceptId> =>
      Promise.resolve([]),
  };
});

const [firstAngle] = demoAngles;
const [firstTheme] = demoThemes;
if (firstAngle === undefined || firstTheme === undefined) {
  throw new Error('the demo fixtures are empty');
}

const angle: AngleOption = firstAngle;
const theme: ThemeOption = firstTheme;

/** The create form, filled the way a strategist fills it before pressing Save. */
function filledForm(): string {
  return renderToStaticMarkup(
    <ConceptDetail
      concept={{
        id: 'unsaved',
        batch: 'B2',
        angleIds: [angle.id],
        creatorIds: [],
        themeId: theme.id,
        category: 'New',
        conceptStyle: 'Editing',
        formats: ['Video'],
        adInspoLinks: [],
        hookExamples: 'Three forty-seven. Every night.',
        scriptIdea: 'Creator reads the thread aloud beside a full-screen grab.',
        description: null,
        painPoints: null,
        usp: null,
        clientComments: null,
        approvalStatus: null,
        productionStatus: 'done',
        formatsToCreate: [],
      }}
      creatives={[]}
      campaigns={[]}
      collections={[]}
      angles={[angle]}
      themes={[theme]}
      creators={demoCreators.map((row) => ({ id: row.id, name: row.name }))}
      track="video"
      internal="sent_to_video_editor"
      client="pending_for_approval"
      demo={false}
    />,
  );
}

/**
 * The fields a browser would submit from that markup: every `<input>`/`<textarea>` that carries a
 * `name` and is not disabled, read-only ones included — a read-only control is submitted, only a
 * disabled one is dropped. Repeated names are appended, which is how `formats` and the link fields
 * travel.
 */
function submitted(markup: string): FormData {
  const data = new FormData();
  for (const tag of markup.matchAll(/<(input|textarea)\b([^>]*)>/g)) {
    const attributes = tag[2] ?? '';
    if (/\bdisabled\b/.test(attributes)) continue;
    const name = /\bname="([^"]*)"/.exec(attributes)?.[1];
    if (name === undefined) continue;
    data.append(name, /\bvalue="([^"]*)"/.exec(attributes)?.[1] ?? '');
  }
  return data;
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.inserted = [];
});

describe('the Concept form against the action that reads it', () => {
  it('posts a name for every field the action reads, so a filled form is never rejected', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const posted = submitted(filledForm());

    const result = await createConceptAction(null, posted);

    if (!result.ok) {
      throw new Error(
        `the form the component rendered was rejected: ${result.error} ${JSON.stringify(
          result.fieldErrors ?? {},
        )}`,
      );
    }
    // The pairing arrived whole, which is the rule that was unsatisfiable through the UI — and it
    // arrived RIGHT. The stored name is `Batch-Angle-Theme` (CLAUDE.md non-negotiable 6) and the
    // action re-derives it from the rows it reads itself, so asserting the whole string is what
    // proves the theme the form chose is the theme the junction got: a posted name that reached the
    // wrong field would rename the concept rather than fail.
    expect(seam.inserted).toHaveLength(1);
    expect(result.name).toBe(`B2-${angle.name}-${theme.name}`);
  });

  it('names the Theme control after the key the action reads, not after its own field key', () => {
    const markup = filledForm();

    // The name `fieldsOf` reads, carrying the chosen theme.
    expect(markup).toContain(`name="themeId" value="${theme.id}"`);
    // The field KEY is still `themeIds` — it is what the error and the test hook are keyed by —
    // but it must never be what a control posts, because nothing reads it.
    expect(markup).toContain('data-slot="concept-themeIds"');
    expect(markup).not.toContain('name="themeIds"');
  });

  it('renders the Theme select’s own error, instead of only the generic banner', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const posted = submitted(filledForm());
    posted.set('themeId', '');

    const result = await createConceptAction(null, posted);

    if (result.ok) {
      throw new Error('a concept with no theme was accepted');
    }
    // Keyed under what the form asks `fieldError` for, so the message lands under the control.
    expect(result.fieldErrors?.themeIds).toBe('Pick at least one theme this angle is paired with.');
    expect(result.fieldErrors?.angleIds).toBeUndefined();
  });
});
