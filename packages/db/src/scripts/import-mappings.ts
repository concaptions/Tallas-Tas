/**
 * Complete Airtable → Drizzle field mapping for the Gratsi base (appllDG4OmkK2Hdnn).
 * Generated from the live Airtable schema + Drizzle schema audit on 2026-09-23; extended on
 * 2026-10-01 (Prompt 3) when the last seven live tables got a Drizzle home and the importer began
 * reading EVERY table of the base. The ids below are documentation only — the fetcher resolves
 * tables by NAME (`airtable-tables.ts`). The engine (`../airtable-import.ts`) is the source of truth
 * for what is written; its dry run prints the per-table UNMAPPED-FIELDS list straight from the
 * export, so this file no longer has to enumerate every lookup a table carries.
 *
 * Handler types:
 *   text         singleLineText | multilineText → Drizzle text
 *   richText     richText → Drizzle text (strip to plain for V0)
 *   number       number | percent | rating → Drizzle integer | numeric
 *   currency     currency → Drizzle integer (whole dollars)
 *   select       singleSelect → Drizzle text (with enum constraint)
 *   multiSelect  multipleSelects → Drizzle jsonb array
 *   checkbox     checkbox → Drizzle boolean
 *   date         date → Drizzle date (ISO string)
 *   dateTime     dateTime → Drizzle timestamptz
 *   singleLink   multipleRecordLinks (take first) → Drizzle uuid FK
 *   multiLink    multipleRecordLinks → junction table inserts
 *   attachment   multipleAttachments → jsonb array of URLs
 *   collaborator singleCollaborator → text (extract name or id)
 *   aiText       aiText → Drizzle text
 *   formula      formula field → take computed value as text
 *   skip         no Drizzle column, computed, or reverse link
 */

export type HandlerType =
  | 'text'
  | 'richText'
  | 'number'
  | 'currency'
  | 'select'
  | 'multiSelect'
  | 'checkbox'
  | 'date'
  | 'dateTime'
  | 'singleLink'
  | 'multiLink'
  | 'attachment'
  | 'collaborator'
  | 'aiText'
  | 'formula'
  | 'skip';

export interface FieldMapping {
  readonly drizzleColumn: string | null;
  readonly handler: HandlerType;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly junctionTable?: string;
  readonly note?: string;
}

export interface TableMapping {
  readonly airtableTable: string;
  readonly airtableTableId: string;
  readonly drizzleImport: string;
  readonly importOrder: number;
  readonly isGlobal?: boolean;
  readonly fields: Record<string, FieldMapping>;
}

