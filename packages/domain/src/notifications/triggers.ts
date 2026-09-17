/**
 * The eight things the platform DMs somebody about (PRD §12), written once.
 *
 * §12's requirement is that "notifications go as **Slack direct messages to the assigned person**,
 * through our existing TAS Bot app" and that "routing comes from the team assignment made at
 * onboarding (§3) — filled once, never rebuilt by hand". Two consequences shape this module:
 *
 *   - THE TRIGGER LIST IS FIXED AND ORDERED. There is no add, delete or reorder anywhere on
 *     `/app/notifications`; the eight bullets of §12 are the product. `NOTIFICATION_TRIGGERS` is the
 *     one place their keys and their wording exist, so a component never writes `'ad_submitted'` and
 *     never retypes a label (CLAUDE.md non-negotiable: no magic strings in a component).
 *   - THE RECIPIENT IS ROW DATA, NEVER A CONTROL. `recipients` here is §12's own phrase for who is
 *     DMed — "the media buyer and CSM" — kept verbatim so the page, the routing note and any future
 *     email all describe routing in the PRD's words rather than three paraphrases of it.
 *
 * TWO `recipients` FIELDS, DELIBERATELY DIFFERENT. `notificationTriggers` in
 * `packages/db/src/schema/enums.ts` carries `recipients` as `BrandRole[]` — the §11 roles the DM
 * actually resolves to — plus `recipientLabel`, the short reading the Recipient cell renders
 * ("Media Buyer + CSM"). THAT is what a row of the table prints. The `recipients` in this file is
 * §12's sentence fragment, which is longer and includes the payload detail §12 attaches to the first
 * bullet ("with priority and deadline"). It is the copy for prose — the routing note, a tooltip, the
 * body of a future notification email — not for the Recipient column.
 *
 * COPIED FROM `@tas/db`, NOT IMPORTED, exactly as `INTERFACE_PAGE_KEYS` is: `@tas/domain` depends on
 * nothing and this repo's dependency edge runs app → domain and app → db, never domain → db. The
 * eight keys and the eight labels are therefore byte-identical to the tuple the migration seeds, and
 * `triggers.test.ts` pins both lists so a rename on either side fails a test instead of drifting.
 *
 * Pure and total: no I/O, no clock, no React, no row type from `@tas/db`.
 */

/** One §12 trigger: the stored key, the label a human reads, and §12's phrase for who is DMed. */
export interface NotificationTriggerSpec {
  /** Storage vocabulary — `notification_settings.trigger_key`, and the row's `data-trigger`. */
  readonly key: string;
  /** The §12 bullet as the platform writes it; identical to the label stored beside the row. */
  readonly label: string;
  /** §12's own words for who gets the DM. Prose, not the Recipient cell — see the module note. */
  readonly recipients: string;
}

/**
 * §12's eight triggers, IN §12's ORDER, which is also the render order of the table and the
 * `position` 0..7 the seed writes. Order is part of the contract: criterion 6 of the ticket reads
 * "exactly 8 triggers are seeded, in PRD §12 order, one per bullet", and the e2e spec asserts the
 * eight rows in this sequence.
 *
 * Every `recipients` phrase is §12's, trimmed only of the "DM" verb that every bullet repeats:
 * "→ DM the assignee, with priority and deadline" becomes "the assignee with priority and deadline".
 * Nothing is invented and nothing is dropped — the first bullet keeps its payload detail because the
 * DM §12 asks for genuinely carries more than the other seven.
 */
export const NOTIFICATION_TRIGGERS = [
  {
    key: 'brief_assigned',
    label: 'Brief assigned to an editor or designer',
    recipients: 'the assignee with priority and deadline',
  },
  {
    key: 'internal_revisions_requested',
    label: 'Revisions requested internally',
    recipients: 'the assignee',
  },
  {
    key: 'ad_submitted',
    label: 'Ad submitted',
    recipients: 'the creative strategist and CSM',
  },
  {
    key: 'client_approved',
    label: 'Client approved a concept, creative, copy or creator',
    recipients: 'the CSM and strategist',
  },
  {
    key: 'client_requested_revisions',
    label: 'Client requested revisions',
    recipients: 'the CSM and strategist',
  },
  {
    key: 'creative_ready_to_launch',
    label: 'Creative approved internally and ready to launch',
    recipients: 'the media buyer',
  },
  {
    key: 'creator_status_changed',
    label: 'Creator status changed',
    recipients: 'the UGC manager',
  },
  {
    key: 'partnership_expiring',
    label: 'Partnership permission expiring in 5 days',
    recipients: 'the media buyer and CSM',
  },
] as const satisfies readonly NotificationTriggerSpec[];

/** What `notification_settings.trigger_key` stores; the tuple above is the only place it is written. */
export type NotificationTriggerKey = (typeof NOTIFICATION_TRIGGERS)[number]['key'];

/** The eight keys alone, in §12 order — what an ordering assertion and a Server Action need. */
export const NOTIFICATION_TRIGGER_KEYS: readonly NotificationTriggerKey[] =
  NOTIFICATION_TRIGGERS.map((trigger) => trigger.key);

/**
 * True when `value` is a trigger this module knows.
 *
 * Total on `string` because `trigger_key` is a `text` column and the Server Action reads its key out
 * of a `FormData`: an unrecognised key is refused by the action rather than thrown at inside a query,
 * and a key retired by a later PRD revision reads back cleanly as "not one of ours".
 */
export function isNotificationTriggerKey(value: string): value is NotificationTriggerKey {
  return (NOTIFICATION_TRIGGER_KEYS as readonly string[]).includes(value);
}

/**
 * The trigger for a stored key, or `null` when the key is not one of §12's eight.
 *
 * `null` rather than a throw, for the same reason `listNotificationSettings` hands back a row with a
 * `label: null` instead of failing: a row written before a trigger was renamed must still render.
 */
export function notificationTrigger(key: string): NotificationTriggerSpec | null {
  return NOTIFICATION_TRIGGERS.find((trigger) => trigger.key === key) ?? null;
}

/**
 * The §12 label for a stored key, falling back to the key itself.
 *
 * The fallback is the same one the Trigger cell uses (`row.label ?? row.triggerKey`), written here so
 * the page and any future email agree without a component repeating the `??`.
 */
export function notificationTriggerLabel(key: string): string {
  return notificationTrigger(key)?.label ?? key;
}
