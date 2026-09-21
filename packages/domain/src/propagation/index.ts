/**
 * Everything `/app/propagation` reasons with: the status vocabulary, the diff preview, the review
 * guard and the row's sentence. The page and its Server Actions import from here; neither writes a
 * status string, a truncation rule or a `role === 'admin'` check of its own.
 *
 * `PROMOTION_STATUS` and its helpers physically live in `../state/promotion-status`, next to the
 * other status machines and reachable as `@tas/domain/state` (ticket criterion 7 names that import
 * path, because a component that renders a `StatusChip` should reach one barrel for the label, the
 * tone and the key). They are re-exported here so a caller that only cares about propagation has one
 * import, and because the re-export is the SAME declaration it is not a second copy: the root barrel
 * can export both this module and `../state/index` without an ambiguity.
 */

export * from '../state/promotion-status';
export * from './diff-summary';
export * from './describe-promotion';
export * from './plan';
export * from './review';