export const TABLE_MAPPINGS: Record<string, TableMapping> = {
  products: {
    airtableTable: '(Internal) Product',
    airtableTableId: 'tblfvfJMYNBz2OYYw',
    drizzleImport: 'products',
    importOrder: 1,
    fields: {
      'Product Name / Landing Page Name': {
        drizzleColumn: 'name',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      Link: { drizzleColumn: 'link', handler: 'text', required: true, default: '' },
      Angles: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Angles › Product into angle_products (the gate derives this from inverseLinkFieldId)',
      },
      'UGC Management': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from UGC Management › Products into creator_products (the gate derives this from inverseLinkFieldId)',
      },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Creative Design › (Internal) Product into creative_briefs.product_id (the gate derives this from inverseLinkFieldId)',
      },
      '(Internal) Creative Design 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Youtube Copywriting': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Youtube Copywriting › Product into youtube_copy_products (the gate derives this from inverseLinkFieldId)',
      },
      'Creative Sheet': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Email Campaigns Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Table 17': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Email Campaigns Management › (Internal) Product into email_campaign_products (the gate derives this from inverseLinkFieldId)',
      },
    },
  },

  themes: {
    airtableTable: 'Themes',
    airtableTableId: 'tbl1aFLMJXxhdVKiz',
    drizzleImport: 'themes',
    importOrder: 2,
    isGlobal: true,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      Notes: { drizzleColumn: 'notes', handler: 'text' },
      Assignee: {
        drizzleColumn: 'assigneeId',
        handler: 'collaborator',
        note: 'Extract collaborator name or id',
      },
      Status: { drizzleColumn: 'status', handler: 'select' },
      Attachments: {
        drizzleColumn: 'attachments',
        handler: 'attachment',
        note: 'Array of attachment URLs',
      },
      'Attachment Summary': { drizzleColumn: 'aiAttachmentSummary', handler: 'aiText' },
    },
  },

  campaignsOffers: {
    airtableTable: 'Campaigns & Offers',
    airtableTableId: 'tblRNaWCVa1cCIwLL',
    drizzleImport: 'campaignsOffers',
    importOrder: 3,
    fields: {
      Name: {
        drizzleColumn: 'name',
        handler: 'formula',
        required: true,
        default: 'Untitled',
        note: 'Formula: CONCATENATE({Holiday},"-",{Discount Offer},"-",{Code})',
      },
      Holiday: { drizzleColumn: 'holiday', handler: 'text' },
      'Official Date': { drizzleColumn: 'officialDate', handler: 'date' },
      Country: { drizzleColumn: 'country', handler: 'text' },
      Description: { drizzleColumn: 'description', handler: 'text' },
      'Promotional Ideas': { drizzleColumn: 'promotionalIdeas', handler: 'richText' },
      Interested: {
        drizzleColumn: 'confirmedByClient',
        handler: 'checkbox',
        note: 'Airtable "Interested" maps to confirmedByClient',
      },
      Launched: { drizzleColumn: 'launched', handler: 'checkbox' },
      'Ads Launch Date': { drizzleColumn: 'adsLaunchDate', handler: 'date' },
      'Ads End Date': { drizzleColumn: 'adsEndDate', handler: 'date' },
      'Discount Offer': { drizzleColumn: 'discountOffer', handler: 'text' },
      Code: { drizzleColumn: 'code', handler: 'text' },
      Collections: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from (Internal) Collections › Campaigns & Offers into collections.campaign_id (the gate derives this from inverseLinkFieldId)',
      },
      Product: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'multipleLookupValues, not a direct link',
      },
      COPY: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Youtube Copywriting › Campaign Code into youtube_copy_campaigns (the gate derives this from inverseLinkFieldId)',
      },
      Angles: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'campaignConcepts',
        note: 'Links the CONCEPTS table despite its name (schema/campaign-links.ts)',
      },
      'Design attached': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Email Campaigns': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Email Campaigns Management › Campaigns & Offers into email_campaign_campaigns (the gate derives this from inverseLinkFieldId)',
      },
      'Email Campaigns Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Email Flows Management › Campaigns & Offers into email_flow_campaigns (the gate derives this from inverseLinkFieldId)',
      },
      'Ads Copywriting copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Meta Copywriting › Campaign Code into copywriting_campaigns (the gate derives this from inverseLinkFieldId)',
      },
    },
  },

  personas: {
    airtableTable: 'Personas',
    airtableTableId: 'tblyt7X4VjHxtMDVS',
    drizzleImport: 'personas',
    importOrder: 4,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      'Description  [Age Status Salary]': {
        drizzleColumn: 'demographic',
        handler: 'text',
        note: 'Airtable "Description" maps to demographic',
      },
      Personality: {
        drizzleColumn: 'psychographic',
        handler: 'richText',
        note: 'Rich text → plain text',
      },
      'Drivers for this persona': {
        drizzleColumn: 'coreDesires',
        handler: 'richText',
        note: 'Gratsi\'s name for the template\'s "Core Desires (Cashvertising)" — read through PERSONA_FIELDS.coreDesires',
      },
      Passion: {
        drizzleColumn: 'passion',
        handler: 'richText',
        note: "Gratsi's own field; its own column since 0044, never folded into a neighbour",
      },
      Angles: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Angles › Personas into angle_personas (the gate derives this from inverseLinkFieldId)',
      },
      'Problem-Solution Awareness Level': {
        drizzleColumn: 'stageOfAwareness',
        handler: 'select',
        note: 'Map Airtable select values to awareness_stage enum keys',
      },
    },
  },

  angles: {
    airtableTable: 'Angles',
    airtableTableId: 'tblRlcp1ibmS7U7HG',
    drizzleImport: 'angles',
    importOrder: 5,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      Status: {
        drizzleColumn: 'status',
        handler: 'select',
        note: 'The approval track (angleStatuses tuple); Potential and Winning are separate columns',
      },
      Potential: { drizzleColumn: 'potential', handler: 'select' },
      Description: { drizzleColumn: 'description', handler: 'text' },
      Creators: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Link to UGC Management with no mapped inverse; empty on all 43 live rows; excluded in docs/decisions.md',
      },
      Concepts: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Concepts › Angles into concept_angles (the gate derives this from inverseLinkFieldId)',
      },
      'Product (from Angles)': { drizzleColumn: null, handler: 'skip', note: 'Lookup field' },
      'Personas (from Angles)': { drizzleColumn: null, handler: 'skip', note: 'Lookup field' },
      '(Internal) Creative Modules': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from (Internal) Creative Modules › Concepts (which links Angles) into creative_module_angles (the gate derives this from inverseLinkFieldId)',
      },
      'Formats to create': {
        drizzleColumn: 'formats',
        handler: 'multiSelect',
        note: 'Maps to AngleFormat[] jsonb',
      },
      'Client Notes': { drizzleColumn: 'clientNotes', handler: 'text' },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      Brief: { drizzleColumn: 'briefUrl', handler: 'text' },
      'Exact Script': { drizzleColumn: 'exactScriptUrl', handler: 'text' },
      'Ad Inspo': {
        drizzleColumn: 'adInspoLinks',
        handler: 'text',
        note: 'Multiline text → split by newline into string[] jsonb',
      },
      Winning: { drizzleColumn: 'winning', handler: 'checkbox' },
      'Internal Notes': { drizzleColumn: 'internalNotes', handler: 'text' },
      'Creative Sheet': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      '(Internal) Creative Design 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Creative Design › Angle into creative_briefs.angle_id (the gate derives this from inverseLinkFieldId)',
      },
      'UGC Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Concepts copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
    },
  },

  concepts: {
    airtableTable: 'Concepts',
    airtableTableId: 'tbl4UFSFcynlS2Pkn',
    drizzleImport: 'concepts',
    importOrder: 6,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      Batch: { drizzleColumn: 'batch', handler: 'select' },
      Theme: {
        drizzleColumn: null,
        handler: 'multiSelect',
        junctionTable: 'conceptThemes',
        note: 'multipleSelects in Gratsi (not a record link): matched by theme NAME against the global themes library',
      },
      Angle: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'conceptAngles',
        note: 'Resolve angle IDs in Pass 2',
      },
      Category: { drizzleColumn: 'category', handler: 'select' },
      Style: { drizzleColumn: 'conceptStyle', handler: 'select' },
      'Production Status': {
        drizzleColumn: 'productionStatus',
        handler: 'select',
        note: 'Map to ConceptProductionStatus enum values',
      },
      Type: {
        drizzleColumn: 'formats',
        handler: 'multiSelect',
        note: 'Airtable "Type" multiSelects → concepts.formats jsonb',
      },
      Performance: {
        drizzleColumn: 'performance',
        handler: 'select',
        note: 'Live options carry a parenthetical ("Winning (ROAS/CPA Goal)"); stored as the bare grade of creativePerformances',
      },
      Product: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'angleProducts',
        note: "Gratsi pairs the product on the concept; the importer infers angle_products for each of the concept's angles so the angle → product inheritance chain lights up",
      },
      Personas: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'anglePersonas',
        note: "As Product: inferred angle_personas across the concept's angles",
      },
      Status: {
        drizzleColumn: 'clientApprovalStatus',
        handler: 'select',
        note: 'Airtable "Status" → clientApprovalStatus in the one client vocabulary (SMOKE-18 / 0064 mapping); the legacy column is frozen and never written',
      },
      Decription: {
        drizzleColumn: 'description',
        handler: 'text',
        note: "The live base's own spelling of the field",
      },
      Script: { drizzleColumn: 'scriptIdea', handler: 'richText' },
      Collection: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'conceptCollections',
        note: 'Resolve collection IDs in Pass 2',
      },
      'Pain Points': { drizzleColumn: 'painPoints', handler: 'richText' },
      USP: { drizzleColumn: 'usp', handler: 'richText' },
      Hooks: { drizzleColumn: 'hookExamples', handler: 'richText' },
      "Client's Comments": { drizzleColumn: 'clientComments', handler: 'text' },
      'UGC Management': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from UGC Management › Concept to film into creator_concepts (the gate derives this from inverseLinkFieldId)',
      },
      'Campaigns & Offers': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Campaigns & Offers › Angles (which links Concepts) into campaign_concepts (the gate derives this from inverseLinkFieldId)',
      },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Creative Design › Concept into creative_briefs.concept_id (the gate derives this from inverseLinkFieldId)',
      },
      'UGC Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
    },
  },

  collections: {
    airtableTable: '(Internal) Collections',
    airtableTableId: 'tbl6LBNrRqa6Hh4I2',
    drizzleImport: 'collections',
    importOrder: 7,
    fields: {
      'Main Collection': {
        drizzleColumn: 'name',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      URL: { drizzleColumn: 'url', handler: 'text' },
      Copywriting: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Links YOUTUBE Copywriting in Gratsi; written from Youtube Copywriting › Collections into youtube_copy_collections (the gate derives this from inverseLinkFieldId)',
      },
      'Campaigns & Offers': {
        drizzleColumn: 'campaignId',
        handler: 'singleLink',
        note: 'Resolve campaign ID in Pass 2 — existing script has a BUG: resolves against conceptMap',
      },
      'Creative Sheet': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      Angles: {
        drizzleColumn: null,
        handler: 'skip',
        junctionTable: 'conceptCollections',
        note: 'Misnamed: links CONCEPTS in Gratsi; written from Concepts › Collections into concept_collections',
      },
      '(Internal) Product': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Single-line text in Gratsi where the platform has product_id; empty on all 5 live rows; excluded in docs/decisions.md',
      },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Creative Design › (Internal) Collections 3 into creative_briefs.collection_id (the gate derives this from inverseLinkFieldId)',
      },
      '(Internal) Creative Design 2': {
        drizzleColumn: 'creativeDesignNote',
        handler: 'text',
        note: 'Loose text beside the real link; kept as the design note',
      },
      'Table 17': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Email Campaigns Management › (Internal) Collections into email_campaign_collections (the gate derives this from inverseLinkFieldId)',
      },
      'Email Campaigns Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Ads Copywriting copy': {
        drizzleColumn: 'copywritingId',
        handler: 'singleLink',
        note: 'The Meta Copywriting link (the template base named it Copywriting); resolved in Pass 2',
      },
    },
  },

  creativeBriefs: {
    airtableTable: 'Creative Design (Internal & Interface)',
    airtableTableId: 'tblhU5yVNhVDwykUt',
    drizzleImport: 'creativeBriefs',
    importOrder: 8,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      Type: { drizzleColumn: 'type', handler: 'select', note: 'Map to CreativeType enum' },
      Priority: { drizzleColumn: 'priority', handler: 'select', note: 'Map to CreativePriority' },
      'Internal Status': {
        drizzleColumn: 'internalStatus',
        handler: 'select',
        note: 'Map Airtable select values to domain state keys',
      },
      'Client Status': {
        drizzleColumn: 'clientStatus',
        handler: 'select',
        note: 'Map Airtable select values to domain state keys',
      },
      Performance: { drizzleColumn: 'performance', handler: 'select' },
      Assignee: {
        drizzleColumn: 'assignee',
        handler: 'collaborator',
        note: 'Extract collaborator name',
      },
      Batch: { drizzleColumn: 'batch', handler: 'select' },
      'QA Checklist Doc': {
        drizzleColumn: 'qaChecklistDoc',
        handler: 'attachment',
        note: 'Array of attachment URLs',
      },
      'Video Editor QA': { drizzleColumn: 'qaVideoEditor', handler: 'checkbox' },
      'Graphic Designer QA': { drizzleColumn: 'qaDesigner', handler: 'checkbox' },
      'Creative Strategist QA': { drizzleColumn: 'qaStrategist', handler: 'checkbox' },
      Angle: {
        drizzleColumn: 'angleId',
        handler: 'singleLink',
        note: 'Resolve angle ID in Pass 2 (multipleRecordLinks, take first)',
      },
      Concept: {
        drizzleColumn: 'conceptId',
        handler: 'singleLink',
        note: 'Resolve concept ID in Pass 2',
      },
      '(Internal) Product': {
        drizzleColumn: 'productId',
        handler: 'singleLink',
        note: 'Resolve product ID in Pass 2',
      },
      Language: { drizzleColumn: 'language', handler: 'select', note: 'Map to CreativeLanguage' },
      'Design File': {
        drizzleColumn: 'designFile',
        handler: 'attachment',
        note: 'Array of attachment URLs',
      },
      'Design Link URL': { drizzleColumn: 'designFileUrl', handler: 'text' },
      Inspiration: {
        drizzleColumn: 'inspirationImage',
        handler: 'attachment',
        note: 'Array of attachment URLs',
      },
      'Brief to Design/Editing': { drizzleColumn: 'briefToDesign', handler: 'richText' },
      'Script / Ad Content': {
        drizzleColumn: 'scriptContent',
        handler: 'richText',
        note: 'Maps to scriptContent. adContent gets same value.',
      },
      Platform: {
        drizzleColumn: 'platform',
        handler: 'multiSelect',
        note: 'multipleSelects → CreativePlatform[] jsonb',
      },
      Dimensions: {
        drizzleColumn: 'dimensions',
        handler: 'multiLink',
        note: 'Links to Creative Dimensions table. Resolve to dimension names in Pass 2.',
      },
      Source: { drizzleColumn: 'source', handler: 'select', note: 'Map to CreativeSource' },
      Funnel: { drizzleColumn: 'funnel', handler: 'select', note: 'Map to CreativeFunnel' },
      'Elements we are Testing': { drizzleColumn: 'elementsTested', handler: 'richText' },
      Offer: { drizzleColumn: 'offer', handler: 'richText' },
      'Creative Module': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from (Internal) Creative Modules › (Internal) Creative Design into creative_module_designs (the gate derives this from inverseLinkFieldId)',
      },
      'Last Modified': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Use updatedAt from baseColumns',
      },
      Created: { drizzleColumn: null, handler: 'skip', note: 'Use createdAt from baseColumns' },
      'Click for AI Spell Checker Again': {
        drizzleColumn: 'clickForAiSpellChecker',
        handler: 'checkbox',
      },
      'Spelling Feedback': { drizzleColumn: 'spellingFeedback', handler: 'text' },
      'Spelling Feedback 2': { drizzleColumn: 'spellingFeedback2', handler: 'text' },
      '(Internal) Collections 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Internal ref text',
      },
      '(Internal) Collections 3': {
        drizzleColumn: 'collectionId',
        handler: 'singleLink',
        note: 'Resolve collection ID in Pass 2',
      },
      'Creative Sheet': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Creative Sheet › Creative Name into creative_sheet_items.brief_id (the gate derives this from inverseLinkFieldId)',
      },
      'Ads Copywriting copy': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      'Meta Copywriting': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      'Script & brief breakdown ': {
        drizzleColumn: 'scriptAndBriefBreakdown',
        handler: 'attachment',
        note: 'Array of attachment URLs. Note trailing space in Airtable field name.',
      },
      Angles: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'singleLineText, not a link. Angle resolved via Angle field above.',
      },
      'Concepts (from Angles)': { drizzleColumn: null, handler: 'skip', note: 'Lookup field' },
    },
  },

  copywriting: {
    airtableTable: 'Meta Copywriting',
    airtableTableId: 'tblZpBYPTcZcmQ1Kf',
    drizzleImport: 'copywriting',
    importOrder: 9,
    fields: {
      'Copy #': {
        drizzleColumn: 'copyNumber',
        handler: 'text',
        note: 'Parse to integer. Airtable stores as text (e.g. "Copy 1").',
      },
      Status: {
        drizzleColumn: 'status',
        handler: 'select',
        note: 'Map to COPY_STATUS domain keys',
      },
      Collections: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Link to Collections whose inverse (Ads Copywriting copy) is unmapped; 0 Meta rows in the base; excluded in docs/decisions.md',
      },
      Product: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      Angle: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      Descriptions: {
        drizzleColumn: 'primaryCopy',
        handler: 'richText',
        note: 'Rich text → plain text for primaryCopy',
      },
      Headline: { drizzleColumn: 'headline', handler: 'text' },
      'News Feed': {
        drizzleColumn: 'linkDescription',
        handler: 'text',
        note: 'Airtable "News Feed" = Meta link description field',
      },
      CTA: { drizzleColumn: 'cta', handler: 'select', note: 'Map to CopyCta enum values' },
      'Campaign Code': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'copywritingCampaigns',
        note: 'Resolve campaign IDs in Pass 2',
      },
      Offer: { drizzleColumn: null, handler: 'skip', note: 'Lookup from campaign' },
      'Campaign (from Campaign)': { drizzleColumn: null, handler: 'skip', note: 'Lookup' },
      'Code (from Campaign)': { drizzleColumn: null, handler: 'skip', note: 'Lookup' },
      Funnel: { drizzleColumn: 'funnel', handler: 'select', note: 'Map to CopyFunnel values' },
      'Copy Type': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'copywritingCopyTypes',
        note: 'Resolve copy-type IDs in Pass 2 (rows live in copy_types)',
      },
      "Client's Comment": { drizzleColumn: 'clientComment', handler: 'text' },
      Creative: {
        drizzleColumn: 'creativeBriefId',
        handler: 'singleLink',
        note: 'Resolve creative brief ID in Pass 2',
      },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Second link to Creative Design beside Creative; the platform keeps one creative_brief_id; excluded in docs/decisions.md',
      },
      'Collection URL': { drizzleColumn: null, handler: 'skip', note: 'Lookup' },
      'Link (from Product)': { drizzleColumn: null, handler: 'skip', note: 'Lookup' },
      USED: { drizzleColumn: 'used', handler: 'checkbox' },
      Winning: { drizzleColumn: 'winning', handler: 'checkbox' },
      'Meta Rating': {
        drizzleColumn: 'metaRating',
        handler: 'number',
        note: 'Rating field (1-5) → integer',
      },
      'Products (from Collections)': { drizzleColumn: null, handler: 'skip', note: 'Lookup' },
      'Created By': { drizzleColumn: null, handler: 'skip', note: 'Use createdBy from audit cols' },
      'Creative Reporting': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Creative Sheet': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      '(Internal) Product': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      '⚠️ Please Change the Status of the copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'UI instruction, not data',
      },
      '(Internal) Creative Design 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
    },
  },

  creators: {
    airtableTable: 'UGC Management',
    airtableTableId: 'tblRsVqiqUaZRcQYd',
    drizzleImport: 'creators',
    importOrder: 10,
    fields: {
      'Creator name (Filled by UGC Manager)': {
        drizzleColumn: 'name',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      Status: {
        drizzleColumn: 'internalCreatorStatus',
        handler: 'select',
        note: 'Map Airtable select values to CREATOR_INTERNAL_STATUS keys',
      },
      'Date of Management': { drizzleColumn: 'dateOfManagement', handler: 'date' },
      Age: {
        drizzleColumn: 'ageBracket',
        handler: 'select',
        note: 'Map to CreatorAgeBracket values',
      },
      Gender: { drizzleColumn: 'gender', handler: 'select' },
      Ethnicity: { drizzleColumn: 'ethnicity', handler: 'text' },
      'Concept to film': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'creatorConcepts',
        note: 'Resolve concept IDs in Pass 2',
      },
      Products: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'creatorProducts',
        note: 'Resolve product IDs in Pass 2',
      },
      'Budget per 60sec video': { drizzleColumn: 'budgetPer60s', handler: 'currency' },
      'Partnership Activity': {
        drizzleColumn: 'partnershipActivity',
        handler: 'select',
        note: 'Map to active/not_active/ended',
      },
      "Creator's video Intro": {
        drizzleColumn: 'videoIntroUrl',
        handler: 'attachment',
        note: 'Extract first attachment URL',
      },
      "Creator's Profile Pic": {
        drizzleColumn: 'profilePicUrl',
        handler: 'attachment',
        note: 'Extract first attachment URL',
      },
      'Facebook Profile for Partnership': {
        drizzleColumn: 'facebookProfileUrl',
        handler: 'richText',
        note: 'Rich text → extract URL or plain text',
      },
      Platform: {
        drizzleColumn: 'platform',
        handler: 'select',
        note: 'singleSelect in Gratsi → wrap in array for jsonb CreatorPlatform[]',
      },
      "(Client's) Note or Comments": { drizzleColumn: 'clientNote', handler: 'text' },
      'Additional Note - TAS Team': { drizzleColumn: 'internalBrief', handler: 'richText' },
      "Creator's cost (USD) - Internal": { drizzleColumn: 'creatorCost', handler: 'currency' },
      'Raw assets': { drizzleColumn: 'rawAssetsUrl', handler: 'text' },
      'Shipping Location': { drizzleColumn: 'shippingLocation', handler: 'text' },
      'Tracking Number ': {
        drizzleColumn: 'trackingNumber',
        handler: 'text',
        note: 'Note trailing space in Airtable field name',
      },
      'Creator Link': { drizzleColumn: 'creatorLink', handler: 'text' },
      'Creator Status': {
        drizzleColumn: 'clientStatus',
        handler: 'select',
        note: 'Map to CREATOR_CLIENT_STATUS keys',
      },
      'Paid by TAS': {
        drizzleColumn: 'costUsd',
        handler: 'currency',
        note: 'Payment by TAS → costUsd column',
      },
      'Payment Date': { drizzleColumn: 'paymentDate', handler: 'date' },
      Concepts: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Second link to Concepts beside Concept to film, empty on all 70 live rows; excluded in docs/decisions.md',
      },
      'Creator Info Request': { drizzleColumn: 'creatorInfoRequest', handler: 'richText' },
      "Creator's cost (USD)": {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Formula (cost + 5% fee); computed server-side',
      },
      'Date of Partnership Activation': {
        drizzleColumn: 'partnershipActivatedAt',
        handler: 'date',
      },
      'Notify Flag': { drizzleColumn: null, handler: 'skip', note: 'Formula, computed' },
      'Slack Notified ': {
        drizzleColumn: 'slackNotified',
        handler: 'checkbox',
        note: 'The live field name carries a trailing space',
      },
      'Partnership Time Period (days)': {
        drizzleColumn: 'partnershipPeriodDays',
        handler: 'number',
      },
      'Continue Working With?': {
        drizzleColumn: 'continueWorkingWith',
        handler: 'select',
        note: 'Map singleSelect (Yes/No/TBD) to boolean (Yes=true, No=false, else=null)',
      },
      'Extension Time Period': {
        drizzleColumn: 'extensionDays',
        handler: 'select',
        note: 'singleSelect of day values (e.g. "30 days") → parse to integer',
      },
      'Partnership Price per 30 days': {
        drizzleColumn: 'partnershipPricePer30Days',
        handler: 'currency',
      },
      'Notes for Partnership ads': { drizzleColumn: 'partnershipNotes', handler: 'text' },
      'Instagram Username': { drizzleColumn: 'instagramUsername', handler: 'text' },
    },
  },

  // ── Prompt 3 (2026-10-01): the seven tables the importer used to skip, plus Youtube Copywriting ──
  // Only STORED fields are listed; lookups/formulas/system fields show up in the dry run's
  // UNMAPPED-FIELDS report instead of being enumerated here.

  copyTypes: {
    airtableTable: '(Internal) Copy Type',
    airtableTableId: 'tblQiBPj9ypCmYxev',
    drizzleImport: 'copyTypes',
    importOrder: 11,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      Description: { drizzleColumn: 'description', handler: 'text' },
      Copywriting: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Youtube Copywriting › Copy Type into youtube_copy_copy_types (the gate derives this from inverseLinkFieldId)',
      },
      'Ads Copywriting copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Meta Copywriting › Copy Type into copywriting_copy_types (the gate derives this from inverseLinkFieldId)',
      },
    },
  },

  youtubeCopy: {
    airtableTable: 'Youtube Copywriting',
    airtableTableId: 'tblVR1UmkbDoDzJ7z',
    drizzleImport: 'youtubeCopy',
    importOrder: 12,
    fields: {
      'Copy #': { drizzleColumn: 'copyNumber', handler: 'text', note: 'Parse to integer' },
      Status: { drizzleColumn: 'status', handler: 'select', note: 'COPY_STATUS keys' },
      Angle: { drizzleColumn: 'angle', handler: 'text' },
      'Descriptions (90 caractères max)': { drizzleColumn: 'descriptions', handler: 'richText' },
      Headline: { drizzleColumn: 'headline', handler: 'text' },
      'News Feed': { drizzleColumn: 'newsFeed', handler: 'text' },
      CTA: { drizzleColumn: 'cta', handler: 'select', note: 'youtubeCopyCtas keys' },
      Funnel: { drizzleColumn: 'funnel', handler: 'select', note: 'youtubeCopyFunnels keys' },
      "Client's Comment": { drizzleColumn: 'clientComment', handler: 'text' },
      USED: { drizzleColumn: 'used', handler: 'checkbox' },
      Winning: { drizzleColumn: 'winning', handler: 'checkbox' },
      'Meta Rating': { drizzleColumn: 'metaRating', handler: 'number', note: 'rating → integer' },
      Collections: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'youtubeCopyCollections',
      },
      Product: { drizzleColumn: null, handler: 'multiLink', junctionTable: 'youtubeCopyProducts' },
      'Campaign Code': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'youtubeCopyCampaigns',
      },
      'Copy Type': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'youtubeCopyCopyTypes',
      },
      'Creative Reporting': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      'Creative Sheet': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      '(Internal) Product': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Residual single-line text left by a converted link; excluded in docs/decisions.md',
      },
      '⚠️ Please Change the Status of the copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'UI instruction banner, not data; excluded in docs/decisions.md',
      },
    },
  },

  creativeModules: {
    airtableTable: '(Internal) Creative Modules',
    airtableTableId: 'tblzS73a9JrJGiV2J',
    drizzleImport: 'creativeModules',
    importOrder: 13,
    fields: {
      'Module Name': {
        drizzleColumn: 'moduleName',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      'Foreplay Link': { drizzleColumn: 'foreplayLink', handler: 'text' },
      Concepts: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'creativeModuleAngles',
        note: 'Links the ANGLES table despite its name (schema/creative-modules.ts)',
      },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'creativeModuleDesigns',
      },
    },
  },

  creativeSheetItems: {
    airtableTable: 'Creative Sheet',
    airtableTableId: 'tblGC0TxnHI7lKaNQ',
    drizzleImport: 'creativeSheetItems',
    importOrder: 14,
    fields: {
      Name: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Formula (month + brief name); computed by the query layer',
      },
      'Creative Name': {
        drizzleColumn: 'briefId',
        handler: 'singleLink',
        note: 'First link → creative_briefs; nullable',
      },
      'Internal Status': {
        drizzleColumn: 'internalStatus',
        handler: 'select',
        note: 'creativeSheetInternalStatuses keys',
      },
      Status: { drizzleColumn: 'status', handler: 'select', note: 'creativeSheetStatuses keys' },
      'QA Checklist Doc': { drizzleColumn: 'qaChecklistDoc', handler: 'attachment' },
      'Video Editor QA': { drizzleColumn: 'qaVideoEditor', handler: 'checkbox' },
      'Graphic Designer QA': { drizzleColumn: 'qaDesigner', handler: 'checkbox' },
      'Creative Strategist QA': { drizzleColumn: 'qaStrategist', handler: 'checkbox' },
      "Client's Comments": { drizzleColumn: 'clientComments', handler: 'text' },
      Used: { drizzleColumn: 'used', handler: 'checkbox' },
      'Denied/revisions needed': { drizzleColumn: 'deniedRevisionsNeeded', handler: 'checkbox' },
      Winning: { drizzleColumn: 'winning', handler: 'select', note: 'creativeSheetWinning keys' },
      'Click for AI Spell Checker Again': {
        drizzleColumn: 'spellCheckRequested',
        handler: 'checkbox',
      },
      'Spelling Feedback': { drizzleColumn: 'spellingFeedback', handler: 'text' },
    },
  },

  smCampaignFeedTasks: {
    airtableTable: 'SM Campaign Management Feed',
    airtableTableId: 'tblLRajTW55XEhVhk',
    drizzleImport: 'smCampaignFeedTasks',
    importOrder: 15,
    fields: {
      'Task Name': {
        drizzleColumn: 'taskName',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      Platform: { drizzleColumn: 'platform', handler: 'select', note: 'smPlatforms keys' },
      'Due Date': { drizzleColumn: 'dueDate', handler: 'dateTime' },
      Status: { drizzleColumn: 'status', handler: 'select', note: 'smTaskStatuses keys' },
      Notes: { drizzleColumn: 'notes', handler: 'text' },
      'Reminder Trigger': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Clock-dependent formula; computed by the query layer',
      },
    },
  },

  emailCampaigns: {
    airtableTable: 'Email Campaigns Management',
    airtableTableId: 'tblABjVpwRpYtY7de',
    drizzleImport: 'emailCampaigns',
    importOrder: 16,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      'Campaign Purpose': { drizzleColumn: 'campaignPurpose', handler: 'text' },
      Status: { drizzleColumn: 'status', handler: 'select', note: 'emailCampaignStatuses keys' },
      'Send Date': { drizzleColumn: 'sendDate', handler: 'date' },
      Copywriting: { drizzleColumn: 'copywriting', handler: 'richText' },
      Assignee: { drizzleColumn: 'assigneeId', handler: 'collaborator' },
      'Copy Link': { drizzleColumn: 'copyLink', handler: 'text' },
      Design: { drizzleColumn: 'design', handler: 'attachment' },
      'Klaviyo Link': { drizzleColumn: 'klaviyoLink', handler: 'text' },
      Assets: { drizzleColumn: 'assets', handler: 'attachment' },
      Type: { drizzleColumn: 'type', handler: 'select', note: 'emailCampaignTypes keys' },
      Channel: { drizzleColumn: 'channel', handler: 'select', note: 'emailChannels keys' },
      'Campaigns & Offers': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'emailCampaignCampaigns',
      },
      '(Internal) Product': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'emailCampaignProducts',
      },
      '(Internal) Collections': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'emailCampaignCollections',
      },
      'Copywriting Due Date': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Formula off Send Date',
      },
      'Design Due Date': { drizzleColumn: null, handler: 'skip', note: 'Formula off Send Date' },
    },
  },

  emailFlows: {
    airtableTable: 'Email Flows Management',
    airtableTableId: 'tblubVflAQZgJSxcF',
    drizzleImport: 'emailFlows',
    importOrder: 17,
    fields: {
      'Flow Name': {
        drizzleColumn: 'flowName',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      'Expected Setup Date': { drizzleColumn: 'expectedSetupDate', handler: 'date' },
      'Flow Purpose': { drizzleColumn: 'flowPurpose', handler: 'text' },
      Status: { drizzleColumn: 'status', handler: 'select', note: 'emailFlowStatuses keys' },
      Copywriting: { drizzleColumn: 'copywriting', handler: 'richText' },
      Design: { drizzleColumn: 'design', handler: 'attachment' },
      'Klaviyo Link': { drizzleColumn: 'klaviyoLink', handler: 'text' },
      Type: { drizzleColumn: 'type', handler: 'select', note: 'emailChannels keys' },
      Inspo: { drizzleColumn: 'inspo', handler: 'attachment' },
      Assignee: { drizzleColumn: 'assigneeId', handler: 'collaborator' },
      'Campaigns & Offers': {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'emailFlowCampaigns',
      },
      'Copywriting Due Date': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Formula off Expected Setup Date',
      },
      'Design Due Date': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Formula off Expected Setup Date',
      },
    },
  },

  creativeReporting: {
    airtableTable: 'Creative Reporting',
    airtableTableId: 'tblgW4bwDSSeqihlr',
    drizzleImport: 'creativeReporting',
    importOrder: 18,
    fields: {
      'Name + Angle + Offer': {
        drizzleColumn: 'nameAngleOffer',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      Notes: { drizzleColumn: 'notes', handler: 'text' },
      'Ad Design': { drizzleColumn: 'adDesign', handler: 'attachment' },
      'Ad Link': { drizzleColumn: 'adLink', handler: 'text' },
      CTR: {
        drizzleColumn: 'ctr',
        handler: 'number',
        note: 'percent → numeric(6,4) as a fraction',
      },
      'Thumb-Stop Rate': { drizzleColumn: 'thumbStopRate', handler: 'number' },
      Results: { drizzleColumn: 'results', handler: 'number' },
      CPA: { drizzleColumn: 'cpa', handler: 'currency', note: 'numeric(10,2), cents kept' },
      'Target CPA': { drizzleColumn: 'targetCpa', handler: 'currency', note: 'numeric(10,2)' },
      ROAS: { drizzleColumn: 'roas', handler: 'number' },
      'Target ROAS': { drizzleColumn: 'targetRoas', handler: 'number' },
      'Difference CPA': { drizzleColumn: null, handler: 'skip', note: 'Formula: cpa - target_cpa' },
      'Creative Name': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Invalid formula in the base',
      },
      'Creative Name (from Creative)': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Orphaned lookup; brief_id has no live Airtable source',
      },
    },
  },

  competitiveResearch: {
    airtableTable: 'Competitive research',
    airtableTableId: 'tbl9W6v78tKWznN9S',
    drizzleImport: 'competitiveResearch',
    importOrder: 19,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      Type: { drizzleColumn: 'type', handler: 'select', note: 'Competitor | Inspiration' },
      Website: { drizzleColumn: 'website', handler: 'text' },
      Insta: { drizzleColumn: 'instagram', handler: 'text' },
      'FB Page': { drizzleColumn: 'facebookPage', handler: 'text' },
      'Meta Ads Library': { drizzleColumn: 'metaAdsLibrary', handler: 'text' },
      Analysis: { drizzleColumn: 'analysis', handler: 'text' },
    },
  },

  clientAssetFolders: {
    airtableTable: 'Client Assets Organisation',
    airtableTableId: 'tbldFmPU6AWg62Fll',
    drizzleImport: 'clientAssetFolders',
    importOrder: 20,
    fields: {
      'Name [Folder]': {
        drizzleColumn: 'name',
        handler: 'text',
        required: true,
        default: 'Untitled',
      },
      Description: { drizzleColumn: 'description', handler: 'text' },
      Location: { drizzleColumn: 'locationUrl', handler: 'text' },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Single-line text, not a link, so no brief_asset_folders rows can be derived; excluded in docs/decisions.md',
      },
    },
  },

  creativeDimensions: {
    airtableTable: '(Internal) Creative Dimensions',
    airtableTableId: 'tblli0Y76yJvG56zK',
    drizzleImport: 'creativeDimensions',
    importOrder: 21,
    fields: {
      Name: { drizzleColumn: 'name', handler: 'text', required: true, default: 'Untitled' },
      Dimensions: { drizzleColumn: 'dimensions', handler: 'text' },
      'Link Description': { drizzleColumn: 'linkDescription', handler: 'select' },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link; the junction/FK is written from Creative Design › Dimensions into creative_briefs.dimensions (by placement name) (the gate derives this from inverseLinkFieldId)',
      },
    },
  },
} as const;

