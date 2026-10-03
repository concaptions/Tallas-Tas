/**
 * The two things a resolver-driven page must SAY about its own column configuration, written once.
 *
 * Both were already duplicated near-identically on Personas and Products, and eleven more pages are
 * due to need them. They exist because the two ways a configured column set and a page can disagree
 * are both silent by default, and a silent disagreement makes the page quietly lie about the brand's
 * configuration:
 *
 * - `unconfigured` — the brand resolved NO columns of its own, so the template's master set is
 *   standing in. Without the notice the page would pass a fallback off as this brand's setup.
 * - `missing` — an admin configured a column this page has no renderer for. Without the notice the
 *   column would simply not appear, which looks identical to it not being configured.
 *
 * `slotPrefix` keeps each page's existing automation hooks intact: Personas' notices are addressed
 * as `persona-unconfigured-columns` and `persona-missing-columns`, Products' as `product-…`, and a
 * new page picks its own singular noun.
 */
export interface ColumnNoticesProps {
  /** The singular noun a page's `data-slot` names use, e.g. `persona`, `product`, `angle`. */
  readonly slotPrefix: string;
  /** True when the columns shown are the parent master-set fallback, not the brand's own. */
  readonly unconfigured: boolean;
  /** Resolved column keys this page has no renderer for, from `gridColumnsFrom`. */
  readonly missing: readonly string[];
  /** The registry a developer should add the missing key to, named so the fix is obvious. */
  readonly registryName: string;
}

const NOTICE_CLASS = 'rounded-card border border-line bg-surface2 px-3 py-2 text-xs text-text3';

export function ColumnNotices({
  slotPrefix,
  unconfigured,
  missing,
  registryName,
}: ColumnNoticesProps) {
  return (
    <>
      {unconfigured ? (
        <p data-slot={`${slotPrefix}-unconfigured-columns`} className={NOTICE_CLASS}>
          This brand has no column configuration yet, so the template&rsquo;s master set is shown.
          Use Column Admin to give it its own labels and order.
        </p>
      ) : null}
      {missing.length > 0 ? (
        <p data-slot={`${slotPrefix}-missing-columns`} className={NOTICE_CLASS}>
          Configured for this brand but not drawn here:{' '}
          <span className="font-mono">{missing.join(', ')}</span>. Add an entry to {registryName}.
        </p>
      ) : null}
    </>
  );
}
