import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLIENT_STATUS } from '@tas/domain/state';
import type { PipelineSummary } from '@tas/domain';

import { OverviewDashboard } from './overview-dashboard';

/**
 * The Pipeline section's status tiles, held to one rule: every key a tile is handed resolves to
 * its vocabulary's label, never to the em dash. The smoke test of 2026-10-10 caught the Creative
 * Sheet tile showing "—" for `launched`, `revisions_needed`, `revisions_submitted` and
 * `pending_for_approval`: since the single-source cutover the sheet's `status` IS the brief's
 * `client_status` (`creative-sheet-items.ts`), six values, and the tile still resolved them through
 * the four-value `clientApprovalLabel`. The counts here cover every `CLIENT_STATUS` key, so a key
 * added to the vocabulary later fails this test rather than reading as a dash.
 */
const EVERY_CLIENT_STATUS: Record<string, number> = Object.fromEntries(
  CLIENT_STATUS.map((entry, index) => [entry.key, index + 1]),
);

const SUMMARY: PipelineSummary = {
  briefs: { total: 0, byInternalStatus: {}, byClientStatus: {} },
  concepts: { total: 0, byInternalStatus: {}, byClientStatus: {} },
  creativeSheet: { total: 21, byInternalStatus: {}, byStatus: EVERY_CLIENT_STATUS },
  copywriting: { total: 0, byStatus: {} },
  creators: { total: 0, byInternalStatus: {}, byClientStatus: {} },
};

/** The chip labels the markup carries, in render order: `Label (count)` per status. */
function chipLabels(markup: string): string[] {
  return [...markup.matchAll(/data-slot="status-chip"[^>]*>([^<]+)<\/span>/g)].map(
    (m) => m[1] ?? '',
  );
}

describe('OverviewDashboard', () => {
  it('labels every client status on the Creative Sheet tile from CLIENT_STATUS — never a dash', () => {
    const labels = chipLabels(renderToStaticMarkup(<OverviewDashboard summary={SUMMARY} />));

    expect(labels).toMatchInlineSnapshot(`
      [
        "Pending for Approval (1)",
        "Approved (2)",
        "Revisions Needed (3)",
        "Revisions Submitted (4)",
        "Disapproved (5)",
        "Launched (6)",
      ]
    `);
    expect(labels.some((label) => label.startsWith('—'))).toBe(false);
    for (const entry of CLIENT_STATUS) {
      expect(labels).toContain(`${entry.label} (${String(EVERY_CLIENT_STATUS[entry.key])})`);
    }
  });
});
