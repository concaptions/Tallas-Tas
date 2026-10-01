import { expect, test, type Locator, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import {
  anglesPath,
  appPath,
  campaignsOffersPath,
  clientAssetsPath,
  collectionsPath,
  competitiveResearchPath,
  conceptsPath,
  copyTypesPath,
  creativeDesignPath,
  creativeDimensionsPath,
  creativeModulesPath,
  creativeReportingPath,
  creativeSheetPath,
  emailCampaignsPath,
  emailFlowsPath,
  metaCopywritingPath,
  personasPath,
  productsPath,
  smCampaignFeedPath,
  themesPath,
  ugcPath,
  youtubeCopywritingPath,
} from '../src/lib/routes';

/**
 * Airtable module parity (Prompt 4, item 1 of the module-parity work, 2026-10-01).
 *
 * One table, twenty-one rows: every sidebar section that stands in for a Gratsi base table — the
 * fifteen modules the Prompt 4 list names, then the six tables the sidebar already stood in for
 * (Angles, Concepts, Personas, Themes, UGC Management, Competitive Research). For each one the
 * test clicks the sidebar link by its exact accessible name, checks the URL and the `h1`, checks
 * the grid has at least one fixture row, opens the first row, and then asserts that the panel (or,
 * for Creative Design and Concepts, the detail page; for Themes, the card itself) shows a label
 * for EVERY stored field of the Gratsi table — "stored" meaning every field type except formula,
 * lookup, rollup, count, the created/modified timestamps, created-by, autonumber and button. The
 * ground truth is `gratsi-meta.json` (the live base `appllDG4OmkK2Hdnn`), read field by field; the
 * field-to-label mapping is spelled out per entry so a reviewer can check it against `fields.ts`
 * of each module (and, for the six later tables, against `TABLE_MAPPINGS` in
 * `packages/db/src/scripts/import-mappings.ts`, which names the column each Gratsi field lands in).
 *
 * WHAT COUNTS AS PRESENT. A label counts when the panel renders the field's platform name as the
 * text of a label-like element (Gratsi "Insta" would be "Instagram"; Gratsi "Interested" is
 * "Confirmed by Client"). A record link counts when the panel shows a picker or a read-only linked
 * list for it. A primary field the platform generates rather than types (the Copy # title, the §7
 * creative name, the Batch-Angle-Theme concept name — CLAUDE.md non-negotiable 6) is asserted as a
 * non-empty titled element instead.
 *
 * WHAT IS LEFT OUT, AND SAID SO. A stored field goes to `excluded` only when
 * `docs/audits/airtable-module-gap-2026-10-01.md` §2 documents it as dead (empty on every live row)
 * or as a deliberate drop, or when the register in `docs/decisions.md` ("2026-10-01 — Airtable
 * field exclusion register") names it; the reason cites which. Everything else is asserted, and a
 * field the panel does not label FAILS the module's test. Those known gaps are marked `gap:` inline
 * so the spec is honest about what it expects to fail until the panel grows the field.
 *
 * HOW A LABEL IS MATCHED. `getByText(label, { exact: true })` compares the WHOLE normalised text of
 * an element, and the design system nests a hint inside the label element itself —
 * `<label>Foreplay Link<span>optional</span></label>`, "read-only", "One link per line." — so an
 * exact whole-text match fails on every optional field although the label is plainly there. The
 * `:text-is("…")` engine instead matches an element whose OWN text node equals the label after
 * whitespace normalisation, case-sensitive (Playwright `textIsEngine`: `immediate.some(s =>
 * normalizeWhiteSpace(s) === text)`), which is exactly "this element is labelled X": a label that
 * merely contains the words does not match, and an ancestor never does. Nothing is relaxed.
 *
 * The per-field assertions are SOFT so one run reports every missing label of a module rather than
 * stopping at the first; the test still fails on any of them.
 */

/** A Gratsi stored field, asserted by the exact label the panel renders for it. */
interface LabelledField {
  /** The field's name in the Gratsi base, as `gratsi-meta.json` spells it. */
  readonly gratsi: string;
  /** The exact own text of the label the platform renders for it. */
  readonly label: string;
}

/**
 * A primary field the platform renders as a title, never as a labelled control: the generated Copy
 * # heading, the §7 creative name and the Batch-Angle-Theme concept name, and the one typed name a
 * card renders as its heading (the theme name). Asserted as a non-empty element by its `data-slot`.
 */
interface TitledField {
  readonly gratsi: string;
  readonly slot: string;
}

type FieldCheck = LabelledField | TitledField;

interface Exclusion {
  readonly field: string;
  /** Why the spec does not assert it, citing the audit section that documents the drop. */
  readonly reason: string;
}

interface ModuleEntry {
  /** The sidebar label, clicked by exact accessible name. */
  readonly label: string;
  /** The route constant the sidebar links to. */
  readonly path: string;
  /** The page's `h1`. */
  readonly heading: string;
  /** The `data-slot` of one grid row. */
  readonly rowSlot: string;
  /**
   * The element inside the row to click when the row's centre deliberately does not open the
   * panel (Meta Copywriting's centre cell is a link to the brief; its title cell opens the panel).
   */
  readonly clickSlot?: string;
  /**
   * The view tab to click before looking for rows. Only Creative Design needs it: its page opens on
   * the Kanban board by default (P2B), and the grid rows exist only in the Grid view.
   */
  readonly gridTab?: string;
  /**
   * Where the first row opens: a side panel on the same page, or a detail route. `inRow` is the
   * third shape, for Themes alone: a theme is a card and nothing else (PRD §5.5 — "a CARD, never a
   * table row"; the only form on the page is the create dialog), so no click is made and the labels
   * are looked for in the first card itself.
   */
  readonly opens:
    { readonly panelSlot: string } | { readonly detailMarker: string } | { readonly inRow: true };
  /** Every Gratsi stored field of the table that the panel is expected to label, in schema order. */
  readonly fields: readonly FieldCheck[];
  /** The stored fields deliberately not asserted, each with the audit's reason. */
  readonly excluded: readonly Exclusion[];
}

/**
 * The twenty-one modules: the fifteen in the order the task lists them, then the six Gratsi tables
 * the sidebar already stood in for, in sidebar order. Field order follows `gratsi-meta.json`.
 * Where the Gratsi name and the platform label differ, the pair says so; where a label is absent
 * from the panel today, the line is marked `gap:` and the assertion is expected to fail.
 */
const MODULES: readonly ModuleEntry[] = [
  {
    label: 'Meta Copywriting',
    path: metaCopywritingPath,
    heading: 'Meta Copywriting',
    rowSlot: 'copy-row',
    clickSlot: 'copy-row-title',
    opens: { panelSlot: 'copy-panel' },
    fields: [
      { gratsi: 'Copy #', slot: 'copy-panel-title' },
      { gratsi: 'Status', label: 'Status' },
      // gap: the inverse of collections.copywriting_id; the Meta panel lists no collections yet.
      { gratsi: 'Collections', label: 'Collections' },
      { gratsi: 'Descriptions', label: 'Primary Copy' },
      { gratsi: 'Headline', label: 'Headline' },
      { gratsi: 'News Feed', label: 'News Feed / Link Description' },
      { gratsi: 'CTA', label: 'CTA' },
      { gratsi: 'Campaign Code', label: 'Campaigns & Offers' },
      { gratsi: 'Funnel', label: 'Funnel' },
      { gratsi: 'Copy Type', label: 'Copy Types' },
      // gap: the panel renders this section only when the row carries a comment; the first fixture
      // row (Copy 1, newest edit) has none, so the label is absent although the field exists.
      { gratsi: "Client's Comment", label: "Client's Comment" },
      { gratsi: 'Creative', label: 'Linked Creative' },
      { gratsi: 'USED', label: 'Used' },
      { gratsi: 'Winning', label: 'Winning' },
      { gratsi: 'Meta Rating', label: 'Meta Rating' },
    ],
    excluded: [
      {
        field: '(Internal) Creative Design 2',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: '(Internal) Creative Design',
        reason:
          'second link to Creative Design beside Creative; one creative_brief_id is kept (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: '(Internal) Product',
        reason:
          'residual single-line text (same datum as Product) (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Creative Sheet',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Creative Reporting',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Angle',
        reason:
          'residual single-line text; the angle is the brief\'s angle_id (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Product',
        reason:
          'residual single-line text; the product is the brief\'s product_id (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: '⚠️ Please Change the Status of the copy',
        reason:
          'a UI-instruction banner, not data (audit §2.1; importer: "UI instruction, not data")',
      },
    ],
  },
  {
    label: 'Creative Design',
    path: creativeDesignPath,
    heading: 'Creative Design',
    rowSlot: 'brief-row',
    gridTab: 'Grid',
    opens: { detailMarker: 'brief-name' },
    fields: [
      { gratsi: 'Name', slot: 'brief-name' },
      { gratsi: 'Type', label: 'Type' },
      { gratsi: 'Priority', label: 'Priority' },
      { gratsi: 'Internal Status', label: 'Internal status' },
      { gratsi: 'Client Status', label: 'Client status' },
      { gratsi: 'Performance', label: 'Performance' },
      { gratsi: 'Assignee', label: 'Assignee' },
      { gratsi: 'Batch', label: 'Batch' },
      { gratsi: 'QA Checklist Doc', label: 'QA Checklist Doc' },
      { gratsi: 'Video Editor QA', label: 'Video Editor QA' },
      { gratsi: 'Graphic Designer QA', label: 'Graphic Designer QA' },
      { gratsi: 'Creative Strategist QA', label: 'Creative Strategist QA' },
      { gratsi: 'Angle', label: 'Angle' },
      { gratsi: 'Concept', label: 'Concept' },
      { gratsi: '(Internal) Product', label: 'Product' },
      { gratsi: 'Language', label: 'Language' },
      { gratsi: 'Design File', label: 'Design File' },
      { gratsi: 'Design Link URL', label: 'Design Link URL' },
      // The Gratsi attachments field maps to inspiration_image (audit §2.2).
      { gratsi: 'Inspiration', label: 'Inspiration Image' },
      { gratsi: 'Brief to Design/Editing', label: 'Brief to Design' },
      { gratsi: 'Script / Ad Content', label: 'Script or Ad Content' },
      { gratsi: 'Platform', label: 'Platform' },
      { gratsi: 'Dimensions', label: 'Dimensions' },
      { gratsi: 'Source', label: 'Source' },
      { gratsi: 'Funnel', label: 'Funnel' },
      { gratsi: 'Elements we are Testing', label: 'Elements we are Testing' },
      { gratsi: 'Offer', label: 'Offer' },
      { gratsi: 'Creative Module', label: 'Creative Modules' },
      // The Airtable checkbox trigger is the page's spell-check button.
      { gratsi: 'Click for AI Spell Checker Again', label: 'Run AI spell check' },
      { gratsi: 'Spelling Feedback', label: 'Spelling Feedback' },
      { gratsi: 'Spelling Feedback 2', label: 'Spelling Feedback 2' },
      { gratsi: '(Internal) Collections 3', label: 'Collection' },
      { gratsi: 'Creative Sheet', label: 'Creative Sheet' },
      { gratsi: 'Meta Copywriting', label: 'Meta Copywriting' },
      { gratsi: 'Script & brief breakdown', label: 'Script & Brief Breakdown' },
    ],
    excluded: [
      {
        field: 'Ads Copywriting copy',
        reason:
          'inverse of the excluded second Meta link; "Meta Copywriting" is the mapped one (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: '(Internal) Collections 2',
        reason:
          'dead residual text column, empty on all 390 live rows; the real link is "(Internal) Collections 3" (audit §2.2)',
      },
      {
        field: 'Angles',
        reason:
          'dead residual text column, empty on all 390 live rows; the real link is "Angle" (audit §2.2)',
      },
    ],
  },
  {
    label: 'Creative Sheet',
    path: creativeSheetPath,
    heading: 'Creative Sheet',
    rowSlot: 'creative-sheet-row',
    opens: { panelSlot: 'creative-sheet-panel' },
    fields: [
      { gratsi: 'Creative Name', label: 'Creative Name' },
      { gratsi: 'Internal Status', label: 'Internal Status' },
      { gratsi: 'Status', label: 'Status' },
      { gratsi: 'QA Checklist Doc', label: 'QA Checklist Doc' },
      { gratsi: 'Video Editor QA', label: 'Video Editor QA' },
      { gratsi: 'Graphic Designer QA', label: 'Graphic Designer QA' },
      { gratsi: 'Creative Strategist QA', label: 'Creative Strategist QA' },
      { gratsi: "Client's Comments", label: "Client's Comments" },
      { gratsi: 'Used', label: 'Used' },
      { gratsi: 'Denied/revisions needed', label: 'Denied / revisions needed' },
      { gratsi: 'Winning', label: 'Winning' },
      { gratsi: 'Click for AI Spell Checker Again', label: 'Click for AI Spell Checker Again' },
      { gratsi: 'Spelling Feedback', label: 'Spelling Feedback' },
    ],
    excluded: [],
  },
  {
    label: 'Creative Modules',
    path: creativeModulesPath,
    heading: 'Creative Modules',
    rowSlot: 'creative-module-row',
    opens: { panelSlot: 'creative-module-panel' },
    fields: [
      { gratsi: 'Module Name', label: 'Module Name' },
      // Gratsi's "Concepts" links the Angles table (audit §2.4); the panel names it honestly.
      { gratsi: 'Concepts', label: 'Angles' },
      { gratsi: 'Foreplay Link', label: 'Foreplay Link' },
      { gratsi: '(Internal) Creative Design', label: 'Creative Designs' },
    ],
    excluded: [],
  },
  {
    label: 'SM Campaign Feed',
    path: smCampaignFeedPath,
    heading: 'SM Campaign Feed',
    rowSlot: 'sm-task-row',
    opens: { panelSlot: 'sm-task-panel' },
    fields: [
      { gratsi: 'Task Name', label: 'Task Name' },
      { gratsi: 'Platform', label: 'Platform' },
      { gratsi: 'Due Date', label: 'Due Date (UTC)' },
      { gratsi: 'Status', label: 'Status' },
      { gratsi: 'Notes', label: 'Notes' },
    ],
    excluded: [],
  },
  {
    label: 'Campaigns & Offers',
    path: campaignsOffersPath,
    heading: 'Campaigns & Offers',
    rowSlot: 'campaign-row',
    opens: { panelSlot: 'campaign-panel' },
    fields: [
      { gratsi: 'Holiday', label: 'Holiday' },
      { gratsi: 'Official Date', label: 'Official Date' },
      { gratsi: 'Country', label: 'Country' },
      { gratsi: 'Description', label: 'Description' },
      { gratsi: 'Promotional Ideas', label: 'Promotional Ideas' },
      // Gratsi "Interested" is the template's "Confirmed by Client" (audit §2.6).
      { gratsi: 'Interested', label: 'Confirmed by Client' },
      { gratsi: 'Launched', label: 'Launched' },
      { gratsi: 'Ads Launch Date', label: 'Ads Launch Date' },
      { gratsi: 'Ads End Date', label: 'Ads End Date' },
      { gratsi: 'Discount Offer', label: 'Discount Offer' },
      { gratsi: 'Code', label: 'Code' },
      { gratsi: 'Collections', label: 'Linked collections' },
      // "COPY" links Youtube Copywriting (audit §1 row 6).
      { gratsi: 'COPY', label: 'YouTube copy' },
      // Despite its name, "Angles" links the Concepts table (audit §1 row 6).
      { gratsi: 'Angles', label: 'Concepts' },
      { gratsi: 'Email Campaigns', label: 'Email campaigns' },
      // "Email Campaigns Management copy" links Email Flows Management (audit §1 row 6).
      { gratsi: 'Email Campaigns Management copy', label: 'Email flows' },
      // "Ads Copywriting copy" links Meta Copywriting (audit §1 row 6).
      { gratsi: 'Ads Copywriting copy', label: 'Meta copy' },
    ],
    excluded: [
      {
        field: 'Design attached',
        reason:
          'loose single-line text with no target (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
    ],
  },
  {
    label: 'Products',
    path: productsPath,
    heading: 'Products',
    rowSlot: 'product-row',
    opens: { panelSlot: 'product-panel' },
    fields: [
      { gratsi: 'Product Name / Landing Page Name', label: 'Product Name' },
      { gratsi: 'Link', label: 'Landing Page URL' },
      { gratsi: 'Angles', label: 'Linked angles' },
      // "Table 17" links Email Campaigns Management (audit §1 row 7).
      { gratsi: 'Table 17', label: 'Email campaigns' },
      { gratsi: 'Youtube Copywriting', label: 'YouTube copy' },
      { gratsi: '(Internal) Creative Design', label: 'Creative Designs' },
      { gratsi: 'UGC Management', label: 'Creators' },
    ],
    excluded: [
      {
        field: 'Creative Sheet',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Email Campaigns Management copy (2nd)',
        reason:
          'the second field of that name (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Email Campaigns Management copy',
        reason:
          'residual single-line text, twice-named; email campaigns arrive through "Table 17" (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: '(Internal) Creative Design 2',
        reason:
          'residual single-line text; the structured link is "(Internal) Creative Design" (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
    ],
  },
  {
    label: 'Collections',
    path: collectionsPath,
    heading: 'Collections',
    rowSlot: 'collection-row',
    opens: { panelSlot: 'collection-panel' },
    fields: [
      { gratsi: 'Main Collection', label: 'Collection Name' },
      { gratsi: 'URL', label: 'URL' },
      // "Copywriting" (→ Youtube Copywriting) is collections.copywriting_id (audit §2.8).
      // gap: "Copywriting" links YOUTUBE copy in Gratsi (youtube_copy_collections); no list on the panel yet.
      { gratsi: 'Copywriting', label: 'YouTube copy' },
      { gratsi: 'Campaigns & Offers', label: 'Campaign' },
      // gap: despite its name "Angles" links CONCEPTS in Gratsi (concept_collections); no list on the panel yet.
      { gratsi: 'Angles', label: 'Concepts' },
      // Gratsi stores loose text where Drizzle has product_id; same datum (audit §2.8).
      { gratsi: '(Internal) Product', label: 'Product ID' },
      { gratsi: '(Internal) Creative Design', label: 'Creative Designs' },
      // The text variant plausibly maps to creative_design_note (audit §2.8).
      { gratsi: '(Internal) Creative Design 2', label: 'Creative Design Note' },
      // "Table 17" links Email Campaigns Management (audit §1 row 8).
      { gratsi: 'Table 17', label: 'Email campaigns' },
      // The Meta Copywriting link is collections.copywriting_id, shown as the panel's "Meta copy".
      { gratsi: 'Ads Copywriting copy', label: 'Meta copy' },
    ],
    excluded: [
      {
        field: 'Email Campaigns Management copy (2nd)',
        reason:
          'the second field of that name (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Email Campaigns Management copy',
        reason:
          'residual single-line text, twice-named; email campaigns arrive through "Table 17" (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Creative Sheet',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
    ],
  },
  {
    label: 'Client Assets',
    path: clientAssetsPath,
    heading: 'Client Assets',
    rowSlot: 'client-asset-folder-row',
    opens: { panelSlot: 'client-asset-panel' },
    fields: [
      { gratsi: 'Name [Folder]', label: 'Folder Name' },
      { gratsi: 'Description', label: 'Description' },
      { gratsi: 'Location', label: 'Location' },
      { gratsi: '(Internal) Creative Design', label: 'Creative Designs' },
    ],
    excluded: [],
  },
  {
    label: 'Email Campaigns',
    path: emailCampaignsPath,
    heading: 'Email Campaigns',
    rowSlot: 'email-campaign-row',
    opens: { panelSlot: 'email-campaign-panel' },
    fields: [
      { gratsi: 'Name', label: 'Name' },
      { gratsi: 'Campaign Purpose', label: 'Campaign Purpose' },
      { gratsi: 'Status', label: 'Status' },
      { gratsi: 'Send Date', label: 'Send Date' },
      { gratsi: 'Copywriting', label: 'Copywriting' },
      { gratsi: 'Assignee', label: 'Assignee' },
      { gratsi: 'Copy Link', label: 'Copy Link' },
      { gratsi: 'Design', label: 'Design' },
      { gratsi: 'Klaviyo Link', label: 'Klaviyo Link' },
      { gratsi: 'Assets', label: 'Assets' },
      { gratsi: 'Type', label: 'Type' },
      { gratsi: 'Channel', label: 'Channel' },
      { gratsi: 'Campaigns & Offers', label: 'Campaigns & Offers' },
      { gratsi: '(Internal) Product', label: 'Products' },
      { gratsi: '(Internal) Collections', label: 'Collections' },
    ],
    excluded: [],
  },
  {
    label: 'Email Flows',
    path: emailFlowsPath,
    heading: 'Email Flows',
    rowSlot: 'email-flow-row',
    opens: { panelSlot: 'email-flow-panel' },
    fields: [
      { gratsi: 'Flow Name', label: 'Flow Name' },
      { gratsi: 'Expected Setup Date', label: 'Expected Setup Date' },
      { gratsi: 'Flow Purpose', label: 'Flow Purpose' },
      { gratsi: 'Status', label: 'Status' },
      { gratsi: 'Copywriting', label: 'Copywriting' },
      { gratsi: 'Design', label: 'Design' },
      { gratsi: 'Klaviyo Link', label: 'Klaviyo Link' },
      { gratsi: 'Type', label: 'Type' },
      { gratsi: 'Campaigns & Offers', label: 'Campaigns & Offers' },
      { gratsi: 'Inspo', label: 'Inspo' },
      { gratsi: 'Assignee', label: 'Assignee' },
    ],
    excluded: [],
  },
  {
    label: 'YouTube Copywriting',
    path: youtubeCopywritingPath,
    heading: 'YouTube Copywriting',
    rowSlot: 'youtube-copy-row',
    opens: { panelSlot: 'youtube-copy-panel' },
    fields: [
      { gratsi: 'Copy #', label: 'Copy #' },
      { gratsi: 'Status', label: 'Status' },
      { gratsi: 'Collections', label: 'Collections' },
      { gratsi: 'Product', label: 'Product' },
      { gratsi: 'Angle', label: 'Angle' },
      { gratsi: 'Descriptions (90 caractères max)', label: 'Descriptions' },
      { gratsi: 'Headline', label: 'Headline' },
      { gratsi: 'News Feed', label: 'News Feed' },
      { gratsi: 'CTA', label: 'CTA' },
      { gratsi: 'Campaign Code', label: 'Campaign Code' },
      { gratsi: 'Funnel', label: 'Funnel' },
      { gratsi: 'Copy Type', label: 'Copy Type' },
      { gratsi: "Client's Comment", label: "Client's Comment" },
      { gratsi: 'USED', label: 'Used' },
      { gratsi: 'Winning', label: 'Winning' },
      { gratsi: 'Meta Rating', label: 'Meta Rating' },
      // The text remnant is the same datum as the Product link (audit §2.12).
      { gratsi: '(Internal) Product', label: 'Product' },
    ],
    excluded: [
      {
        field: '(Internal) Creative Design',
        reason:
          'residual single-line text; youtube_copy has no brief link because the base\'s field is not one (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Creative Sheet',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Creative Reporting',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: '⚠️ Please Change the Status of the copy',
        reason:
          'the same UI-instruction banner Meta Copywriting carries, not data (audit §2.1 reasoning; §2.12 lists the table as structurally identical)',
      },
    ],
  },
  {
    label: 'Creative Reporting',
    path: creativeReportingPath,
    heading: 'Creative Reporting',
    rowSlot: 'creative-report-row',
    opens: { panelSlot: 'creative-report-panel' },
    fields: [
      { gratsi: 'Name + Angle + Offer', label: 'Name + Angle + Offer' },
      { gratsi: 'Notes', label: 'Notes' },
      { gratsi: 'Ad Design', label: 'Ad Design' },
      { gratsi: 'Ad Link', label: 'Ad Link' },
      { gratsi: 'CTR', label: 'CTR' },
      { gratsi: 'Thumb-Stop Rate', label: 'Thumb-Stop Rate' },
      { gratsi: 'Results', label: 'Results' },
      { gratsi: 'CPA', label: 'CPA' },
      { gratsi: 'Target CPA', label: 'Target CPA' },
      { gratsi: 'ROAS', label: 'ROAS' },
      { gratsi: 'Target ROAS', label: 'Target ROAS' },
    ],
    excluded: [],
  },
  {
    label: 'Copy Types',
    path: copyTypesPath,
    heading: 'Copy Types',
    rowSlot: 'copy-type-row',
    opens: { panelSlot: 'copy-type-panel' },
    fields: [
      { gratsi: 'Name', label: 'Name' },
      { gratsi: 'Description', label: 'Description' },
      // "Copywriting" is the YouTube side of the link (audit §2.13).
      { gratsi: 'Copywriting', label: 'YouTube copies' },
      // "Ads Copywriting copy" is the Meta side of the link (audit §2.13).
      { gratsi: 'Ads Copywriting copy', label: 'Meta copies' },
    ],
    excluded: [],
  },
  {
    label: 'Creative Dimensions',
    path: creativeDimensionsPath,
    heading: 'Creative Dimensions',
    rowSlot: 'creative-dimension-row',
    opens: { panelSlot: 'creative-dimension-panel' },
    fields: [
      { gratsi: 'Name', label: 'Name' },
      { gratsi: 'Dimensions', label: 'Dimensions' },
      { gratsi: 'Link Description', label: 'Link Description' },
      { gratsi: '(Internal) Creative Design', label: 'Creative Design ID' },
    ],
    excluded: [],
  },
  // ── The six Gratsi tables the sidebar already stood in for, in sidebar order ──
  {
    label: 'Personas',
    path: personasPath,
    heading: 'Personas',
    rowSlot: 'persona-row',
    opens: { panelSlot: 'persona-panel' },
    fields: [
      { gratsi: 'Name', label: 'Persona Name' },
      // Gratsi's "Description" (two spaces before the bracket, as the base spells it) is the
      // demographic column (import-mappings: 'Airtable "Description" maps to demographic').
      { gratsi: 'Description  [Age Status Salary]', label: 'Demographic' },
      { gratsi: 'Personality', label: 'Psychographic' },
      { gratsi: 'Drivers for this persona', label: 'Emotional Triggers' },
      { gratsi: 'Passion', label: 'Core Desires' },
      // Despite its name the field links the CONCEPTS table; the platform infers angle_personas
      // from it and the panel lists those angles read-only under "Linked angles".
      { gratsi: 'Angles', label: 'Linked angles' },
      { gratsi: 'Problem-Solution Awareness Level', label: 'Stage of Market Awareness' },
    ],
    excluded: [],
  },
  {
    label: 'Angles',
    path: anglesPath,
    heading: 'Angles',
    rowSlot: 'angle-row',
    opens: { panelSlot: 'angle-panel' },
    fields: [
      { gratsi: 'Name', label: 'Angle Name' },
      // The approval track (angleStatuses), its own "Approval" section under the six groups.
      { gratsi: 'Status', label: 'Status' },
      // gap: the `potential` column groups the Kanban view but the panel has no control for it.
      { gratsi: 'Potential', label: 'Potential' },
      { gratsi: 'Description', label: 'Description' },
      // gap: the reverse of concept_angles is not listed on the panel ("Linked work" lists only
      // the creative modules).
      { gratsi: 'Concepts', label: 'Concepts' },
      // The reverse of creative_module_angles, read-only under "Linked work".
      { gratsi: '(Internal) Creative Modules', label: 'Creative modules' },
      // gap: `formats` reaches the form only as hidden inputs; no toggle row or label renders it.
      { gratsi: 'Formats to create', label: 'Formats to create' },
      // gap: the `client_notes` column has no field in the panel.
      { gratsi: 'Client Notes', label: 'Client Notes' },
      { gratsi: 'Brief', label: 'Brief URL' },
      { gratsi: 'Exact Script', label: 'Exact Script URL' },
      // gap: `ad_inspo_links` is validated by the panel but no link editor or label renders it
      // (the "Inspiration" group the panel's own doc describes is not among ANGLE_FIELD_GROUPS).
      { gratsi: 'Ad Inspo', label: 'Ad Inspo' },
      // gap: the `winning` checkbox column has no field in the panel.
      { gratsi: 'Winning', label: 'Winning' },
      // gap: the `internal_notes` column has no field in the panel.
      { gratsi: 'Internal Notes', label: 'Internal Notes' },
      // gap: the reverse of creative_briefs.angle_id is not listed on the panel.
      { gratsi: '(Internal) Creative Design 2', label: 'Creative Designs' },
    ],
    excluded: [
      {
        field: 'Creators',
        reason:
          'a UGC Management link with no mapped inverse, empty on all 43 live rows; creators reach angles through their concepts (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: '(Internal) Creative Design',
        reason:
          'residual single-line text; the structured link is "(Internal) Creative Design 2" → creative_briefs.angle_id (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Creative Sheet',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'UGC Management copy',
        reason:
          'residual single-line text left by a converted link (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
      {
        field: 'Concepts copy',
        reason:
          'residual single-line text (concept names); the structured link "Concepts" → concept_angles carries the same pairs (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
    ],
  },
  {
    label: 'Themes',
    path: themesPath,
    heading: 'Themes',
    rowSlot: 'theme-card',
    opens: { inRow: true },
    fields: [
      // The typed name is the card's heading (ticket criterion 4: name, category chip, usage).
      { gratsi: 'Name', slot: 'theme-name' },
      // gap: the card prints the note unlabelled ([data-slot="theme-note"], and only when set).
      { gratsi: 'Notes', label: 'Notes' },
      // gap: the `assignee_id` column is not rendered anywhere on the page.
      { gratsi: 'Assignee', label: 'Assignee' },
      // gap: the card renders the status as an unlabelled StatusChip beside the category chip.
      { gratsi: 'Status', label: 'Status' },
      // gap: the `attachments` column is not rendered; the card's link chips are reference_links,
      // a Drizzle-only column (audit §2.16).
      { gratsi: 'Attachments', label: 'Attachments' },
      // gap: the aiText snapshot column `ai_attachment_summary` is imported (audit §2.16) but not
      // rendered.
      { gratsi: 'Attachment Summary', label: 'Attachment Summary' },
    ],
    excluded: [],
  },
  {
    label: 'Concepts',
    path: conceptsPath,
    heading: 'Concepts',
    rowSlot: 'concept-row',
    opens: { detailMarker: 'concept-name-preview' },
    fields: [
      // Batch-Angle-Theme, generated (CLAUDE.md non-negotiable 6): the NamePreview heading.
      { gratsi: 'Name', slot: 'concept-name-preview' },
      { gratsi: 'Batch', label: 'Batch' },
      // Gratsi stores the theme as a multi-select; the platform resolves it by name into
      // concept_themes and the Pairing picks it.
      { gratsi: 'Theme', label: 'Theme' },
      { gratsi: 'Angle', label: 'Angle' },
      { gratsi: 'Category', label: 'Category' },
      { gratsi: 'Style', label: 'Concept Style' },
      // Gratsi "Type" is concepts.formats (import-mappings), the second toggle row of the Brief.
      { gratsi: 'Type', label: 'Formats to create' },
      // Gratsi pairs Product and Personas on the concept; the importer infers angle_products and
      // angle_personas from them, and the detail reads both back read-only "from Angle".
      { gratsi: 'Product', label: 'Product' },
      { gratsi: 'Personas', label: 'Persona' },
      // Gratsi "Status" is concepts.approval_status (import-mappings).
      { gratsi: 'Status', label: 'Approval Status' },
      // The live base's own spelling of the field (import-mappings).
      { gratsi: 'Decription', label: 'Description' },
      { gratsi: 'Script', label: 'Script idea' },
      // gap: the concept_collections junction is not listed on the detail page.
      { gratsi: 'Collection', label: 'Collections' },
      { gratsi: 'Pain Points', label: 'Pain Points' },
      { gratsi: 'USP', label: 'USP' },
      { gratsi: 'Hooks', label: 'Hook examples' },
      { gratsi: "Client's Comments", label: "Client's Comments" },
      // The inverse of UGC Management › "Concept to film" (creator_concepts): the detail's
      // Creator picker reads the junction set (`concept.creatorIds[0]`).
      { gratsi: 'UGC Management', label: 'Creator' },
      // The inverse of Campaigns & Offers › "Angles" (campaign_concepts), read-only in the rail.
      { gratsi: 'Campaigns & Offers', label: 'Campaigns & Offers' },
      // The inverse of creative_briefs.concept_id, read-only in the rail.
      { gratsi: '(Internal) Creative Design', label: 'Creatives' },
    ],
    excluded: [
      {
        field: 'Production Status',
        reason:
          'stored (concepts.production_status round-trips through a hidden input) but deliberately not shown: Talal, 2026-09-28, "take it out" — docs/tickets/in-progress/sprint-p1-airtable-schema-parity.md (P2B: hide the field, keep the column)',
      },
      {
        field: 'UGC Management copy',
        reason:
          'residual single-line text; the creator link is "UGC Management" ↔ "Concept to film" (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
    ],
  },
  {
    label: 'Competitive Research',
    path: competitiveResearchPath,
    heading: 'Competitive Research',
    rowSlot: 'competitive-research-row',
    opens: { panelSlot: 'competitive-research-panel' },
    fields: [
      { gratsi: 'Name', label: 'Name' },
      { gratsi: 'Type', label: 'Type' },
      { gratsi: 'Website', label: 'Website' },
      { gratsi: 'Insta', label: 'Instagram' },
      { gratsi: 'FB Page', label: 'Facebook Page' },
      { gratsi: 'Meta Ads Library', label: 'Meta Ads Library' },
      { gratsi: 'Analysis', label: 'Analysis' },
    ],
    excluded: [],
  },
  {
    label: 'UGC Management',
    path: ugcPath,
    heading: 'UGC Management',
    // The Creators tab and the card grid are the page's defaults, so no tab click is needed.
    rowSlot: 'creator-card',
    opens: { panelSlot: 'creator-panel' },
    fields: [
      { gratsi: 'Creator name (Filled by UGC Manager)', label: 'Name' },
      // gap: `internal_creator_status` is a labelled chip on the CARD ("Internal") but the panel
      // has no control or label for it.
      { gratsi: 'Status', label: 'Internal Status' },
      // gap: the `date_of_management` column has no field in the panel.
      { gratsi: 'Date of Management', label: 'Date of Management' },
      { gratsi: 'Age', label: 'Age Bracket' },
      { gratsi: 'Gender', label: 'Gender' },
      { gratsi: 'Ethnicity', label: 'Ethnicity' },
      { gratsi: 'Concept to film', label: 'Linked Concepts' },
      { gratsi: 'Products', label: 'Linked Products' },
      // gap: the `budget_per_60s` column has no field in the panel.
      { gratsi: 'Budget per 60sec video', label: 'Budget per 60sec Video' },
      // gap: `partnership_activity` is a column of the Partnership Ads TAB, not of the panel.
      { gratsi: 'Partnership Activity', label: 'Partnership Activity' },
      // gap: `video_intro_url` feeds the gallery view only; the panel has no field for it.
      { gratsi: "Creator's video Intro", label: 'Video Intro' },
      // gap: `profile_pic_url` is the card's avatar; the panel has no field for it.
      { gratsi: "Creator's Profile Pic", label: 'Profile Picture' },
      // gap: the `facebook_profile_url` column has no field in the panel.
      { gratsi: 'Facebook Profile for Partnership', label: 'Facebook Profile' },
      { gratsi: 'Platform', label: 'Platform' },
      // gap: the `client_note` column has no field in the panel.
      { gratsi: "(Client's) Note or Comments", label: "Client's Note" },
      { gratsi: 'Additional Note - TAS Team', label: 'Internal Brief' },
      // The panel's "Creator Cost (USD)" is this field's platform name — BUT its input is bound to
      // `cost_usd`, the column the importer fills from "Paid by TAS" below, while `creator_cost`
      // (this field's column) is never read by the UI. The label assertion cannot see a binding;
      // the fix is to bind this label to creator_cost and give Paid by TAS its own field.
      { gratsi: "Creator's cost (USD) - Internal", label: 'Creator Cost (USD)' },
      { gratsi: 'Raw assets', label: 'Raw Assets URL' },
      { gratsi: 'Shipping Location', label: 'Shipping Location' },
      // The live field name carries a trailing space (import-mappings).
      { gratsi: 'Tracking Number ', label: 'Tracking Number' },
      { gratsi: 'Creator Link', label: 'Creator Link' },
      // gap: `client_status` is a labelled chip on the CARD ("Client") but the panel has no
      // control or label for it.
      { gratsi: 'Creator Status', label: 'Client Status' },
      // gap: `cost_usd` has no label of its own; see "Creator's cost (USD) - Internal" above.
      { gratsi: 'Paid by TAS', label: 'Paid by TAS (USD)' },
      { gratsi: 'Payment Date', label: 'Payment Date' },
      { gratsi: 'Creator Info Request', label: 'Creator Info Request' },
      // gap: `partnership_activated_at` is the Partnership Ads tab's "Activated" column, not a
      // panel field.
      { gratsi: 'Date of Partnership Activation', label: 'Date of Partnership Activation' },
      // The live field name carries a trailing space (import-mappings).
      { gratsi: 'Slack Notified ', label: 'Slack Notified' },
      // gap: `partnership_period_days` is the Partnership Ads tab's "Period" column, not a panel
      // field.
      { gratsi: 'Partnership Time Period (days)', label: 'Partnership Time Period (days)' },
      // gap: the `continue_working_with` column has no field in the panel.
      { gratsi: 'Continue Working With?', label: 'Continue Working With?' },
      // gap: `extension_days` is folded into the Partnership Ads tab's "Period" column, not a
      // panel field.
      { gratsi: 'Extension Time Period', label: 'Extension Time Period' },
      { gratsi: 'Partnership Price per 30 days', label: 'Partnership Price / 30 Days (USD)' },
      // gap: the `partnership_notes` column has no field in the panel.
      { gratsi: 'Notes for Partnership ads', label: 'Notes for Partnership Ads' },
      // gap: `instagram_username` is the Partnership Ads tab's column, not a panel field.
      { gratsi: 'Instagram Username', label: 'Instagram Username' },
    ],
    excluded: [
      {
        field: 'Concepts',
        reason:
          'second link to Concepts beside "Concept to film", empty on all 70 live rows (docs/decisions.md "Airtable field exclusion register" (2026-10-01))',
      },
    ],
  },
];

/**
 * The first navigation into a route compiles it (`next dev`), and with four parallel workers the
 * compile can outlast the 15s expect timeout; the URL and heading expectations get this budget and
 * nothing else does (the same reasoning as `playwright.config.ts`).
 */
const COLD_ROUTE_TIMEOUT = 45_000;

/**
 * A label is in the DOM the moment its panel is, so a present one resolves on the first poll; this
 * is only how long a MISSING label costs before its soft failure is recorded.
 */
const LABEL_TIMEOUT = 5_000;

/**
 * The element whose own text node is exactly `label`, whitespace-normalised and case-sensitive: the
 * `:text-is()` engine. A label element that also nests a hint span ("optional", "read-only") still
 * matches on its own text; an element that merely contains the words, or an ancestor, never does.
 */
function labelIn(scope: Locator, label: string): Locator {
  // `:not(option)` keeps a Select's option that happens to carry the label text ("Copywriting" is
  // both an Assignee option and a field) from counting; `.first()` because a panel may legitimately
  // show the text as a group heading AND as the field's own label, and one labelled element is the
  // claim being tested.
  return scope.locator(`:not(option):text-is(${JSON.stringify(label)})`).first();
}

/**
 * The sidebar click, the URL, the heading, the rows, and the first row opened. Returns the element
 * every field label is looked for in: the side panel, the detail page's `<main>`, or — for a row
 * that is the whole record — the row itself.
 */
async function openFirstRow(page: Page, entry: ModuleEntry): Promise<Locator> {
  await page.goto(appPath);

  const link = page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: entry.label, exact: true });
  await expect(link).toHaveAttribute('href', entry.path);
  await link.click();

  await expect(page).toHaveURL((url) => url.pathname === entry.path, {
    timeout: COLD_ROUTE_TIMEOUT,
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.heading, {
    timeout: COLD_ROUTE_TIMEOUT,
  });

  if (entry.gridTab !== undefined) {
    await page.getByRole('tab', { name: entry.gridTab, exact: true }).click();
  }

  const rows = page.locator(`[data-slot="${entry.rowSlot}"]`);
  await expect(rows.first()).toBeVisible({ timeout: COLD_ROUTE_TIMEOUT });
  expect(await rows.count()).toBeGreaterThanOrEqual(1);
  const firstRow = rows.first();

  // The row is the whole record (Themes): nothing opens, so the card is where the labels live.
  if ('inRow' in entry.opens) {
    return firstRow;
  }

  await (
    entry.clickSlot === undefined ? firstRow : firstRow.locator(`[data-slot="${entry.clickSlot}"]`)
  ).click();

  if ('panelSlot' in entry.opens) {
    const panel = page.locator(`[data-slot="${entry.opens.panelSlot}"]`);
    await expect(panel).toBeVisible();
    return panel;
  }

  // A row click navigates to the record's own route; the marker proves the detail page rendered.
  await expect(page).toHaveURL((url) => url.pathname.startsWith(`${entry.path}/`), {
    timeout: COLD_ROUTE_TIMEOUT,
  });
  await expect(page.locator(`[data-slot="${entry.opens.detailMarker}"]`)).toBeVisible({
    timeout: COLD_ROUTE_TIMEOUT,
  });
  return page.getByRole('main');
}

test('the table names the twenty-one Airtable modules once each, with no field asserted twice', () => {
  expect(MODULES).toHaveLength(21);
  expect(new Set(MODULES.map((entry) => entry.label)).size).toBe(21);
  expect(new Set(MODULES.map((entry) => entry.path)).size).toBe(21);
  for (const entry of MODULES) {
    const names = [
      ...entry.fields.map((field) => field.gratsi),
      ...entry.excluded.map((exclusion) => exclusion.field),
    ];
    expect(new Set(names).size, `${entry.label} lists a Gratsi field twice`).toBe(names.length);
  }
});

test.describe('Airtable module parity in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the module pages need a session and real data',
  );

  // Each missing label is a soft failure that waits LABEL_TIMEOUT before it is recorded, and one
  // run must report EVERY missing label of a module, so the test budget is widened to hold them
  // all behind a cold route compile. No assertion is relaxed by it.
  test.describe.configure({ timeout: 180_000 });

  for (const entry of MODULES) {
    test(`${entry.label}: the first row shows a label for every Gratsi stored field`, async ({
      page,
    }) => {
      const scope = await openFirstRow(page, entry);
      const where =
        'panelSlot' in entry.opens
          ? `[data-slot="${entry.opens.panelSlot}"]`
          : 'inRow' in entry.opens
            ? `the first [data-slot="${entry.rowSlot}"]`
            : 'the detail page';

      for (const field of entry.fields) {
        if ('slot' in field) {
          await expect
            .soft(
              scope.locator(`[data-slot="${field.slot}"]`),
              `${entry.label}: Gratsi field "${field.gratsi}" is rendered as the generated title [data-slot="${field.slot}"], which is empty or absent in ${where}`,
            )
            .toHaveText(/\S/, { timeout: LABEL_TIMEOUT });
          continue;
        }
        await expect
          .soft(
            labelIn(scope, field.label),
            `${entry.label}: Gratsi field "${field.gratsi}" has no visible label "${field.label}" in ${where}`,
          )
          .toBeVisible({ timeout: LABEL_TIMEOUT });
      }
    });
  }
});
