import { StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import {
  expiryRowClassName,
  expiryRowStyle,
  INTERNAL_ONLY_NOTE,
  PARTNERSHIP_COLUMNS,
  TONE_TEXT_CLASS,
  type PartnershipRow,
} from './fields';

interface PartnershipTableProps {
  readonly rows: readonly PartnershipRow[];
}

/**
 * The Partnership Ads table (PRD §5.8.1). A TABLE, not cards: these rows exist to be compared —
 * whose window lapses first, which one has an extension on it — and a countdown you have to hunt
 * across a grid for is the manual Slack reminder all over again.
 *
 * THE COUNTDOWN IS THE PAGE. §5.8.1 is one sentence of arithmetic ("activation + period +
 * extension = the date permission lapses") and one failure it exists to stop: an ad still running
 * from a creator's personal handle after the creator stopped agreeing to it. So the last column
 * carries the whole answer in `font-mono`, the row inside the highlight window gets a warn rule
 * down its left edge and a warn tint, and a lapsed row gets the same treatment in `bad` and reads
 * `Expired` rather than a negative number. Both come from `partnershipExpiry` in
 * `@tas/domain/creators` by way of `partnershipRow`; this component computes nothing and compares
 * nothing to a date.
 *
 * NO PRICE COLUMN. `partnership_price_per_30_days` is internal data (CLAUDE.md non-negotiable 10),
 * so it is absent here even though this is an internal page, and the note above the table says so —
 * an absence nobody explains is an absence somebody eventually "fixes".
 *
 * Presentational and stateless, so `/design-system` mounts the identical element.
 */
export function PartnershipTable({ rows }: PartnershipTableProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm text-text3" data-slot="partnership-internal-note">
        {INTERNAL_ONLY_NOTE}
      </p>

      <div className="min-w-0 overflow-hidden rounded-card border border-line bg-surface">
        <Table data-slot="partnership-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {PARTNERSHIP_COLUMNS.map((column) => (
                <TableHead key={column} className="whitespace-nowrap text-text3">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-slot="partnership-row"
                data-partnership-id={row.id}
                data-expiry-state={row.expiryState ?? 'none'}
                {...(row.nearExpiry ? { 'data-near-expiry': 'true' } : {})}
                className={expiryRowClassName(row.expiryState)}
                style={expiryRowStyle(row.expiryState)}
              >
                <TableCell className="font-medium text-text" data-slot="partnership-creator">
                  {row.name}
                </TableCell>
                <TableCell
                  className="font-mono text-[12px] whitespace-nowrap text-text2"
                  data-slot="partnership-handle"
                >
                  {row.instagramUsername}
                </TableCell>
                <TableCell data-slot="partnership-activity">
                  <StatusChip tone={row.activityTone} label={row.activityLabel} />
                </TableCell>
                <TableCell
                  className="font-mono text-[12px] whitespace-nowrap text-text2"
                  data-slot="partnership-activated"
                >
                  {row.activatedLabel}
                </TableCell>
                <TableCell className="whitespace-nowrap text-text2" data-slot="partnership-period">
                  {row.periodLabel}
                </TableCell>
                <TableCell
                  className={`font-mono text-[12px] whitespace-nowrap ${TONE_TEXT_CLASS[row.countdownTone]}`}
                  data-slot="partnership-countdown"
                >
                  {row.countdownLabel}
                </TableCell>
                <TableCell data-slot="partnership-notified">
                  <StatusChip tone={row.notifiedTone} label={row.notifiedLabel} />
                </TableCell>
                <TableCell data-slot="partnership-continue">
                  <StatusChip tone={row.continueTone} label={row.continueLabel} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
