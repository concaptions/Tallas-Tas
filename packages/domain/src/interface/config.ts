/**
 * Which pages a client sees, and which fields those pages show (PRD §10: "the interface must be
 * configurable per client, at two levels: **Which pages appear** … **Which fields appear**").
 *
 * This module is the whole rule. The defaults of §10 are written here ONCE as const tuples, the
 * preview and the real client interface both ask `visibleFields` what a page shows, and both toggles
 * are pure functions returning a NEW configuration — so `/app/interface-config` can preview a change
 * without a server round trip, and the Server Action that saves it applies exactly the same
 * transformation rather than a second opinion about it (CLAUDE.md non-negotiable 4: the rule lives in
 * `packages/domain` and neither the UI nor the action reimplements it).
 *
 * NO PAGE, FIELD KEY OR LABEL IS A LITERAL IN A COMPONENT (ticket criterion 9). A component reads
 * `DEFAULT_INTERFACE_PAGES` or the configuration it was handed; it never writes `'hook_examples'`.
 *
 * THE TWO AXES ARE INDEPENDENT, and the order matters. `visible` is what a CSM tunes per brand;
 * `clientEditable` is fixed by §10's table (Client Status and comments on Creatives, Status and
 * Client's Comment on Copywriting, Status, Note and Tracking Number on UGC, nothing on the concept
 * card, nothing on Partnership Ads Tracking, which is view / group / filter only). A hidden field is
 * never editable whatever its flag says, which is why `clientCanEdit` asks `visible && clientEditable`
 * and nothing anywhere asks `clientEditable` alone.
 *
 * A PAGE SWITCHED OFF HIDES ITS FIELDS WITHOUT CHANGING THEM (ticket criterion 6). `visibleFields`
 * returns nothing for a disabled page while every field keeps its own `visible` flag, so switching the
 * page back on restores exactly the previous field set rather than the defaults.
 *
 * Pure and total: no I/O, no clock, no React, no row type from `@tas/db`. Every function is generic
 * over the minimum shape a row has to carry — `InterfacePageRow` and `InterfaceFieldRow` from
 * `@tas/db` satisfy it structurally, ids and timestamps included, and come back out of a toggle with
 * those extra columns intact — which is what keeps the dependency edge app → domain and app → db,
 * never domain → db.
 */

import type { ChipTone } from '../state/creative-status';

/**
 * The storage vocabulary of `interface_pages.page_key`, copied from `interfacePageKeys` in
 * `packages/db/src/schema/enums.ts` rather than imported: `@tas/domain` depends on nothing, and this
 * repo's dependency edge runs app → domain and app → db, never domain → db. The tuple order is PRD
 * §10's page order, which is also the render order of the tab strip.
 */
export const INTERFACE_PAGE_KEYS = [
  'concepts',
  'creatives',
  'copywriting',
  'ugc',
  'partnership',
  'calendar',
] as const;

export type InterfacePageKey = (typeof INTERFACE_PAGE_KEYS)[number];

export function isInterfacePageKey(value: string): value is InterfacePageKey {
  return (INTERFACE_PAGE_KEYS as readonly string[]).includes(value);
}

/**
 * One configured field. The minimum a row has to carry to be placed in a tree, a preview or a client
 * page: the key the interface renders against, the label a human reads, and the two flags.
 *
 * `fieldName` is snake_case storage vocabulary (`hook_examples`); `label` is what the client reads
 * ("Hook examples"). The key never changes when a brand renames a label, which is why the preview
 * matches on the key and prints the label.
 */
export interface InterfaceFieldConfig {
  readonly fieldName: string;
  readonly label: string;
  readonly visible: boolean;
  readonly clientEditable: boolean;
  /** 0-based and dense within its page. Order is DATA, so a field toggled off and on comes back in place. */
  readonly position: number;
}

/** One configured page with its fields. `InterfacePageRow` from `@tas/db` satisfies this verbatim. */
export interface InterfacePageConfig<Field extends InterfaceFieldConfig = InterfaceFieldConfig> {
  readonly pageKey: InterfacePageKey;
  readonly label: string;
  readonly enabled: boolean;
  readonly position: number;
  readonly fields: readonly Field[];
}

