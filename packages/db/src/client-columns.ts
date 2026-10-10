/**
 * The columns a CLIENT may ever see on a client-portal page, per source table (PRD §10 "which
 * fields appear", CLAUDE.md non-negotiable 10, `docs/design/sprint-06-client-field-allowlist.md`,
 * PRD §5.8.1 for the partnership fields). ALLOW-LIST, not deny-list: a column not named here never
 * leaves `loadCustomPageRows`, whatever a page's `column_config` says — the structural fix for the
 * 2026-10-10 F1 finding, where a template page with `column_config = []` would have drawn every
 * column of `creative_briefs`, internal status included, on every brand's portal.
 *
 * Keys are the Postgres column names (`client_status`), the spelling `column_config`, the resolver
 * and the portal route all use. `id` is always allowed: it is a uuid the page keys rows by, never a
 * fact about the brand. Never listed, on any table: `internal_*`, `*_cost`, `cost_usd`, `budget_*`,
 * `partnership_price_per_30_days`, `created_by`, `updated_by`, `deleted_at`, `legacy_airtable_id`,
 * the QA ticks and the spelling feedback.
 */
const ALWAYS = ['id'] as const;

export const CLIENT_VISIBLE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  creative_briefs: [
    'name',
    'type',
    'funnel',
    'platform',
    'design_file',
    'inspiration_image',
    'client_status',
    'client_status_note',
    'performance',
    'launched_at',
  ],
  concepts: [
    'name',
    'batch',
    'category',
    'concept_style',
    'script_idea',
    'description',
    'pain_points',
    'usp',
    'hook_examples',
    // `approval_status` is NOT here: retired by 0064/SMOKE-18, its stale values must never reach a client.
    'client_status',
    'client_comments',
    'client_approval_status',
  ],
  copywriting: [
    'copy_number',
    'primary_copy',
    'headline',
    'link_description',
    'cta',
    'funnel',
    'status',
    'client_comment',
    'client_approval_status',
  ],
  creators: [
    'name',
    'age_bracket',
    'gender',
    'profile_pic_url',
    'video_intro_url',
    'shipping_location',
    'tracking_number',
    'deadline',
    'client_status',
    'client_note',
    'raw_assets_url',
    // PRD §5.8.1, Partnership Ads Tracking (view / group / filter). The price per 30 days is a
    // partnership price and is never here (non-negotiable 10).
    'instagram_username',
    'for_partnership_ads',
    'partnership_activity',
    'partnership_activated_at',
    'partnership_period_days',
    'continue_working_with',
    'extension_days',
    'partnership_notes',
    'facebook_profile_url',
    'partnership_ended_at',
  ],
  collections: ['name', 'url'],
  products: ['name', 'link', 'collection_link'],
};

/** The allowed column names of one source table, `id` included; empty for an unknown table. */
export function clientVisibleColumns(sourceTableKey: string): ReadonlySet<string> {
  const listed = CLIENT_VISIBLE_COLUMNS[sourceTableKey];
  return new Set(listed === undefined ? [] : [...ALWAYS, ...listed]);
}

export function isClientVisibleColumn(sourceTableKey: string, columnKey: string): boolean {
  return clientVisibleColumns(sourceTableKey).has(columnKey);
}
