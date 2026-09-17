/**
 * The one closed vocabulary a copy row carries: its call to action (PRD §5.11).
 *
 * `@tas/db` owns the storage vocabulary (`copyCtas` in `packages/db/src/schema/enums.ts`, a tuple
 * plus its `pgEnum`, declared exactly as `angleFormats` is); this module owns how those values are
 * *presented* — the fixed render order and the human label. The keys are the stored values verbatim,
 * so a row read out of the database indexes straight into this table with no mapping layer in
 * between and the panel's dropdown is just `COPY_CTAS.map(...)`, exactly the arrangement
 * `ANGLE_FORMATS` documents.
 *
 * A component imports `COPY_CTAS` and never writes `'Shop Now'` itself, the same way it never writes
 * a status string. None of this is a state: a CTA is a choice on a row, and the states a copy row
 * moves through live in `../state/copy-status`.
 */

export interface CopyCtaEntry {
  /** The value stored in `copywriting.cta`, verbatim. */
  readonly key: CopyCtaKey;
  readonly label: string;
}

/**
 * The six CTAs, in the order PRD §5.11 lists them and the dropdown renders them: `Shop Now` first
 * because it is both the PRD's first entry and the column's default (`COPY_CTA_DEFAULT`).
 *
 * Label and key are identical here — the PRD wrote these as the words that appear on the button, so
 * there is nothing to translate — but the pair is kept because every other vocabulary in this
 * package is a `{ key, label }` table and a caller should not have to know which kind it has.
 */
export const COPY_CTAS = [
  { key: 'Shop Now', label: 'Shop Now' },
  { key: 'Learn More', label: 'Learn More' },
  { key: 'Get Offer', label: 'Get Offer' },
  { key: 'Get Directions', label: 'Get Directions' },
  { key: 'Visit Us', label: 'Visit Us' },
  { key: 'Download', label: 'Download' },
] as const satisfies readonly { key: string; label: string }[];

export type CopyCtaKey = (typeof COPY_CTAS)[number]['key'];

/** The CTA a row gets when nobody chooses one. `@tas/db`'s `COPY_CTA_DEFAULT` is this key, copied. */
export const COPY_CTA_INITIAL: CopyCtaKey = COPY_CTAS[0].key;

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const COPY_CTA_KEYS: readonly CopyCtaKey[] = COPY_CTAS.map((entry) => entry.key);

export function isCopyCta(value: string): value is CopyCtaKey {
  return COPY_CTA_KEYS.includes(value as CopyCtaKey);
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function copyCtaEntry(value: string): CopyCtaEntry | undefined {
  return COPY_CTAS.find((entry) => entry.key === value);
}

/** The human label for a stored CTA; total for the same reason `copyStatusLabel` is. */
export function copyCtaLabel(value: string): string {
  return copyCtaEntry(value)?.label ?? value;
}
