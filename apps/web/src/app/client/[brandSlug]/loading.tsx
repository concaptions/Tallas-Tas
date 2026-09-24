/**
 * The instant response to a navigation between client-portal sections. Every section reads a remote
 * database; without a boundary a click showed nothing until the render returned. The brand layout
 * (header and section nav) stays; this fills the content area. Token classes only.
 */
export default function ClientSectionLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-1 flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-40 animate-pulse rounded-input bg-surface2" />
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-20 animate-pulse rounded-card border border-line bg-surface" />
      ))}
    </div>
  );
}
