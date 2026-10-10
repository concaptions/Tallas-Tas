import { CLIENT_STATUS, chipTone, type ChipTone, type ClientStatusKey } from '@tas/domain/state';
import { INTERFACE_PAGE_KEYS, type InterfacePageKey } from '@tas/domain/interface';

/**
 * Everything `/app/interface-config` renders that is not a configuration row (PRD §10).
 *
 * A pure module with no React, no `@tas/db` import and no I/O, for two reasons. The preview is
 * rendered by a CLIENT component, so anything it needs has to be resolvable without pulling a
 * database client into the browser bundle: `page.tsx` projects one concept row into
 * `ConceptPreview` on the server and hands the client component plain strings. And the projection
 * itself — which concept column each of PRD §10's twelve concept fields prints — is data, so it is
 * stated once here and asserted against `defaultInterfaceConfig()` in `fields.test.ts` rather than
 * being spelled out inside a card.
 *
 * WHAT IS DELIBERATELY ABSENT. No internal status, no budget, no creator cost, no partnership
 * price, and no `scriptIdea`. CLAUDE.md non-negotiable 10 is that clients see zero internal data,
 * and this page's whole job is to show a CSM what the client sees — a preview that leaked an
 * internal column would be worse than no preview at all. The only status this module resolves is
 * the CLIENT status, and it resolves it through `CLIENT_STATUS` and `chipTone` from
 * `@tas/domain/state`, never a literal (ticket criterion 10).
 */

/** The dash an unset value shows, so a hidden-but-empty field is never a blank gap. */
export const EM_DASH = '—';

/**
 * The line above the preview. CLAUDE.md non-negotiable 10 stated out loud, because a CSM deciding
 * what to switch on has to know what can never be switched on.
 */
export const CLIENT_PRIVACY_NOTE =
  'The client sees nothing internal. No internal status, no budget, no creator cost, no partnership price — those columns are not configurable here because they never reach the client interface at all.';

/**
 * THE GATE'S COPY (2026-10-03). This page edits per-column visibility for a whole brand and had no
 * role check at all — page or action — unlike `/app/propagation`, which has both. Per-column
 * structure is an admin decision, so the page now asks the same `canSeePropagationPage` rule and
 * the save asks it again on the server.
 */
export const INTERFACE_CONFIG_ADMIN_NOTE =
  'This page is admin only. Switching a page or a field off changes what every client of this brand ' +
  'sees in their interface.';

/** What the page says instead of the tree when the guard refuses. */
export const INTERFACE_CONFIG_NOT_ADMIN_NOTE =
  'Only an agency Admin can change what the client interface shows. Ask your Admin to switch a page ' +
  'or a field on or off.';

/** Said in both modes: the page gate is not the only gate. */
export const INTERFACE_CONFIG_ENFORCEMENT_NOTE =
  'Saving checks the same rule again on the server before it writes.';

/** The line the page shows in demo mode: toggling is real, saving is not. */
export const DEMO_DRAFT_NOTICE =
  'Demo mode — toggle anything you like: the preview updates immediately, but this is a draft and nothing is saved.';

/** What the tree says when the brand has no configuration rows at all. */
export const NO_CONFIG_TITLE = 'No interface configuration for this brand yet.';
export const NO_CONFIG_BODY =
  "PRD §10's five pages are seeded with the brand. Connect a database and run the seed, and every page and field appears here ready to switch.";

/** What the preview says when every field of the open page is switched off. */
export const EMPTY_CARD_TITLE = 'The client would see an empty card.';
export const EMPTY_CARD_BODY =
  'That is a legitimate configuration — a page can exist purely so the client can approve — but it is worth seeing before you save it.';

/** What the preview says when every page is switched off. */
export const NO_PAGES_TITLE = 'The client would see no pages at all.';
export const NO_PAGES_BODY =
  'Switch at least one page back on, or the client interface opens on nothing.';

