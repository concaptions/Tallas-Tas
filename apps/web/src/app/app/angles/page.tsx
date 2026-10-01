import { loadAngles } from '@/lib/angles-source';
import { loadCreativeModules } from '@/lib/creative-modules-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadPersonas } from '@/lib/personas-source';
import { loadProducts } from '@/lib/products-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import type { LinkOption } from './angle-panel';
import { AnglesWorkspace, type AngleItem } from './angles-workspace';
import { indexCreativeModulesByAngle } from './fields';

/**
 * Angles (PRD §5.6): the hypothesis a strategist writes from a persona, and the row every concept
 * is eventually built on.
 *
 * A server component, shaped exactly like the Personas and Products pages. The rows come from
 * `loadAngles()`, which is the in-repo fixtures in demo mode and the brand-scoped query otherwise;
 * the page does not know which and does not branch on it. Both pieces of table state are query
 * parameters — `?angle=` for the open panel and `?q=` for the filter — so a refresh restores the
 * view and either one is shareable. It renders into the shell's `<main>` and owns no frame, padding
 * or background of its own.
 *
 * Four loaders, one per table: the panel's Persona and Product dropdowns are populated here from
 * `loadPersonas()` and `loadProducts()` and handed down as plain `{ id, name }` data, so the client
 * component never imports `@tas/db` at runtime and the driver stays out of the browser bundle. The
 * four reads are independent, so they run together.
 *
 * The fourth is `loadCreativeModules()`, the other side of `creative_module_angles`: a module links
 * its angles, and this page shows each angle the modules that link it, read-only. The module rows
 * already carry their `angleIds`, so the inversion is a pure function over them
 * (`indexCreativeModulesByAngle`) and the result crosses to the panel as plain `{ id, label, href }`
 * records. In demo mode the module fixtures carry the same id arrays, so the links render there too.
 *
 * The relative timestamps are formatted here, once, with a single `now`: a client that formatted
 * them itself would produce a different string from the server's and break hydration. The rows
 * arrive newest edit first, so this page never sorts.
 */
interface AnglesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnglesPage({ searchParams }: AnglesPageProps) {
  const [{ rows }, personaRows, productRows, creativeModuleRows, params] = await Promise.all([
    loadAngles(),
    loadPersonas(),
    loadProducts(),
    loadCreativeModules(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items: AngleItem[] = rows.map((angle) => ({
    angle,
    updatedLabel: relativeTime(angle.updatedAt, now),
    updatedTitle: absoluteTime(angle.updatedAt),
  }));

  const personas: LinkOption[] = personaRows.rows.map(({ id, name }) => ({ id, name }));
  const products: LinkOption[] = productRows.rows.map(({ id, name }) => ({ id, name }));
  const creativeModulesByAngle = indexCreativeModulesByAngle(creativeModuleRows.rows);

  const requested = params.angle;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <AnglesWorkspace
      items={items}
      personas={personas}
      products={products}
      creativeModulesByAngle={creativeModulesByAngle}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