/** A whole client interface: the six pages of §10, in order. */
export type InterfaceConfig<Page extends InterfacePageConfig = InterfacePageConfig> =
  readonly Page[];

/** A field default before `defaultInterfaceConfig()` gives it its position. */
interface InterfaceFieldDefault {
  readonly fieldName: string;
  readonly label: string;
  readonly clientEditable: boolean;
}

/** A page default before `defaultInterfaceConfig()` gives it its position. */
interface InterfacePageDefault {
  readonly pageKey: InterfacePageKey;
  readonly label: string;
  readonly fields: readonly InterfaceFieldDefault[];
}

/**
 * The concept card's fields, in PRD §10's order (ticket criterion 8) — the list the ticket names
 * field for field: Batch, Category, Concept name, Concept Style, Angle, Theme, Product, Description
 * (hypothesis), Pain Points, USP, Persona, Hook examples.
 *
 * Every one is read-only for the client. §10 grants the client editing on the Creatives, Copywriting
 * and UGC pages only; a concept card is the strategist's argument for an ad, and a client who could
 * rewrite the hypothesis in place would be rewriting the record of why the ad was made.
 */
export const DEFAULT_CONCEPT_FIELDS: readonly InterfaceFieldDefault[] = [
  { fieldName: 'batch', label: 'Batch', clientEditable: false },
  { fieldName: 'category', label: 'Category', clientEditable: false },
  { fieldName: 'concept_name', label: 'Concept name', clientEditable: false },
  { fieldName: 'concept_style', label: 'Concept Style', clientEditable: false },
  { fieldName: 'angle', label: 'Angle', clientEditable: false },
  { fieldName: 'theme', label: 'Theme', clientEditable: false },
  { fieldName: 'product', label: 'Product', clientEditable: false },
  { fieldName: 'description', label: 'Description (hypothesis)', clientEditable: false },
  { fieldName: 'pain_points', label: 'Pain Points', clientEditable: false },
  { fieldName: 'usp', label: 'USP', clientEditable: false },
  { fieldName: 'persona', label: 'Persona', clientEditable: false },
  { fieldName: 'hook_examples', label: 'Hook examples', clientEditable: false },
] as const;

/**
 * PRD §10's six pages, in the order the client's tab strip renders them, each with the fields that
 * page actually carries.
 *
 * The labels are the PRD's own page titles and carry no emoji: the sidebar and the client's tab strip
 * are typography, not decoration (design handoff), and a label is also what a CSM reads in the tree.
 *
 * These four short field lists are honest rather than decorative — they are the columns the client
 * touches on each page. Partnership Ads Tracking lists only what the client may see: the creator, the
 * handle, the activity and the expiry, never the partnership price or the creator cost (CLAUDE.md
 * non-negotiable 10 keeps internal money out of the client interface entirely).
 *
 * `packages/db/src/demo-data.ts` writes this same configuration as ROWS, ids, brand and timestamps
 * included. It is not a second opinion about the defaults: `@tas/db` does not depend on `@tas/domain`,
 * and `apps/web` — which depends on both — is where the two are asserted equal (ticket criterion 12).
 */
export const DEFAULT_INTERFACE_PAGES: readonly InterfacePageDefault[] = [
  { pageKey: 'concepts', label: 'Concepts', fields: DEFAULT_CONCEPT_FIELDS },
  {
    pageKey: 'creatives',
    label: 'Creatives',
    fields: [
      { fieldName: 'client_status', label: 'Client Status', clientEditable: true },
      { fieldName: 'client_comments', label: 'Comments & annotations', clientEditable: true },
    ],
  },
  {
    pageKey: 'copywriting',
    label: 'Copywriting',
    fields: [
      { fieldName: 'client_status', label: 'Status', clientEditable: true },
      { fieldName: 'client_comment', label: "Client's Comment", clientEditable: true },
    ],
  },
  {
    pageKey: 'ugc',
    label: 'UGC Management',
    fields: [
      { fieldName: 'client_status', label: 'Status', clientEditable: true },
      { fieldName: 'client_note', label: "Client's Note", clientEditable: true },
      { fieldName: 'tracking_number', label: 'Tracking Number', clientEditable: true },
    ],
  },
  {
    pageKey: 'partnership',
    label: 'Partnership Ads Tracking',
    fields: [
      { fieldName: 'creator_name', label: 'Creator', clientEditable: false },
      { fieldName: 'instagram_username', label: 'Instagram Username', clientEditable: false },
      { fieldName: 'partnership_activity', label: 'Activity', clientEditable: false },
      { fieldName: 'partnership_expires_on', label: 'Expires On', clientEditable: false },
    ],
  },
  {
    pageKey: 'calendar',
    label: 'Promotional Calendar',
    fields: [
      { fieldName: 'campaign_name', label: 'Campaign', clientEditable: false },
      { fieldName: 'holiday', label: 'Holiday', clientEditable: false },
      { fieldName: 'official_date', label: 'Official Date', clientEditable: false },
      { fieldName: 'ads_launch_date', label: 'Ads Launch', clientEditable: false },
      { fieldName: 'ads_end_date', label: 'Ads End', clientEditable: false },
    ],
  },
] as const;