/** What the concept card says on a brand that has not written a concept yet. */
export const NO_CONCEPT_BODY =
  'This brand has no concept to preview yet. The card fills in as soon as the first concept is written; the switches below already decide what it will show.';

/**
 * The one page the preview draws as a REAL card rather than as a short body: PRD §10's concept
 * card, which is the card §10 argues about ("some clients want the full script on a concept card,
 * some don't") and the only page whose per-field configuration this ticket covers.
 *
 * Read out of the domain's own tuple rather than written as `'concepts'`, so no component and no
 * module here spells a page key (ticket criterion 9); `fields.test.ts` pins it to the page of
 * `defaultInterfaceConfig()` that carries the twelve concept fields, so a re-ordered tuple fails
 * there rather than silently previewing the wrong page.
 */
export const CONCEPT_CARD_PAGE_KEY: InterfacePageKey = INTERFACE_PAGE_KEYS[0];

/**
 * The short body each non-Concepts tab shows. The preview renders ONE real card — the concept card,
 * which is the card PRD §10 argues about ("some clients want the full script on a concept card,
 * some don't") — and says honestly what the other four pages are rather than drawing four fake
 * tables. Ticket criterion 7: "the other four tabs render a short placeholder body".
 *
 * Typed `Record<InterfacePageKey, string>`, so the domain's own tuple makes this exhaustive: a
 * sixth page cannot be added to `INTERFACE_PAGE_KEYS` without this failing to compile.
 */
export const PAGE_PREVIEW_BODY: Record<InterfacePageKey, string> = {
  concepts: 'One card per concept, with the fields switched on below.',
  creatives: 'The approved creatives, each with the client status and the comment box.',
  copywriting: 'The copy waiting on the client, each with its status and comment.',
  ugc: 'The creator deliveries, each with its status, note and tracking number.',
  partnership: 'The live partnership ads, view only — the client groups and filters, never edits.',
  calendar: 'Campaign dates and holidays — read-only timeline, no financial details.',
};

