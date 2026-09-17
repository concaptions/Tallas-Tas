import { isDemoMode } from '@/lib/demo-mode';
import { loadNotifications } from '@/lib/notifications-source';

import { toNotificationItem } from './fields';
import { NotificationsWorkspace } from './notifications-workspace';

/**
 * Notifications (PRD §12): "notifications go as **Slack direct messages to the assigned person**,
 * through our existing TAS Bot app", one row per trigger with a Slack DM switch and an email switch.
 *
 * A server component. The rows come from `loadNotifications()`, which is the in-repo fixtures in
 * demo mode and the brand-scoped query otherwise; the page does not know which and does not branch
 * on it. It renders into the shell's `<main>` and therefore owns no frame, padding or background of
 * its own (ticket criterion 1).
 *
 * THE ROWS ARE PROJECTED HERE, on the server, into plain strings and booleans. The table is a client
 * component, so handing it a `@tas/db` row would pull the database types — and the module that
 * builds a client — towards the browser bundle. `toNotificationItem` resolves the §12 label, the
 * Recipient cell's reading of the §11 roles and the two stored flags, and nothing else: the roles
 * themselves never reach the browser, because the page cannot edit routing and has no use for them.
 *
 * Nothing is sorted or filtered here. `loadNotifications` returns §12's eight triggers in `position`
 * order, and a trigger with both switches off is still a row — a settings table has to show a muted
 * trigger in order to switch it back on.
 */
export const metadata = {
  title: 'Notifications — TAS Creative Platform',
};

interface NotificationsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const [{ rows }, params] = await Promise.all([loadNotifications(), searchParams]);
  const demo = isDemoMode();

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <NotificationsWorkspace
      items={rows.map(toNotificationItem)}
      demo={demo}
      initialSearch={initialSearch}
    />
  );
}