/**
 * The configuration a brand starts with: every page enabled, every field visible, positions taken
 * from the order the defaults are WRITTEN in — so no position can be typed wrong or repeated, and the
 * order the PRD lists is the order the client reads (ticket criterion 8).
 *
 * A function rather than a frozen constant, and it builds fresh objects every call, so a caller that
 * toggles a copy can never reach back and change the defaults for the next reader.
 */
export function defaultInterfaceConfig(): InterfacePageConfig[] {
  return DEFAULT_INTERFACE_PAGES.map((page, pageIndex) => ({
    pageKey: page.pageKey,
    label: page.label,
    enabled: true,
    position: pageIndex,
    fields: page.fields.map((field, fieldIndex) => ({
      fieldName: field.fieldName,
      label: field.label,
      visible: true,
      clientEditable: field.clientEditable,
      position: fieldIndex,
    })),
  }));
}

/** Ascending `position`, the one order anything in this module sorts by. */
function byPosition(left: { readonly position: number }, right: { readonly position: number }) {
  return left.position - right.position;
}

/**
 * The pages the client's tab strip shows: enabled only, in position order (ticket criterion 6 — a
 * page switched off loses its tab AND its card).
 *
 * Sorts a copy. A configuration read through `listInterfaceConfig` already arrives ordered, but a
 * configuration held in React state has been through a toggle, and a pure function that depends on
 * its caller having sorted first is a bug waiting for the first optimistic update.
 */
export function enabledPages<Page extends InterfacePageConfig>(
  config: InterfaceConfig<Page>,
): readonly Page[] {
  return config.filter((page) => page.enabled).sort(byPosition);
}

/** The page with this key, or `undefined`. Total: an unknown key is a miss, never a throw. */
export function findPage<Page extends InterfacePageConfig>(
  config: InterfaceConfig<Page>,
  pageKey: string,
): Page | undefined {
  return config.find((page) => page.pageKey === pageKey);
}

/**
 * What a page actually shows the client: its visible fields in position order, and NOTHING when the
 * page itself is switched off.
 *
 * The page gate lives here rather than in the preview component on purpose. `/app/interface-config`'s
 * preview and the real client interface later must agree on one rule about what a client sees, and
 * the rule is: a disabled page shows no fields, an invisible field is not shown, order is `position`.
 */
export function visibleFields<Field extends InterfaceFieldConfig>(
  page: InterfacePageConfig<Field>,
): readonly Field[] {
  if (!page.enabled) {
    return [];
  }
  return page.fields.filter((field) => field.visible).sort(byPosition);
}

/**
 * The same page with its fields replaced, as a NEW object: every extra column a `@tas/db` row carries
 * (`id`, `brandId`, the timestamps) is spread through untouched, which is what lets the page hold real
 * rows in React state and still get rows back out of a toggle. Nothing is mutated.
 */
function withFields<Page extends InterfacePageConfig>(
  page: Page,
  fields: readonly InterfaceFieldConfig[],
): Page {
  return { ...page, fields };
}

/**
 * The configuration with one field's `visible` flipped, as a NEW configuration (ticket criterion 5:
 * the preview updates immediately, client state only, no server round trip).
 *
 * A field is addressed by its page key AND its field name because the keys repeat across pages —
 * `client_status` is a field of Creatives, of Copywriting and of UGC, and a tree that matched on the
 * field name alone would toggle all three at once. An unknown page or field returns the configuration
 * unchanged rather than throwing: a stale click is not a crash.
 */
