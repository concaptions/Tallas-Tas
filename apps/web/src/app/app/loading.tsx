/**
 * The instant response to every navigation inside /app.
 *
 * Every /app page is dynamic and reads a remote database, and there was no loading boundary anywhere,
 * so a sidebar or list click showed nothing — not even the sidebar highlight moving — until the whole
 * server render came back. This file wraps the subtree under the /app layout in Suspense: the shell
 * (top bar, sidebar) stays, this skeleton appears at once in the page slot, and the page streams in
 * when ready. It also lets `<Link>` prefetch dynamic routes up to this boundary, so the skeleton is
 * already on the client when the click lands.
 *
 * Token classes only (CLAUDE.md UI governance 1); a route file, not a shared primitive.
 */
export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-input bg-surface2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-input bg-surface2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <div
            key={key}
            className="h-28 animate-pulse rounded-card border border-line bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