export const JUNCTION_MAPPINGS = {
  anglePersonas: {
    sourceTable: 'angles',
    airtableField: null,
    note: 'Personas are on the Personas table linking to Angles, not vice versa. Handled by reading Personas.Angles reverse links.',
  },
  angleProducts: {
    sourceTable: 'angles',
    airtableField: null,
    note: 'Products link to Angles. Handled by reading Products.Angles reverse links.',
  },
  conceptAngles: {
    sourceTable: 'concepts',
    airtableField: 'Angle',
    note: 'Concepts.Angle is multipleRecordLinks to Angles table.',
  },
  conceptThemes: {
    sourceTable: 'concepts',
    airtableField: 'Theme',
    note: 'In Gratsi, Theme is multipleSelects (NOT a record link). Match by name against themes table.',
  },
  conceptCollections: {
    sourceTable: 'concepts',
    airtableField: 'Collection',
    note: 'Concepts.Collection is multipleRecordLinks to Collections table.',
  },
  creatorConcepts: {
    sourceTable: 'creators',
    airtableField: 'Concept to film',
    note: 'UGC Management."Concept to film" is multipleRecordLinks.',
  },
  creatorProducts: {
    sourceTable: 'creators',
    airtableField: 'Products',
    note: 'UGC Management.Products is multipleRecordLinks.',
  },
  // Prompt 3 (2026-10-01)
  copywritingCopyTypes: {
    sourceTable: 'copywriting',
    airtableField: 'Copy Type',
    note: 'Meta Copywriting."Copy Type" → copy_types rows.',
  },
  copywritingCampaigns: {
    sourceTable: 'copywriting',
    airtableField: 'Campaign Code',
    note: 'Meta Copywriting."Campaign Code" (prefers a single link).',
  },
  youtubeCopyCollections: { sourceTable: 'youtubeCopy', airtableField: 'Collections', note: '' },
  youtubeCopyProducts: { sourceTable: 'youtubeCopy', airtableField: 'Product', note: '' },
  youtubeCopyCampaigns: { sourceTable: 'youtubeCopy', airtableField: 'Campaign Code', note: '' },
  youtubeCopyCopyTypes: { sourceTable: 'youtubeCopy', airtableField: 'Copy Type', note: '' },
  creativeModuleAngles: {
    sourceTable: 'creativeModules',
    airtableField: 'Concepts',
    note: 'The field is NAMED Concepts but links the Gratsi ANGLES table.',
  },
  creativeModuleDesigns: {
    sourceTable: 'creativeModules',
    airtableField: '(Internal) Creative Design',
    note: '',
  },
  campaignConcepts: {
    sourceTable: 'campaignsOffers',
    airtableField: 'Angles',
    note: 'The field is NAMED Angles but links the Gratsi CONCEPTS table.',
  },
  emailCampaignCampaigns: {
    sourceTable: 'emailCampaigns',
    airtableField: 'Campaigns & Offers',
    note: '',
  },
  emailCampaignProducts: {
    sourceTable: 'emailCampaigns',
    airtableField: '(Internal) Product',
    note: '',
  },
  emailCampaignCollections: {
    sourceTable: 'emailCampaigns',
    airtableField: '(Internal) Collections',
    note: '',
  },
  emailFlowCampaigns: { sourceTable: 'emailFlows', airtableField: 'Campaigns & Offers', note: '' },
} as const;

