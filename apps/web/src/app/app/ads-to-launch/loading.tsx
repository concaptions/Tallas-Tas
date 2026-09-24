/**
 * Ads to Launch while it loads: the header and the two sections in their final shape, so the page
 * does not jump when the rows arrive. Token classes only; a route file, not a shared primitive.
 */
function SectionSkeleton({ rows }: { readonly rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-4 w-36 animate-pulse rounded-input bg-surface2" />
      <ul className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <li
            key={index}
            className="h-16 animate-pulse rounded-card border border-line bg-surface"
          />
        ))}
      </ul>
    </div>
  );
}

export default function AdsToLaunchLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-8">
      <span className="sr-only">Loading ads to launch…</span>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-20 animate-pulse rounded-input bg-surface2" />
        <div className="h-7 w-44 animate-pulse rounded-input bg-surface2" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded-input bg-surface2" />
      </div>
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={2} />
    </div>
  );
}
