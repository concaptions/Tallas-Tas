import {
  COPY_CTAS,
  COPY_FIELD_LABELS,
  COPY_FUNNELS,
  COPY_LIMITS,
  copyLength,
  copyLimitFor,
  overBy,
  type CopyDraftField,
  type CopyLimitField,
} from '@tas/domain/copy';
import { COPY_STATUS, type ChipTone } from '@tas/domain/state';
import { collectionsPath } from '@/lib/routes';

/**
 * How the Copywriting route presents what it stores (PRD §5.11). One module, so the table, the
 * detail panel and the `/design-system` preview cannot drift: the column order, the four copy
 * fields, the character guidance, the em dash and the empty-state sentences are each stated once.
 *
 * Nothing here invents a vocabulary. The CTA options are `COPY_CTAS`, the status options are
 * `COPY_STATUS`, the field labels and the ~125 / ~40 / ~27 guidance are `COPY_FIELD_LABELS` and
 * `COPY_LIMITS`, and the counter measures with `copyLength` / `overBy` — all from `@tas/domain`.
 * No component writes `'Shop Now'`, `'approved'`, `'Primary Copy'` or `125`.
 *
 * `@tas/db` is deliberately absent: the workspace and the panel are client components and a runtime
 * import of that package would drag the database driver into the browser bundle. Everything a
 * client needs is handed down from `page.tsx` as plain data.
 */

/** The URL parameter the search lives in, the same `?q=` every other list page uses. */
export const SEARCH_PARAM = 'q';

/** The URL parameter the open row lives in, so a refresh reopens the panel and the link is shareable. */
export const SELECTION_PARAM = 'copy';

/**
 * The grid's columns are NOT listed here any more (GRATSI-MATCH, 2026-10-04). Label, order and
 * visibility come from the column resolver per brand — the template's ten fields for an inheriting
 * base, Gratsi's twenty-five — and the workspace joins them to its renderer registry through
 * `gridColumnsFrom`, exactly as every other resolver-driven page does. The hand-written
 * `COPY_COLUMNS` array this replaces drew six headers over a thirty-field base, which is the gap
 * `docs/audits/gratsi-column-diff-2026-10-04.md` opened on.
 */

/** The dash a null cell shows, so an unattached row is never just a gap. */
export const EM_DASH = '—';

/** How much of the Descriptions cell the grid shows before the ellipsis; the full text is its title. */
export const PRIMARY_COPY_PREVIEW = 56;

/** A grid preview of a long text: cut at `max` with an ellipsis, or returned whole when it fits. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(max - 1, 0)).trimEnd()}…`;
}

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/**
 * One copy row as the route renders it: everything the table and the panel show, and nothing else.
 * Built on the server so the client components never import `@tas/db` and never resolve a status,
 * a title or a timestamp themselves.
 */