/**
 * Every table of the live Gratsi base is imported as of 2026-10-01 (Prompt 3); the former
 * `SKIPPED_AIRTABLE_TABLES` list is gone with its last entry. What a table carries that the import
 * leaves behind is no longer declared here: the dry run's UNMAPPED-FIELDS report lists it from the
 * export itself.
 */

export const DRIZZLE_COLUMNS_WITHOUT_AIRTABLE_SOURCE = {
  products: ['collectionLink'],
  themes: ['category', 'referenceLinks', 'isActive'],
  campaignsOffers: ['productId'],
  personas: [
    'productId',
    'dayInTheLife',
    'painPoints',
    'successFactors',
    'perceivedBarriers',
    'buyingTriggers',
    'problemChallenge',
    'successTransformation',
    'triggerWords',
  ],
  angles: ['type', 'painPoints', 'usp'],
  concepts: ['adInspoLinks', 'formatsToCreate', 'internalStatus', 'clientStatus'],
  collections: ['productId', 'creativeDesign2Id'],
  creativeBriefs: [
    'campaignOfferId',
    'assetId',
    'version',
    'sequence',
    'inspoLinks',
    'adContent',
    'inspiration',
  ],
  copywriting: ['conceptId', 'productId', 'clickForAiSpellChecker', 'spellingFeedback'],
  creators: ['forPartnershipAds', 'internalAssetsStatus', 'conceptIds', 'productIds'],
  // The base's link from a report to a creative was deleted; only an orphaned lookup remains.
  creativeReporting: ['briefId'],
} as const;

export function coverageSummary(): {
  table: string;
  airtableFields: number;
  mapped: number;
  skipped: number;
  pct: number;
}[] {
  return Object.entries(TABLE_MAPPINGS).map(([key, mapping]) => {
    const fields = Object.values(mapping.fields);
    const total = fields.length;
    const mapped = fields.filter((f) => f.drizzleColumn !== null).length;
    const skipped = fields.filter((f) => f.handler === 'skip').length;
    return {
      table: key,
      airtableFields: total,
      mapped,
      skipped,
      pct: Math.round((mapped / Math.max(total - skipped, 1)) * 100),
    };
  });
}
