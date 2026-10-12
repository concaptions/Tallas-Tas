/**
 * Collections is RETIRED (Oct 12 client sync, Ticket 1; `REMOVED_WORKSPACES` in `@tas/domain`).
 * The segment's `layout.tsx` permanently redirects every address under `/app/collections` to the
 * Products / Landing Pages page before this component is ever invoked; it exists only because a
 * route segment needs a page to resolve. The `collections` table is frozen, not dropped.
 */
export default function CollectionsPage() {
  return null;
}
