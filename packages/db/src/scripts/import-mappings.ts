/**
 * Complete Airtable → Drizzle field mapping for the Gratsi base (appllDG4OmkK2Hdnn).
 * Generated from the live Airtable schema + Drizzle schema audit on 2026-09-23.
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
      Angles: { drizzleColumn: null, handler: 'skip', note: 'Reverse link from angles' },
      'UGC Management': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      '(Internal) Creative Design': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      '(Internal) Creative Design 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Internal ref text',
      },
      'Youtube Copywriting': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      'Creative Sheet': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      'Email Campaigns Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link',
      },
      'Table 17': { drizzleColumn: null, handler: 'skip', note: 'Internal link' },
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
      'Promotional Ideas': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'No Drizzle column; richText field',
      },
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
      Collections: { drizzleColumn: null, handler: 'skip', note: 'Reverse link from collections' },
      Product: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'multipleLookupValues, not a direct link',
      },
      COPY: { drizzleColumn: null, handler: 'skip', note: 'Reverse link from copywriting' },
      Angles: { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      'Design attached': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      'Email Campaigns': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      'Email Campaigns Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link',
      },
      'Ads Copywriting copy': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
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
        drizzleColumn: 'emotionalTriggers',
        handler: 'richText',
        note: 'Closest match to emotionalTriggers',
      },
      Passion: {
        drizzleColumn: 'coreDesires',
        handler: 'richText',
        note: 'Closest match to coreDesires',
      },
      Angles: { drizzleColumn: null, handler: 'skip', note: 'Reverse link from angles' },
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
        drizzleColumn: null,
        handler: 'skip',
        note: 'No status column on angles; Drizzle uses potential + winning',
      },
      Potential: { drizzleColumn: 'potential', handler: 'select' },
      Description: { drizzleColumn: 'description', handler: 'text' },
      Creators: { drizzleColumn: null, handler: 'skip', note: 'Reverse link from creators' },
      Concepts: { drizzleColumn: null, handler: 'skip', note: 'Reverse link from concepts' },
      'Product (from Angles)': { drizzleColumn: null, handler: 'skip', note: 'Lookup field' },
      'Personas (from Angles)': { drizzleColumn: null, handler: 'skip', note: 'Lookup field' },
      '(Internal) Creative Modules': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'No Drizzle table for Creative Modules',
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
        note: 'Internal ref text',
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
      'Creative Sheet': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      '(Internal) Creative Design 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link',
      },
      'UGC Management copy': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      'Concepts copy': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
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
        handler: 'skip',
        note:
          'multipleSelects in Gratsi (not a record link). ' +
          'Cannot resolve to theme IDs. ' +
          'Match by name to themes table in Pass 2 if needed.',
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
      Performance: { drizzleColumn: null, handler: 'skip', note: 'Lookup field' },
      Product: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'multipleRecordLinks but no concept→product FK or junction in Drizzle',
      },
      Personas: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'multipleRecordLinks but no concept→persona FK or junction in Drizzle',
      },
      Status: {
        drizzleColumn: 'approvalStatus',
        handler: 'select',
        note: 'Airtable "Status" → approvalStatus. Map values to ConceptApprovalStatus',
      },
      Decription: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Typo in Airtable field name. No description column on concepts.',
      },
      Script: { drizzleColumn: 'scriptIdea', handler: 'richText' },
      Collection: {
        drizzleColumn: null,
        handler: 'multiLink',
        junctionTable: 'conceptCollections',
        note: 'Resolve collection IDs in Pass 2',
      },
      'Pain Points': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'No painPoints column on concepts (exists on angles)',
      },
      USP: {
        drizzleColumn: null,
        handler: 'skip',
        note: 'No usp column on concepts (exists on angles)',
      },
      Hooks: { drizzleColumn: 'hookExamples', handler: 'richText' },
      "Client's Comments": {
        drizzleColumn: null,
        handler: 'skip',
        note: 'No clientComments column on concepts',
      },
      'UGC Management': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Reverse link from creators; handled in creators import',
      },
      'Campaigns & Offers': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'No concept→campaign FK or junction in Drizzle',
      },
      '(Internal) Creative Design': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      'UGC Management copy': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
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
        drizzleColumn: 'copywritingId',
        handler: 'singleLink',
        note: 'Resolve copywriting ID in Pass 2',
      },
      'Campaigns & Offers': {
        drizzleColumn: 'campaignId',
        handler: 'singleLink',
        note: 'Resolve campaign ID in Pass 2 — existing script has a BUG: resolves against conceptMap',
      },
      'Creative Sheet': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      Angles: {
        drizzleColumn: 'angleId',
        handler: 'singleLink',
        note: 'Resolve angle ID in Pass 2',
      },
      '(Internal) Product': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'singleLineText in Gratsi, not a record link. Cannot resolve.',
      },
      '(Internal) Creative Design': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
      '(Internal) Creative Design 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Internal ref text',
      },
      'Table 17': { drizzleColumn: null, handler: 'skip', note: 'Internal link' },
      'Email Campaigns Management copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Internal ref text',
      },
      'Ads Copywriting copy': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
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
        note: 'No Creative Modules table in Drizzle',
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
      'Creative Sheet': { drizzleColumn: null, handler: 'skip', note: 'Reverse link' },
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
      Collections: { drizzleColumn: null, handler: 'skip', note: 'Resolved through brief' },
      Product: { drizzleColumn: null, handler: 'skip', note: 'Text ref, not a link' },
      Angle: { drizzleColumn: null, handler: 'skip', note: 'Text ref, not a link' },
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
      'Campaign Code': { drizzleColumn: null, handler: 'skip', note: 'Link to campaigns' },
      Offer: { drizzleColumn: null, handler: 'skip', note: 'Lookup from campaign' },
      'Campaign (from Campaign)': { drizzleColumn: null, handler: 'skip', note: 'Lookup' },
      'Code (from Campaign)': { drizzleColumn: null, handler: 'skip', note: 'Lookup' },
      Funnel: { drizzleColumn: 'funnel', handler: 'select', note: 'Map to CopyFunnel values' },
      'Copy Type': { drizzleColumn: null, handler: 'skip', note: 'No Drizzle column' },
      "Client's Comment": { drizzleColumn: 'clientComment', handler: 'text' },
      Creative: {
        drizzleColumn: 'creativeBriefId',
        handler: 'singleLink',
        note: 'Resolve creative brief ID in Pass 2',
      },
      '(Internal) Creative Design': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Alternate link to creative; use Creative field instead',
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
      'Creative Reporting': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      'Creative Sheet': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      '(Internal) Product': { drizzleColumn: null, handler: 'skip', note: 'Internal ref text' },
      '⚠️ Please Change the Status of the copy': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'UI instruction, not data',
      },
      '(Internal) Creative Design 2': {
        drizzleColumn: null,
        handler: 'skip',
        note: 'Internal ref text',
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
      'Payment Date': { drizzleColumn: null, handler: 'skip', note: 'No Drizzle column' },
      Concepts: { drizzleColumn: null, handler: 'skip', note: 'Reverse link from concepts' },
      'Creator Info Request': { drizzleColumn: null, handler: 'skip', note: 'No Drizzle column' },
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
      'Slack Notified ': { drizzleColumn: null, handler: 'skip', note: 'No Drizzle column' },
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
} as const;

export const SKIPPED_AIRTABLE_TABLES = [
  {
    name: 'Email Campaigns Management',
    reason: 'No Drizzle table. Email management is out of scope for V0.',
  },
  {
    name: 'Email Flows Management',
    reason: 'No Drizzle table. Email flows out of scope for V0.',
  },
  {
    name: 'Youtube Copywriting',
    reason:
      'Same structure as Meta Copywriting. Import separately if needed, mapping to same copywriting table.',
  },
  {
    name: 'Creative Sheet',
    reason: 'View/reporting layer. All data originates from Creative Design records.',
  },
  {
    name: '(Internal) Creative Modules',
    reason: 'No Drizzle table. Module grouping not in V0.',
  },
  {
    name: 'Creative Reporting',
    reason:
      'Partially maps to adMetrics but field structure differs significantly. Import manually.',
  },
  {
    name: 'SM Campaign Management Feed',
    reason: 'No Drizzle table. Social media scheduling out of scope.',
  },
  {
    name: '(Internal) Creative Dimensions',
    reason:
      'Drizzle table exists (creativeDimensions) but only holds dimension name strings. Import if needed.',
  },
  {
    name: '(Internal) Copy Type',
    reason: 'No Drizzle table. Copy types are not separate records in V0.',
  },
  {
    name: 'Competitive research',
    reason: 'Maps loosely to competitorAds but field structure differs. Import manually.',
  },
  {
    name: 'Client Assets Organisation',
    reason: 'No Drizzle table. Asset organization is folder-level metadata.',
  },
] as const;

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
