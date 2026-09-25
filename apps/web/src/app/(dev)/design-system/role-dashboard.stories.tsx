import { RoleDashboardSection } from '@/components/role-dashboard';
import { roleDashboard } from '@/lib/dashboard-source';

/**
 * The role-aware Overview dashboard (Sprint 12, UI governance rule 4): the identical
 * `RoleDashboardSection` the Overview renders, in two role configurations over the demo fixtures. The
 * Admin set carries the CSM pipeline tiles plus the new spell-check-flags tile; the Media Buyer set is
 * the launch-focused one. Which set a real user sees is decided on the server by `loadActiveRole`.
 */
export function RoleDashboardAdminStory() {
  return <RoleDashboardSection dashboard={roleDashboard('admin')} />;
}

export function RoleDashboardMediaBuyerStory() {
  return <RoleDashboardSection dashboard={roleDashboard('media_buyer')} />;
}