export function toggleField<Page extends InterfacePageConfig>(
  config: InterfaceConfig<Page>,
  pageKey: string,
  fieldName: string,
): readonly Page[] {
  return config.map((page) => {
    if (page.pageKey !== pageKey || !page.fields.some((field) => field.fieldName === fieldName)) {
      return page;
    }
    return withFields(
      page,
      page.fields.map((field) =>
        field.fieldName === fieldName ? { ...field, visible: !field.visible } : field,
      ),
    );
  });
}

/**
 * The configuration with one page's `enabled` flipped, as a NEW configuration.
 *
 * It does NOT touch the page's fields (ticket criterion 6): every field keeps the flag it had, the
 * tree mutes those rows, `visibleFields` returns nothing while the page is off, and switching the page
 * back on restores exactly the field set the client was seeing before.
 */
export function togglePage<Page extends InterfacePageConfig>(
  config: InterfaceConfig<Page>,
  pageKey: string,
): readonly Page[] {
  return config.map((page) =>
    page.pageKey === pageKey ? { ...page, enabled: !page.enabled } : page,
  );
}

/**
 * May the client CHANGE this value? Both axes, in this order and nowhere else: a field the client
 * cannot see is not a field the client can edit, whatever §10's second column says about it.
 *
 * Takes the field alone, so a caller that has already gated on the page (`visibleFields`) asks one
 * question about one field. The overload that knows about the page is `visibleFields(page)` followed
 * by this — a disabled page returns no fields at all, so nothing on it can be reached.
 */
export function clientCanEdit(field: InterfaceFieldConfig): boolean {
  return field.visible && field.clientEditable;
}

/**
 * The three things a field can be to a client, as short phrases for the tree's chip.
 *
 * These are ACCESS, not status. They are deliberately not in `@tas/domain/state` and deliberately not
 * a status vocabulary: nothing here is a state a record moves through, no record stores one, and
 * `/app/interface-config` renders the platform's real statuses (`@tas/domain/state`) and these
 * side by side without confusing the two (ticket criteria 10 and 14).
 */
const ACCESS_EDIT = {
  key: 'edit',
  label: 'Client can edit',
  tone: 'accent',
  description: 'Visible on the client interface, and the client may change the value.',
} as const;

const ACCESS_READ = {
  key: 'read',
  label: 'Client sees it',
  tone: 'info',
  description: 'Visible on the client interface, read-only.',
} as const;

const ACCESS_HIDDEN = {
  key: 'hidden',
  label: 'Hidden from the client',
  tone: 'mute',
  description: 'Switched off for this brand. The client never sees the field.',
} as const;

export const INTERFACE_ACCESS = [ACCESS_EDIT, ACCESS_READ, ACCESS_HIDDEN] as const;

export interface InterfaceAccessEntry {
  readonly key: InterfaceAccessKey;
  readonly label: string;
  readonly tone: ChipTone;
  readonly description: string;
}

export type InterfaceAccessKey = (typeof INTERFACE_ACCESS)[number]['key'];

/**
 * The whole entry, so a chip takes its label and its tone from one lookup — and a branch rather than
 * a lookup table, so the three cases are exhaustive by construction and `visible` is asked first.
 */
export function accessEntry(field: InterfaceFieldConfig): InterfaceAccessEntry {
  if (!field.visible) {
    return ACCESS_HIDDEN;
  }
  return field.clientEditable ? ACCESS_EDIT : ACCESS_READ;
}

/** Which of the three a field is. Total — every field is exactly one of them. */
export function accessKey(field: InterfaceFieldConfig): InterfaceAccessKey {
  return accessEntry(field).key;
}

/** The short phrase: 'Client can edit', 'Client sees it' or 'Hidden from the client'. */
export function describeAccess(field: InterfaceFieldConfig): string {
  return accessEntry(field).label;
}

/** The `StatusChip` tone for that phrase, in the one `ChipTone` vocabulary every chip uses. */
export function accessTone(field: InterfaceFieldConfig): ChipTone {
  return accessEntry(field).tone;
}
