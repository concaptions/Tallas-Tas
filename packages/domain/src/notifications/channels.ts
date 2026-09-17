/**
 * The two channels a §12 trigger can go out on, and the two words the column headers use.
 *
 * §12 is explicit that Slack is THE channel — "notifications go as **Slack direct messages to the
 * assigned person**, through our existing TAS Bot app" — and the table's second switch is the extra,
 * which is why the seed defaults Slack on and email off for all eight rows. So there are exactly two
 * channels, they are not configurable, and there is no channel picker: `NOTIFICATION_CHANNELS` is a
 * closed vocabulary, mirroring `notificationChannels` in `packages/db/src/schema/enums.ts` (copied,
 * not imported — domain depends on nothing).
 *
 * "Slack DM", not "Slack": the distinction is the whole point of §12, which exists because "today
 * automations post into Slack channels and it's noise nobody reads". The header says DM so nobody
 * reads the switch as "post to a channel".
 */

/** The two channels §12 offers per trigger, in column order: the DM first, email second. */
export const NOTIFICATION_CHANNELS = ['slack', 'email'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * True when `value` is one of the two channels.
 *
 * Total on `string` because the Server Action reads the channel out of a `FormData` before it knows
 * anything about it; an unknown channel is refused there rather than reaching `setChannel`.
 */
export function isNotificationChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

const CHANNEL_LABELS: Readonly<Record<NotificationChannel, string>> = {
  slack: 'Slack DM',
  email: 'Email',
};

/**
 * The column header and switch label for a channel.
 *
 * Typed on the union rather than on `string`, unlike the trigger lookups: a channel never arrives
 * from a `text` column — it is one of two switches the page renders per row — so an unknown value
 * here is a build error rather than a fallback. `isNotificationChannel` is the guard for the one
 * place a channel does arrive as an untrusted string.
 */
export function channelLabel(channel: NotificationChannel): string {
  return CHANNEL_LABELS[channel];
}
