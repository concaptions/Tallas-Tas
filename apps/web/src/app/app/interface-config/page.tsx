import { loadConcepts } from '@/lib/concepts-source';
import { loadInterfaceConfig } from '@/lib/interface-config-source';
import { isDemoMode } from '@/lib/demo-mode';

import { conceptPreview } from './fields';
import { InterfaceConfigWorkspace } from './interface-config-workspace';

/**
 * Interface Config (PRD §10): "the interface must be configurable per client, at two levels —
 * which pages appear, and which fields appear".
 *
 * A server component. The configuration comes from `loadInterfaceConfig()` and the concept the
 * preview card renders from `loadConcepts()`; both are the in-repo fixtures in demo mode and the
 * brand-scoped queries otherwise, and this page does not know which and does not branch on it. It
 * renders into the shell's `<main>` and therefore owns no frame, padding or background of its own
 * (ticket criterion 1).
 *
 * THE PREVIEW'S CONCEPT IS PROJECTED HERE, on the server, into plain strings. The preview is a
 * client component, so handing it a `@tas/db` row would pull the database types — and the module
 * that builds a client — towards the browser bundle. `conceptPreview` takes the row and returns the
 * client status chip plus one value per configurable field, and NOTHING internal: no internal
 * status, no budget, no cost, no price (CLAUDE.md non-negotiable 10).
 *
 * The newest concept is the one previewed. It is a picture of the card's SHAPE, not a record the
 * CSM is working on, so which concept fills it does not matter beyond it being a real one.
 */
export const metadata = {
  title: 'Interface Config — TAS Creative Platform',
};

export default async function InterfaceConfigPage() {
  const [{ rows }, { rows: concepts }] = await Promise.all([loadInterfaceConfig(), loadConcepts()]);
  const demo = isDemoMode();
  const newest = concepts[0];

  return (
    <InterfaceConfigWorkspace
      rows={rows}
      demo={demo}
      concept={newest === undefined ? null : conceptPreview(newest)}
    />
  );
}
