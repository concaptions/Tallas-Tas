import { cache } from 'react';

import { loadViewerRole } from './data-source';

/**
 * The viewer's role for the active brand, resolved AT MOST ONCE PER REQUEST (AI-57).
 *
 * Two different places need the same answer on every navigation: the shell layout, which filters
 * the sidebar, and the guard on whichever section is being opened, which decides whether the page
 * renders at all. Without `cache` that is two Neon round trips for one question — and `withDb`
 * opens and closes a pool each time, so it is two connections as well. React's request-scoped
 * `cache` collapses them into one; outside a request (a unit test, a script) it is a pass-through,
 * which is why `loadViewerRole` keeps its `deps` seam and this wrapper takes no arguments.
 *
 * It is a separate module and not a `loadViewerRole` that caches itself, because `cache` is only
 * meaningful inside a React server render: wrapping the data-layer function would make every
 * non-React caller pay for a memo that can never hit.
 */
export const viewerRole = cache(() => loadViewerRole());
