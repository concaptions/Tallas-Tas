import { COLUMN_SEED } from '@tas/db';
import { StatusChip } from '@tas/ui';

import { ColumnAdminWorkspace } from '@/app/app/column-admin/column-admin-workspace';
import {
  COLUMN_ADMIN_ADMIN_NOTE,
  DEMO_COLUMN_ADMIN_NOTE,
  ORIGIN_LABEL,
  ORIGIN_TONE,
  SEED_PARENT_BASE_ID,
  TEMPLATE_BASE_LABEL,
  restorableColumns,
  seedColumnsFor,
  seedHiddenColumnKeys,
  toColumnAdminRows,
  type ColumnAdminBase,
  type ColumnOrigin,
} from '@/app/app/column-admin/fields';

/**
 * The shapes `/app/column-admin` introduces (CLAUDE.md UI governance rule 4): the five-value
 * Inheritance chip, and the row-control cluster that changes a column's structure.
 *
 * Nothing is re-drawn here. The workspace below IS the route's own component, mounted with the
 * Personas columns `COLUMN_SEED` already carries and projected by the route's own pure functions,
 * so a story cannot show a label, an order or an inheritance state the product does not have.
 *
 * WHY THE WORKSPACE IS MOUNTED IN DEMO MODE. Its controls are Server Actions, and both of them
 * refuse before validation when there is no Clerk key — which is the state this page is served in.
 * Rendering it with `demo` set is therefore the honest state and not a weaker one: the cluster is
 * on screen with the shared `DisabledWrite` tooltip, which is itself the treatment every write
 * control on the route uses. The chip row above it shows all five tones unconditionally, including
 * the two a single base can never show at the same time.
 */
const BASES: readonly ColumnAdminBase[] = [
  { id: SEED_PARENT_BASE_ID, name: TEMPLATE_BASE_LABEL, isTemplate: true },
  { id: 'gratsi', name: 'Gratsi', isTemplate: false },
];

const TABLES = ['angles', 'personas', 'products'];

const EVERY_ORIGIN: readonly ColumnOrigin[] = [
  'master',
  'inherited',
  'overriding',
  'detached',
  'custom',
];

/**
 * The Inheritance chip in all five of its values, which is the vocabulary this route adds. Tones
 * come from `ORIGIN_TONE` and labels from `ORIGIN_LABEL`; the chip is `StatusChip` from `@tas/ui`
 * and never a locally drawn pill (UI governance rule 3).
 */
export function ColumnOriginChipsStory() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      {EVERY_ORIGIN.map((origin) => (
        <div key={origin} className="flex flex-col items-start gap-1.5">
          <StatusChip tone={ORIGIN_TONE[origin]} label={ORIGIN_LABEL[origin]} />
          <span className="font-mono text-[11px] text-text3">{origin}</span>
        </div>
      ))}
    </div>
  );
}

/** The parent base: every column is the master set, so no row offers detach or reattach. */
export function ColumnAdminTemplateStory() {
  const columns = seedColumnsFor(COLUMN_SEED, SEED_PARENT_BASE_ID, 'personas');

  return (
    <ColumnAdminWorkspace
      bases={BASES}
      tables={TABLES}
      baseId={SEED_PARENT_BASE_ID}
      tableKey="personas"
      isTemplateBase
      rows={toColumnAdminRows(columns, true)}
      restorable={[]}
      demo
      adminNote={COLUMN_ADMIN_ADMIN_NOTE}
      demoNote={DEMO_COLUMN_ADMIN_NOTE}
    />
  );
}

/**
 * A brand: its own labels, the inheritance note that says what a local row actually does to a read,
 * and the Restore list — the nine template columns Gratsi hides, which is the only way back from
 * Hide and the only "add" the route offers.
 */
export function ColumnAdminBrandStory() {
  const columns = seedColumnsFor(COLUMN_SEED, 'gratsi', 'personas');
  const hidden = seedHiddenColumnKeys(COLUMN_SEED, 'gratsi', 'personas');

  return (
    <ColumnAdminWorkspace
      bases={BASES}
      tables={TABLES}
      baseId="gratsi"
      tableKey="personas"
      isTemplateBase={false}
      rows={toColumnAdminRows(columns, false)}
      restorable={restorableColumns(
        seedColumnsFor(COLUMN_SEED, SEED_PARENT_BASE_ID, 'personas').filter((column) =>
          hidden.includes(column.columnKey),
        ),
        columns,
      )}
      demo
      adminNote={COLUMN_ADMIN_ADMIN_NOTE}
      demoNote={DEMO_COLUMN_ADMIN_NOTE}
    />
  );
}