export interface CopyItem {
  readonly id: string;
  /** The stored integer behind the title, for the grid's numeric sort. */
  readonly copyNumber: number;
  /** `copyTitle(copyNumber)` — auto-generated, never typed, rendered in `font-mono`. */
  readonly title: string;
  readonly headline: string | null;
  readonly primaryCopy: string | null;
  readonly linkDescription: string | null;
  readonly cta: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly statusTone: ChipTone;
  /** `null` is the ordinary unattached case (CLAUDE.md non-negotiable 5), not a degraded row. */
  readonly creativeBriefId: string | null;
  readonly creativeName: string | null;
  readonly conceptId: string | null;
  readonly conceptName: string | null;
  /** `briefPath(creativeBriefId)`, or `null` when there is no creative to link to. */
  readonly creativeHref: string | null;
  /** A `COPY_FUNNELS` key, or `null` when not yet assigned. */
  readonly funnel: string | null;
  /** Whether this copy has been used in a live ad. */
  readonly used: boolean;
  /** Whether this copy is a proven winner. */
  readonly winning: boolean;
  /** Meta's ad quality rating (1–10), or `null` when not yet scored. */
  readonly metaRating: number | null;
  /** AI-generated spelling feedback, read-only. */
  readonly spellingFeedback: string | null;
  /** The client writes this, we never do. Read-only wherever it appears. */
  readonly clientComment: string | null;
  /** The client-facing approval status, one of the six `CLIENT_STATUS` keys or null. */
  readonly clientApprovalStatus: string | null;
  /**
   * The copy types this row is tagged with (Airtable "Copy Type", `copywriting_copy_types`). The
   * copy side OWNS this link, so the panel edits it; the Copy Types page reads the same rows back.
   */
  readonly copyTypeIds: readonly string[];
  /**
   * The campaigns this row is linked to (Airtable "Campaign Code", `copywriting_campaigns`).
   * Read-only in the panel: see `CAMPAIGNS_READ_ONLY_NOTE`.
   */
  readonly campaigns: readonly LinkedCampaign[];
  /**
   * The collections whose `collections.copywriting_id` is this row (Airtable "Collections", the
   * inverse of the Collections panel's Copywriting ID). The panel renders them as chip-links
   * (reverse read), AND Oct 5 added an editable Linked Collection single-select (owner-side write);
   * the Linked Collection control resolves to the first entry here, which is what the UI pre-fills.
   */
  readonly collections: readonly LinkedCollection[];
  /**
   * The current single Linked Collection — the first id of `collections`, or `null` when no
   * collection points at this copy. Oct 5 ruling: one collection per copy (the many-to-many case is
   * deferred); the Linked Collection control writes `collections.copywriting_id` through
   * `setCollectionCopywritingLinkInBrand`.
   */
  readonly linkedCollectionId: string | null;
  /**
   * The Airtable LOOKUP cells (GRATSI-MATCH, 2026-10-04), each resolved on the server by
   * `page.tsx` through the row's links with `lookupRollup` — never stored, never editable, and
   * `null` wherever the link points at nothing, which the grid renders as the muted em dash.
   * `angleName` is the linked brief's angle; `productName`/`productLink` read the row's
   * `product_id`; the three campaign strings read the rows `copywriting_campaigns` links; the two
   * collection strings read the collections whose `copywriting_id` is this row.
   *
   * `productId` is the Oct 5 Linked Product control's own value — the stored FK — so the panel
   * can pre-fill its select. It is NOT a lookup rollup; it is the row's own column.
   */
  readonly angleName: string | null;
  readonly productId: string | null;
  readonly productName: string | null;
  readonly productLink: string | null;
  readonly offer: string | null;
  readonly campaignNames: string | null;
  readonly campaignCodes: string | null;
  readonly collectionUrls: string | null;
  readonly collectionProducts: string | null;
  /** The names behind `copyTypeIds`, for the Copy Type grid cell's chips. */
  readonly copyTypeNames: readonly string[];
  /** The shared `created_by` audit column, surfaced as Airtable's "Created By" (annotation 3). */
  readonly createdBy: string | null;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

/** One toggle of the panel's Copy Types picker: a copy type's id and its name. */
export interface CopyTypeChoice {
  readonly id: string;
  readonly name: string;
}

/** One campaign a copy row is linked to, as the panel lists it: a label and, when known, a link. */
export interface LinkedCampaign {
  readonly id: string;
  readonly label: string;
  readonly href: string | null;
}

/** One collection that points at a copy row, as the panel lists it: its typed name and a link. */
export interface LinkedCollection {
  readonly id: string;
  /** The collection's hand-typed name — not system output, so the panel does not set `font-mono`. */
  readonly label: string;
  /** The Collections page with its panel open on this collection. */
  readonly href: string;
}

/**
 * The URL parameter the Collections workspace keeps its open row in. It is the key that module's
 * `syncUrl` writes (a literal there), restated here so the panel can deep-link into the page.
 */
export const COLLECTION_SELECTION_PARAM = 'collection';

export function collectionHref(id: string): string {
  return `${collectionsPath}?${COLLECTION_SELECTION_PARAM}=${encodeURIComponent(id)}`;
}

/** A collection row as the inversion reads it: its id, its name and the Meta copy it points at. */
export interface CollectionLinkSource {
  readonly id: string;
  readonly name: string;
  readonly copywritingId: string | null;
}

/**
 * `copyId -> collections`, inverted from `collections.copywriting_id`: every collection that points
 * at a copy row, in the order the collections arrive (newest edit first). A collection with no Meta
 * copy contributes nothing, and a copy no collection points at has no entry, so the page falls back
 * to an empty list and the panel renders the em dash. The collection owns the link (its Copywriting
 * ID field), which is why nothing here is a writer.
 */
export function collectionsByCopy(
  rows: readonly CollectionLinkSource[],
): Map<string, LinkedCollection[]> {
  const byCopy = new Map<string, LinkedCollection[]>();
  for (const row of rows) {
    if (row.copywritingId === null) continue;
    const record: LinkedCollection = { id: row.id, label: row.name, href: collectionHref(row.id) };
    const existing = byCopy.get(row.copywritingId);
    if (existing === undefined) {
      byCopy.set(row.copywritingId, [record]);
    } else {
      existing.push(record);
    }
  }
  return byCopy;
}

/**
 * `copyId -> copyTypeIds`, inverted from the copy types' own linked-copy lists. The junction is owned
 * by the copy side, but the brand's types arrive from the Copy Types source already carrying their
 * Meta copies — demo fixtures and database rows alike — so the page inverts that list rather than
 * reading the junction a second time. A type with no Meta copies contributes nothing, and a copy
 * tagged with two types lists both, in the order the types arrived (newest edit first), which is
 * the order the picker renders them.
 */
export function copyTypeIdsByCopy(
  copyTypes: readonly {
    readonly id: string;
    readonly metaCopies: readonly { readonly id: string }[];
  }[],
): Map<string, string[]> {
  const byCopy = new Map<string, string[]>();
  for (const copyType of copyTypes) {
    for (const copy of copyType.metaCopies) {
      const existing = byCopy.get(copy.id);
      if (existing === undefined) {
        byCopy.set(copy.id, [copyType.id]);
      } else if (!existing.includes(copyType.id)) {
        existing.push(copyType.id);
      }
    }
  }
  return byCopy;
}

/** One option of the panel's Linked Creative select: a brief's id and its generated §7 name. */
export interface CreativeChoice {
  readonly id: string;
  readonly name: string;
}

/**
 * One option of the panel's Linked Product `<select>` (Oct 5 Linked Product control): a brand
 * product's id and hand-typed name. The FK (`copywriting.product_id`) is a column on this row, so
 * the setter writes it directly through `updateCopy`.
 */
export interface ProductChoice {
  readonly id: string;
  readonly name: string;
}

export const NO_PRODUCT_VALUE = 'none';
export const NO_PRODUCT_LABEL = 'No product';

/**
 * The value the "No creative" option carries. A `Select` item cannot hold the empty string, and a
 * copy row's `creative_brief_id` is a uuid or nothing, so this sentinel can never collide with a
 * real brief id. The hidden input submits `''` for it and the action stores NULL.
 */
export const NO_CREATIVE_VALUE = 'none';

/** What that option reads as (ticket criterion 7). */
export const NO_CREATIVE_LABEL = 'No creative';

/** One option of the panel's Concept select. */
export interface ConceptChoice {
  readonly id: string;
  readonly name: string;
}

export const NO_CONCEPT_VALUE = 'none';
export const NO_CONCEPT_LABEL = 'No concept';

/**
 * One option of the panel's Linked Collection `<select>` (Oct 5 ruling in `docs/decisions.md`): a
 * brand collection's id and hand-typed name. The owner-side FK (`collections.copywriting_id`)
 * stores the pick, and this list is the whole brand so the picker can offer an unassigned one.
 */
export interface CollectionChoice {
  readonly id: string;
  readonly name: string;
}

export const NO_COLLECTION_VALUE = 'none';
export const NO_COLLECTION_LABEL = 'No collection';

/** The four copy fields of ticket criterion 6, and how each one is rendered. */
export interface CopyField {
  readonly name: CopyDraftField;
  readonly label: string;
  /** `textarea` is copy the writer types; `cta` is the closed-vocabulary select. */
  readonly kind: 'textarea' | 'cta';
  /** The field's character guidance, or `null` for the CTA, which carries none. */
  readonly limit: CopyLimitField | null;
  /** Helper text under the label, in `text-text3`. */
  readonly hint: string;
}

/** The PRD's guidance sentence for a limited field. The number is the domain's, never retyped. */
function guidance(field: CopyLimitField): string {
  return `~${String(COPY_LIMITS[field])} characters — Meta cuts it short past that, it is not rejected.`;
}

/**
 * Primary Copy, Headline, News Feed / Link Description, CTA — exactly these four, in this order.
 * Client's Comment is not here on purpose: the client writes it, so the panel shows it read-only
 * outside this descriptor and no save ever submits it.
 */
export const COPY_FIELDS = [
  {
    name: 'primaryCopy',
    label: COPY_FIELD_LABELS.primaryCopy,
    kind: 'textarea',
    limit: 'primaryCopy',
    hint: guidance('primaryCopy'),
  },
  {
    name: 'headline',
    label: COPY_FIELD_LABELS.headline,
    kind: 'textarea',
    limit: 'headline',
    hint: guidance('headline'),
  },
  {
    name: 'linkDescription',
    label: COPY_FIELD_LABELS.linkDescription,
    kind: 'textarea',
    limit: 'linkDescription',
    hint: guidance('linkDescription'),
  },
  {
    name: 'cta',
    label: 'CTA',
    kind: 'cta',
    limit: null,
    hint: 'The button Meta renders on the ad. One of six, never typed.',
  },
] as const satisfies readonly CopyField[];

/** The CTA dropdown's options, in the domain's render order. */
export const CTA_OPTIONS: readonly { value: string; label: string }[] = COPY_CTAS.map((entry) => ({
  value: entry.key,
  label: entry.label,
}));

/** The Status dropdown's options, in the PRD's order: the entry state, then the four outcomes. */
export const STATUS_OPTIONS: readonly { value: string; label: string; description: string }[] =
  COPY_STATUS.map((entry) => ({
    value: entry.key,
    label: entry.label,
    description: entry.description,
  }));

/** The Funnel dropdown's options, in the domain's render order. */
export const FUNNEL_OPTIONS: readonly { value: string; label: string }[] = COPY_FUNNELS.map(
  (entry) => ({
    value: entry.key,
    label: entry.label,
  }),
);

/** The sentinel value the "No funnel" option carries, matching the NO_CREATIVE_VALUE pattern. */
export const NO_FUNNEL_VALUE = 'none';

/** What the "No funnel" option reads as. */
export const NO_FUNNEL_LABEL = 'No funnel';

/** The panel's section headings, stated once so the E2E assertions agree with them. */
export const COPY_HEADINGS = {
  copy: 'Copy',
  creative: 'Creative & Status',
  copyTypes: 'Copy Types',
  campaigns: 'Campaigns & Offers',
  collections: 'Collections',
  details: 'Details',
  clientComment: "Client's Comment",
} as const;

/** The one sentence under the read-only client comment, so nobody hunts for the missing input. */
export const CLIENT_COMMENT_NOTE =
  'Written by the client in their approval interface. Read-only here.';

/** Under the Copy Types picker: which side owns the link, so nobody looks for it on the other. */
export const COPY_TYPES_HINT =
  'The kinds of copy this row is tagged with. Owned here; the Copy Types page reads them back.';

/** The picker with nothing to pick from: a brand that has not created a copy type yet. */
export const NO_COPY_TYPES_NOTE =
  'No copy types in this brand yet. Create one on the Copy Types page.';

/** The campaigns list with nothing in it — the ordinary case for copy that is not offer-led. */
export const NO_CAMPAIGNS_NOTE = 'No campaign is linked to this copy yet.';

/**
 * Why the Campaigns & Offers list is read-only here although the copy side owns the link in
 * Airtable: `@tas/db` ships no writer (and no reader) for `copywriting_campaigns` yet, so a picker
 * would have nothing to submit to. The list is the shape the page fills once one exists.
 */
export const CAMPAIGNS_READ_ONLY_NOTE =
  'Linking a campaign from this panel ships with the campaign-links writer.';

/**
 * What the Collections section says under the read-only chip list. Oct 5 ruling
 * (`docs/decisions.md`): the Linked Collection single-select above WRITES the owner-side FK on
 * `collections.copywriting_id`, so a reader expects to see editing happen here — but a copy row can
 * be pointed at by more than one legacy collection and the chip list is the whole truth, not the
 * one entry the control pre-fills with.
 */
export const COLLECTIONS_READ_ONLY_NOTE =
  'Every collection whose Copywriting ID points at this row. The Linked Collection control above writes the owner-side FK.';

/** How the header counts what is on screen. Singular at one, never "1 copies". */
export function copyCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'copy row' : 'copy rows'}`;
}

/** The count line while the search narrows the list, so "4 copy rows" never contradicts 1 row. */
export function filteredCopyCountLabel(visible: number, total: number): string {
  return `${String(Math.max(Math.floor(visible), 0))} of ${copyCountLabel(total)}`;
}

/**
 * The search reads everything the table shows plus the words the row is actually made of: the
 * generated title, the headline, the primary copy, the linked creative's name and the status LABEL
 * — so "approved" finds the row whose chip says Approved without this module writing that string,
 * and a half-remembered phrase finds the copy it belongs to. `query` arrives lowercased and trimmed.
 */
export function matchesQuery(item: CopyItem, query: string): boolean {
  if (query === '') {
    return true;
  }
  return [
    item.title,
    item.headline ?? '',
    item.primaryCopy ?? '',
    item.linkDescription ?? '',
    item.cta,
    item.creativeName ?? NO_CREATIVE_LABEL,
    item.funnel ?? '',
    item.statusLabel,
    item.angleName ?? '',
    item.productName ?? '',
    item.campaignCodes ?? '',
    ...item.collections.map((collection) => collection.label),
    ...item.copyTypeNames,
  ].some((value) => value.toLowerCase().includes(query));
}

/** The Yes/No chip a checkbox column renders: `ok` when set, muted otherwise. */
export function booleanChip(value: boolean): { readonly label: string; readonly tone: ChipTone } {
  return value ? { label: 'Yes', tone: 'ok' } : { label: 'No', tone: 'mute' };
}

/**
 * The empty state's two sentences, which say different things and must never be collapsed into one.
 * A brand with no copy at all is offered the primary action; a search that matches nothing is
 * offered its way back, because "New copy" would answer a question nobody asked.
 */
export const NO_COPY_NOTE =
  'No copy written yet. A copy row is a headline plus the three pieces of text around it.';

export const NO_MATCH_NOTE = 'No copy matches this search. Clear it to see every row.';

/**
 * Why "New copy" is inert outside demo mode too: creating a row is explicitly out of this ticket's
 * scope, so there is no create action for the button to submit to. One ships with the CSV upload
 * ticket; an exported Server Action nothing submits to would be dead code until then.
 */
/** How a character counter reads: used of the guide. */
export function counterLabel(text: string | null, field: CopyLimitField): string {
  return `${String(copyLength(text))} of ${String(copyLimitFor(field))}`;
}

/**
 * What colour that counter is. Muted while there is room, `warn` exactly AT the guide — the last
 * character that still fits — and `bad` past it. Never a block: `validateCopyDraft` keeps `ok` true
 * for an over-long field, because the PRD's numbers are tildes.
 */
export type CounterTone = 'muted' | 'warn' | 'bad';

export function counterTone(text: string | null, field: CopyLimitField): CounterTone {
  const limit = copyLimitFor(field);
  if (overBy(text, limit) > 0) {
    return 'bad';
  }
  return copyLength(text) === limit ? 'warn' : 'muted';
}

/** The token class each counter tone renders in. No hex, no literal colour anywhere. */
export const COUNTER_TONE_CLASS: Record<CounterTone, string> = {
  muted: 'text-text3',
  warn: 'text-warn',
  bad: 'text-bad',
};

/**
 * The campaigns a copy row is linked to (`copywriting_campaigns`), as the panel lists them: the
 * campaign's generated name as a plain chip (`href: null`), since the Campaigns & Offers workspace
 * is removed from the app (2026-10-09). Ids with no live campaign (another brand's, soft-deleted)
 * drop out rather than render blank.
 */
export function campaignLinks(
  campaignIds: readonly string[],
  campaignsById: ReadonlyMap<string, string>,
): LinkedCampaign[] {
  const links: LinkedCampaign[] = [];
  for (const id of campaignIds) {
    const name = campaignsById.get(id);
    if (name === undefined) continue;
    links.push({ id, label: name, href: null });
  }
  return links;
}
