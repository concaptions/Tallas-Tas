import { redirect } from 'next/navigation';

import { appPath } from '@/lib/routes';

/**
 * Ad Spy is HIDDEN ON PURPOSE (2026-10-12) — not deleted. Its sidebar entry is in
 * `NAV_HIDDEN_SECTION_KEYS` (`components/shell/nav.ts`), and this segment layout closes the
 * route for everyone: opening `/app/ad-spy` or any ad beneath it lands on the dashboard. The page
 * files, `ad-spy-source.ts`, the server actions, the `ad-spy` table capability and the
 * `competitor_ads` data all stay, so bringing it back is: restore `sectionGuard('ad-spy')` here and
 * take `ad-spy` out of the hide set.
 */
export default function HiddenAdSpyLayout(): never {
  redirect(appPath);
}