/** A client status as its chip: the domain's own label, and the tone that label earns. */
export interface ClientStatusView {
  readonly key: string;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The chip for a stored client status. A key this build does not know renders itself on a muted
 * chip rather than throwing or drawing an empty pill — the same choice `clientStatusView` makes on
 * the Client Queue.
 */
export function clientStatusView(status: string): ClientStatusView {
  const entry = CLIENT_STATUS.find((candidate) => candidate.key === status);
  return entry === undefined
    ? { key: status, label: status, tone: 'mute' }
    : { key: entry.key, label: entry.label, tone: chipTone(entry.label) };
}

/**
 * The minimum a concept row has to carry to be previewed. Declared structurally rather than
 * imported as `ConceptRow`, so this module — and therefore the client components that read it —
 * never reaches `@/lib/concepts-source` and never pulls `@tas/db` or `@tas/env` into the browser
 * bundle. `ConceptRow` satisfies it verbatim.
 *
 * The three prose fields are the ANGLE's (`angleDescription`, `anglePainPoints`, `angleUsp`), not
 * the concept's own `description`, `painPoints` and `usp`: PRD §5.7 derives the card's
 * "Description (hypothesis)", "Pain Points" and "USP" from the linked angle, and `clientConcepts`
 * — the reader behind the real client portal — prints the angle's text, so the preview must read
 * the same columns or a CSM would be shown a card the client never gets.
 */
export interface PreviewConceptSource {
  readonly name: string;
  readonly batch: string | null;
  readonly category: string | null;
  readonly conceptStyle: string | null;
  readonly angleName: string | null;
  readonly themeName: string | null;
  readonly productName: string | null;
  readonly personaName: string | null;
  readonly angleDescription: string | null;
  readonly anglePainPoints: string | null;
  readonly angleUsp: string | null;
  readonly hookExamples: string | null;
  readonly clientStatus: ClientStatusKey;
}

/**
 * One concept as the preview card renders it: the client status, and the value of every field the
 * configuration might switch on, keyed by `interface_fields.field_name`.
 *
 * A plain object rather than a `Map` because it crosses the server/client boundary — `page.tsx`
 * builds it, the client preview reads it.
 */
export interface ConceptPreview {
  readonly status: ClientStatusView;
  readonly values: Readonly<Record<string, string | null>>;
}

/**
 * The field names whose value is AUTO-GENERATED system output and therefore renders in `font-mono`
 * (design handoff: "concept names, creative names, IDs always use --mono"). The concept name is
 * `Batch-Angle-Theme` from `packages/domain/naming`; the batch is the code that name is built from.
 */
const MONO_FIELD_NAMES: ReadonlySet<string> = new Set(['concept_name', 'batch']);

/** True when this field's value is system output rather than prose. */
export function isMonoField(fieldName: string): boolean {
  return MONO_FIELD_NAMES.has(fieldName);
}

/**
 * Which concept column each of PRD §10's twelve concept fields prints.
 *
 * The keys are `interface_fields.field_name`, the storage vocabulary the domain's
 * `DEFAULT_CONCEPT_FIELDS` and `demoInterfaceConfig` both use. `fields.test.ts` asserts this covers
 * exactly the concept page of `defaultInterfaceConfig()` — no field left without a value, no value
 * for a field that no longer exists — so the twelve keys cannot drift from the twelve defaults.
 *
 * `script_idea` is NOT here: the full script is not one of §10's twelve concept-card fields, and
 * this preview shows what the configuration can switch on, not everything the row happens to store.
 *
 * `description`, `pain_points` and `usp` print the ANGLE's three fields — the ones the client
 * portal prints — never the concept's own prose columns of the same name, which are the
 * strategist's working text on the detail page (see `PreviewConceptSource`).
 */
export function conceptPreviewValues(
  concept: PreviewConceptSource,
): Readonly<Record<string, string | null>> {
  return {
    batch: concept.batch,
    category: concept.category,
    concept_name: concept.name,
    concept_style: concept.conceptStyle,
    angle: concept.angleName,
    theme: concept.themeName,
    product: concept.productName,
    description: concept.angleDescription,
    pain_points: concept.anglePainPoints,
    usp: concept.angleUsp,
    persona: concept.personaName,
    hook_examples: concept.hookExamples,
  };
}

/** The whole preview payload for one concept, built once on the server. */
export function conceptPreview(concept: PreviewConceptSource): ConceptPreview {
  return {
    status: clientStatusView(concept.clientStatus),
    values: conceptPreviewValues(concept),
  };
}

/** "3 of 12 fields" — what the tree says under a page, so a switched-off field is never silent. */
export function fieldCountLabel(visible: number, total: number): string {
  if (total === 0) {
    return 'no fields';
  }
  return `${String(visible)} of ${String(total)} ${total === 1 ? 'field' : 'fields'} visible`;
}

/** "4 of 5 pages" — the same sentence for the page level. */
export function pageCountLabel(enabled: number, total: number): string {
  return `${String(enabled)} of ${String(total)} ${total === 1 ? 'page' : 'pages'} on`;
}

/** The "Pages" section (Scope A, B4): heading, body, the kind chips and the push dialog. */
export const PAGES_SECTION_TITLE = 'Pages';
export const PAGES_SECTION_BODY =
  'Every page this brand\u2019s client sees, in order: the standard tabs, custom views and module pages. Switch a page off, move it a step, or reset a brand override to the template. An Admin can push a template page to every client, which opens a review request on the Propagation page.';
export const PAGE_KIND_LABELS: Readonly<Record<'standard' | 'custom' | 'module', string>> = {
  standard: 'standard tab',
  custom: 'custom view',
  module: 'module',
};
export const PUSH_DIALOG_TITLE = 'Push this page to every client?';
export const PUSH_DIALOG_BODY =
  'this opens a review request. Nothing reaches a client brand until an agency Admin approves it on the Propagation page; a brand that has customised the page keeps its own version.';
